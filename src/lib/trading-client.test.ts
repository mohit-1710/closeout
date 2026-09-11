import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({
  client: {} as any,
  balance: vi.fn(),
  create: vi.fn(),
}));
vi.mock("@polymarket/client", () => ({
  AssetType: { CONDITIONAL: "CONDITIONAL", COLLATERAL: "COLLATERAL" },
  OrderSide: { SELL: "SELL" },
  OrderType: { FAK: "FAK", FOK: "FOK" },
  SignerType: { OWNER: "OWNER" },
  createSecureClient: m.create,
  production: {
    contracts: {
      standardExchange: "0xE111180000d2663C0091e4f400237545B87B996B",
      negRiskExchange: "0xe2222d279d744050d28e00520010520000310F59",
      exchangeV3: "0xe3333700cA9d93003F00f0F71f8515005F6c00Aa",
    },
  },
}));
vi.mock("@polymarket/client/actions", () => ({
  fetchBalanceAllowance: m.balance,
}));
vi.mock("@polymarket/client/viem", () => ({
  signerFrom: () => ({
    getAddress: vi.fn(),
    signTypedData: vi.fn(),
    signMessage: vi.fn(),
  }),
}));
import {
  createTradingSession,
  checkGeo,
  SubmissionUncertainError,
  resolveExitExchange,
} from "./trading-client";
const signer = "0x1111111111111111111111111111111111111111",
  account = "0x2222222222222222222222222222222222222222";
let listeners: Record<string, Set<Function>>;
let provider: any;
const exchange = "0xE111180000d2663C0091e4f400237545B87B996B";
function pages(items: any[]) {
  return {
    [Symbol.asyncIterator]: async function* () {
      yield { items };
    },
  };
}
const token =
  "107505882767731489358349912513945399560393482969656700824895970500493757150417";
