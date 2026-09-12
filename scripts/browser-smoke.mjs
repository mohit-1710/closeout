import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";

// Run against an already-started app. Every profile/position/market/book response
// in Live mode is an explicit GET fixture. No wallet provider or financial write.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const origin = new URL(process.env.BASE_URL || "http://127.0.0.1:3000");
assert.ok(["http:", "https:"].includes(origin.protocol));
assert.ok(!origin.username && !origin.password && !origin.search && !origin.hash);
assert.equal(origin.pathname, "/");
const baseURL = origin.origin;
const label = process.env.QA_LABEL || "onboarding";
assert.match(label, /^[a-z0-9][a-z0-9-]{0,70}$/);
const output = path.join(root, ".artifacts/qa");
const stem = `browser-${label}`;
const report = {
  startedAt: new Date().toISOString(),
  baseURL,
  browser: "isolated Chromium",
  scope:
    "Position-first onboarding, controlled public GET fixtures, stale lookup responses, explicit example planning/review/activity and mobile recovery. No actual user portfolio, wallet connection, authentication, linking, signature, approval or real order. All writes are blocked.",
  checks: [],
  screenshots: [],
  pageErrors: [],
  consoleErrors: [],
  unexpectedWrites: [],
  blockedInitializationAnalytics: [],
  blockedCdnBackground: [],
  blockedWebSockets: [],
  fixtureViolations: [],
  fixtureRequests: [],
  delayedResponses: [],
};
const accountA = `0x${"1".repeat(40)}`,
  accountB = `0x${"2".repeat(40)}`;
function fixture(name, accountAddress, size, digit) {
  const conditionId = `0x${digit.repeat(64)}`,
    tokenId = `${digit}01`;
  const title = `Fixture ${name} position — simulated public response`;
  return {
    profile: {
      accountAddress,
      displayName: `Fixture ${name}`,
      username: name.toLowerCase(),
      resolvedFromProfile: true,
    },
    position: {
      tokenId,
      conditionId,
      title,
      outcome: "Yes",
      size,
      currentPrice: "0.62",
      value: "0",
      slug: `fixture-${name.toLowerCase()}`,
      redeemable: false,
    },
    market: {
      id: `fixture-${name}`,
      conditionId,
      question: title,
      slug: `fixture-${name.toLowerCase()}`,
      category: "QA fixture",
      volume24h: 0,
      liquidity: 0,
      endDate: null,
      active: true,
      acceptingOrders: true,
      outcomes: [
        { label: "Yes", tokenId, price: "0.62" },
        { label: "No", tokenId: `${digit}02`, price: "0.38" },
      ],
    },
  };
}
const alpha = fixture("Alpha", accountA, "80", "1"),
  beta = fixture("Beta", accountB, "12", "2");
const fixtures = [alpha, beta];
function book(f) {
  const now = Date.now();
  return {
    tokenId: f.position.tokenId,
    acceptingOrders: true,
    bids: [
      { price: "0.62", size: "10" },
      { price: "0.61", size: "15" },
      { price: "0.60", size: "25" },
      { price: "0.58", size: "50" },
    ],
    asks: [{ price: "0.63", size: "100" }],
    tickSize: "0.01",
    minOrderSize: "5",
    timestampMs: now,
    fetchedAt: now,
    hash: "explicit-browser-fixture",
    fee: { kind: "known", rate: "0.02", exponent: 1, roundingDecimals: 5 },
  };
}
function requestClass(method, target, headers = {}) {
  const url = new URL(target);
  const credential = [
    "authorization",
    "privy-authorization",
    "x-api-key",
    "poly-api-key",
    "poly-signature",
  ].some((key) => !!headers[key]);
  if (
    url.origin === "https://auth.privy.io" &&
    url.pathname.startsWith("/cdn-cgi/challenge-platform/")
  )
    return "cdn-background";
  if (
    method === "POST" &&
    url.origin === "https://auth.privy.io" &&
    url.pathname === "/api/v1/analytics_events" &&
    !url.search &&
    !credential
  )
    return "anonymous-initialization";
  if (credential) return "unexpected-write";
  return ["GET", "HEAD", "OPTIONS"].includes(method) ? "read" : "unexpected-write";
}
for (const [method, url, headers, kind] of [
  ["POST", "https://auth.privy.io/api/v1/analytics_events", {}, "anonymous-initialization"],
  [
    "POST",
    "https://auth.privy.io/api/v1/analytics_events",
    { authorization: "fixture" },
    "unexpected-write",
  ],
  ["PUT", "https://auth.privy.io/api/v1/analytics_events", {}, "unexpected-write"],
  ["POST", "https://auth.privy.io/api/v1/analytics_events?session=fixture", {}, "unexpected-write"],
  ["POST", "https://auth.privy.io.example.com/api/v1/analytics_events", {}, "unexpected-write"],
  ["POST", "https://auth.privy.io/api/v1/authenticate", {}, "unexpected-write"],
  ["POST", "https://clob.polymarket.com/order", {}, "unexpected-write"],
])
  assert.equal(requestClass(method, url, headers), kind);
