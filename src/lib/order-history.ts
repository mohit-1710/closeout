import type { TrackedOrder } from "./types";
const HISTORY_LIMIT = 100;
const activeStates = new Set<TrackedOrder["status"]>([
  "unknown",
  "open",
  "matched",
  "settling",
]);

/** Keep unresolved execution evidence even when newer completed orders fill history. */
export function compactOrderHistory(orders: TrackedOrder[]): TrackedOrder[] {
  const active = orders.filter((order) => activeStates.has(order.status));
  if (active.length > HISTORY_LIMIT) {
    throw new Error(
      "Too many unresolved orders to safely save history. Review existing orders before continuing.",
    );
  }
  const newestFirst = (a: TrackedOrder, b: TrackedOrder) =>
    b.createdAt - a.createdAt;
  const terminal = orders
    .filter((order) => !activeStates.has(order.status))
    .sort(newestFirst)
    .slice(0, HISTORY_LIMIT - active.length);
  return [...active, ...terminal].sort(newestFirst);
}

const decimal = (v: unknown) =>
  typeof v === "string" && /^\d{1,18}(?:\.\d{1,18})?$/.test(v);
const nullableDecimal = (v: unknown) => v === null || decimal(v);
const states = new Set([
  "open",
  "matched",
  "partial",
  "settling",
  "settled",
  "cancelled",
  "failed",
  "unknown",
]);
/** Corruption must block execution, not silently discard an unresolved intent. */
export function decodeOrderHistory(raw: string | null): TrackedOrder[] {
  if (raw === null) return [];
  if (raw.length > 1_000_000)
    throw new Error("Order history is too large to verify.");
  const values: unknown = JSON.parse(raw);
  if (!Array.isArray(values) || values.length > HISTORY_LIMIT)
    throw new Error("Order history format is invalid.");
  const ids = new Set<string>();
  return values.map((value: unknown) => {
    if (!value || typeof value !== "object")
      throw new Error("Order history contains an invalid record.");
    const v = value as Record<string, unknown>;
    if (
      v.mode !== "live" ||
      typeof v.id !== "string" ||
      !v.id ||
      v.id.length > 160 ||
      ids.has(v.id) ||
      typeof v.tokenId !== "string" ||
      !/^\d{1,78}$/.test(v.tokenId) ||
      typeof v.accountAddress !== "string" ||
      !/^0x[\da-fA-F]{40}$/.test(v.accountAddress) ||
      typeof v.market !== "string" ||
      typeof v.outcome !== "string" ||
      typeof v.detail !== "string" ||
      typeof v.status !== "string" ||
      !states.has(v.status) ||
      !decimal(v.requestedShares) ||
      !decimal(v.matchedShares) ||
      !decimal(v.price) ||
      !nullableDecimal(v.settledShares) ||
      !nullableDecimal(v.netReceipt) ||
      typeof v.createdAt !== "number" ||
      !Number.isSafeInteger(v.createdAt) ||
      v.createdAt < 0 ||
      typeof v.canCancel !== "boolean" ||
      !Array.isArray(v.transactionHashes) ||
      !v.transactionHashes.every(
        (h) => typeof h === "string" && /^0x[\da-fA-F]{64}$/.test(h),
      ) ||
      (v.orderType !== "FAK" && v.orderType !== "FOK")
    )
      throw new Error("Saved order history could not be verified.");
    ids.add(v.id);
    return v as unknown as TrackedOrder;
  });
}
