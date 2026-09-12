import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";

// Run against an already-started app. This script uses a new browser, no saved
// profile, no injected provider, and no wallet/auth/order interaction. It never
// starts a server or reads .env files. BASE_URL must be an origin, not a route.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = ".artifacts/qa";
const output = path.join(root, outputDirectory);
const configuredURL = new URL(process.env.BASE_URL || "http://127.0.0.1:3000");
assert.ok(["http:", "https:"].includes(configuredURL.protocol));
assert.ok(
  !configuredURL.username &&
    !configuredURL.password &&
    !configuredURL.search &&
    !configuredURL.hash,
);
assert.equal(configuredURL.pathname, "/", "BASE_URL must be an origin.");
const baseURL = configuredURL.origin;
const label = process.env.QA_LABEL || "onboarding";
assert.match(label, /^[a-z0-9][a-z0-9-]{0,70}$/);
const stem = `site-${label}`;
const publicPaths = ["/", "/product", "/how-it-works"];
const sizes = [
  { width: 1440, height: 1000 },
  { width: 760, height: 1024 },
  { width: 375, height: 812 },
];
const report = {
  startedAt: new Date().toISOString(),
  baseURL,
  browser: "isolated Chromium",
  scope:
    "Real public routes, navigation, explicit synthetic example entry, interactive hero math, responsive layout and image responses. No wallet selection, authentication, signing, order, approval or fund movement. Marketing contexts reject wallet/auth/trading requests; all contexts reject writes except exact anonymous Privy initialization analytics after deliberate workspace entry.",
  checks: [],
  screenshots: [],
  pages: [],
  assets: [],
  focusChecks: [],
  pageErrors: [],
  consoleErrors: [],
  unexpectedWrites: [],
  marketingServiceRequests: [],
  allowedAnonymousAnalytics: [],
  blockedCdnBackground: [],
  blockedWebSockets: [],
  requestCounts: {},
  workspaceDataRequests: [],
};

const isRead = (method) => ["GET", "HEAD", "OPTIONS"].includes(method);
const hasCredential = (headers) =>
  ["authorization", "privy-authorization", "x-api-key", "poly-api-key", "poly-signature"].some(
    (name) => Boolean(headers[name]),
  );
function isAnonymousAnalytics(method, target, headers = {}) {
  const url = new URL(target);
  return (
    method === "POST" &&
    url.origin === "https://auth.privy.io" &&
    url.pathname === "/api/v1/analytics_events" &&
    !url.search &&
    !hasCredential(headers)
  );
}
function isWalletOrTrading(target) {
  const url = new URL(target);
  const hostname = url.hostname.toLowerCase();
  if (hostname === "privy.io" || hostname.endsWith(".privy.io")) return true;
  if (
    ["walletconnect.com", "walletconnect.org", "walletconnect.network"].some(
      (host) => hostname === host || hostname.endsWith(`.${host}`),
    )
  )
    return true;
  if (
    [
      "clob.polymarket.com",
      "gamma-api.polymarket.com",
      "data-api.polymarket.com",
      "relayer-v2.polymarket.com",
    ].includes(hostname)
  )
    return true;
  if (hostname === "polymarket.com" && url.pathname.startsWith("/api/")) return true;
  return (
    url.origin === baseURL &&
    /^\/api\/(?:profile|markets|book|positions|auth|session|orders?|trades?|wallet)(?:\/|$)/.test(
      url.pathname,
    )
  );
}
const guardCases = [
  ["POST", "https://auth.privy.io/api/v1/analytics_events", {}, true],
  ["POST", "https://auth.privy.io/api/v1/analytics_events", { authorization: "fixture" }, false],
  [
    "POST",
    "https://auth.privy.io/api/v1/analytics_events",
    { "privy-authorization": "fixture" },
    false,
  ],
  ["PUT", "https://auth.privy.io/api/v1/analytics_events", {}, false],
  ["POST", "https://auth.privy.io/api/v1/analytics_events?session=fixture", {}, false],
  ["POST", "https://auth.privy.io/api/v1/analytics_events/extra", {}, false],
  ["POST", "https://auth.privy.io.example.com/api/v1/analytics_events", {}, false],
  ["POST", "https://auth.privy.io/api/v1/authenticate", {}, false],
  ["POST", "https://clob.polymarket.com/order", {}, false],
];
for (const [method, url, headers, expected] of guardCases)
  assert.equal(isAnonymousAnalytics(method, url, headers), expected);
