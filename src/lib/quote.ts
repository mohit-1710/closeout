import Decimal from "decimal.js";
import { calculateExitPlan } from "./exit-plan";
import type { OrderBook, ExitQuote } from "./types";
const messages: Record<string, string> = {
  "unknown-fees": "The venue’s current fee model is unavailable.",
  "snapshot-stale": "This quote has expired. Refresh the order book.",
  "snapshot-missing": "A fresh order book is required.",
  "snapshot-future": "The quote clock could not be verified.",
  "snapshot-invalid": "The quote timestamp could not be verified.",
  "no-liquidity-at-floor": "No bids meet this price floor.",
  "insufficient-depth-for-fok":
    "There is not enough depth for an all-or-none fill. Lower the size or choose partial fills.",
  "min-net-receipt-not-met": "Estimated proceeds do not meet the minimum.",
};
export function buildQuote(
  book: OrderBook,
  shares: string,
  floorPrice: string,
  orderType: "FAK" | "FOK",
  now = Date.now(),
): ExitQuote {
  const result = calculateExitPlan({
    shares,
    floorPrice,
    orderType,
    bids: book.bids,
    fee: book.fee,
    snapshot: {
      timestampMs: book.fetchedAt,
      nowMs: now,
      maxAgeMs: 15000,
      allowedFutureSkewMs: 5000,
    },
  });
  const depth = book.bids.reduce<ExitQuote["depth"]>((a, b) => {
    const prev = a.at(-1);
    a.push({
      price: b.price,
      shares: b.size,
      cumulativeShares: new Decimal(prev?.cumulativeShares ?? "0").plus(b.size).toFixed(),
      receipt: new Decimal(prev?.receipt ?? "0").plus(new Decimal(b.price).times(b.size)).toFixed(),
    });
    return a;
  }, []);
  if (!result.valid)
    return {
      status: "blocked",
      requestedShares: shares,
      filledShares: "0",
      remainingShares: shares || "0",
      grossReceipt: "0",
      fees: null,
      netReceipt: null,
      averagePrice: null,
      worstPrice: null,
      fillPercent: 0,
      depth,
      blockers: result.issues.map((i) => `${i.path}: ${i.message}`),
      warnings: [],
      snapshotAt: book.fetchedAt,
    };
  const estimate = result.blockers.includes("insufficient-depth-for-fok")
    ? result.estimate
    : result.available;
  const blockers = result.blockers.map((b) => messages[b] ?? b);
  if (new Decimal(floorPrice).lte(0))
    blockers.push("Set a minimum price greater than 0 pUSD per share.");
  if (!book.acceptingOrders) blockers.push("This market is not currently accepting orders.");
  if (new Decimal(shares).lt(book.minOrderSize))
    blockers.push(`The venue requires at least ${book.minOrderSize} shares.`);
  if (!new Decimal(floorPrice).mod(book.tickSize).eq(0))
    blockers.push(`Use a price floor in increments of ${book.tickSize} pUSD.`);
  if (new Decimal(shares).decimalPlaces() > 2)
    blockers.push("Use at most 2 decimal places for share amounts.");
  return {
    status: blockers.length
      ? "blocked"
      : result.status === "partial"
        ? "partial"
        : result.status === "no-fill"
          ? "empty"
          : "ready",
    requestedShares: shares,
    filledShares: estimate.filledShares,
    remainingShares: estimate.remainingShares,
    grossReceipt: estimate.grossReceipt,
    fees: estimate.fees,
    netReceipt: estimate.netReceipt,
    averagePrice: estimate.weightedAveragePrice,
    worstPrice: estimate.worstFillPrice,
    fillPercent: new Decimal(estimate.filledShares).div(shares).times(100).toNumber(),
    depth,
    blockers,
    warnings: result.warnings,
    snapshotAt: book.fetchedAt,
  };
}
