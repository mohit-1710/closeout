import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import {
  calculateExitPlan,
  checkSnapshotFreshness,
  type ExitPlan,
  type ExitPlanInput,
  type ExitPlanResult,
  type SnapshotFreshnessInput,
} from "./exit-plan";

const SNAPSHOT: SnapshotFreshnessInput = {
  timestampMs: 1_789_200_000_000,
  nowMs: 1_789_200_001_000,
  maxAgeMs: 15_000,
};

function fixture(overrides: Partial<ExitPlanInput> = {}): ExitPlanInput {
  return {
    shares: "100",
    floorPrice: "0.5",
    orderType: "FAK",
    fee: { kind: "known", rate: "0.05", exponent: 1 },
    snapshot: { ...SNAPSHOT },
    // Deliberately unsorted; only 30 of the 100 shares at 0.55 should be used.
    bids: [
      { price: "0.55", size: "100" },
      { price: "0.65", size: "40" },
      { price: "0.60", size: "30" },
    ],
    ...overrides,
  };
}

function valid(result: ExitPlanResult): ExitPlan {
  expect(result.valid).toBe(true);
  if (!result.valid) throw new Error(JSON.stringify(result.issues));
  return result;
}

describe("sell-side exit estimates", () => {
  it("sweeps highest bids first and reconciles per-level fees and final proceeds", () => {
    const plan = valid(calculateExitPlan(fixture()));
    expect(plan.status).toBe("full");
    expect(plan.passesSnapshotChecks).toBe(true);
    expect(plan.estimate).toEqual({
      filledShares: "100",
      remainingShares: "0",
      grossReceipt: "60.5",
      fees: "1.18625",
      netReceipt: "59.31375",
      weightedAveragePrice: "0.605",
      worstFillPrice: "0.55",
    });
    expect(plan.depthSteps.map((s) => [s.price, s.filledShares, s.fees])).toEqual([
      ["0.65", "40", "0.455"],
      ["0.6", "30", "0.36"],
      ["0.55", "30", "0.37125"],
    ]);
    expect(plan.depthSteps.at(-1)?.cumulativeNetReceipt).toBe(plan.estimate.netReceipt);
    expect(plan.indicative).toBe(true);
    expect(plan.minimumReceiptIsGuaranteed).toBe(false);
  });

  it("counts a bid exactly at the price floor and excludes lower liquidity", () => {
    const plan = valid(calculateExitPlan(fixture({ floorPrice: "0.6" })));
    expect(plan.status).toBe("partial");
    expect(plan.estimate).toEqual({
      filledShares: "70",
      remainingShares: "30",
      grossReceipt: "44",
      fees: "0.815",
      netReceipt: "43.185",
      weightedAveragePrice: "0.628571428571428571",
      worstFillPrice: "0.6",
    });
    expect(plan.depthSteps[2]).toMatchObject({
      exclusionReason: "below-floor",
      filledShares: "0",
      remainingShares: "30",
      cumulativeFilledShares: "70",
      cumulativeGrossReceipt: "44",
    });
  });

  it("models FOK as no fill when the eligible book is short, while preserving available depth", () => {
    const plan = valid(calculateExitPlan(fixture({ floorPrice: "0.6", orderType: "FOK" })));
    expect(plan.status).toBe("no-fill");
    expect(plan.blockers).toEqual(["insufficient-depth-for-fok"]);
    expect(plan.available.filledShares).toBe("70");
    expect(plan.available.netReceipt).toBe("43.185");
    expect(plan.estimate).toEqual({
      filledShares: "0",
      remainingShares: "100",
      grossReceipt: "0",
      fees: "0",
      netReceipt: "0",
      weightedAveragePrice: null,
      worstFillPrice: null,
    });
    expect(plan.passesSnapshotChecks).toBe(false);
  });

  it("permits FOK at exactly sufficient depth", () => {
    const plan = valid(
      calculateExitPlan(fixture({ shares: "70", floorPrice: "0.6", orderType: "FOK" })),
    );
    expect(plan.status).toBe("full");
    expect(plan.estimate).toEqual(plan.available);
    expect(plan.passesSnapshotChecks).toBe(true);
  });

  it.each([{ bids: [] }, { bids: [{ price: "0.49", size: "1000" }] }])(
    "returns no fill for absent eligible bids: %j",
    ({ bids }) => {
      const plan = valid(calculateExitPlan(fixture({ bids })));
      expect(plan.status).toBe("no-fill");
      expect(plan.estimate.filledShares).toBe("0");
      expect(plan.estimate.remainingShares).toBe("100");
      expect(plan.estimate.netReceipt).toBe("0");
      expect(plan.estimate.weightedAveragePrice).toBeNull();
      expect(plan.blockers).toContain("no-liquidity-at-floor");
    },
  );

  it("does not include excess depth after the requested shares are filled", () => {
    const plan = valid(calculateExitPlan(fixture({ shares: "10" })));
    expect(plan.estimate.filledShares).toBe("10");
    expect(plan.estimate.worstFillPrice).toBe("0.65");
    expect(plan.depthSteps[1].exclusionReason).toBe("requested-amount-filled");
    expect(plan.depthSteps[2].cumulativeFilledShares).toBe("10");
  });

  it("keeps decimal shares exact without binary floating-point dust", () => {
    const plan = valid(
      calculateExitPlan(
        fixture({
          shares: "0.3",
          fee: { kind: "none" },
          bids: [
            { price: "0.5", size: "0.2" },
            { price: "0.6", size: "0.1" },
          ],
        }),
      ),
    );
    expect(plan.estimate.filledShares).toBe("0.3");
    expect(plan.estimate.remainingShares).toBe("0");
    expect(plan.estimate.grossReceipt).toBe("0.16");
    expect(plan.estimate.weightedAveragePrice).toBe("0.533333333333333333");
  });

  it("preserves exact products near the supported 18-digit boundaries", () => {
    const amount = "999999999999999999.999999999999999999";
    const plan = valid(
      calculateExitPlan(
        fixture({
          shares: amount,
          fee: { kind: "none" },
          bids: [{ price: "0.999999999999999999", size: amount }],
        }),
      ),
    );
    expect(plan.estimate.grossReceipt).toBe(
      "999999999999999998.999999999999999999000000000000000001",
    );
    expect(plan.estimate.remainingShares).toBe("0");
  });

  it("does not mutate frozen feed data or depend on Decimal's global precision", () => {
    const input = fixture();
    input.bids.forEach(Object.freeze);
    Object.freeze(input.bids);
    Object.freeze(input.fee);
    Object.freeze(input.snapshot);
    Object.freeze(input);
    const before = JSON.stringify(input);
    const originalPrecision = Decimal.precision;
    try {
      Decimal.set({ precision: 3 });
      expect(valid(calculateExitPlan(input)).estimate.netReceipt).toBe("59.31375");
      expect(JSON.stringify(input)).toBe(before);
      expect(Decimal.precision).toBe(3);
    } finally {
      Decimal.set({ precision: originalPrecision });
    }
  });
});

