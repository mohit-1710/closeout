import { describe, it, expect } from "vitest";
import { compactOrderHistory, decodeOrderHistory } from "./order-history";
import type { TrackedOrder } from "./types";
const record: TrackedOrder = {
  id: "intent-example",
  mode: "live",
  tokenId: "1",
  accountAddress: "0x" + "1".repeat(40),
  market: "Market",
  outcome: "Yes",
  detail: "Uncertain",
  status: "unknown",
  requestedShares: "10",
  matchedShares: "0",
  price: "0.5",
  settledShares: null,
  netReceipt: null,
  createdAt: 1,
  canCancel: false,
  transactionHashes: [],
  orderType: "FAK",
};
describe("saved order history integrity", () => {
  it("starts empty only when absent or an actual empty array", () => {
    expect(decodeOrderHistory(null)).toEqual([]);
    expect(decodeOrderHistory("[]")).toEqual([]);
  });
  it("retains an unresolved intent", () =>
    expect(decodeOrderHistory(JSON.stringify([record]))[0].status).toBe(
      "unknown",
    ));
  it("never silently drops corrupt records", () => {
    for (const raw of [
      "broken",
      "{}",
      JSON.stringify([record, {}]),
      JSON.stringify([{ ...record, status: "complete" }]),
      JSON.stringify([{ ...record, accountAddress: null }]),
    ])
      expect(() => decodeOrderHistory(raw)).toThrow();
  });
  it("rejects duplicate order IDs", () =>
    expect(() =>
      decodeOrderHistory(JSON.stringify([record, record])),
    ).toThrow());
  it("rejects example history in the live store", () =>
    expect(() =>
      decodeOrderHistory(JSON.stringify([{ ...record, mode: "example" }])),
    ).toThrow());
});

describe("order history compaction", () => {
  const completed = (createdAt: number): TrackedOrder => ({
    ...record,
    id: `completed-${createdAt}`,
    status: "settled",
    createdAt,
  });

  it("preserves an old unknown intent among 100 newer terminal records", () => {
    const orders = [
      ...Array.from({ length: 100 }, (_, index) => completed(index + 2)),
      record,
    ];
    const result = compactOrderHistory(orders);
    expect(result).toHaveLength(100);
    expect(result).toContain(record);
    expect(result.map((order) => order.id)).not.toContain("completed-2");
    expect(result[0].createdAt).toBe(101);
    expect(decodeOrderHistory(JSON.stringify(result))).toEqual(result);
  });

  it("retains every active status across accounts while trimming terminal records", () => {
    const active = (["unknown", "open", "matched", "settling"] as const).map(
      (status, index): TrackedOrder => ({
        ...record,
        id: `active-${status}`,
        accountAddress: `0x${String(index + 1).repeat(40)}`,
        status,
      }),
    );
    const result = compactOrderHistory([
      ...Array.from({ length: 100 }, (_, index) => completed(index + 2)),
      ...active,
    ]);
    expect(result).toHaveLength(100);
    for (const order of active) expect(result).toContain(order);
    expect(result.filter((order) => order.status === "settled")).toHaveLength(
      96,
    );
    expect(result.map((order) => order.createdAt)).toEqual([
      ...Array.from({ length: 96 }, (_, index) => 101 - index),
      1, 1, 1, 1,
    ]);
  });

  it("fails closed instead of evicting any of more than 100 active records", () => {
    const active = Array.from({ length: 101 }, (_, index) => ({
      ...record,
      id: `active-${index}`,
    }));
    expect(() => compactOrderHistory(active)).toThrow("unresolved orders");
    expect(active).toHaveLength(101);
  });

  it("allows exactly 100 active records and evicts all terminal records", () => {
    const active = Array.from({ length: 100 }, (_, index) => ({
      ...record,
      id: `active-${index}`,
    }));
    expect(compactOrderHistory([completed(1000), ...active])).toEqual(active);
  });

  it("keeps the newest terminal records without mutating input", () => {
    const orders = Array.from({ length: 102 }, (_, index) => completed(index));
    const before = [...orders];
    const result = compactOrderHistory(orders);
    expect(result.map((order) => order.createdAt)).toEqual(
      Array.from({ length: 100 }, (_, index) => 101 - index),
    );
    expect(orders).toEqual(before);
    expect(result).not.toBe(orders);
    expect(compactOrderHistory([])).toEqual([]);
  });
});
