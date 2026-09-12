import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getMarkets,
  getOrderBook,
  getPositions,
  isAccountAddress,
  isConditionId,
  isSearchQuery,
  isTokenId,
  normalizeMarket,
  normalizeMarkets,
  normalizeOrderBook,
  normalizePositions,
  parsePublicJson,
  PublicDataError,
  publicDataError,
} from "./public-data";
import { GET as marketsRoute } from "../app/api/markets/route";
import { GET as bookRoute } from "../app/api/book/route";
import { GET as positionsRoute } from "../app/api/positions/route";

const CONDITION = `0x${"a".repeat(64)}`;
const OTHER_CONDITION = `0x${"b".repeat(64)}`;
const ACCOUNT = `0x${"c".repeat(40)}`;
const TOKEN = "5615282760875985231868508008056959876238536896643315063916840237042205273721";
const OTHER_TOKEN = "97050921740416192996389806693742575608111328819185493163189880975611314813724";
const NOW = 1_789_200_000_000;

function market(overrides = {}) {
  return {
    id: "123",
    conditionId: CONDITION,
    question: "Example event?",
    slug: "example-event",
    active: true,
    closed: false,
    archived: false,
    acceptingOrders: true,
    enableOrderBook: true,
    outcomes: '["Yes","No"]',
    clobTokenIds: JSON.stringify([TOKEN, OTHER_TOKEN]),
    outcomePrices: '["0.6","0.4"]',
    volume24hr: "12345.67",
    liquidity: "5000",
    endDate: "2026-09-16T00:00:00Z",
    ...overrides,
  };
}

function book(overrides = {}) {
  return {
    asset_id: TOKEN,
    market: CONDITION,
    timestamp: String(NOW - 1_000_000),
    hash: "a".repeat(40),
    bids: [
      { price: "0.50", size: "10.25" },
      { price: "0.60", size: "20" },
    ],
    asks: [
      { price: "0.80", size: "30" },
      { price: "0.70", size: "40" },
    ],
    tick_size: "0.01",
    min_order_size: "5",
    ...overrides,
  };
}

function metadata(overrides = {}) {
  return {
    c: CONDITION,
    t: [
      { t: TOKEN, o: "Yes" },
      { t: OTHER_TOKEN, o: "No" },
    ],
    mos: 5,
    mts: 0.01,
    ao: true,
    fd: { r: 0.05, e: 1, to: true },
    ...overrides,
  };
}

const expected = { tokenId: TOKEN, conditionId: CONDITION, fetchedAt: NOW };

function position(overrides = {}) {
  return {
    token_id: TOKEN,
    condition_id: CONDITION,
    proxy_wallet: ACCOUNT,
    current_size: "12.345678",
    current_price: "0.6",
    current_value: "7.4074068",
    title: "Example event?",
    outcome: "Yes",
    slug: "example-event",
    redeemable: false,
    ...overrides,
  };
}

function positionsEnvelope(data = [position()], hasMore = false) {
  return {
    data,
    pagination: {
      limit: 100,
      offset: 0,
      has_more: hasMore,
      next_cursor: hasMore ? "opaque" : null,
    },
  };
}