report.routeGuardChecks = guardCases.length;

async function sourceHashes() {
  const result = {};
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (/\.(?:tsx?|css|svg)$/.test(entry.name))
        result[path.relative(root, file)] = createHash("sha256")
          .update(await readFile(file))
          .digest("hex");
    }
  }
  await walk(path.join(root, "src"));
  result["scripts/site-smoke.mjs"] = createHash("sha256")
    .update(await readFile(fileURLToPath(import.meta.url)))
    .digest("hex");
  return result;
}
await mkdir(output, { recursive: true });
report.sourceHashes = await sourceHashes();
const browser = await chromium.launch({ headless: true });
let currentPage;
const contexts = [];

async function newPage(name) {
  const context = await browser.newContext({
    viewport: sizes[0],
    reducedMotion: "reduce",
    serviceWorkers: "block",
  });
  contexts.push(context);
  const state = { name, phase: "marketing" };
  await context.routeWebSocket("**/*", async (socket) => {
    const url = new URL(socket.url());
    const httpOrigin = `${url.protocol === "wss:" ? "https:" : "http:"}//${url.host}`;
    if (httpOrigin === baseURL && ["/_next/hmr", "/_next/webpack-hmr"].includes(url.pathname)) {
      socket.connectToServer(); // Local Next development refresh only.
      return;
    }
    report.blockedWebSockets.push({
      context: name,
      phase: state.phase,
      host: url.hostname,
      path: url.pathname,
    });
    await socket.close(); // No connection is made to the original server.
  });
  await context.route("**/*", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    const cdnBackground =
      url.origin === "https://auth.privy.io" &&
      url.pathname.startsWith("/cdn-cgi/challenge-platform/");
    // Never record bodies, headers, query strings, cookies or opaque challenge IDs.
    const metadata = {
      context: name,
      phase: state.phase,
      method: request.method(),
      host: url.hostname,
      path: cdnBackground ? "/cdn-cgi/challenge-platform/[redacted]" : url.pathname,
    };
    const key = `${state.phase}:${url.hostname}`;
    report.requestCounts[key] = (report.requestCounts[key] || 0) + 1;
    if (
      state.phase === "workspace" &&
      url.origin === baseURL &&
      /^\/api\/(profile|positions|markets|book)$/.test(url.pathname)
    ) {
      report.workspaceDataRequests.push(metadata);
    }
    if (state.phase === "marketing" && isWalletOrTrading(request.url())) {
      report.marketingServiceRequests.push(metadata);
      return route.abort("blockedbyclient");
    }
    // Known automatic CDN writes are blocked and reported, not treated as an
    // authenticated operation. They are never allowed through this exception.
    if (cdnBackground) {
      report.blockedCdnBackground.push(metadata);
      return route.abort("blockedbyclient");
    }
    if (!isRead(request.method())) {
      if (
        state.phase === "workspace" &&
        isAnonymousAnalytics(request.method(), request.url(), request.headers())
      ) {
        report.allowedAnonymousAnalytics.push(metadata);
      } else {
        report.unexpectedWrites.push(metadata);
        return route.abort("blockedbyclient");
      }
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  page.on("pageerror", (error) =>
    report.pageErrors.push({ context: name, message: error.message }),
  );
  page.on("console", (entry) => {
    if (entry.type() === "error")
      report.consoleErrors.push({ context: name, message: entry.text() });
  });
  currentPage = page;
  return { page, context, state };
}
async function check(name, action) {
  try {
    await action();
    report.checks.push({ name, passed: true });
    console.log(`PASS ${name}`);
  } catch (error) {
    report.checks.push({ name, passed: false, error: error.message });
    throw error;
  }
}
async function screenshot(page, suffix, fullPage = true) {
  const filename = `${stem}-${suffix}.png`;
  await page.screenshot({ path: path.join(output, filename), fullPage, animations: "disabled" });
  report.screenshots.push(`${outputDirectory}/${filename}`);
}
async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}
async function loadPublic(page, pathname) {
  const response = await page.goto(new URL(pathname, baseURL).href, {
    waitUntil: "domcontentloaded",
  });
  assert.equal(response?.status(), 200, `${pathname} did not return HTTP200`);
  await expect(page.locator("main")).toHaveCount(1);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("h1")).toBeVisible();
  await settle(page);
  assert.equal(new URL(page.url()).origin, baseURL);
  assert.equal(new URL(page.url()).pathname, pathname);
  report.pages.push({
    pathname,
    status: response.status(),
    title: await page.title(),
    h1: await page.locator("h1").innerText(),
  });
}
async function noOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    viewport: innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    offenders: Array.from(document.querySelectorAll("main *,header *,footer *"))
      .filter((element) => {
        const box = element.getBoundingClientRect(),
          style = getComputedStyle(element);
        return (
          box.width > 0 &&
          style.visibility !== "hidden" &&
          (box.left < -1 || box.right > innerWidth + 1)
        );
      })
      .slice(0, 8)
      .map((element) => ({ tag: element.tagName, class: String(element.className).slice(0, 120) })),
  }));
  assert.ok(
    dimensions.document <= dimensions.viewport + 1 && dimensions.body <= dimensions.viewport + 1,
    `Horizontal overflow: ${JSON.stringify(dimensions)}`,
  );
}
async function visibleKeyboardFocus(page, expected) {
  if (expected) await expect(expected).toBeFocused();
  const evidence = await page.evaluate(() => {
    const element = document.activeElement;
    if (!(element instanceof HTMLElement)) return null;
    const style = getComputedStyle(element),
      box = element.getBoundingClientRect();
    return {
      tag: element.tagName,
      text: element.textContent?.trim().slice(0, 80),
      focusVisible: element.matches(":focus-visible"),
      outline: style.outline,
      shadow: style.boxShadow,
      drawn:
        (style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0) ||
        style.boxShadow !== "none",
      inViewport:
        box.width > 0 &&
        box.height > 0 &&
        box.left >= -1 &&
        box.right <= innerWidth + 1 &&
        box.top >= -1 &&
        box.bottom <= innerHeight + 1,
    };
  });
  assert.ok(
    evidence?.focusVisible && evidence.drawn && evidence.inViewport,
    `Keyboard focus is not visibly identifiable: ${JSON.stringify(evidence)}`,
  );
  report.focusChecks.push(evidence);
}

