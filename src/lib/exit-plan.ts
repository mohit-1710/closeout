import Decimal from "decimal.js";

/** Financial inputs/outputs never pass through a JavaScript floating-point number. */
export type DecimalString = string;
export type ExitOrderType = "FAK" | "FOK";

export interface OrderbookBid {
  price: DecimalString;
  size: DecimalString;
}

export type SellFeeModel =
  | { kind: "none" }
  | { kind: "unknown"; reason?: string }
  | {
      kind: "known";
      /** Decimal coefficient, e.g. "0.05", NOT a percentage or basis-point integer. */
      rate: DecimalString;
      exponent: number;
      /** Omit for the exact curve. If supplied, round each depth step half-up. */
      roundingDecimals?: number;
    };

export interface SnapshotFreshnessInput {
  timestampMs: number;
  nowMs: number;
  maxAgeMs: number;
  /** Explicit tolerated clock skew; defaults to zero. */
  allowedFutureSkewMs?: number;
}

export interface SnapshotFreshness {
  status: "fresh" | "stale" | "future" | "invalid" | "missing";
  isFresh: boolean;
  ageMs: number | null;
  clockSkewMs: number | null;
  maxAgeMs: number | null;
  reason: string | null;
}

export interface ExitPlanInput {
  shares: DecimalString;
  /** Minimum GROSS price per share, inclusive. Not an after-fee receipt guarantee. */
  floorPrice: DecimalString;
  /** Minimum total modeled proceeds after the supplied fee; defaults to zero. */
  minNetReceipt?: DecimalString;
  bids: readonly OrderbookBid[];
  orderType: ExitOrderType;
  fee: SellFeeModel;
  /** Missing time leaves depth visible, but blocks the snapshot policy check. */
  snapshot?: SnapshotFreshnessInput;
}

export interface ExitFillEstimate {
  filledShares: DecimalString;
  remainingShares: DecimalString;
  grossReceipt: DecimalString;
  fees: DecimalString | null;
  netReceipt: DecimalString | null;
  /** Gross, share-weighted average, rounded DOWN to at most 18 decimal places. */
  weightedAveragePrice: DecimalString | null;
  worstFillPrice: DecimalString | null;
}

export interface ExitDepthStep {
  /** Index in the original input, before the non-mutating descending sort. */
  sourceIndex: number;
  price: DecimalString;
  availableShares: DecimalString;
  filledShares: DecimalString;
  remainingShares: DecimalString;
  grossReceipt: DecimalString;
  fees: DecimalString | null;
  netReceipt: DecimalString | null;
  cumulativeFilledShares: DecimalString;
  cumulativeGrossReceipt: DecimalString;
  cumulativeFees: DecimalString | null;
  cumulativeNetReceipt: DecimalString | null;
  exclusionReason: "below-floor" | "requested-amount-filled" | null;
}

export type ExitPlanBlocker =
  | "unknown-fees"
  | "snapshot-missing"
  | "snapshot-stale"
  | "snapshot-future"
  | "snapshot-invalid"
  | "no-liquidity-at-floor"
  | "insufficient-depth-for-fok"
  | "min-net-receipt-not-met";

export interface ExitPlan {
  valid: true;
  indicative: true;
  status: "full" | "partial" | "no-fill" | "blocked";
  orderType: ExitOrderType;
  requestedShares: DecimalString;
  floorPrice: DecimalString;
  minNetReceipt: DecimalString;
  /** Candidate sweep before order-type, freshness and receipt policy gates. */
  available: ExitFillEstimate;
  /** Zero if a gate blocks the plan or FOK lacks depth. Never a recorded fill. */
  estimate: ExitFillEstimate;
  /** Candidate ladder, retained even when the proposed plan is blocked. */
  depthSteps: ExitDepthStep[];
  freshness: SnapshotFreshness;
  /** Based on FAK/FOK depth semantics, BEFORE freshness/receipt policy blocking. */
  meetsMinNetReceipt: boolean | null;
  passesSnapshotChecks: boolean;
  /** A passing estimate cannot enforce a future whole-order net receipt. */
  minimumReceiptIsGuaranteed: false;
  blockers: ExitPlanBlocker[];
  warnings: string[];
}

export interface ExitPlanIssue {
  code:
    | "invalid-input"
    | "invalid-decimal"
    | "out-of-range"
    | "invalid-order-type"
    | "invalid-bids"
    | "duplicate-price"
    | "invalid-fee-model"
    | "unsupported-exponent"
    | "invalid-fee-rounding"
    | "fee-exceeds-proceeds";
  path: string;
  message: string;
}