function fetchResponse(body: unknown, status = 200) {
  return vi.fn<typeof fetch>().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("public request validation", () => {
  it("accepts bounded identifiers and rejects URL/path injection or unsafe uint256 values", () => {
    expect(isAccountAddress(ACCOUNT)).toBe(true);
    expect(isConditionId(CONDITION)).toBe(true);
    expect(isTokenId(TOKEN)).toBe(true);
    expect(isTokenId(((1n << 256n) - 1n).toString())).toBe(true);
    expect(isTokenId((1n << 256n).toString())).toBe(false);
    for (const input of [
      "https://evil.test",
      "../x",
      "1&other=2",
      "01",
      "1e10",
      "9".repeat(79),
      123,
    ])
      expect(isTokenId(input)).toBe(false);
    expect(isAccountAddress(`${ACCOUNT}#suffix`)).toBe(false);
    expect(isConditionId(`${CONDITION}/extra`)).toBe(false);
    expect(isSearchQuery("élection & growth")).toBe(true);
    expect(isSearchQuery("x".repeat(120))).toBe(true);
    expect(isSearchQuery("x".repeat(121))).toBe(false);
    expect(isSearchQuery("a\nb")).toBe(false);
  });

  it("preserves numeric source precision rather than silently passing through binary rounding", () => {
    expect(
      parsePublicJson(
        '{"size":0.123456789012345678,"big":999999999999999999,"small":1e-6,"flag":true}',
      ),
    ).toEqual({
      size: "0.123456789012345678",
      big: "999999999999999999",
      small: "0.000001",
      flag: true,
    });
    expect(() => parsePublicJson('{"size":1e9999}')).toThrow(PublicDataError);
    expect(() => parsePublicJson("<html>error</html>")).toThrow(PublicDataError);
  });
});

describe("market normalization", () => {
  it("binds labels to tokens and treats an indicative outcome price as nullable", () => {
    const value = normalizeMarket(market());
    expect(value?.conditionId).toBe(CONDITION);
    expect(value?.outcomes).toEqual([
      { label: "Yes", tokenId: TOKEN, price: "0.6" },
      { label: "No", tokenId: OTHER_TOKEN, price: "0.4" },
    ]);
    expect(normalizeMarket(market({ outcomePrices: null }))?.outcomes[0].price).toBeNull();
  });

  it.each([
    { active: false },
    { closed: true },
    { acceptingOrders: false },
    { archived: true },
    { enableOrderBook: false },
  ])("filters non-tradeable markets %j", (overrides) => {
    expect(normalizeMarket(market(overrides))).toBeNull();
  });

  it.each([
    { conditionId: "bad" },
    { outcomes: '["Yes"]' },
    { outcomes: "broken json" },
    { clobTokenIds: JSON.stringify([TOKEN, TOKEN]) },
    { outcomePrices: '["0.2"]' },
    { outcomePrices: '["1.1","0"]' },
    { endDate: "nonsense" },
    { question: "" },
  ])("rejects malformed active market instead of inventing a binding %j", (overrides) => {
    expect(() => normalizeMarket(market(overrides))).toThrow(PublicDataError);
  });

  it("flattens search events, filters closed markets, and deduplicates identical results", () => {
    const payload = {
      events: [{ markets: [market(), market({ active: false })] }, { markets: [market()] }],
    };
    expect(normalizeMarkets(payload, { search: true })).toHaveLength(1);
    expect(normalizeMarkets({ pagination: { hasMore: false } }, { search: true })).toEqual([]);
    expect(() => normalizeMarkets({ error: "down" }, { search: true })).toThrow(PublicDataError);
    expect(() => normalizeMarkets({ events: [{ markets: "bad" }] }, { search: true })).toThrow(
      PublicDataError,
    );
  });

  it("rejects condition lookup mismatch and conflicting duplicate markets", () => {
    expect(() => normalizeMarkets([market()], { conditionId: OTHER_CONDITION })).toThrow(
      /different market/,
    );
    expect(() => normalizeMarkets([market(), market({ question: "Other event?" })])).toThrow(
      /conflicting/,
    );
  });
});

describe("verified order-book binding", () => {
  it("sorts a copied book, uses current fee metadata and preserves last-change versus fetch time", () => {
    const raw = book();
    const before = JSON.stringify(raw);
    const normalized = normalizeOrderBook(raw, metadata(), expected);
    expect(normalized.bids.map((b) => b.price)).toEqual(["0.6", "0.5"]);
    expect(normalized.asks.map((b) => b.price)).toEqual(["0.7", "0.8"]);
    expect(normalized.fee).toEqual({ kind: "known", rate: "0.05", exponent: 1 });
    expect(normalized.timestampMs).toBe(NOW - 1_000_000);
    expect(normalized.fetchedAt).toBe(NOW);
    expect(normalized.acceptingOrders).toBe(true);
    expect(JSON.stringify(raw)).toBe(before);
  });

  it.each([
    [book({ asset_id: OTHER_TOKEN }), metadata()],
    [book({ market: OTHER_CONDITION }), metadata()],
    [book(), metadata({ c: OTHER_CONDITION })],
    [
      book(),
      metadata({
        t: [
          { t: OTHER_TOKEN, o: "No" },
          { t: "123", o: "Other" },
        ],
      }),
    ],
    [
      book(),
      metadata({
        t: [
          { t: TOKEN, o: "Yes" },
          { t: TOKEN, o: "No" },
        ],
      }),
    ],
  ])("rejects an incorrectly bound or duplicated token/condition", (raw, meta) => {
    expect(() => normalizeOrderBook(raw, meta, expected)).toThrow(PublicDataError);
  });

  it.each([
    {
      bids: [
        { price: "0.5", size: "1" },
        { price: "0.50", size: "2" },
      ],
    },
    { bids: [{ price: "0.505", size: "1" }] },
    { bids: [{ price: "0.5", size: "0" }] },
    { bids: [{ price: "0.5", size: "NaN" }] },
    { bids: [{ price: 0.5, size: "1" }] },
    { bids: [{ price: "1", size: "1" }] },
    { bids: new Array(1) },
    { asks: [{ price: "0.55", size: "1" }] },
    { timestamp: "bad" },
    { timestamp: String(NOW + 60_001) },
    { hash: "not a hash" },
  ])("rejects corrupt depth or integrity metadata %j", (overrides) => {
    expect(() => normalizeOrderBook(book(overrides), metadata(), expected)).toThrow(
      PublicDataError,
    );
  });

  it("rejects changing/inconsistent tick and order constraints instead of rounding them", () => {
    expect(() => normalizeOrderBook(book(), metadata({ mts: "0.001" }), expected)).toThrow(
      /constraints disagree/,
    );
    expect(() => normalizeOrderBook(book(), metadata({ mos: "10" }), expected)).toThrow(
      /constraints disagree/,
    );
    expect(() => normalizeOrderBook(book(), metadata({ ao: "true" }), expected)).toThrow(
      /accepts orders/,
    );
  });

  it("allows a verified nonaccepting market for display without silently opening it", () => {
    expect(normalizeOrderBook(book(), metadata({ ao: false }), expected).acceptingOrders).toBe(
      false,
    );
  });

  it.each([undefined, null, {}, { r: "bad", e: 1 }, { r: "0.05" }, { r: "0.05", e: 9 }])(
    "keeps missing or malformed fees unknown: %j",
    (fd) => {
      const result = normalizeOrderBook(book(), metadata({ fd }), expected);
      expect(result.fee.kind).toBe("unknown");
      expect(result.bids).toHaveLength(2);
    },
  );

  it("accepts explicit zero fees without guessing from legacy base-fee fields", () => {
    expect(normalizeOrderBook(book(), metadata({ fd: { r: 0 } }), expected).fee).toEqual({
      kind: "none",
    });
    expect(normalizeOrderBook(book(), metadata({ fd: undefined, tbf: 0 }), expected).fee.kind).toBe(
      "unknown",
    );
  });
});

describe("current v2 position normalization", () => {
  it("maps exact snake-case economics and reports pagination without claiming all positions", () => {
    expect(normalizePositions(positionsEnvelope([position()], true), ACCOUNT)).toEqual({
      positions: [
        {
          tokenId: TOKEN,
          conditionId: CONDITION,
          title: "Example event?",
          outcome: "Yes",
          size: "12.345678",
          currentPrice: "0.6",
          value: "7.4074068",
          slug: "example-event",
          redeemable: false,
        },
      ],
      hasMore: true,
    });
    expect(normalizePositions(positionsEnvelope([]), ACCOUNT)).toEqual({
      positions: [],
      hasMore: false,
    });
  });

  it("applies the documented dust threshold locally and retains redeemed-price endpoints", () => {
    expect(
      normalizePositions(positionsEnvelope([position({ current_size: "0.0009" })]), ACCOUNT)
        .positions,
    ).toEqual([]);
    expect(
      normalizePositions(
        positionsEnvelope([
          position({ current_size: "0.001", current_price: "1", redeemable: true }),
        ]),
        ACCOUNT,
      ).positions[0].redeemable,
    ).toBe(true);
  });

  it.each([
    { proxy_wallet: `0x${"d".repeat(40)}` },
    { token_id: "bad" },
    { condition_id: "bad" },
    { current_size: "-1" },
    { current_price: "1.1" },
    { current_value: null },
    { redeemable: "false" },
  ])("rejects wrong account and malformed balances %j", (overrides) => {
    expect(() => normalizePositions(positionsEnvelope([position(overrides)]), ACCOUNT)).toThrow(
      PublicDataError,
    );
  });

  it("rejects legacy payloads, missing pagination and duplicate positions", () => {
    expect(() => normalizePositions([position()], ACCOUNT)).toThrow(PublicDataError);
    expect(() => normalizePositions({ data: [] }, ACCOUNT)).toThrow(PublicDataError);
    expect(() => normalizePositions(positionsEnvelope([position(), position()]), ACCOUNT)).toThrow(
      /duplicate/,
    );
  });
});

describe("fixed public network endpoints and route errors", () => {
  it("uses encoded search parameters, fixed origins, no credentials, no redirects and no caching", async () => {
    const fetcher = fetchResponse({ events: [{ markets: [market()] }] });
    await getMarkets({ q: "bitcoin & growth" }, fetcher);
    const [url, options] = fetcher.mock.calls[0];
    const parsed = new URL(String(url));
    expect(parsed.origin).toBe("https://gamma-api.polymarket.com");
    expect(parsed.pathname).toBe("/public-search");
    expect(parsed.searchParams.get("q")).toBe("bitcoin & growth");
    expect(parsed.searchParams.get("search_profiles")).toBe("false");
    expect(options).toMatchObject({
      method: "GET",
      redirect: "error",
      cache: "no-store",
      credentials: "omit",
    });
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    expect(options?.headers).toEqual({ Accept: "application/json" });
  });

  it("uses the requested fixed discovery and current position filters", async () => {
    const markets = fetchResponse([market()]);
    await getMarkets({}, markets);
    const marketUrl = new URL(String(markets.mock.calls[0][0]));
    expect(marketUrl.searchParams.get("limit")).toBe("40");
    expect(marketUrl.searchParams.get("order")).toBe("volume24hr");
    const positions = fetchResponse(positionsEnvelope([]));
    await getPositions(ACCOUNT, positions);
    const positionsUrl = new URL(String(positions.mock.calls[0][0]));
    expect(positionsUrl.pathname).toBe("/v2/positions");
    expect(positionsUrl.searchParams.get("filter_type")).toBe("TOKENS");
    expect(positionsUrl.searchParams.get("filter_amount")).toBe("0.001");
    expect(positionsUrl.searchParams.has("sizeThreshold")).toBe(false);
  });

  it("fetches and cross-checks book and metadata before returning a book", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(
        async (url) =>
          new Response(
            JSON.stringify(new URL(String(url)).pathname === "/book" ? book() : metadata()),
          ),
      );
    const result = await getOrderBook({ tokenId: TOKEN, conditionId: CONDITION }, fetcher);
    expect(result.fetchedAt).toBe(NOW);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("rejects invalid inputs before fetching", async () => {
    const fetcher = fetchResponse([]);
    await expect(getMarkets({ q: "x".repeat(121) }, fetcher)).rejects.toMatchObject({
      status: 400,
    });
    await expect(getMarkets({ q: "yes", conditionId: CONDITION }, fetcher)).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      getOrderBook({ tokenId: "https://evil.test", conditionId: CONDITION }, fetcher),
    ).rejects.toMatchObject({ status: 400 });
    await expect(getPositions("wrong", fetcher)).rejects.toMatchObject({ status: 400 });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("turns upstream HTTP/network failures into friendly errors, never example data", async () => {
    await expect(
      getMarkets({}, fetchResponse({ error: "private upstream details" }, 503)),
    ).rejects.toMatchObject({ status: 502 });
    const failed = vi.fn<typeof fetch>().mockRejectedValue(new Error("network internals"));
    await expect(getMarkets({}, failed)).rejects.toThrow(/12 seconds/);
    expect(publicDataError(new Error("secret internal stack"))).toEqual({
      error: "Public market data is unavailable. Please retry.",
      status: 502,
    });
  });

  it("serves route JSON and validates missing/duplicate query parameters", async () => {
    vi.stubGlobal("fetch", fetchResponse([market()]));
    const response = await marketsRoute(new Request("https://closeout.test/api/markets"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect((await response.json()).markets).toHaveLength(1);
    expect((await bookRoute(new Request("https://closeout.test/api/book"))).status).toBe(400);
    expect(
      (await positionsRoute(new Request("https://closeout.test/api/positions?account=bad"))).status,
    ).toBe(400);
    expect(
      (await marketsRoute(new Request("https://closeout.test/api/markets?q=a&q=b"))).status,
    ).toBe(400);
    vi.stubGlobal("fetch", fetchResponse({ error: "down" }, 503));
    const failure = await marketsRoute(new Request("https://closeout.test/api/markets"));
    expect(failure.status).toBe(502);
    expect(await failure.json()).toEqual({
      error: "The market-data provider is unavailable (HTTP 503). Please retry.",
    });
  });
});