describe("explicit fee and minimum-receipt policy", () => {
  it("matches the official current sports example at 100 shares and price 0.50", () => {
    const plan = valid(calculateExitPlan(fixture({ bids: [{ price: "0.5", size: "100" }] })));
    expect(plan.estimate.grossReceipt).toBe("50");
    expect(plan.estimate.fees).toBe("1.25");
    expect(plan.estimate.netReceipt).toBe("48.75");
  });

  it("applies a supplied exponent per price level rather than to an average price", () => {
    const plan = valid(
      calculateExitPlan(
        fixture({
          shares: "20",
          floorPrice: "0.1",
          fee: { kind: "known", rate: "0.2", exponent: 2 },
          bids: [
            { price: "0.25", size: "10" },
            { price: "0.75", size: "10" },
          ],
        }),
      ),
    );
    expect(plan.estimate.grossReceipt).toBe("10");
    expect(plan.estimate.fees).toBe("0.140625");
    expect(plan.depthSteps.map((s) => s.fees)).toEqual(["0.0703125", "0.0703125"]);
  });

  it("rounds only when an explicit per-level rounding model is supplied", () => {
    const input = fixture({
      shares: "0.003",
      bids: [{ price: "0.5", size: "0.003" }],
    });
    expect(valid(calculateExitPlan(input)).estimate.fees).toBe("0.0000375");
    const rounded = valid(
      calculateExitPlan({
        ...input,
        fee: { kind: "known", rate: "0.05", exponent: 1, roundingDecimals: 5 },
      }),
    );
    expect(rounded.estimate.fees).toBe("0.00004");
    expect(rounded.warnings.some((s) => s.includes("actual matches may split"))).toBe(true);
  });

  it("never treats unknown fees as zero, but still displays gross depth", () => {
    const plan = valid(
      calculateExitPlan(
        fixture({ fee: { kind: "unknown", reason: "Market response omitted the schedule" } }),
      ),
    );
    expect(plan.status).toBe("blocked");
    expect(plan.blockers).toContain("unknown-fees");
    expect(plan.available.grossReceipt).toBe("60.5");
    expect(plan.available.filledShares).toBe("100");
    expect(plan.available.fees).toBeNull();
    expect(plan.available.netReceipt).toBeNull();
    expect(plan.estimate.filledShares).toBe("0");
    expect(plan.estimate.netReceipt).toBeNull();
    expect(plan.meetsMinNetReceipt).toBeNull();
    expect(plan.depthSteps.every((s) => s.netReceipt === null)).toBe(true);
  });

  it("allows an explicitly verified fee-free schedule", () => {
    const plan = valid(calculateExitPlan(fixture({ fee: { kind: "none" } })));
    expect(plan.estimate.fees).toBe("0");
    expect(plan.estimate.netReceipt).toBe("60.5");
  });

  it("checks minimum total receipt after fees, including an exact decimal boundary", () => {
    const atBoundary = valid(calculateExitPlan(fixture({ minNetReceipt: "59.31375" })));
    expect(atBoundary.status).toBe("full");
    expect(atBoundary.meetsMinNetReceipt).toBe(true);
    const overBoundary = valid(
      calculateExitPlan(fixture({ minNetReceipt: "59.313750000000000001" })),
    );
    expect(overBoundary.available.netReceipt).toBe("59.31375");
    expect(overBoundary.status).toBe("blocked");
    expect(overBoundary.meetsMinNetReceipt).toBe(false);
    expect(overBoundary.estimate.grossReceipt).toBe("0");
    expect(overBoundary.blockers).toContain("min-net-receipt-not-met");
  });

  it("does not prorate the user's minimum to make a FAK partial fill pass", () => {
    const plan = valid(calculateExitPlan(fixture({ floorPrice: "0.6", minNetReceipt: "50" })));
    expect(plan.available.filledShares).toBe("70");
    expect(plan.available.netReceipt).toBe("43.185");
    expect(plan.status).toBe("blocked");
    expect(plan.estimate.filledShares).toBe("0");
  });

  it("does not let candidate partial proceeds satisfy a FOK receipt test", () => {
    const plan = valid(
      calculateExitPlan(fixture({ floorPrice: "0.6", orderType: "FOK", minNetReceipt: "40" })),
    );
    expect(plan.available.netReceipt).toBe("43.185");
    expect(plan.meetsMinNetReceipt).toBe(false);
    expect(plan.estimate.netReceipt).toBe("0");
  });

  it("rejects a supplied fee model whose charge exceeds fill proceeds", () => {
    const result = calculateExitPlan(fixture({ fee: { kind: "known", rate: "1", exponent: 0 } }));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.issues[0].code).toBe("fee-exceeds-proceeds");
  });
});

