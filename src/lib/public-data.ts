import Decimal from "decimal.js";
import type { BookLevel, Market, OrderBook, Position } from "./types";

// Public sources checked September 12, 2026:
// https://docs.polymarket.com/market-data/market-details
// https://docs.polymarket.com/api-reference/orderbook/get-order-book
// https://docs.polymarket.com/api-reference/wallet/list-positions-for-a-user-or-market
// Live v2 uses {data,pagination}, snake_case economics and filter_type/filter_amount.
// No server-only imports: the small validators can also be used by client hooks.
const D = Decimal.clone({ precision: 100 });
const DECIMAL = /^\d{1,18}(?:\.\d{1,18})?$/;
const UINT256_MAX = (1n << 256n) - 1n;
const ORIGINS = {
  gamma: "https://gamma-api.polymarket.com",
  clob: "https://clob.polymarket.com",
  data: "https://data-api.polymarket.com",
} as const;
const TICKS = new Set(["0.1", "0.01", "0.005", "0.0025", "0.001", "0.0001"]);
const TIMEOUT_MS = 12_000;
const MAX_BODY_CHARS = 6_000_000;

export class PublicDataError extends Error {
  public readonly status: 400 | 502;
  constructor(message: string, status: 400 | 502 = 502) {
    super(message);
    this.name = "PublicDataError";
    this.status = status;
  }
}

export function isAccountAddress(value: unknown): value is string {
  return typeof value === "string" && /^0x[\da-fA-F]{40}$/.test(value);
}

export function isConditionId(value: unknown): value is string {
  return typeof value === "string" && /^0x[\da-fA-F]{64}$/.test(value);
}

export function isTokenId(value: unknown): value is string {
  return typeof value === "string" && /^(?:0|[1-9]\d{0,77})$/.test(value) && BigInt(value) <= UINT256_MAX;
}

export function isSearchQuery(value: unknown): value is string {
  return typeof value === "string" && value.length <= 120 && !/[\u0000-\u001f\u007f]/.test(value);
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new PublicDataError(`The provider returned invalid ${label}. Please refresh.`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, maxLength = 2000): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > maxLength) {
    throw new PublicDataError(`The provider omitted or malformed ${label}. Please refresh.`);
  }
  return value;
}

function decimal(value: unknown, label: string, options: { positive?: boolean; max?: string; stringOnly?: boolean } = {}): string {
  // Numeric compact metadata is accepted only as an already bounded value.
  // Network JSON numbers are preserved lexically by parsePublicJson below.
  if (!options.stringOnly && typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER) {
    value = new D(String(value)).toFixed();
  }
  if (typeof value !== "string" || !DECIMAL.test(value)) {
    throw new PublicDataError(`The provider returned invalid ${label}. Please refresh.`);
  }
  const parsed = new D(value);
  if ((options.positive && parsed.lte(0)) || (options.max && parsed.gt(options.max))) {
    throw new PublicDataError(`The provider returned out-of-range ${label}. Please refresh.`);
  }
  return parsed.isZero() ? "0" : parsed.toFixed();
}

function integer(value: unknown, label: string): number {
  if (typeof value === "string" && /^\d{1,16}$/.test(value)) value = Number(value);
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new PublicDataError(`The provider returned invalid ${label}. Please refresh.`);
  }
  return value;
}

function arrayField(value: unknown, label: string): unknown[] {
  if (typeof value === "string") {
    if (value.length > 100_000) throw new PublicDataError(`The provider returned oversized ${label}.`);
    try { value = JSON.parse(value); } catch { throw new PublicDataError(`The provider returned invalid ${label}.`); }
  }
  if (!Array.isArray(value) || value.length > 100) throw new PublicDataError(`The provider returned invalid ${label}.`);
  return value;
}

/** Preserve JSON numeric lexemes before binary rounding (supported Node runtime). */
export function parsePublicJson(body: string): unknown {
  try {
    return JSON.parse(body, (_key, value, context?: { source?: string }) => {
      if (typeof value !== "number") return value;
      if (!context?.source) throw new PublicDataError("This server cannot preserve provider decimal precision.");
      // Expand numeric exponent notation exactly, while bounding pathological exponents.
      if (!/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d{1,3})?$/.test(context.source)) {
        throw new PublicDataError("The provider returned an unsupported numeric value.");
      }
      const d = new D(context.source);
      if (!d.isFinite() || d.e > 100 || d.e < -100) throw new PublicDataError("The provider returned an out-of-range numeric value.");
      return d.toFixed();
    });
  } catch (error) {
    if (error instanceof PublicDataError) throw error;
    throw new PublicDataError("The provider returned unreadable market data. Please retry.");
  }
}

