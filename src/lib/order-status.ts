import Decimal from "decimal.js";
import type { TrackedOrder } from "./types";

/** Identity fields supplied by the pinned SDK's OpenOrder response. */
export interface VenueOrder {
  id: string;
  assetId: string;
  tokenId?: string;
  makerAddress: string;
  side: string;
  orderType: string;
  sizeMatched: string;
  originalSize: string;
  status: string;
  associateTrades: string[];
}
export interface VenueMakerOrder {
  orderId: string;
  assetId: string;
  tokenId?: string;
  makerAddress: string;
  side: string;
  matchedAmount: string;
}
export interface VenueTrade {
  id: string;
  takerOrderId: string;
  assetId: string;
  tokenId?: string;
  makerAddress: string;
  side: string;
  traderSide: "TAKER" | "MAKER";
  size: string;
  status: string;
  transactionHash: string;
  makerOrders: VenueMakerOrder[];
}

const D = Decimal.clone({ precision: 80 });
const state = (s: string) =>
  typeof s === "string" ? s.toUpperCase().replace(/^TRADE_STATUS_/, "") : "";
const address = (s: unknown) =>
  typeof s === "string" && /^0x[0-9a-fA-F]{40}$/.test(s) ? s.toLowerCase() : null;
const txHash = (s: unknown) => typeof s === "string" && /^0x[0-9a-fA-F]{64}$/.test(s);
const id = (s: unknown) => typeof s === "string" && s.length > 0 && s.length <= 256;

function quantity(value: unknown, label: string, positive = false): Decimal {
  if (typeof value !== "string" || !/^\d{1,18}(?:\.\d{1,18})?$/.test(value))
    throw new Error(`${label} is not a valid share quantity.`);
  const result = new D(value);
  if (positive && result.lte(0)) throw new Error(`${label} must be greater than zero.`);
  return result;
}
function asset(value: unknown): bigint {
  if (
    typeof value !== "string" ||
    !(/^(?:0|[1-9]\d{0,77})$/.test(value) || /^0x[0-9a-fA-F]{64}$/.test(value))
  )
    throw new Error("The venue returned an invalid outcome token.");
  const result = BigInt(value);
  if (result >= 1n << 256n) throw new Error("The venue outcome token exceeds uint256.");
  return result;
}
function checkAsset(value: { assetId: string; tokenId?: string }, expected: bigint) {
  if (
    asset(value.assetId) !== expected ||
    (value.tokenId !== undefined && asset(value.tokenId) !== expected)
  )
    throw new Error("The venue returned a different outcome token.");
}
function checkSeller(value: { makerAddress: string; side: string }, expected: string) {
  if (address(value.makerAddress) !== expected)
    throw new Error("The venue returned a different order account.");
  if (state(value.side) !== "SELL") throw new Error("The venue returned a different order side.");
}