try {
  for (const pathname of publicPaths) {
    const { page, context } = await newPage(`public:${pathname}`);
    await check(
      `${pathname} serves a real public page without workspace initialization`,
      async () => {
        await loadPublic(page, pathname);
        // Allow delayed hydration effects to surface; this is not an inactivity or
        // network-completion assertion, and does not wait for persistent dev sockets.
        await page.waitForTimeout(700);
        assert.equal(await page.evaluate(() => Boolean(window.ethereum || window.solana)), false);
        assert.equal(report.marketingServiceRequests.length, 0);
      },
    );
    for (const size of sizes) {
      await check(
        `${pathname} fits ${size.width}px and keeps the main content usable`,
        async () => {
          await page.setViewportSize(size);
          await settle(page);
          await noOverflow(page);
          await expect(page.locator("h1")).toBeVisible();
          if (size.width !== 760)
            await screenshot(
              page,
              `${pathname === "/" ? "home" : pathname.slice(1)}-${size.width}`,
            );
        },
      );
    }
    await context.close();
  }

  const navigation = await newPage("navigation-and-preview");
  const { page } = navigation;
  await loadPublic(page, "/");
  const header = page.locator("header").first();
  await check(
    "Desktop navigation changes actual routes and follows the Questions anchor",
    async () => {
      await header.getByRole("link", { name: "Product", exact: true }).click();
      await expect(page).toHaveURL(`${baseURL}/product`);
      await expect(page.locator("main h1")).toBeVisible();
      await header.getByRole("link", { name: "How it works", exact: true }).click();
      await expect(page).toHaveURL(`${baseURL}/how-it-works`);
      const questions = header.getByRole("link", { name: "Questions", exact: true });
      const target = new URL(await questions.getAttribute("href"), baseURL);
      assert.equal(target.origin, baseURL);
      assert.ok(target.hash.length > 1, "Questions must link to a real section.");
      await questions.click();
      await expect(page).toHaveURL(target.href);
      const section = page.locator(
        `[id=${JSON.stringify(decodeURIComponent(target.hash.slice(1)))}]`,
      );
      await expect(section).toHaveCount(1);
      await expect(section).toBeInViewport();
      const bounds = await section.boundingBox(),
        headerBounds = await header.boundingBox();
      assert.ok(
        bounds && headerBounds && bounds.y >= headerBounds.y + headerBounds.height - 2,
        "FAQ anchor is hidden under the site header.",
      );
    },
  );

  await check("FAQ answers are keyboard-operable and expose actual expanded content", async () => {
    const detail = page.locator("main details").first();
    await expect(detail).toBeVisible();
    const summary = detail.locator("summary");
    if ((await detail.getAttribute("open")) !== null) await summary.click();
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(detail).toHaveAttribute("open", "");
    await expect(detail.locator("p").first()).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(detail).not.toHaveAttribute("open", "");
  });

  await loadPublic(page, "/");
  await check("Tab navigation exposes a visible keyboard focus indicator", async () => {
    await page.keyboard.press("Tab");
    await visibleKeyboardFocus(page);
  });

  await check("Interactive example recomputes fillable shares when the floor changes", async () => {
    const preview = page.getByRole("region", {
      name: "Interactive example of an exit plan",
      exact: true,
    });
    await expect(preview).toBeVisible();
    // This reads the user's result, not a hidden source variable or fixture API.
    const result = preview.locator('[aria-label="Fillable shares"]');
    // First observe an actual state change from the server-rendered 0.60 default.
    // This establishes completed event attachment before synthetic keyboard input.
    await preview.getByRole("button", { name: "0.58", exact: true }).click();
    await expect(result).toHaveText("230");
    for (const [floor, expected] of [
      ["0.60", "140"],
      ["0.62", "30"],
      ["0.58", "230"],
      ["0.60", "140"],
    ]) {
      const button = preview.getByRole("button", { name: floor, exact: true });
      if (floor === "0.62") {
        await button.focus();
        await expect(button).toBeFocused();
        await page.keyboard.press("Enter");
      } else await button.click();
      await expect(button).toHaveAttribute("aria-pressed", "true");
      await expect(result).toHaveCount(1);
      await expect(result).toHaveText(expected);
    }
    await screenshot(page, "interactive-preview", false);
  });

  await check(
    "Mobile navigation opens, closes with Escape, restores focus and follows links",
    async () => {
      await page.setViewportSize(sizes[2]);
      // Keep the just-exercised, hydrated homepage. An immediate synthetic keydown
      // after a fresh DOM response can precede React's event attachment; navigation
      // behavior should be tested on the live interactive page, not that race.
      await settle(page);
      const toggle = header.getByRole("button", { name: "Open navigation", exact: true });
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await toggle.focus();
      await page.keyboard.press("Enter");
      const close = header.getByRole("button", { name: "Close navigation", exact: true });
      await expect(close).toHaveAttribute("aria-expanded", "true");
      await expect(header.getByRole("link", { name: "Product", exact: true })).toBeVisible();
      await noOverflow(page);
      await screenshot(page, "mobile-navigation", false);
      await page.keyboard.press("Escape");
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await visibleKeyboardFocus(page, toggle);
      await toggle.click();
      await header.getByRole("link", { name: "Product", exact: true }).click();
      await expect(page).toHaveURL(`${baseURL}/product`);
      await expect(
        header.getByRole("button", { name: "Open navigation", exact: true }),
      ).toHaveAttribute("aria-expanded", "false");
      await noOverflow(page);
    },
  );

  await page.setViewportSize(sizes[0]);
  await loadPublic(page, "/");
  await check("Metadata references a served SVG icon, Apple PNG and full-size OG PNG", async () => {
    const declarations = await page.evaluate(() => ({
      icon: document.querySelector('link[rel="icon"][type="image/svg+xml"]')?.getAttribute("href"),
      apple: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute("href"),
      og: document.querySelector('meta[property="og:image"]')?.getAttribute("content"),
    }));
    for (const [kind, declared] of Object.entries(declarations)) {
      assert.ok(declared, `Missing ${kind} metadata`);
      const source = new URL(declared, baseURL);
      // Next's metadataBase may contain the public canonical origin. Check the
      // same asset path on BASE_URL, never silently visit production from local QA.
      const checked = new URL(source.pathname, baseURL);
      const response = await navigation.context.request.get(checked.href, { maxRedirects: 0 });
      assert.equal(response.status(), 200, `${kind} returned ${response.status()}`);
      const body = await response.body();
      const asset = {
        kind,
        declared: `${source.origin}${source.pathname}`,
        checked: checked.href,
        status: response.status(),
        contentType: response.headers()["content-type"],
        bytes: body.length,
        sha256: createHash("sha256").update(body).digest("hex"),
      };
      if (kind === "icon") {
        assert.match(asset.contentType || "", /image\/svg\+xml/);
        assert.match(body.toString("utf8"), /<svg[\s>]/);
      } else {
        assert.match(asset.contentType || "", /image\/png/);
        assert.deepEqual(body.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
        assert.equal(body.toString("ascii", 12, 16), "IHDR");
        asset.width = body.readUInt32BE(16);
        asset.height = body.readUInt32BE(20);
        assert.deepEqual([asset.width, asset.height], kind === "og" ? [1200, 630] : [180, 180]);
      }
      report.assets.push(asset);
    }
  });

  await check("An unknown route returns HTTP404 without an application exception", async () => {
    const response = await page.goto(`${baseURL}/__closeout_site_smoke_missing__`, {
      waitUntil: "domcontentloaded",
    });
    assert.equal(response?.status(), 404);
    report.pages.push({
      pathname: "/__closeout_site_smoke_missing__",
      status: response.status(),
      title: await page.title(),
    });
  });
  await navigation.context.close();

  const entry = await newPage("real-position-entry");
  await loadPublic(entry.page, "/");
  await check(
    "The primary CTA opens position intake without inventing a market, balance or quote",
    async () => {
      const cta = entry.page.locator('main a[href="/app"]').first();
      await expect(cta).toBeVisible();
      entry.state.phase = "workspace";
      await cta.click();
      await expect(entry.page).toHaveURL(`${baseURL}/app`);
      await expect(
        entry.page.getByRole("textbox", { name: "Public profile or account address", exact: true }),
      ).toBeVisible();
      await expect(
        entry.page.getByRole("heading", { name: /Bring your.*Polymarket positions/ }),
      ).toBeVisible();
      await expect(
        entry.page.getByRole("textbox", { name: "Shares to sell", exact: true }),
      ).toHaveCount(0);
      await expect(
        entry.page.getByRole("complementary", { name: "Exit estimate", exact: true }),
      ).toHaveCount(0);
      await expect(entry.page.locator("#privy-dialog")).toHaveCount(0);
      for (const size of sizes) {
        await entry.page.setViewportSize(size);
        await settle(entry.page);
        await noOverflow(entry.page);
        await expect(
          entry.page.getByRole("textbox", {
            name: "Public profile or account address",
            exact: true,
          }),
        ).toBeVisible();
        if (size.width !== 760) await screenshot(entry.page, `entry-${size.width}`);
      }
      assert.equal(
        report.workspaceDataRequests.filter((r) => r.context === "real-position-entry").length,
        0,
      );
    },
  );
  await entry.context.close();

  const workspace = await newPage("explicit-example-entry");
  const app = workspace.page;
  await loadPublic(app, "/");
  await check(
    "The example CTA starts a fictional portfolio; choosing Atlas opens its holdings-based plan",
    async () => {
      const cta = app.locator('main a[href="/app?mode=example"]').first();
      await expect(cta).toBeVisible();
      workspace.state.phase = "workspace";
      report.workspaceEntryRequestedAt = new Date().toISOString();
      await cta.click();
      await expect(app).toHaveURL(`${baseURL}/app?mode=example`);
      await expect(
        app.getByRole("heading", { name: "Pick a sample position.", exact: true }),
      ).toBeVisible();
      await expect(app.getByRole("textbox", { name: "Shares to sell", exact: true })).toHaveCount(
        0,
      );
      await app.getByRole("button", { name: /Will the Atlas mission launch/ }).click();
      await expect(app.getByRole("textbox", { name: "Shares to sell", exact: true })).toHaveValue(
        "250",
      );
      await expect(app.getByRole("textbox", { name: "Minimum price", exact: true })).toHaveValue(
        "0.62",
      );
      const estimate = app.getByRole("complementary", { name: "Exit estimate", exact: true });
      const row = (label) =>
        estimate.locator("dl > div").filter({ has: app.getByText(label, { exact: true }) });
      await expect(row("Shares that can fill")).toContainText("30 / 250");
      await expect(row("Shares left unsold")).toContainText("220");
      await app.getByRole("button", { name: /^Use minimum price 0\.60 / }).click();
      await expect(row("Shares that can fill")).toContainText("140 / 250");
      await expect(row("Shares left unsold")).toContainText("110");
      await expect(
        app.getByRole("button", { name: "Review simulated exit", exact: true }),
      ).toBeVisible();
      await expect(app.getByText("Fictional estimate", { exact: true })).toBeVisible();
      assert.equal(await app.evaluate(() => Boolean(window.ethereum || window.solana)), false);
      assert.equal(await app.locator("#privy-dialog").count(), 0);
      const history = await app.evaluate(() => localStorage.getItem("closeout-orders-v1"));
      assert.ok(
        history === null || history === "[]",
        "Selecting an example position unexpectedly wrote order history.",
      );
      assert.equal(
        report.workspaceDataRequests.filter((r) => r.context === "explicit-example-entry").length,
        0,
      );
    },
  );
  for (const size of sizes) {
    await check(`Example plan fits ${size.width}px without horizontal overflow`, async () => {
      await app.setViewportSize(size);
      await settle(app);
      await noOverflow(app);
      await expect(
        app.getByRole("complementary", { name: "Exit estimate", exact: true }),
      ).toBeVisible();
      if (size.width !== 760) await screenshot(app, `example-${size.width}`);
    });
  }
  await check(
    "Public pages made no wallet/auth/trading calls, and no unexpected writes or page errors occurred",
    async () => {
      await app.waitForTimeout(500);
      assert.deepEqual(report.marketingServiceRequests, []);
      assert.deepEqual(report.unexpectedWrites, []);
      assert.deepEqual(report.blockedWebSockets, []);
      assert.deepEqual(report.pageErrors, []);
    },
  );
  report.sourceHashesAfter = await sourceHashes();
  await check("The source stayed unchanged during this QA run", async () => {
    assert.deepEqual(
      report.sourceHashesAfter,
      report.sourceHashes,
      "Source changed during the test; repeat against a stable revision.",
    );
  });
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.failure = error instanceof Error ? error.stack : String(error);
  await screenshot(currentPage, "failure", false).catch(() => {});
  console.error(report.failure);
  process.exitCode = 1;
} finally {
  await Promise.allSettled(contexts.map((context) => context.close()));
  await browser.close();
  report.finishedAt = new Date().toISOString();
  await writeFile(path.join(output, `${stem}.json`), `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    JSON.stringify(
      {
        passed: report.passed,
        checks: report.checks.length,
        report: `${outputDirectory}/${stem}.json`,
        failure: report.failure,
      },
      null,
      2,
    ),
  );
}