/** Null means explicitly non-tradeable, never a malformed active market. */
export function normalizeMarket(value: unknown): Market | null {
  const raw = record(value, "market data");
  if (raw.active !== true || raw.closed !== false || raw.acceptingOrders !== true || raw.archived === true || raw.enableOrderBook === false) return null;
  if (!isConditionId(raw.conditionId)) throw new PublicDataError("The provider returned a market without a valid condition ID.");
  const labels = arrayField(raw.outcomes, "market outcomes");
  const tokens = arrayField(raw.clobTokenIds, "market tokens");
  if (labels.length < 2 || tokens.length !== labels.length || new Set(tokens).size !== tokens.length || !tokens.every(isTokenId)) {
    throw new PublicDataError("Market outcomes could not be bound to unique token IDs.");
  }
  const prices = raw.outcomePrices == null ? labels.map(() => null) : arrayField(raw.outcomePrices, "outcome prices");
  if (prices.length !== labels.length) throw new PublicDataError("Market outcome prices do not match the token count.");
  const endDate = raw.endDate == null ? null : text(raw.endDate, "market end date", 100);
  if (endDate !== null && !Number.isFinite(Date.parse(endDate))) throw new PublicDataError("The provider returned an invalid market end date.");
  // Optional discovery metrics are display-only, not executable prices or balances.
  const volume24h = Number(decimal(raw.volume24hr ?? raw.volume24hrClob ?? "0", "24-hour market volume"));
  const liquidity = Number(decimal(raw.liquidityNum ?? raw.liquidity ?? "0", "market liquidity"));
  return {
    id: text(raw.id, "market ID", 100), conditionId: raw.conditionId.toLowerCase(),
    question: text(raw.question, "market question"), slug: text(raw.slug, "market slug", 512),
    category: typeof raw.category === "string" && raw.category.trim() ? raw.category.slice(0, 100) : "Markets",
    volume24h, liquidity, endDate,
    outcomes: labels.map((label, i) => ({
      label: text(label, "outcome label", 200), tokenId: tokens[i] as string,
      price: prices[i] === null ? null : decimal(prices[i], "outcome price", { max: "1" }),
    })),
    acceptingOrders: true, active: true,
  };
}

export function normalizeMarkets(payload: unknown, options: { search?: boolean; conditionId?: string } = {}): Market[] {
  let rows: unknown[];
  if (options.search) {
    const result = record(payload, "search results");
    // A valid empty search can omit events entirely.
    if (result.events === undefined && record(result.pagination, "search pagination")) rows = [];
    else if (Array.isArray(result.events) && result.events.length <= 100) {
      rows = result.events.flatMap((value) => {
        const event = record(value, "search event");
        if (!Array.isArray(event.markets) || event.markets.length > 500) throw new PublicDataError("The provider returned invalid event markets.");
        return event.markets;
      });
    } else throw new PublicDataError("The provider returned invalid market search results.");
  } else {
    if (!Array.isArray(payload) || payload.length > 500) throw new PublicDataError("The provider returned invalid market results.");
    rows = payload;
  }
  const markets = new Map<string, Market>();
  for (const row of rows) {
    const market = normalizeMarket(row);
    if (!market) continue;
    if (options.conditionId && market.conditionId !== options.conditionId.toLowerCase()) throw new PublicDataError("The condition lookup returned a different market.");
    const previous = markets.get(market.conditionId);
    if (previous && JSON.stringify(previous) !== JSON.stringify(market)) throw new PublicDataError("The provider returned conflicting copies of a market.");
    markets.set(market.conditionId, market);
  }
  return [...markets.values()];
}

function normalizeFee(value: unknown): OrderBook["fee"] {
  if (value === undefined || value === null) return { kind: "unknown", reason: "The market did not provide its fee schedule." };
  try {
    const fd = record(value, "fee schedule");
    const rate = decimal(fd.r, "fee rate", { max: "1" });
    if (rate === "0") return { kind: "none" };
    const exponent = integer(fd.e, "fee exponent");
    if (exponent > 8) throw new PublicDataError("Unsupported fee exponent.");
    return { kind: "known", rate, exponent };
  } catch {
    return { kind: "unknown", reason: "The supplied market fee schedule could not be verified." };
  }
}