/** Inconsistent data throws: callers retain the prior record and request reconciliation. */
export function reconcileOrder(
  previous: TrackedOrder,
  order: VenueOrder,
  trades: VenueTrade[],
): TrackedOrder {
  if (!id(order.id) || order.id !== previous.id)
    throw new Error("The venue returned a different order.");
  const account = address(previous.accountAddress);
  if (previous.mode !== "live" || !account)
    throw new Error("The saved live order account could not be verified.");
  const token = asset(previous.tokenId);
  checkAsset(order, token);
  checkSeller(order, account);
  const type = state(previous.orderType ?? "");
  if (!["FAK", "FOK"].includes(type) || state(order.orderType) !== type)
    throw new Error("The venue returned a different immediate-order type.");
  const requested = quantity(previous.requestedShares, "Saved requested shares", true);
  const original = quantity(order.originalSize, "Venue original shares", true);
  const matched = quantity(order.sizeMatched, "Venue matched shares");
  if (!original.eq(requested)) throw new Error("The venue original size does not match this exit.");
  if (matched.gt(requested))
    throw new Error("The venue reports more matched shares than requested.");
  if (!Array.isArray(order.associateTrades) || order.associateTrades.some((value) => !id(value)))
    throw new Error("The venue returned invalid trade references.");
  if (!Array.isArray(trades) || trades.length > 100_000)
    throw new Error("Trade reconciliation is incomplete.");

  const references = new Set(order.associateTrades);
  const related = new Map<
    string,
    { quantity: Decimal; status: string; hash: string; fingerprint: string }
  >();
  for (const trade of trades) {
    if (!trade || !id(trade.id) || !id(trade.takerOrderId) || !Array.isArray(trade.makerOrders))
      throw new Error("The venue returned an invalid trade identity.");
    const makerLegs = trade.makerOrders.filter((maker) => maker && maker.orderId === order.id);
    const taker = trade.takerOrderId === order.id;
    if (!taker && makerLegs.length === 0) {
      if (references.has(trade.id))
        throw new Error("A referenced trade belongs to a different order.");
      continue;
    }
    if ((taker && makerLegs.length > 0) || makerLegs.length > 1)
      throw new Error("The venue returned ambiguous order legs for one trade.");
    let amount: Decimal;
    if (taker) {
      if (trade.traderSide !== "TAKER")
        throw new Error("The venue returned a different trade role.");
      checkAsset(trade, token);
      checkSeller(trade, account);
      amount = quantity(trade.size, "Trade shares", true);
    } else {
      if (trade.traderSide !== "MAKER")
        throw new Error("The venue returned a different trade role.");
      // Complementary matches may have a different token/side at the top level.
      const maker = makerLegs[0];
      checkAsset(maker, token);
      checkSeller(maker, account);
      amount = quantity(maker.matchedAmount, "Maker fill shares", true);
    }
    if (amount.gt(requested)) throw new Error("A trade quantity exceeds this exit.");
    const status = state(trade.status);
    if (status === "CONFIRMED" && !txHash(trade.transactionHash))
      throw new Error("A confirmed fill has no valid settlement transaction hash.");
    const hash = txHash(trade.transactionHash) ? trade.transactionHash.toLowerCase() : "";
    const fingerprint = JSON.stringify([taker, amount.toFixed(), status, hash]);
    const existing = related.get(trade.id);
    if (existing && existing.fingerprint !== fingerprint)
      throw new Error("The venue returned conflicting versions of the same trade. Refresh again.");
    related.set(trade.id, { quantity: amount, status, hash, fingerprint });
  }
  const fills = [...related.values()];
  const confirmed = fills.filter((t) => t.status === "CONFIRMED");
  const settled = confirmed.reduce((sum, t) => sum.plus(t.quantity), new D(0));
  if (settled.gt(matched))
    throw new Error("Confirmed fills exceed the order’s reported matched shares. Refresh again.");
  if (
    previous.settledShares !== null &&
    settled.lt(quantity(previous.settledShares, "Saved settled shares"))
  )
    throw new Error(
      "Confirmed fill history is incomplete or changed. Verify the order on Polymarket.",
    );
  const allTradeIdsKnown = references.size > 0 && [...references].every((ref) => related.has(ref));
  const allReturnedFinal = fills.every((t) => ["CONFIRMED", "FAILED"].includes(t.status));
  const pending = fills.some((t) => ["MATCHED", "MINED", "RETRYING"].includes(t.status));
  const failed = fills.some((t) => t.status === "FAILED");
  const cancelled = ["CANCELED", "CANCELLED"].includes(state(order.status));
  const live = ["LIVE", "OPEN", "UNMATCHED"].includes(state(order.status));
  const hasLiveRemainder = live && matched.lt(requested);
  let status: TrackedOrder["status"] = "unknown",
    detail = "The venue has not reported a final order state.";
  if (pending) {
    status = "settling";
    detail = "Matched fills are awaiting venue settlement confirmation.";
  } else if (hasLiveRemainder) {
    status = "open";
    detail = settled.gt(0)
      ? "Some shares have confirmed fills. The venue still reports a live remainder; refresh or cancel it before another exit."
      : "The venue reports a live remainder. Refresh or cancel it before another exit.";
  } else if (matched.gt(0) && allTradeIdsKnown && allReturnedFinal && settled.eq(matched)) {
    const terminalState = ["MATCHED", "FILLED", "CANCELED", "CANCELLED", "EXPIRED"].includes(
      state(order.status),
    );
    if (settled.eq(requested)) {
      status = "settled";
      detail = "All requested shares have venue-confirmed fills.";
    } else if (terminalState) {
      status = "partial";
      detail = "Confirmed partial fill. The immediate order’s remaining shares were not sold.";
    } else {
      status = "matched";
      detail = "Some shares have confirmed fills; the remaining order state is not yet verified.";
    }
  } else if (failed && allTradeIdsKnown && allReturnedFinal) {
    status = "failed";
    detail =
      "The venue reported a failed fill. Check the venue and remaining position before a new exit.";
  } else if (matched.gt(0)) {
    status = "matched";
    detail = "The venue reports matched shares; complete settlement is not yet verified.";
  } else if (cancelled && references.size === 0 && fills.length === 0) {
    status = "cancelled";
    detail = "The venue confirmed cancellation. No matched shares were reported.";
  } else if (live) {
    status = "open";
    detail = "The venue reports an open order. Refresh for matching or cancellation.";
  }
  return {
    ...previous,
    matchedShares: matched.toFixed(),
    settledShares: settled.toFixed(),
    status,
    detail,
    netReceipt: null,
    transactionHashes: [...new Set(confirmed.map((t) => t.hash))],
    canCancel: hasLiveRemainder && !pending,
  };
}
