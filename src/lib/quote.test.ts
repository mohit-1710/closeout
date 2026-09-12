import { describe, it, expect } from "vitest";
import { buildQuote } from "./quote";
import { exampleBook } from "./example-data";
const now = 100000,
  book = exampleBook("example-yes", now);
describe("UI quote mapping", () => {
  it("preserves indicative gross depth when fees are unknown", () => {
    const q = buildQuote({ ...book, fee: { kind: "unknown" } }, "250", "0.60", "FAK", now);
    expect(q.status).toBe("blocked");
    expect(q.filledShares).toBe("140");
    expect(q.grossReceipt).toBe("85.05");
    expect(q.fees).toBeNull();
    expect(q.netReceipt).toBeNull();
  });
  it("does not display a partial FOK execution estimate", () => {
    const q = buildQuote(book, "250", "0.60", "FOK", now);
    expect(q.status).toBe("blocked");
    expect(q.filledShares).toBe("0");
    expect(q.remainingShares).toBe("250");
  });
  it("blocks zero floors and unsupported share precision", () => {
    expect(buildQuote(book, "250", "0", "FAK", now).status).toBe("blocked");
    expect(buildQuote(book, "10.123", "0.60", "FAK", now).status).toBe("blocked");
  });
  it("blocks stale fetches without replacing timestamp with now", () => {
    const q = buildQuote(book, "250", "0.60", "FAK", now + 15001);
    expect(q.status).toBe("blocked");
    expect(q.snapshotAt).toBe(now);
  });
  it("blocks current market shutdown and off-tick floors", () => {
    expect(buildQuote({ ...book, acceptingOrders: false }, "250", "0.60", "FAK", now).status).toBe(
      "blocked",
    );
    expect(buildQuote(book, "250", "0.601", "FAK", now).status).toBe("blocked");
  });
});