const order = {
  id: "one",
  assetId: token,
  makerAddress: account,
  side: "SELL",
  originalSize: "12.5",
  sizeMatched: "2.25",
  associateTrades: [],
};
const signed = { tokenId: token, signature: "0xmock" };
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("window", {});
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({ blocked: false, country: "IN" }),
      }),
  );
  listeners = {};
  provider = {
    request: vi.fn(async ({ method }: any) =>
      method === "eth_accounts"
        ? [signer]
        : method === "eth_chainId"
          ? "0x89"
          : "0x6000",
    ),
    on: (e: string, f: Function) => (listeners[e] ??= new Set()).add(f),
    removeListener: (e: string, f: Function) => listeners[e]?.delete(f),
  };
  m.client = {
    account: { signer, wallet: account, signerType: "OWNER" },
    fetchOrderBook: vi
      .fn()
      .mockResolvedValue({ negRisk: false, minOrderSize: "5", tickSize: 0.01 }),
    listOpenOrders: vi.fn(() => pages([order])),
    createMarketOrder: vi.fn().mockResolvedValue(signed),
    postOrder: vi
      .fn()
      .mockResolvedValue({
        ok: true,
        orderId: "one",
        status: "matched",
        tradeIds: ["t"],
        transactionsHashes: [],
      }),
    fetchOrder: vi.fn().mockResolvedValue(order),
    cancelOrder: vi
      .fn()
      .mockResolvedValue({
        canceled: [],
        notCanceled: { one: "already matched" },
      }),
    listAccountTrades: vi.fn(() => pages([])),
    closeSubscriptions: vi.fn().mockResolvedValue(undefined),
  };
  m.create.mockResolvedValue(m.client);
  m.balance.mockImplementation(async (_: any, r: any) => ({
    balance: r.assetType === "CONDITIONAL" ? "25000000" : "5000000",
    allowances: { [exchange]: 1n },
  }));
});
afterEach(() => vi.unstubAllGlobals());
describe("Closeout trading boundary", () => {
  it("chooses SDK standard and neg-risk exchanges for protocol v1 tokens", () => {
    expect(resolveExitExchange(token, false).toLowerCase()).toBe(
      exchange.toLowerCase(),
    );
    expect(resolveExitExchange(token, true).toLowerCase()).toBe(
      "0xe2222d279d744050d28e00520010520000310f59",
    );
  });
  it("chooses ExchangeV3 for protocol v2 position namespace", () => {
    const position = (1n << 248n).toString();
    expect(resolveExitExchange(position, false).toLowerCase()).toBe(
      "0xe3333700ca9d93003f00f0f71f8515005f6c00aa",
    );
    expect(resolveExitExchange(position, true)).toBe(
      resolveExitExchange(position, false),
    );
  });
  it("rejects an identifier larger than uint256", () => {
    expect(() => resolveExitExchange((1n << 256n).toString(), false)).toThrow(
      "uint256",
    );
  });
  it("does not deploy an undeployed account during authentication", async () => {
    provider.request.mockImplementation(async ({ method }: any) =>
      method === "eth_accounts"
        ? [signer]
        : method === "eth_chainId"
          ? "0x89"
          : "0x",
    );
    await expect(
      createTradingSession(provider, signer, account),
    ).rejects.toThrow("not deployed");
    expect(m.create).not.toHaveBeenCalled();
  });

  it("fails closed when geo response is incomplete or unavailable", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ blocked: false }),
    } as any);
    expect((await checkGeo()).status).toBe("unknown");
    vi.mocked(fetch).mockRejectedValue(Error());
    expect((await checkGeo()).status).toBe("unknown");
  });
  it("does not assume a watched wallet is owned", async () => {
    m.client.account.signerType = "SESSION_KEY";
    await expect(
      createTradingSession(provider, signer, account),
    ).rejects.toThrow("not the owner");
    expect(m.client.postOrder).not.toHaveBeenCalled();
  });
  it("normalizes raw balances and subtracts remaining open sells", async () => {
    const c = await createTradingSession(provider, signer, account);
    expect(await c.readBalances(token)).toEqual({
      held: "25",
      reserved: "10.25",
      available: "14.75",
      collateral: "5",
      approvalsReady: true,
    });
    c.dispose();
  });
  it("submits one bounded FAK and retains matched as distinct from settled", async () => {
    const c = await createTradingSession(provider, signer, account);
    const r = await c.placeExit({
      tokenId: token,
      shares: "10",
      floorPrice: "0.52",
      orderType: "FAK",
    });
    expect(m.client.createMarketOrder).toHaveBeenCalledWith({
      assetId: token,
      side: "SELL",
      shares: "10",
      minPrice: "0.52",
      orderType: "FAK",
    });
    expect(r.ok && r.status).toBe("matched");
    expect(m.client.postOrder).toHaveBeenCalledTimes(1);
  });
  it("rejects overselling before signing", async () => {
    const c = await createTradingSession(provider, signer, account);
    await expect(
      c.placeExit({
        tokenId: token,
        shares: "20",
        floorPrice: "0.52",
        orderType: "FOK",
      }),
    ).rejects.toThrow("unreserved");
    expect(m.client.createMarketOrder).not.toHaveBeenCalled();
  });
  it("blocks missing allowances without an approval transaction", async () => {
    m.balance.mockResolvedValue({ balance: "25000000", allowances: {} });
    const c = await createTradingSession(provider, signer, account);
    await expect(
      c.placeExit({
        tokenId: token,
        shares: "10",
        floorPrice: "0.52",
        orderType: "FOK",
      }),
    ).rejects.toThrow("approval");
    expect(m.client.createMarketOrder).not.toHaveBeenCalled();
    await expect(
      m.create.mock.calls[0][0].signer.sendTransaction(),
    ).rejects.toThrow("approvals");
  });
  it("blocks geo-restricted user before signing", async () => {
    const c = await createTradingSession(provider, signer, account);
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ blocked: true, country: "US" }),
    } as any);
    await expect(
      c.placeExit({
        tokenId: token,
        shares: "10",
        floorPrice: "0.52",
        orderType: "FAK",
      }),
    ).rejects.toThrow("restriction");
    expect(m.client.createMarketOrder).not.toHaveBeenCalled();
  });
  it("invalidates an old session on provider account change", async () => {
    const c = await createTradingSession(provider, signer, account);
    listeners.accountsChanged.forEach((f) => f([account]));
    await expect(c.readBalances(token)).rejects.toThrow("changed");
  });
  it("does not post after a chain change during signing", async () => {
    const c = await createTradingSession(provider, signer, account);
    m.client.createMarketOrder.mockImplementation(async () => {
      listeners.chainChanged.forEach((f) => f("0x1"));
      return signed;
    });
    await expect(
      c.placeExit({
        tokenId: token,
        shares: "10",
        floorPrice: "0.52",
        orderType: "FAK",
      }),
    ).rejects.toThrow("changed");
    expect(m.client.postOrder).not.toHaveBeenCalled();
  });
  it("locks uncertain POSTs instead of retrying the exit", async () => {
    const c = await createTradingSession(provider, signer, account);
    m.client.postOrder.mockRejectedValue(Error("connection lost"));
    const request = {
      tokenId: token,
      shares: "10",
      floorPrice: "0.52",
      orderType: "FAK" as const,
    };
    await expect(c.placeExit(request)).rejects.toBeInstanceOf(
      SubmissionUncertainError,
    );
    await expect(c.placeExit(request)).rejects.toBeInstanceOf(
      SubmissionUncertainError,
    );
    expect(m.client.postOrder).toHaveBeenCalledTimes(1);
  });
  it("preserves cancellation failure and rejects foreign orders", async () => {
    const c = await createTradingSession(provider, signer, account);
    expect(await c.cancelOrder("one")).toEqual({
      canceled: [],
      notCanceled: { one: "already matched" },
    });
    m.client.fetchOrder.mockResolvedValue({ ...order, makerAddress: signer });
    await expect(c.cancelOrder("two")).rejects.toThrow("different");
    expect(m.client.cancelOrder).toHaveBeenCalledTimes(1);
  });
  it("filters both taker and maker fills for the exact order", async () => {
    const c = await createTradingSession(provider, signer, account);
    const a = { id: "a", takerOrderId: "one", makerOrders: [] },
      b = { id: "b", takerOrderId: "two", makerOrders: [{ orderId: "one" }] },
      z = { id: "z", takerOrderId: "other", makerOrders: [] };
    m.client.listAccountTrades.mockImplementation(() => pages([a, b, z]));
    expect(await c.getTradesForOrder("one")).toEqual([a, b]);
  });
});