export interface InvalidExitPlan {
  valid: false;
  indicative: true;
  issues: ExitPlanIssue[];
}

export type ExitPlanResult = ExitPlan | InvalidExitPlan;

// With <=18 integer/fractional digits, <=10,000 rows and integer exponent <=8,
// 512 significant digits leave all products and sums exact. Only averages divide.
// Clone avoids changing Decimal's global configuration in other application code.
const D = Decimal.clone({ precision: 512, rounding: Decimal.ROUND_HALF_UP });
const DECIMAL_INPUT = /^\d{1,18}(?:\.\d{1,18})?$/;
const MAX_BID_LEVELS = 10_000;
const ZERO = new D(0);
const ONE = new D(1);

type ParsedFee =
  | { kind: "none" }
  | { kind: "unknown"; reason?: string }
  | { kind: "known"; rate: Decimal; exponent: number; roundingDecimals?: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function decimalText(value: Decimal): DecimalString {
  return value.isZero() ? "0" : value.toFixed();
}

function parseDecimal(
  value: unknown,
  path: string,
  issues: ExitPlanIssue[],
): Decimal | null {
  if (typeof value !== "string" || !DECIMAL_INPUT.test(value)) {
    issues.push({
      code: "invalid-decimal",
      path,
      message: "Use a nonnegative decimal string with at most 18 digits on either side of the decimal point.",
    });
    return null;
  }
  return new D(value);
}

function parseFee(value: unknown, issues: ExitPlanIssue[]): ParsedFee | null {
  if (!isRecord(value)) {
    issues.push({ code: "invalid-fee-model", path: "fee", message: "Provide known, explicitly zero, or unknown fees." });
    return null;
  }
  if (value.kind === "none") return { kind: "none" };
  if (value.kind === "unknown") {
    return { kind: "unknown", reason: typeof value.reason === "string" ? value.reason : undefined };
  }
  if (value.kind !== "known") {
    issues.push({ code: "invalid-fee-model", path: "fee.kind", message: "Fee kind must be known, none, or unknown." });
    return null;
  }
  const rate = parseDecimal(value.rate, "fee.rate", issues);
  if (rate?.gt(ONE)) {
    issues.push({ code: "out-of-range", path: "fee.rate", message: "Fee rate must be a decimal coefficient between 0 and 1." });
  }
  const exponent = value.exponent;
  if (typeof exponent !== "number" || !Number.isInteger(exponent) || exponent < 0 || exponent > 8) {
    issues.push({ code: "unsupported-exponent", path: "fee.exponent", message: "An explicitly supplied integer fee exponent from 0 to 8 is required." });
  }
  const roundingDecimals = value.roundingDecimals;
  if (roundingDecimals !== undefined &&
      (typeof roundingDecimals !== "number" || !Number.isInteger(roundingDecimals) || roundingDecimals < 0 || roundingDecimals > 18)) {
    issues.push({ code: "invalid-fee-rounding", path: "fee.roundingDecimals", message: "Fee rounding precision must be an integer from 0 to 18, or omitted for the exact curve." });
  }
  if (!rate || issues.length > 0) return null;
  return { kind: "known", rate, exponent: exponent as number, roundingDecimals: roundingDecimals as number | undefined };
}

/** No Date.now(), I/O or mutable clock state: the caller supplies the observation time. */
export function checkSnapshotFreshness(input?: SnapshotFreshnessInput): SnapshotFreshness {
  const failure = (status: "invalid" | "missing", reason: string): SnapshotFreshness => ({
    status, isFresh: false, ageMs: null, clockSkewMs: null, maxAgeMs: null, reason,
  });
  if (input === undefined) return failure("missing", "The snapshot timestamp and age policy are required.");
  if (!isRecord(input)) return failure("invalid", "Snapshot timing must be an object.");
  const { timestampMs, nowMs, maxAgeMs } = input;
  const skew = input.allowedFutureSkewMs === undefined ? 0 : input.allowedFutureSkewMs;
  if (![timestampMs, nowMs, maxAgeMs, skew].every((v) =>
    typeof v === "number" && Number.isSafeInteger(v) && v >= 0)) {
    return failure("invalid", "Timestamps and age limits must be nonnegative safe integers in milliseconds.");
  }
  const ageMs = nowMs - timestampMs;
  const clockSkewMs = Math.max(0, -ageMs);
  if (clockSkewMs > skew) {
    return { status: "future", isFresh: false, ageMs, clockSkewMs, maxAgeMs, reason: "The snapshot is ahead of the supplied clock beyond the allowed skew." };
  }
  if (ageMs > maxAgeMs) {
    return { status: "stale", isFresh: false, ageMs, clockSkewMs, maxAgeMs, reason: "The snapshot exceeds the maximum permitted age." };
  }
  return { status: "fresh", isFresh: true, ageMs: Math.max(0, ageMs), clockSkewMs, maxAgeMs, reason: null };
}

function modeledFee(shares: Decimal, price: Decimal, fee: ParsedFee): Decimal | null {
  if (fee.kind === "unknown") return null;
  if (fee.kind === "none" || shares.isZero()) return ZERO;
  const raw = shares.mul(fee.rate).mul(price.mul(ONE.minus(price)).pow(fee.exponent));
  return fee.roundingDecimals === undefined
    ? raw
    : raw.toDecimalPlaces(fee.roundingDecimals, Decimal.ROUND_HALF_UP);
}

function emptyEstimate(shares: Decimal, feesKnown: boolean): ExitFillEstimate {
  return {
    filledShares: "0", remainingShares: decimalText(shares), grossReceipt: "0",
    fees: feesKnown ? "0" : null, netReceipt: feesKnown ? "0" : null,
    weightedAveragePrice: null, worstFillPrice: null,
  };
}

/**
 * Indicative sell-side sweep of a validated aggregated bid snapshot.
 * Does not place orders, assert access/ownership, or guarantee future fills/receipts.
 */
export function calculateExitPlan(input: ExitPlanInput): ExitPlanResult {
  const issues: ExitPlanIssue[] = [];
  if (!isRecord(input)) {
    return { valid: false, indicative: true, issues: [{ code: "invalid-input", path: "", message: "An exit-plan object is required." }] };
  }
  const shares = parseDecimal(input.shares, "shares", issues);
  const floorPrice = parseDecimal(input.floorPrice, "floorPrice", issues);
  const minNetReceipt = parseDecimal(input.minNetReceipt === undefined ? "0" : input.minNetReceipt, "minNetReceipt", issues);
  if (shares?.isZero()) issues.push({ code: "out-of-range", path: "shares", message: "Shares to sell must be greater than zero." });
  if (floorPrice?.gt(ONE)) issues.push({ code: "out-of-range", path: "floorPrice", message: "The price floor must be between 0 and 1, inclusive." });
  if (input.orderType !== "FAK" && input.orderType !== "FOK") {
    issues.push({ code: "invalid-order-type", path: "orderType", message: "Select FAK or FOK explicitly." });
  }

  const levels: { price: Decimal; size: Decimal; sourceIndex: number }[] = [];
  const seenPrices = new Set<string>();
  if (!Array.isArray(input.bids) || input.bids.length > MAX_BID_LEVELS) {
    issues.push({ code: "invalid-bids", path: "bids", message: `Provide an array of at most ${MAX_BID_LEVELS} aggregated bid levels.` });
  } else {
    Array.from(input.bids).forEach((bid: unknown, sourceIndex: number) => {
      const path = `bids[${sourceIndex}]`;
      if (!isRecord(bid)) {
        issues.push({ code: "invalid-bids", path, message: "Each bid requires a price and size." });
        return;
      }
      const price = parseDecimal(bid.price, `${path}.price`, issues);
      const size = parseDecimal(bid.size, `${path}.size`, issues);
      if (price && (price.lte(ZERO) || price.gte(ONE))) {
        issues.push({ code: "out-of-range", path: `${path}.price`, message: "An open-book bid must have a price strictly between 0 and 1." });
      }
      if (size?.isZero()) issues.push({ code: "out-of-range", path: `${path}.size`, message: "Bid size must be greater than zero." });
      if (price) {
        const key = decimalText(price);
        if (seenPrices.has(key)) {
          issues.push({ code: "duplicate-price", path: `${path}.price`, message: "Duplicate aggregated price level; verify the source instead of double-counting liquidity." });
        }
        seenPrices.add(key);
      }
      if (price && size) levels.push({ price, size, sourceIndex });
    });
  }
  const fee = parseFee(input.fee, issues);
  if (issues.length > 0 || !shares || !floorPrice || !minNetReceipt || !fee) {
    return { valid: false, indicative: true, issues };
  }

  // Never trust the feed's ordering, and never mutate its array or nested bids.
  levels.sort((a, b) => b.price.comparedTo(a.price));
  const feesKnown = fee.kind !== "unknown";
  let remaining = shares;
  let filled = ZERO;
  let gross = ZERO;
  let fees = ZERO;
  let worst: Decimal | null = null;
  const depthSteps: ExitDepthStep[] = [];

  for (const level of levels) {
    const exclusionReason = level.price.lt(floorPrice)
      ? "below-floor" as const
      : remaining.isZero() ? "requested-amount-filled" as const : null;
    const take = exclusionReason ? ZERO : D.min(level.size, remaining);
    const stepGross = take.mul(level.price);
    const stepFee = modeledFee(take, level.price, fee);
    if (stepFee?.gt(stepGross)) {
      return {
        valid: false, indicative: true,
        issues: [{ code: "fee-exceeds-proceeds", path: `bids[${level.sourceIndex}]`, message: "This fee model or rounding would charge more than this fill's proceeds." }],
      };
    }
    remaining = remaining.minus(take);
    filled = filled.plus(take);
    gross = gross.plus(stepGross);
    if (stepFee) fees = fees.plus(stepFee);
    if (take.gt(ZERO)) worst = level.price;
    depthSteps.push({
      sourceIndex: level.sourceIndex,
      price: decimalText(level.price), availableShares: decimalText(level.size),
      filledShares: decimalText(take), remainingShares: decimalText(remaining),
      grossReceipt: decimalText(stepGross), fees: stepFee === null ? null : decimalText(stepFee),
      netReceipt: stepFee === null ? null : decimalText(stepGross.minus(stepFee)),
      cumulativeFilledShares: decimalText(filled), cumulativeGrossReceipt: decimalText(gross),
      cumulativeFees: feesKnown ? decimalText(fees) : null,
      cumulativeNetReceipt: feesKnown ? decimalText(gross.minus(fees)) : null,
      exclusionReason,
    });
  }

  const available: ExitFillEstimate = {
    filledShares: decimalText(filled), remainingShares: decimalText(remaining),
    grossReceipt: decimalText(gross), fees: feesKnown ? decimalText(fees) : null,
    netReceipt: feesKnown ? decimalText(gross.minus(fees)) : null,
    weightedAveragePrice: filled.isZero() ? null : decimalText(gross.div(filled).toDecimalPlaces(18, Decimal.ROUND_DOWN)),
    worstFillPrice: worst === null ? null : decimalText(worst),
  };
  const zero = emptyEstimate(shares, feesKnown);
  const fokInsufficient = input.orderType === "FOK" && remaining.gt(ZERO);
  const orderEstimate = fokInsufficient ? zero : available;
  const meetsMinNetReceipt = orderEstimate.netReceipt === null
    ? null : new D(orderEstimate.netReceipt).gte(minNetReceipt);
  const freshness = checkSnapshotFreshness(input.snapshot);
  const blockers: ExitPlanBlocker[] = [];
  if (!feesKnown) blockers.push("unknown-fees");
  if (freshness.status !== "fresh") blockers.push(`snapshot-${freshness.status}`);
  if (filled.isZero()) blockers.push("no-liquidity-at-floor");
  else if (fokInsufficient) blockers.push("insufficient-depth-for-fok");
  if (meetsMinNetReceipt === false) blockers.push("min-net-receipt-not-met");

  // A minimum-receipt veto is a policy block, not a claim that FAK enforces it.
  const policyBlocked = !feesKnown || !freshness.isFresh ||
    (!fokInsufficient && filled.gt(ZERO) && meetsMinNetReceipt === false);
  const status: ExitPlan["status"] = policyBlocked ? "blocked"
    : (filled.isZero() || fokInsufficient) ? "no-fill"
    : remaining.isZero() ? "full" : "partial";
  const warnings = [
    "Indicative order-book snapshot only; prices, depth, fees and matching delays can change before execution.",
    "Net receipt subtracts only the supplied sell-fee model; gas, builder, intermediary and conversion charges are not included.",
    "A passing minimum-receipt check is not an enforced or guaranteed whole-order receipt, including for FAK partial fills.",
  ];
  if (fee.kind === "known") {
    warnings.push(fee.roundingDecimals === undefined
      ? "Fees use the unrounded curve; actual match-level rounding and splitting can change the receipt."
      : "Fees assume half-up rounding once per displayed price level; actual matches may split that level and round differently.");
  }
  if (fee.kind === "unknown" && fee.reason) warnings.push(`Fee information unavailable: ${fee.reason}`);

  return {
    valid: true, indicative: true, status, orderType: input.orderType,
    requestedShares: decimalText(shares), floorPrice: decimalText(floorPrice),
    minNetReceipt: decimalText(minNetReceipt), available,
    estimate: policyBlocked ? zero : orderEstimate,
    depthSteps, freshness, meetsMinNetReceipt,
    passesSnapshotChecks: blockers.length === 0,
    minimumReceiptIsGuaranteed: false, blockers, warnings,
  };
}