function normalizeLevels(value: unknown, side: "bids" | "asks", tick: string): BookLevel[] {
  if (!Array.isArray(value) || value.length > 10_000) throw new PublicDataError(`The provider returned invalid ${side}.`);
  const prices = new Set<string>();
  const levels = Array.from(value).map((row) => {
    const raw = record(row, `${side} level`);
    const price = decimal(raw.price, `${side} price`, { stringOnly: true, positive: true, max: "1" });
    const size = decimal(raw.size, `${side} size`, { stringOnly: true, positive: true });
    if (price === "1" || !new D(price).mod(tick).isZero()) throw new PublicDataError(`The ${side} price does not match the current tick size.`);
    if (prices.has(price)) throw new PublicDataError(`The provider returned duplicate ${side} price levels. Refresh before planning.`);
    prices.add(price);
    return { price, size };
  });
  levels.sort((a, b) => side === "bids" ? new D(b.price).comparedTo(a.price) : new D(a.price).comparedTo(b.price));
  return levels;
}

export function normalizeOrderBook(
  value: unknown,
  metadata: unknown,
  expected: { tokenId: string; conditionId: string; fetchedAt: number },
): OrderBook {
  const raw = record(value, "order book");
  const meta = record(metadata, "market metadata");
  if (!isTokenId(expected.tokenId) || !isConditionId(expected.conditionId)) throw new PublicDataError("A valid token and condition ID are required.", 400);
  const condition = expected.conditionId.toLowerCase();
  if (raw.asset_id !== expected.tokenId || !isConditionId(raw.market) || raw.market.toLowerCase() !== condition ||
      !isConditionId(meta.c) || meta.c.toLowerCase() !== condition) {
    throw new PublicDataError("Order book and market identities do not match the selected outcome.");
  }
  if (!Array.isArray(meta.t) || meta.t.length < 2 || meta.t.length > 100) throw new PublicDataError("Market token membership could not be verified.");
  const tokens = meta.t.map((token) => {
    const item = record(token, "market token");
    if (!isTokenId(item.t)) throw new PublicDataError("The market returned an invalid token ID.");
    text(item.o, "market outcome label", 200);
    return item.t;
  });
  if (new Set(tokens).size !== tokens.length || !tokens.includes(expected.tokenId)) throw new PublicDataError("The selected token does not belong to the verified market.");
  if (typeof meta.ao !== "boolean") throw new PublicDataError("Whether this market accepts orders could not be verified.");
  const tickSize = decimal(raw.tick_size, "book tick size", { positive: true, max: "1" });
  const metaTick = decimal(meta.mts, "market tick size", { positive: true, max: "1" });
  const minOrderSize = decimal(raw.min_order_size, "minimum order size", { positive: true });
  const metaMin = decimal(meta.mos, "market minimum order size", { positive: true });
  if (!TICKS.has(tickSize) || tickSize !== metaTick || minOrderSize !== metaMin) throw new PublicDataError("Book and market trading constraints disagree. Please refresh.");
  const timestampMs = integer(raw.timestamp, "book timestamp");
  const fetchedAt = integer(expected.fetchedAt, "fetch timestamp");
  if (timestampMs > fetchedAt + 60_000) throw new PublicDataError("The provider returned an implausible future book timestamp.");
  const hash = text(raw.hash, "book hash", 128);
  if (!/^[\da-fA-F]{32,128}$/.test(hash)) throw new PublicDataError("The provider returned an invalid book hash.");
  const bids = normalizeLevels(raw.bids, "bids", tickSize);
  const asks = normalizeLevels(raw.asks, "asks", tickSize);
  if (bids[0] && asks[0] && new D(bids[0].price).gte(asks[0].price)) throw new PublicDataError("The order-book snapshot is crossed. Please refresh.");
  return { tokenId: expected.tokenId, bids, asks, tickSize, minOrderSize, timestampMs, fetchedAt, hash, fee: normalizeFee(meta.fd), acceptingOrders: meta.ao };
}

export interface PositionsPage { positions: Position[]; hasMore: boolean }

export function normalizePositions(payload: unknown, account: string): PositionsPage {
  if (!isAccountAddress(account)) throw new PublicDataError("Enter a valid 0x account address.", 400);
  const envelope = record(payload, "positions response");
  if (!Array.isArray(envelope.data) || envelope.data.length > 100) throw new PublicDataError("The provider returned invalid position rows.");
  const pagination = record(envelope.pagination, "positions pagination");
  if (typeof pagination.has_more !== "boolean") throw new PublicDataError("Position pagination could not be verified.");
  const seen = new Set<string>();
  const positions: Position[] = [];
  for (const value of envelope.data) {
    const raw = record(value, "position");
    if (!isAccountAddress(raw.proxy_wallet) || raw.proxy_wallet.toLowerCase() !== account.toLowerCase()) throw new PublicDataError("The returned positions do not match the requested account.");
    if (!isTokenId(raw.token_id) || !isConditionId(raw.condition_id)) throw new PublicDataError("A position could not be bound to its market and token.");
    if (seen.has(raw.token_id)) throw new PublicDataError("The provider returned duplicate positions.");
    seen.add(raw.token_id);
    const size = decimal(raw.current_size, "position size");
    const currentPrice = decimal(raw.current_price, "position price", { max: "1" });
    const currentValue = decimal(raw.current_value, "position value");
    if (typeof raw.redeemable !== "boolean") throw new PublicDataError("Position redemption state could not be verified.");
    const position: Position = {
      tokenId: raw.token_id, conditionId: raw.condition_id.toLowerCase(),
      title: text(raw.title, "position title"), outcome: text(raw.outcome, "position outcome", 200),
      size, currentPrice, value: currentValue, slug: text(raw.slug, "position slug", 512), redeemable: raw.redeemable,
    };
    if (new D(size).gte("0.001")) positions.push(position);
  }
  return { positions, hasMore: pagination.has_more };
}

