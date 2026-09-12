// Public identity discovery only. This module never creates a secure SDK client.
// Checked September 12, 2026:
// https://docs.polymarket.com/api-reference/profiles/get-public-profile-by-wallet-address
// https://docs.polymarket.com/api-reference/search/search-markets-events-and-profiles
// Raw Gamma proxyWallet is named wallet by @polymarket/client 0.10.0; this adapter uses raw Gamma.

export interface AccountProfile {
  accountAddress: string;
  displayName: string | null;
  username: string | null;
  resolvedFromProfile: boolean;
}

export type AccountProfileSource = "wallet" | "manual";
type Fetcher = typeof globalThis.fetch;
type ParsedInput = { kind: "address" | "handle"; value: string };
type ProfileIdentity = {
  address: string;
  name: string | null;
  pseudonym: string | null;
  publicName: boolean;
};

const GAMMA_ORIGIN = "https://gamma-api.polymarket.com";
const MAX_BODY_BYTES = 1_000_000;
const TIMEOUT_MS = 12_000;
const ADDRESS = /^0x[\da-fA-F]{40}$/;
const HANDLE = /^[A-Za-z0-9_.-]{1,100}$/;
const ZERO_ADDRESS = `0x${"0".repeat(40)}`;
const NOT_FOUND = Symbol("profile-not-found");
const UNRESOLVED =
  "We could not identify a unique Polymarket profile. Paste the account address from your Polymarket profile menu.";

export class AccountProfileError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 404 | 502 = 502,
  ) {
    super(message);
    this.name = "AccountProfileError";
  }
}

function isAddress(value: unknown): boolean {
  return typeof value === "string" && ADDRESS.test(value) && value.toLowerCase() !== ZERO_ADDRESS;
}

function parseInput(input: string, source: AccountProfileSource): ParsedInput {
  if (typeof input !== "string" || input.length > 300 || /[\u0000-\u001f\u007f]/.test(input)) {
    throw new AccountProfileError(
      "Enter a Polymarket account address or a valid profile link.",
      400,
    );
  }
  const value = input.trim();
  if (isAddress(value)) return { kind: "address", value: value.toLowerCase() };
  if (source === "wallet") {
    throw new AccountProfileError("A valid connected-wallet address is required.", 400);
  }
  let handle = value.startsWith("@") ? value.slice(1) : value;
  if (/^(?:https?:\/\/|www\.|polymarket\.com\/)/i.test(value)) {
    let url: URL;
    try {
      url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    } catch {
      throw new AccountProfileError(
        "Paste a valid Polymarket profile link or account address.",
        400,
      );
    }
    if (
      url.protocol !== "https:" ||
      !["polymarket.com", "www.polymarket.com"].includes(url.hostname) ||
      url.username ||
      url.password ||
      url.port ||
      !/^\/@[^/]+\/?$/.test(url.pathname)
    ) {
      throw new AccountProfileError(
        "Use a polymarket.com/@profile link or paste the account address.",
        400,
      );
    }
    try {
      handle = decodeURIComponent(url.pathname.replace(/^\/@/, "").replace(/\/$/, ""));
    } catch {
      throw new AccountProfileError(
        "The profile link contains invalid text. Paste the account address instead.",
        400,
      );
    }
    // Query strings and fragments are never forwarded to Gamma.
  }
  if (isAddress(handle)) return { kind: "address", value: handle.toLowerCase() };
  if (!HANDLE.test(handle) || handle.startsWith("0x") || /^https?:/i.test(handle)) {
    throw new AccountProfileError(
      "Use a profile name containing letters, numbers, dots, dashes or underscores, or paste the account address.",
      400,
    );
  }
  return { kind: "handle", value: handle };
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AccountProfileError(`Polymarket returned an invalid ${label}. Please retry.`);
  }
  return value as Record<string, unknown>;
}

function optionalName(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || value.length > 200 || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new AccountProfileError("Polymarket returned an invalid profile name. Please retry.");
  }
  return value.trim() || null;
}

function identity(payload: unknown): ProfileIdentity {
  const raw = object(payload, "profile");
  if (typeof raw.proxyWallet !== "string" || !isAddress(raw.proxyWallet)) {
    throw new AccountProfileError(
      "Polymarket did not return a valid position-account address. Paste the account address from your profile menu.",
    );
  }
  if (
    raw.wallet !== undefined &&
    (typeof raw.wallet !== "string" || raw.wallet.toLowerCase() !== raw.proxyWallet.toLowerCase())
  ) {
    throw new AccountProfileError(
      "Polymarket returned conflicting account addresses. Please retry.",
    );
  }
  if (
    raw.displayUsernamePublic !== undefined &&
    raw.displayUsernamePublic !== null &&
    typeof raw.displayUsernamePublic !== "boolean"
  ) {
    throw new AccountProfileError("Polymarket returned invalid profile visibility. Please retry.");
  }
  return {
    address: raw.proxyWallet.toLowerCase(),
    name: optionalName(raw.name),
    pseudonym: optionalName(raw.pseudonym),
    publicName: raw.displayUsernamePublic !== false,
  };
}