describe("invalid snapshots and malformed financial inputs", () => {
  it.each([
    ["0.50", "0.5"],
    ["00.600", "0.6000"],
  ])("rejects equivalent duplicate aggregated prices %s and %s", (a, b) => {
    const result = calculateExitPlan(
      fixture({
        bids: [
          { price: a, size: "10" },
          { price: b, size: "20" },
        ],
      }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.issues.some((i) => i.code === "duplicate-price")).toBe(true);
  });

  it.each([
    { shares: "0" },
    { shares: "-1" },
    { shares: 10 },
    { shares: "1e2" },
    { shares: "NaN" },
    { shares: "Infinity" },
    { floorPrice: "" },
    { floorPrice: ".5" },
    { floorPrice: "0.5 " },
    { floorPrice: "1.01" },
    { floorPrice: null },
    { minNetReceipt: "-0.01" },
    { minNetReceipt: "1.2.3" },
    { minNetReceipt: null },
    { shares: "1.0000000000000000001" },
    { shares: "1000000000000000000" },
    { orderType: "GTC" },
    { fee: null },
    { fee: { kind: "known", rate: "0.05" } },
    { fee: { kind: "known", rate: "1.1", exponent: 1 } },
    { fee: { kind: "known", rate: "0.05", exponent: 1.5 } },
    { fee: { kind: "known", rate: "0.05", exponent: -1 } },
    { fee: { kind: "known", rate: "0.05", exponent: 9 } },
    { fee: { kind: "known", rate: "0.05", exponent: 1, roundingDecimals: -1 } },
    { bids: null },
    { bids: [null] },
    { bids: new Array(1) },
    { bids: [{ price: "0", size: "1" }] },
    { bids: [{ price: "1", size: "1" }] },
    { bids: [{ price: "0.5", size: "0" }] },
    { bids: [{ price: "0.5", size: "-1" }] },
    { bids: [{ price: "NaN", size: "1" }] },
  ])("fails closed on malformed input %j", (overrides) => {
    const result = calculateExitPlan({ ...fixture(), ...overrides } as ExitPlanInput);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.issues.length).toBeGreaterThan(0);
  });

  it("rejects a malformed bid even if it is below the chosen floor", () => {
    const result = calculateExitPlan(fixture({ bids: [{ price: "0.2", size: "bad" }] }));
    expect(result.valid).toBe(false);
  });

  it("keeps stale/unknown-time depth available without passing policy", () => {
    for (const snapshot of [undefined, { ...SNAPSHOT, nowMs: SNAPSHOT.timestampMs + 15_001 }]) {
      const plan = valid(calculateExitPlan(fixture({ snapshot })));
      expect(plan.available.netReceipt).toBe("59.31375");
      expect(plan.status).toBe("blocked");
      expect(plan.estimate.filledShares).toBe("0");
      expect(plan.passesSnapshotChecks).toBe(false);
    }
  });
});

