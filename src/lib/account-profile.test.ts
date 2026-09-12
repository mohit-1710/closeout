import { afterEach, describe, expect, it, vi } from "vitest";
import {
  accountProfileError,
  getAccountProfile,
  type AccountProfileSource,
} from "./account-profile";
import { GET } from "../app/api/profile/route";

const OWNER = `0x${"a".repeat(40)}`;
const ACCOUNT = `0x${"b".repeat(40)}`;
const OTHER = `0x${"c".repeat(40)}`;
const profile = (overrides: Record<string, unknown> = {}) => ({
  proxyWallet: ACCOUNT,
  name: "Alice-Trader",
  pseudonym: "Quiet-Market",
  displayUsernamePublic: true,
  ...overrides,
});
const json = (value: unknown, status = 200) => Response.json(value, { status });
const search = (profiles: unknown[] | null = [profile()], hasMore = false) => ({
  profiles,
  pagination: { hasMore, totalResults: 2 },
});
const fetcher = (...responses: Response[]) => {
  const mock = vi.fn<typeof fetch>();
  responses.forEach((response) => mock.mockResolvedValueOnce(response));
  return mock;
};
afterEach(() => vi.unstubAllGlobals());

describe("public wallet/account resolution", () => {
  it("resolves the owner to the position account and binds it with a second public lookup", async () => {
    const fetch = fetcher(json(profile()), json(profile()));
    await expect(getAccountProfile(OWNER, "wallet", fetch)).resolves.toEqual({
      accountAddress: ACCOUNT,
      displayName: "Alice-Trader",
      username: "Alice-Trader",
      resolvedFromProfile: true,
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(new URL(String(fetch.mock.calls[0][0])).searchParams.get("address")).toBe(OWNER);
    expect(new URL(String(fetch.mock.calls[1][0])).searchParams.get("address")).toBe(ACCOUNT);
    for (const [url, options] of fetch.mock.calls) {
      expect(new URL(String(url)).origin).toBe("https://gamma-api.polymarket.com");
      expect(options).toMatchObject({
        method: "GET",
        cache: "no-store",
        redirect: "error",
        credentials: "omit",
      });
      expect(options?.headers).toEqual({ Accept: "application/json" });
      expect(options?.signal).toBeInstanceOf(AbortSignal);
    }
  });

  it("accepts a profile explicitly mapped to the exact connected EOA, without guessing", async () => {
    const fetch = fetcher(json(profile({ proxyWallet: OWNER })));
    expect((await getAccountProfile(OWNER, "wallet", fetch)).accountAddress).toBe(OWNER);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("permits an explicitly supplied manual address only after actual HTTP 404", async () => {
    const fetch = fetcher(json({ error: "profile not found" }, 404));
    await expect(
      getAccountProfile(OWNER.toUpperCase().replace("0X", "0x"), "manual", fetch),
    ).resolves.toEqual({
      accountAddress: OWNER,
      displayName: null,
      username: null,
      resolvedFromProfile: false,
    });
  });

  it("never falls back from a missing connected-owner profile to the EOA", async () => {
    await expect(getAccountProfile(OWNER, "wallet", fetcher(json({}, 404)))).rejects.toMatchObject({
      status: 404,
    });
  });

  it.each([
    null,
    {},
    [],
    { proxyWallet: null },
    { proxyWallet: "invalid" },
    { proxyWallet: `0x${"0".repeat(40)}` },
  ])("does not turn malformed successful profile %j into address fallback", async (payload) => {
    await expect(getAccountProfile(OWNER, "manual", fetcher(json(payload)))).rejects.toMatchObject({
      status: 502,
    });
  });

  it.each([
    profile({ wallet: OTHER }),
    profile({ displayUsernamePublic: "yes" }),
    profile({ name: "bad\nname" }),
    profile({ pseudonym: 42 }),
  ])("rejects malformed or conflicting profile identity", async (payload) => {
    await expect(
      getAccountProfile(ACCOUNT, "manual", fetcher(json(payload))),
    ).rejects.toMatchObject({ status: 502 });
  });

  it.each([json(profile({ proxyWallet: OTHER })), json({}, 404)])(
    "rejects a changed/missing mapped account",
    async (second) => {
      await expect(
        getAccountProfile(OWNER, "wallet", fetcher(json(profile()), second)),
      ).rejects.toMatchObject({ status: 502 });
    },
  );

  it("uses the public pseudonym when the profile hides its chosen name", async () => {
    const result = await getAccountProfile(
      ACCOUNT,
      "manual",
      fetcher(json(profile({ displayUsernamePublic: false }))),
    );
    expect(result).toMatchObject({ displayName: "Quiet-Market", username: null });
  });
});

describe("profile names and links", () => {
  it.each([
    "@Alice-Trader",
    "alice-trader",
    "https://polymarket.com/@Alice-Trader",
    "https://www.polymarket.com/@Alice-Trader/?tab=positions#activity",
    "polymarket.com/@Alice-Trader",
  ])("resolves %s through a unique complete exact result and a bound profile", async (input) => {
    const fetch = fetcher(json(search()), json(profile()));
    expect((await getAccountProfile(input, "manual", fetch)).accountAddress).toBe(ACCOUNT);
    const url = new URL(String(fetch.mock.calls[0][0]));
    expect(url.pathname).toBe("/public-search");
    expect(url.searchParams.get("search_profiles")).toBe("true");
    expect(url.searchParams.has("tab")).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("can resolve the exact public pseudonym", async () => {
    const fetch = fetcher(json(search()), json(profile()));
    expect((await getAccountProfile("@Quiet-Market", "manual", fetch)).accountAddress).toBe(
      ACCOUNT,
    );
  });

  it.each([
    search([profile({ name: "Alice-Trader-fan" })]),
    search([profile()], true),
    search([profile(), profile({ proxyWallet: OTHER })]),
    search([profile(), profile()]),
    search([]),
    search(null),
  ])("never takes the first fuzzy, incomplete, missing or duplicate result", async (payload) => {
    const fetch = fetcher(json(payload));
    await expect(getAccountProfile("@Alice-Trader", "manual", fetch)).rejects.toMatchObject({
      status: 404,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    profile({ proxyWallet: OTHER }),
    profile({ name: "Different-Person", pseudonym: "Different-Pseudonym" }),
  ])("rejects a different account or changed handle in the profile cross-check", async (full) => {
    await expect(
      getAccountProfile("@Alice-Trader", "manual", fetcher(json(search()), json(full))),
    ).rejects.toMatchObject({ status: 502 });
  });

  it("does not use a search result after its profile disappears", async () => {
    await expect(
      getAccountProfile("@Alice-Trader", "manual", fetcher(json(search()), json({}, 404))),
    ).rejects.toMatchObject({ status: 404 });
  });

  it.each([
    { profiles: [profile()], pagination: {} },
    { profiles: {}, pagination: { hasMore: false } },
    search([profile({ proxyWallet: null })]),
    search(Array.from({ length: 11 }, () => profile())),
  ])("rejects malformed search envelopes", async (payload) => {
    await expect(
      getAccountProfile("@Alice-Trader", "manual", fetcher(json(payload))),
    ).rejects.toMatchObject({ status: 502 });
  });

  it.each([
    "",
    " ",
    "https://evil.example/@Alice-Trader",
    "http://polymarket.com/@Alice-Trader",
    "https://polymarket.com.evil.example/@Alice-Trader",
    "https://polymarket.com@evil.example/@Alice-Trader",
    "https://user:pass@polymarket.com/@Alice-Trader",
    "https://polymarket.com:444/@Alice-Trader",
    "https://polymarket.com/event/Alice-Trader",
    "https://polymarket.com/@Alice%2FTrader",
    "https://polymarket.com/@%ZZ",
    "javascript:alert(1)",
    "file:///etc/passwd",
    "//localhost/@Alice",
    "0x1234",
    `0x${"0".repeat(40)}`,
    "@a\nb",
    "@" + "a".repeat(101),
    "a".repeat(301),
  ])("rejects unsupported or unsafe input before any request: %s", async (input) => {
    const fetch = fetcher();
    await expect(getAccountProfile(input, "manual", fetch)).rejects.toMatchObject({ status: 400 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects a handle or arbitrary source for connected-wallet resolution", async () => {
    const fetch = fetcher();
    await expect(getAccountProfile("@Alice-Trader", "wallet", fetch)).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      getAccountProfile(OWNER, "other" as AccountProfileSource, fetch),
    ).rejects.toMatchObject({ status: 400 });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("provider boundaries and route", () => {
  it.each([400, 401, 403, 429, 500, 503])(
    "preserves provider HTTP %s as an error without fallback",
    async (status) => {
      await expect(
        getAccountProfile(OWNER, "manual", fetcher(json({}, status))),
      ).rejects.toMatchObject({ status: 502 });
    },
  );

  it("reports transport/timeout failure without leaking provider error text", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockRejectedValue(new Error("sensitive response detail"));
    await expect(getAccountProfile(OWNER, "manual", fetch)).rejects.toThrow("within 12 seconds");
  });

  it("rejects redirects even if a custom fetch implementation follows them", async () => {
    const response = json(profile());
    Object.defineProperty(response, "redirected", { value: true });
    await expect(getAccountProfile(ACCOUNT, "manual", fetcher(response))).rejects.toMatchObject({
      status: 502,
    });
  });

  it.each([
    new Response("not json"),
    new Response("{}", { headers: { "content-length": "1000001" } }),
    new Response(" ".repeat(1_000_001)),
  ])("bounds and validates the response body", async (response) => {
    await expect(getAccountProfile(OWNER, "manual", fetcher(response))).rejects.toMatchObject({
      status: 502,
    });
  });

  it("returns the profile contract without caching or authentication", async () => {
    const fetch = fetcher(json(profile()));
    vi.stubGlobal("fetch", fetch);
    const response = await GET(
      new Request(`https://closeout.test/api/profile?input=${ACCOUNT}&source=wallet`),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      profile: {
        accountAddress: ACCOUNT,
        displayName: "Alice-Trader",
        username: "Alice-Trader",
        resolvedFromProfile: true,
      },
    });
  });

  it.each([
    "",
    `input=${OWNER}&input=${ACCOUNT}`,
    `input=${OWNER}&source=wallet&source=manual`,
    `input=${OWNER}&source=other`,
  ])("rejects missing/ambiguous route parameters: %s", async (query) => {
    const fetch = fetcher();
    vi.stubGlobal("fetch", fetch);
    const response = await GET(new Request(`https://closeout.test/api/profile?${query}`));
    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps unknown-owner and upstream failures distinct in route responses", async () => {
    vi.stubGlobal("fetch", fetcher(json({}, 404), json({}, 503)));
    const request = () =>
      new Request(`https://closeout.test/api/profile?input=${OWNER}&source=wallet`);
    expect((await GET(request())).status).toBe(404);
    expect((await GET(request())).status).toBe(502);
    expect(accountProfileError(new Error("private detail"))).toEqual({
      error: "Polymarket profile lookup is unavailable. Please retry.",
      status: 502,
    });
  });
});