async function hashes() {
  const values = {};
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (/\.(?:tsx?|css)$/.test(entry.name))
        values[path.relative(root, file)] = createHash("sha256")
          .update(await readFile(file))
          .digest("hex");
    }
  }
  await walk(path.join(root, "src"));
  values["scripts/browser-smoke.mjs"] = createHash("sha256")
    .update(await readFile(fileURLToPath(import.meta.url)))
    .digest("hex");
  return values;
}
await mkdir(output, { recursive: true });
report.sourceHashes = await hashes();
const browser = await chromium.launch({ headless: true });
const sessions = [];
let currentPage;
async function session(name, width = 1280) {
  const context = await browser.newContext({
    viewport: { width, height: width === 375 ? 812 : 1000 },
    reducedMotion: "reduce",
    acceptDownloads: true,
    serviceWorkers: "block",
  });
  const state = {
    profile: "ok",
    positions: "ok",
    book: "ok",
    delay: null,
    pending: [],
    counts: { profile: 0, positions: 0, markets: 0, book: 0 },
  };
  await context.routeWebSocket("**/*", async (socket) => {
    const url = new URL(socket.url()),
      httpOrigin = `${url.protocol === "wss:" ? "https:" : "http:"}//${url.host}`;
    if (httpOrigin === baseURL && ["/_next/hmr", "/_next/webpack-hmr"].includes(url.pathname))
      return socket.connectToServer();
    report.blockedWebSockets.push({ session: name, host: url.hostname, path: url.pathname });
    return socket.close();
  });
  async function reply(route, value, status = 200) {
    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(value) });
  }
  async function delayed(route, value, stage) {
    let release;
    const wait = new Promise((resolve) => {
      release = resolve;
    });
    const pending = { stage, release, released: false };
    state.pending.push(pending);
    await wait;
    pending.released = true;
    try {
      await reply(route, value);
      report.delayedResponses.push({
        session: name,
        stage,
        result: "fulfilled after input changed",
      });
    } catch {
      report.delayedResponses.push({
        session: name,
        stage,
        result: "superseded request was aborted",
      });
    }
  }
  await context.route("**/*", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    const kind = requestClass(request.method(), request.url(), request.headers());
    const metadata = {
      session: name,
      method: request.method(),
      host: url.hostname,
      path: kind === "cdn-background" ? "/cdn-cgi/challenge-platform/[redacted]" : url.pathname,
    };
    if (kind !== "read") {
      const list =
        kind === "anonymous-initialization"
          ? report.blockedInitializationAnalytics
          : kind === "cdn-background"
            ? report.blockedCdnBackground
            : report.unexpectedWrites;
      list.push(metadata);
      return route.abort("blockedbyclient");
    }
    if (url.origin === baseURL && url.pathname.startsWith("/api/")) {
      const endpoint = url.pathname.slice(5);
      report.fixtureRequests.push({ session: name, endpoint });
      if (!(endpoint in state.counts) || request.method() !== "GET") {
        report.fixtureViolations.push({
          session: name,
          endpoint,
          reason: "Unexpected app API request",
        });
        return reply(route, { error: "Unexpected fixture endpoint" }, 500);
      }
      state.counts[endpoint]++;
      if (endpoint === "profile") {
        const input = url.searchParams.get("input") || "";
        if (url.searchParams.get("source") !== "manual")
          report.fixtureViolations.push({
            session: name,
            endpoint,
            reason: "Lookup was not explicitly manual",
          });
        if (input.includes("invalid"))
          return reply(
            route,
            { error: "Enter a Polymarket profile link or account address." },
            400,
          );
        if (state.profile === "error")
          return reply(route, { error: "Fixture profile service unavailable. Please retry." }, 503);
        const f =
          input.toLowerCase().includes("beta") || input.toLowerCase() === accountB ? beta : alpha;
        if (state.delay === "profile" && f === alpha)
          return delayed(route, { profile: f.profile }, "profile");
        return reply(route, { profile: f.profile });
      }
      if (endpoint === "positions") {
        const f = fixtures.find(
          (item) => item.profile.accountAddress === url.searchParams.get("account"),
        );
        if (!f) {
          report.fixtureViolations.push({
            session: name,
            endpoint,
            reason: "Positions requested for an unbound account",
          });
          return reply(route, { error: "Unknown fixture account" }, 400);
        }
        if (state.positions === "error")
          return reply(
            route,
            { error: "Fixture positions service unavailable. Please retry." },
            503,
          );
        const value = {
          positions: state.positions === "empty" ? [] : [f.position],
          hasMore: false,
        };
        if (state.delay === "positions" && f === alpha) return delayed(route, value, "positions");
        return reply(route, value);
      }
      if (endpoint === "markets") {
        const f = fixtures.find(
          (item) => item.position.conditionId === url.searchParams.get("conditionId"),
        );
        if (!f)
          report.fixtureViolations.push({
            session: name,
            endpoint,
            reason: "Market browsing or unbound condition requested before a position was chosen",
          });
        return reply(route, { markets: f ? [f.market] : [] });
      }
      const f = fixtures.find(
        (item) =>
          item.position.conditionId === url.searchParams.get("conditionId") &&
          item.position.tokenId === url.searchParams.get("tokenId"),
      );
      if (!f) {
        report.fixtureViolations.push({
          session: name,
          endpoint,
          reason: "Book request did not bind both condition and token",
        });
        return reply(route, { error: "Unknown fixture book" }, 400);
      }
      if (state.book === "error")
        return reply(
          route,
          { error: "Fixture order book unavailable. Your position is unchanged." },
          503,
        );
      const snapshot = book(f);
      if (state.book === "empty") snapshot.bids = [];
      return reply(route, { book: snapshot });
    }
    if (url.hostname === "polymarket.com" && url.pathname === "/api/geoblock")
      return reply(
        route,
        { error: "Fixture eligibility unavailable; live execution remains blocked." },
        503,
      );
    return route.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", (error) =>
    report.pageErrors.push({ session: name, message: error.message }),
  );
  page.on("console", (entry) => {
    if (entry.type() === "error")
      report.consoleErrors.push({ session: name, message: entry.text() });
  });
  sessions.push({ context, state, name });
  currentPage = page;
  return { page, context, state };
}
async function check(name, run) {
  try {
    await run();
    report.checks.push({ name, passed: true });
    console.log(`PASS ${name}`);
  } catch (error) {
    report.checks.push({ name, passed: false, error: error.message });
    throw error;
  }
}
async function screenshot(page, suffix) {
  const filename = `${stem}-${suffix}.png`;
  await page.screenshot({
    path: path.join(output, filename),
    fullPage: !(await page.locator("dialog[open],#privy-dialog").count()),
    animations: "disabled",
  });
  report.screenshots.push(`.artifacts/qa/${filename}`);
}
async function noOverflow(page) {
  const box = await page.evaluate(() => ({
    width: innerWidth,
    body: document.body.scrollWidth,
    document: document.documentElement.scrollWidth,
  }));
  assert.ok(
    box.body <= box.width + 1 && box.document <= box.width + 1,
    `Overflow: ${JSON.stringify(box)}`,
  );
}
const input = (page) =>
  page.getByRole("textbox", { name: "Public profile or account address", exact: true });