describe("snapshot freshness policy", () => {
  it("treats the age boundary as inclusive and rejects one millisecond older", () => {
    expect(
      checkSnapshotFreshness({ ...SNAPSHOT, nowMs: SNAPSHOT.timestampMs + 15_000 }).isFresh,
    ).toBe(true);
    expect(
      checkSnapshotFreshness({ ...SNAPSHOT, nowMs: SNAPSHOT.timestampMs + 15_001 }).status,
    ).toBe("stale");
  });

  it("rejects future timestamps unless a finite explicit skew allowance covers them", () => {
    const input = { ...SNAPSHOT, timestampMs: SNAPSHOT.nowMs + 100 };
    expect(checkSnapshotFreshness(input).status).toBe("future");
    expect(checkSnapshotFreshness({ ...input, allowedFutureSkewMs: 100 })).toMatchObject({
      status: "fresh",
      ageMs: 0,
      clockSkewMs: 100,
    });
    expect(checkSnapshotFreshness({ ...input, allowedFutureSkewMs: 99 }).status).toBe("future");
  });

  it.each([
    { timestampMs: NaN },
    { timestampMs: -1 },
    { timestampMs: 1.5 },
    { nowMs: Infinity },
    { nowMs: Number.MAX_SAFE_INTEGER + 1 },
    { maxAgeMs: -1 },
    { allowedFutureSkewMs: Infinity },
    { allowedFutureSkewMs: null },
  ])("rejects invalid clock data %j", (overrides) => {
    expect(
      checkSnapshotFreshness({ ...SNAPSHOT, ...overrides } as SnapshotFreshnessInput).status,
    ).toBe("invalid");
  });

  it("has no implicit wall-clock dependency or assumed freshness", () => {
    expect(checkSnapshotFreshness().status).toBe("missing");
    expect(checkSnapshotFreshness(SNAPSHOT)).toEqual(checkSnapshotFreshness(SNAPSHOT));
  });
});