function matchesHandle(profile: ProfileIdentity, handle: string): boolean {
  const target = handle.toLowerCase();
  return [profile.name, profile.pseudonym].some((name) => name?.toLowerCase() === target);
}

async function boundedText(response: Response): Promise<string> {
  const length = response.headers.get("content-length");
  if (length !== null && /^\d+$/.test(length) && Number(length) > MAX_BODY_BYTES) {
    await response.body?.cancel();
    throw new AccountProfileError("The profile response exceeded the supported size.");
  }
  if (!response.body)
    throw new AccountProfileError("Polymarket returned an empty profile response.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new AccountProfileError("The profile response exceeded the supported size.");
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

async function request(
  path: "/public-profile" | "/public-search",
  params: Record<string, string>,
  fetcher: Fetcher,
): Promise<unknown> {
  const url = new URL(path, GAMMA_ORIGIN);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  try {
    const response = await fetcher(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      redirect: "error",
      credentials: "omit",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.redirected || (response.url && new URL(response.url).origin !== GAMMA_ORIGIN)) {
      throw new AccountProfileError("The profile provider returned an unexpected destination.");
    }
    if (response.status === 404 && path === "/public-profile") {
      await response.body?.cancel();
      return NOT_FOUND;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new AccountProfileError(
        `Polymarket profile lookup is unavailable (HTTP ${response.status}). Please retry.`,
      );
    }
    const text = await boundedText(response);
    try {
      return JSON.parse(text);
    } catch {
      throw new AccountProfileError("Polymarket returned unreadable profile data. Please retry.");
    }
  } catch (error) {
    if (error instanceof AccountProfileError) throw error;
    throw new AccountProfileError(
      "Polymarket profile lookup could not complete within 12 seconds. Please retry.",
    );
  }
}

function result(profile: ProfileIdentity): AccountProfile {
  return {
    accountAddress: profile.address,
    displayName: (profile.publicName ? profile.name : null) ?? profile.pseudonym,
    username: profile.publicName ? profile.name : null,
    resolvedFromProfile: true,
  };
}

/** Resolves public identity, not ownership or trading permission. */
export async function getAccountProfile(
  input: string,
  source: AccountProfileSource = "manual",
  fetcher: Fetcher = globalThis.fetch,
): Promise<AccountProfile> {
  if (source !== "wallet" && source !== "manual") {
    throw new AccountProfileError("Source must be wallet or manual.", 400);
  }
  const parsed = parseInput(input, source);
  if (parsed.kind === "address") {
    const raw = await request("/public-profile", { address: parsed.value }, fetcher);
    if (raw === NOT_FOUND) {
      if (source === "wallet") throw new AccountProfileError(UNRESOLVED, 404);
      return {
        accountAddress: parsed.value,
        displayName: null,
        username: null,
        resolvedFromProfile: false,
      };
    }
    const profile = identity(raw);
    if (profile.address !== parsed.value) {
      const bound = await request("/public-profile", { address: profile.address }, fetcher);
      if (bound === NOT_FOUND || identity(bound).address !== profile.address) {
        throw new AccountProfileError(
          "Polymarket returned an inconsistent account mapping. Please retry.",
        );
      }
    }
    return result(profile);
  }

  const raw = object(
    await request(
      "/public-search",
      {
        q: parsed.value,
        search_profiles: "true",
        search_tags: "false",
        limit_per_type: "10",
        page: "1",
      },
      fetcher,
    ),
    "profile search",
  );
  const pagination = object(raw.pagination, "profile pagination");
  const rawProfiles = raw.profiles ?? [];
  if (
    typeof pagination.hasMore !== "boolean" ||
    !Array.isArray(rawProfiles) ||
    rawProfiles.length > 10
  ) {
    throw new AccountProfileError(
      "Polymarket returned incomplete profile search data. Paste the account address instead.",
    );
  }
  const profiles = rawProfiles.map(identity);
  const matches = profiles.filter((profile) => matchesHandle(profile, parsed.value));
  // A partial page, duplicate or fuzzy match is not a unique identity.
  if (pagination.hasMore || matches.length !== 1) throw new AccountProfileError(UNRESOLVED, 404);
  const candidate = matches[0];
  const full = await request("/public-profile", { address: candidate.address }, fetcher);
  if (full === NOT_FOUND) throw new AccountProfileError(UNRESOLVED, 404);
  const profile = identity(full);
  if (profile.address !== candidate.address || !matchesHandle(profile, parsed.value)) {
    throw new AccountProfileError(
      "The profile changed or could not be verified. Paste its account address instead.",
    );
  }
  return result(profile);
}

export function accountProfileError(error: unknown): { error: string; status: 400 | 404 | 502 } {
  return error instanceof AccountProfileError
    ? { error: error.message, status: error.status }
    : { error: "Polymarket profile lookup is unavailable. Please retry.", status: 502 };
}