async function fillProfile(page, value) {
  // The actual entry form disables this field until its handlers are mounted.
  // Type once after that user-visible readiness state; do not retry input/actions.
  await expect(input(page)).toBeEnabled();
  await input(page).fill(value);
  await expect(page.getByRole("button", { name: "Find positions", exact: true })).toBeEnabled();
}
async function enter(page, profile = "@alpha") {
  await fillProfile(page, profile);
  await page.getByRole("button", { name: "Find positions", exact: true }).click();
}
async function portfolio(page, f = alpha) {
  await expect(
    page.getByRole("heading", { name: "Choose a position to exit.", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: new RegExp(f.position.title.split(" —")[0]) }),
  ).toBeVisible();
}
async function choose(page, f = alpha) {
  await page.getByRole("button", { name: new RegExp(f.position.title.split(" —")[0]) }).click();
  await expect(page.getByRole("textbox", { name: "Shares to sell", exact: true })).toHaveValue(
    f.position.size,
  );
  await expect(page.getByRole("textbox", { name: "Minimum price", exact: true })).toHaveValue(
    "0.62",
  );
}
const estimate = (page) => page.getByRole("complementary", { name: "Exit estimate", exact: true });
const row = (page, label) =>
  estimate(page)
    .locator("dl > div")
    .filter({ has: page.getByText(label, { exact: true }) });