type Fetcher = typeof globalThis.fetch;

async function requestJson(origin: keyof typeof ORIGINS, path: string, params: Record<string, string>, fetcher: Fetcher): Promise<unknown> {
  const url = new URL(path, ORIGINS[origin]);
  // Defense in depth: every caller below has a fixed path, with validated path IDs.
  if (url.origin !== ORIGINS[origin]) throw new PublicDataError("Unsupported public data endpoint.", 400);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  try {
    const response = await fetcher(url, {
      method: "GET", headers: { Accept: "application/json" },
      cache: "no-store", redirect: "error", credentials: "omit", signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new PublicDataError(`The market-data provider is unavailable (HTTP ${response.status}). Please retry.`);
    const body = await response.text();
    if (body.length > MAX_BODY_CHARS) throw new PublicDataError("The provider response exceeded the supported size.");
    return parsePublicJson(body);
  } catch (error) {
    if (error instanceof PublicDataError) throw error;
    throw new PublicDataError("Public market data could not be loaded within 12 seconds. Please retry.");
  }
}

export async function getMarkets(options: { q?: string; conditionId?: string } = {}, fetcher: Fetcher = globalThis.fetch): Promise<Market[]> {
  if (options.q !== undefined && !isSearchQuery(options.q)) throw new PublicDataError("Search must be at most 120 characters without control characters.", 400);
  if (options.conditionId !== undefined && !isConditionId(options.conditionId)) throw new PublicDataError("Enter a valid market condition ID.", 400);
  const q = options.q?.trim() ?? "";
  if (q && options.conditionId) throw new PublicDataError("Use a search term or a condition ID, not both.", 400);
  if (options.conditionId) {
    return normalizeMarkets(await requestJson("gamma", "/markets", { condition_ids: options.conditionId, limit: "2" }, fetcher), { conditionId: options.conditionId });
  }
  if (q) {
    return normalizeMarkets(await requestJson("gamma", "/public-search", {
      q, limit_per_type: "10", events_status: "active", keep_closed_markets: "0", search_profiles: "false", search_tags: "false",
    }, fetcher), { search: true });
  }
  return normalizeMarkets(await requestJson("gamma", "/markets", {
    active: "true", closed: "false", limit: "40", order: "volume24hr", ascending: "false",
  }, fetcher));
}

export async function getOrderBook(options: { tokenId: string; conditionId: string }, fetcher: Fetcher = globalThis.fetch): Promise<OrderBook> {
  if (!isTokenId(options.tokenId) || !isConditionId(options.conditionId)) throw new PublicDataError("A valid numeric token ID and market condition ID are required.", 400);
  const [book, metadata] = await Promise.all([
    requestJson("clob", "/book", { token_id: options.tokenId }, fetcher).then((raw) => ({ raw, fetchedAt: Date.now() })),
    requestJson("clob", `/clob-markets/${options.conditionId}`, {}, fetcher),
  ]);
  return normalizeOrderBook(book.raw, metadata, { ...options, fetchedAt: book.fetchedAt });
}

export async function getPositions(account: string, fetcher: Fetcher = globalThis.fetch): Promise<PositionsPage> {
  if (!isAccountAddress(account)) throw new PublicDataError("Enter a valid 0x account address.", 400);
  const payload = await requestJson("data", "/v2/positions", {
    user: account, limit: "100", status: "OPEN", filter_type: "TOKENS", filter_amount: "0.001",
  }, fetcher);
  return normalizePositions(payload, account);
}

export function readQueryParam(params: URLSearchParams, name: string): string | undefined {
  if (params.getAll(name).length > 1) throw new PublicDataError(`Supply ${name} only once.`, 400);
  return params.get(name) ?? undefined;
}

export function publicDataError(error: unknown): { error: string; status: 400 | 502 } {
  return error instanceof PublicDataError ? { error: error.message, status: error.status }
    : { error: "Public market data is unavailable. Please retry.", status: 502 };
}