async function totals(page, filled, requested, unsold) {
  await expect(row(page, "Shares that can fill")).toContainText(`${filled} / ${requested}`);
  await expect(row(page, "Shares left unsold")).toContainText(unsold);
}
async function example(page) {
  await page.goto(`${baseURL}/app?mode=example`, { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Pick a sample position.", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Shares to sell", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: /Will the Atlas mission launch/ }).click();
  await expect(page.getByRole("textbox", { name: "Shares to sell", exact: true })).toHaveValue(
    "250",
  );
  await expect(page.getByRole("textbox", { name: "Minimum price", exact: true })).toHaveValue(
    "0.62",
  );
}
try {
  const live = await session("manual-desktop");
  const page = live.page;
  await page.goto(`${baseURL}/app`, { waitUntil: "domcontentloaded" });
  await check(
    "Fresh Live entry has no invented holding, selected market or profile/position/book fetch",
    async () => {
      await expect(input(page)).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /Bring your.*Polymarket positions/ }),
      ).toBeVisible();
      await expect(page.getByRole("textbox", { name: "Shares to sell", exact: true })).toHaveCount(
        0,
      );
      await expect(estimate(page)).toHaveCount(0);
      await fillProfile(page, "invalid / profile");
      await expect(page.getByRole("button", { name: "Find positions", exact: true })).toBeEnabled();
      assert.deepEqual(live.state.counts, { profile: 0, positions: 0, markets: 0, book: 0 });
      assert.equal(await page.evaluate(() => Boolean(window.ethereum || window.solana)), false);
      await noOverflow(page);
      await screenshot(page, "entry-desktop");
    },
  );
  await check(
    "Invalid input stays editable beside its error; no portfolio or sample fallback",
    async () => {
      await page.getByRole("button", { name: "Find positions", exact: true }).click();
      await expect(page.locator(".j-entry").getByRole("alert")).toContainText(/profile|account/i);
      await expect(input(page)).toHaveValue("invalid / profile");
      await expect(input(page)).toBeEditable();
      await expect(page.locator(".j-position-button")).toHaveCount(0);
      await expect(
        page.getByRole("heading", { name: "Pick a sample position.", exact: true }),
      ).toHaveCount(0);
    },
  );
  await check(
    "Profile failure can retry the same edited input and loads only its bound public positions",
    async () => {
      live.state.profile = "error";
      await enter(page);
      await expect(page.locator(".j-entry").getByRole("alert")).toContainText(
        "Fixture profile service unavailable",
      );
      await expect(input(page)).toBeEditable();
      assert.equal(live.state.counts.positions, 0);
      const before = live.state.counts.profile;
      live.state.profile = "ok";
      await page.getByRole("button", { name: "Find positions", exact: true }).click();
      await portfolio(page);
      assert.ok(live.state.counts.profile > before);
      assert.equal(live.state.counts.markets, 0);
      assert.equal(live.state.counts.book, 0);
      await expect(page.getByText("Read-only", { exact: false }).first()).toBeVisible();
      await screenshot(page, "public-portfolio");
    },
  );
  await check(
    "Selecting an 80-share holding produces a usable estimate and real holding fractions without wallet authorization",
    async () => {
      await choose(page);
      await totals(page, "10", "80", "70");
      await page.getByRole("button", { name: "25%", exact: true }).click();
      await expect(page.getByRole("textbox", { name: "Shares to sell", exact: true })).toHaveValue(
        "20",
      );
      await page.getByRole("button", { name: "All", exact: true }).click();
      await expect(page.getByRole("textbox", { name: "Shares to sell", exact: true })).toHaveValue(
        "80",
      );
      await page.getByRole("button", { name: /^Use minimum price 0\.60 / }).click();
      await totals(page, "50", "80", "30");
      await expect(estimate(page).locator(".j-net-value")).not.toContainText("—");
      await expect(page.locator("#privy-dialog")).toHaveCount(0);
      assert.deepEqual(report.unexpectedWrites, []);
      await noOverflow(page);
      await screenshot(page, "watch-only-plan");
    },
  );
  await check("Empty positions remain empty and provide an editable account route", async () => {
    const s = await session("empty-positions");
    s.state.positions = "empty";
    await s.page.goto(`${baseURL}/app`, { waitUntil: "domcontentloaded" });
    await enter(s.page);
    await expect(
      s.page.getByRole("heading", { name: "No positions found for this account", exact: true }),
    ).toBeVisible();
    await expect(s.page.locator(".j-position-button")).toHaveCount(0);
    await expect(estimate(s.page)).toHaveCount(0);
    await s.page.getByRole("button", { name: "Use another account", exact: true }).click();
    await expect(input(s.page)).toBeEditable();
    assert.equal(s.state.counts.book, 0);
  });
  await check(
    "Mobile lookup failure is visible in the active form and can recover without a hidden tab",
    async () => {
      const s = await session("mobile-error", 375);
      s.state.positions = "error";
      await s.page.goto(`${baseURL}/app`, { waitUntil: "domcontentloaded" });
      await enter(s.page);
      await expect(s.page.locator(".j-entry").getByRole("alert")).toContainText(
        "Fixture positions service unavailable",
      );
      await expect(input(s.page)).toBeEditable();
      await noOverflow(s.page);
      await screenshot(s.page, "lookup-error-mobile");
      s.state.positions = "ok";
      await s.page.getByRole("button", { name: "Find positions", exact: true }).click();
      await portfolio(s.page);
      await choose(s.page);
      await totals(s.page, "10", "80", "70");
      await noOverflow(s.page);
      await screenshot(s.page, "watch-only-plan-mobile");
    },
  );
  for (const stage of ["profile", "positions"]) {
    await check(
      `A late ${stage} response cannot replace the account chosen after editing the input`,
      async () => {
        const s = await session(`stale-${stage}`);
        s.state.delay = stage;
        await s.page.goto(`${baseURL}/app`, { waitUntil: "domcontentloaded" });
        await enter(s.page);
        await expect.poll(() => s.state.pending.length).toBe(1);
        await expect(input(s.page)).toBeEditable();
        await input(s.page).fill("@beta");
        await expect(
          s.page.getByRole("button", { name: "Find positions", exact: true }),
        ).toBeEnabled();
        await s.page.getByRole("button", { name: "Find positions", exact: true }).click();
        await portfolio(s.page, beta);
        s.state.pending[0].release();
        await expect.poll(() => s.state.pending[0].released).toBe(true);
        await s.page.waitForTimeout(100);
        await expect(s.page.getByRole("button", { name: /Fixture Alpha position/ })).toHaveCount(0);
        await choose(s.page, beta);
        await totals(s.page, "10", "12", "2");
      },
    );
  }
  await check(
    "A selected position with an unavailable book keeps the holding and exposes a useful quote retry",
    async () => {
      const s = await session("book-error");
      s.state.book = "error";
      await s.page.goto(`${baseURL}/app`, { waitUntil: "domcontentloaded" });
      await enter(s.page);
      await portfolio(s.page);
      await s.page.getByRole("button", { name: /Fixture Alpha position/ }).click();
      await expect(
        s.page.getByRole("textbox", { name: "Shares to sell", exact: true }),
      ).toHaveValue("80");
      await expect(
        s.page.getByRole("button", { name: "Retry live quote", exact: true }),
      ).toBeEnabled();
      await expect(s.page.getByText("Live estimate unavailable", { exact: true })).toBeVisible();
      await expect(
        s.page.getByRole("button", { name: /Verify account|Connect wallet to review/ }),
      ).toHaveCount(0);
      s.state.book = "ok";
      await s.page.getByRole("button", { name: "Retry live quote", exact: true }).click();
      await expect(s.page.getByRole("textbox", { name: "Minimum price", exact: true })).toHaveValue(
        "0.62",
      );
      await totals(s.page, "10", "80", "70");
      await expect(
        s.page.getByRole("textbox", { name: "Shares to sell", exact: true }),
      ).toHaveValue("80");
    },
  );
  await check(
    "A successful empty book reports no buyers and can refresh without inventing a floor or fill",
    async () => {
      const s = await session("empty-book");
      s.state.book = "empty";
      await s.page.goto(`${baseURL}/app`, { waitUntil: "domcontentloaded" });
      await enter(s.page);
      await portfolio(s.page);
      await s.page.getByRole("button", { name: /Fixture Alpha position/ }).click();
      await expect(
        s.page.getByRole("textbox", { name: "Shares to sell", exact: true }),
      ).toHaveValue("80");
      await expect(s.page.getByText("No buyers for this outcome", { exact: true })).toBeVisible();
      await expect(
        s.page.getByRole("button", { name: "Check for buyers", exact: true }),
      ).toBeEnabled();
      await expect(s.page.getByRole("textbox", { name: "Minimum price", exact: true })).toHaveValue(
        "",
      );
      await expect(
        s.page.getByRole("button", { name: "Set your minimum price", exact: true }),
      ).toHaveCount(0);
      await expect(
        s.page.getByRole("button", { name: /Verify account|Connect wallet to review/ }),
      ).toHaveCount(0);
      s.state.book = "ok";
      await s.page.getByRole("button", { name: "Check for buyers", exact: true }).click();
      await expect(s.page.getByRole("textbox", { name: "Minimum price", exact: true })).toHaveValue(
        "0.62",
      );
      await totals(s.page, "10", "80", "70");
    },
  );
  await check(
    "A recent public-profile bookmark fetches fresh holdings; Forget preserves separate fixture history and malformed bookmarks are ignored",
    async () => {
      const s = await session("recent-profile");
      await s.page.goto(`${baseURL}/app`, { waitUntil: "domcontentloaded" });
      await enter(s.page);
      await portfolio(s.page);
      // A valid terminal record is inserted solely to check storage isolation.
      // It has never been submitted, signed or associated with a real account.
      const syntheticHistory = JSON.stringify([
        {
          id: "qa-never-submitted",
          mode: "live",
          accountAddress: accountA,
          tokenId: alpha.position.tokenId,
          market: "QA fixture only — never submitted",
          outcome: "Yes",
          detail: "Synthetic terminal storage-isolation fixture; no network order exists.",
          status: "cancelled",
          requestedShares: "1",
          matchedShares: "0",
          settledShares: "0",
          price: "0.60",
          netReceipt: null,
          createdAt: 1,
          canCancel: false,
          transactionHashes: [],
          orderType: "FAK",
        },
      ]);
      await s.page.evaluate(
        (value) => localStorage.setItem("closeout-orders-v1", value),
        syntheticHistory,
      );
      const before = { ...s.state.counts };
      await s.page.reload({ waitUntil: "domcontentloaded" });
      await expect(input(s.page)).toBeEnabled();
      await expect(
        s.page.getByText("Recently viewed · public lookup", { exact: true }),
      ).toBeVisible();
      await expect(s.page.locator(".j-position-button")).toHaveCount(0);
      assert.deepEqual(
        s.state.counts,
        before,
        "Bookmark restored cached holdings or performed an automatic lookup.",
      );
      await s.page.getByRole("button", { name: "Continue with this profile", exact: true }).click();
      await portfolio(s.page);
      assert.equal(s.state.counts.profile, before.profile + 1);
      assert.equal(s.state.counts.positions, before.positions + 1);
      await s.page.getByRole("button", { name: "Change account", exact: true }).click();
      await s.page.getByRole("button", { name: "Forget", exact: true }).click();
      assert.equal(
        await s.page.evaluate(() => localStorage.getItem("closeout-recent-profile-v1")),
        null,
      );
      assert.equal(
        await s.page.evaluate(() => localStorage.getItem("closeout-orders-v1")),
        syntheticHistory,
      );
      await s.page.evaluate(() =>
        localStorage.setItem(
          "closeout-recent-profile-v1",
          '{"accountAddress":"invalid","displayName":"Malformed QA bookmark"}',
        ),
      );
      const after = { ...s.state.counts };
      await s.page.reload({ waitUntil: "domcontentloaded" });
      await expect(input(s.page)).toBeEnabled();
      await expect(
        s.page.getByRole("button", { name: "Continue with this profile", exact: true }),
      ).toHaveCount(0);
      await expect(s.page.locator(".j-position-button")).toHaveCount(0);
      assert.deepEqual(s.state.counts, after);
    },
  );
  const sample = await session("explicit-example");
  const ex = sample.page;
  await check(
    "Example starts at a fictional portfolio, then Atlas at best bid estimates 30 fillable and 220 unsold",
    async () => {
      await example(ex);
      await totals(ex, "30", "250", "220");
      assert.deepEqual(sample.state.counts, { profile: 0, positions: 0, markets: 0, book: 0 });
      await expect(ex.getByText("Fictional estimate", { exact: true })).toBeVisible();
    },
  );
  await check(
    "Actual bid floor controls change fillable shares and FOK offers a safe correction instead of a partial submission",
    async () => {
      await ex.getByRole("button", { name: /^Use minimum price 0\.60 / }).click();
      await totals(ex, "140", "250", "110");
      await ex.getByRole("textbox", { name: "Minimum price", exact: true }).fill("0.58");
      await totals(ex, "230", "250", "20");
      await ex.getByRole("button", { name: /^Use minimum price 0\.60 / }).click();
      await ex.getByRole("radio", { name: /^All or nothing/ }).check();
      await expect(
        ex.getByText("The full amount cannot fill at this floor", { exact: true }),
      ).toBeVisible();
      await expect(ex.getByText("No fill under all-or-nothing", { exact: true })).toBeVisible();
      await totals(ex, "0", "250", "250");
      await expect(
        ex.getByRole("button", { name: "Review simulated exit", exact: true }),
      ).toHaveCount(0);
      await expect(ex.getByRole("button", { name: "Simulate exit", exact: true })).toHaveCount(0);
      await ex.getByRole("button", { name: "Switch to sell available", exact: true }).click();
      await expect(ex.getByRole("radio", { name: /^Sell available/ })).toBeChecked();
      await screenshot(ex, "example-plan-desktop");
    },
  );
  await check(
    "Review has Back and Escape; only explicit Simulate creates one fictional Activity entry and a useful next step",
    async () => {
      const trigger = ex.getByRole("button", { name: "Review simulated exit", exact: true });
      const dialog = ex.getByRole("dialog", { name: "Review simulated exit", exact: true });
      await trigger.click();
      await expect(
        dialog.getByRole("button", { name: "Simulate exit", exact: true }),
      ).toBeEnabled();
      await dialog.getByRole("button", { name: "Back to plan", exact: true }).click();
      await expect(dialog).not.toBeVisible();
      await expect(trigger).toBeFocused();
      await trigger.click();
      await expect(
        dialog.getByRole("button", { name: "Simulate exit", exact: true }),
      ).toBeEnabled();
      await ex.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
      await expect(trigger).toBeFocused();
      await trigger.click();
      await expect(
        dialog.getByRole("button", { name: "Simulate exit", exact: true }),
      ).toBeEnabled();
      await screenshot(ex, "example-review");
      await dialog.getByRole("button", { name: "Simulate exit", exact: true }).click();
      await expect(ex.getByRole("heading", { name: "Activity.", exact: true })).toBeVisible();
      await expect(ex.locator(".j-order")).toHaveCount(1);
      await expect(ex.getByText("Partially settled", { exact: true })).toBeVisible();
      await expect(ex.getByText("Simulated", { exact: true })).toBeVisible();
      await expect(
        ex.getByRole("heading", { name: "You’ve walked through an exit.", exact: true }),
      ).toBeVisible();
      await expect(
        ex.getByRole("button", { name: "Bring my real positions", exact: true }),
      ).toBeVisible();
      await expect(
        ex.getByRole("button", { name: "Adjust the sample plan", exact: true }),
      ).toBeVisible();
      await screenshot(ex, "example-activity");
    },
  );
  await check(
    "Export preserves fictional attribution and no real transaction evidence; real-positions CTA returns to intake",
    async () => {
      const waiting = ex.waitForEvent("download");
      await ex.getByRole("button", { name: "Export activity", exact: true }).click();
      const download = await waiting,
        data = JSON.parse(await readFile(await download.path(), "utf8"));
      assert.equal(data.mode, "example");
      assert.match(data.notice, /FICTIONAL EXAMPLE/);
      assert.equal(data.orders.length, 1);
      assert.equal(data.orders[0].settledShares, "140");
      assert.deepEqual(data.orders[0].transactionHashes, []);
      await ex.getByRole("button", { name: "Bring my real positions", exact: true }).click();
      await expect(input(ex)).toBeVisible();
      await expect(estimate(ex)).toHaveCount(0);
    },
  );
  await check(
    "The same guided example works at 375px and 760px with a contained review dialog",
    async () => {
      const s = await session("mobile-example", 375);
      await example(s.page);
      await totals(s.page, "30", "250", "220");
      await s.page.getByRole("button", { name: /^Use minimum price 0\.60 / }).click();
      await totals(s.page, "140", "250", "110");
      await noOverflow(s.page);
      await screenshot(s.page, "example-plan-mobile");
      await s.page.getByRole("button", { name: "See estimate", exact: true }).click();
      await expect(estimate(s.page)).toBeInViewport();
      await expect(s.page.locator("dialog[open]")).toHaveCount(0);
      await s.page.getByRole("button", { name: "Review simulated exit", exact: true }).click();
      const dialog = s.page.getByRole("dialog", { name: "Review simulated exit", exact: true });
      await expect(
        dialog.getByRole("button", { name: "Simulate exit", exact: true }),
      ).toBeEnabled();
      const bounds = await dialog.boundingBox();
      assert.ok(
        bounds && bounds.width <= 375 && bounds.height <= 812,
        "Mobile review exceeds viewport",
      );
      await screenshot(s.page, "example-review-mobile");
      await s.page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
      await s.page.setViewportSize({ width: 760, height: 1024 });
      await noOverflow(s.page);
      await expect(estimate(s.page)).toBeVisible();
      await screenshot(s.page, "example-plan-tablet");
    },
  );
  await check(
    "No fixture crossed account/token boundaries and no wallet/auth/financial action was attempted",
    async () => {
      assert.deepEqual(report.pageErrors, []);
      assert.deepEqual(report.unexpectedWrites, []);
      assert.deepEqual(report.blockedWebSockets, []);
      assert.deepEqual(report.fixtureViolations, []);
      for (const { context } of sessions)
        for (const p of context.pages()) {
          assert.equal(await p.locator("#privy-dialog").count(), 0);
          assert.equal(await p.evaluate(() => Boolean(window.ethereum || window.solana)), false);
        }
    },
  );
  report.sourceHashesAfter = await hashes();
  await check("Source stayed stable during the onboarding run", async () =>
    assert.deepEqual(report.sourceHashesAfter, report.sourceHashes),
  );
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.failure = error.stack || String(error);
  process.exitCode = 1;
  if (currentPage) await screenshot(currentPage, "failure").catch(() => {});
  console.error(report.failure);
} finally {
  for (const s of sessions) for (const pending of s.state.pending) pending.release();
  await Promise.allSettled(sessions.map((s) => s.context.close()));
  await browser.close();
  report.finishedAt = new Date().toISOString();
  await writeFile(path.join(output, `${stem}.json`), `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    JSON.stringify(
      { passed: report.passed, checks: report.checks.length, report: `.artifacts/qa/${stem}.json` },
      null,
      2,
    ),
  );
}
