import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";

// Start Next separately with NEXT_PUBLIC_PRIVY_APP_ID set. This process does not
// load .env files or use an existing browser profile, wallet, or dashboard.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, ".artifacts/qa");
const baseURL = new URL("/app", process.env.BASE_URL || "http://127.0.0.1:3000").href;
const label = process.env.QA_LABEL || "onboarding";
assert.match(label, /^[a-z0-9-]+$/);
const stem = `privy-integration-${label}`;
const report = {
  startedAt: new Date().toISOString(),
  baseURL,
  browser: "isolated Chromium",
  scope:
    "Actual public Privy configuration and wallet chooser open, dismiss, reopen. No wallet selected; no injected provider, login, link, signature, or trade. Only anonymous Privy analytics POSTs are allowed.",
  checks: [],
  publicAppConfigs: [],
  allowedAnalytics: [],
  blockedWrites: [],
  blockedWebSockets: [],
  accountLookups: [],
  pageErrors: [],
  consoleErrors: [],
  screenshots: [],
  sourceHashes: {},
};
await mkdir(output, { recursive: true });
for (const file of [
  "src/components/wallet-provider.tsx",
  "src/components/exit-workspace.tsx",
  "src/components/journey/onboarding.tsx",
  "scripts/privy-smoke.mjs",
]) {
  report.sourceHashes[file] = createHash("sha256")
    .update(await readFile(path.join(root, file)))
    .digest("hex");
}
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  reducedMotion: "reduce",
  serviceWorkers: "block",
});
await context.routeWebSocket("**/*", async (socket) => {
  const url = new URL(socket.url());
  const httpOrigin = `${url.protocol === "wss:" ? "https:" : "http:"}//${url.host}`;
  if (
    httpOrigin === new URL(baseURL).origin &&
    ["/_next/hmr", "/_next/webpack-hmr"].includes(url.pathname)
  ) {
    return socket.connectToServer();
  }
  report.blockedWebSockets.push({ host: url.hostname, path: url.pathname });
  return socket.close();
});
await context.route("**/*", async (route) => {
  const request = route.request(),
    url = new URL(request.url());
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
    const cdnBackground =
      url.origin === "https://auth.privy.io" &&
      url.pathname.startsWith("/cdn-cgi/challenge-platform/");
    const metadata = {
      method: request.method(),
      host: url.hostname,
      path: cdnBackground ? "/cdn-cgi/challenge-platform/[redacted]" : url.pathname,
    };
    const credential = [
      "authorization",
      "privy-authorization",
      "x-api-key",
      "poly-api-key",
      "poly-signature",
    ].some((key) => Boolean(request.headers()[key]));
    if (
      request.method() === "POST" &&
      url.origin === "https://auth.privy.io" &&
      url.pathname === "/api/v1/analytics_events" &&
      !url.search &&
      !credential
    ) {
      report.allowedAnalytics.push(metadata);
    } else {
      // Includes auth/session/link/order calls. No request body or credential is logged.
      report.blockedWrites.push(metadata);
      return route.abort("blockedbyclient");
    }
  }
  if (
    url.origin === new URL(baseURL).origin &&
    /^\/api\/(profile|positions|markets|book)$/.test(url.pathname)
  ) {
    report.accountLookups.push({ path: url.pathname, method: request.method() });
    return route.abort("blockedbyclient");
  }
  return route.continue();
});
const page = await context.newPage();
page.setDefaultTimeout(15_000);
page.on("pageerror", (error) => report.pageErrors.push(error.message));
page.on("console", (entry) => {
  if (entry.type() === "error") report.consoleErrors.push(entry.text());
});
const responseReads = [];
page.on("response", (response) => {
  const url = new URL(response.url());
  if (url.hostname !== "auth.privy.io" || !/^\/api\/v1\/apps\/[^/]+$/.test(url.pathname)) return;
  responseReads.push(
    (async () => {
      try {
        const app = await response.json();
        report.publicAppConfigs.push({
          capturedAt: new Date().toISOString(),
          url: `${url.origin}${url.pathname}`,
          status: response.status(),
          id: app.id,
          name: app.name,
          wallet_auth: app.wallet_auth,
          allowed_domains: app.allowed_domains,
          logo_url: app.logo_url,
        });
      } catch {
        report.publicAppConfigs.push({
          url: `${url.origin}${url.pathname}`,
          status: response.status(),
          parseError: true,
        });
      }
    })(),
  );
});
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
async function screenshot(suffix) {
  const file = `${stem}-${suffix}.png`;
  await page.screenshot({ path: path.join(output, file), animations: "disabled" });
  report.screenshots.push(`.artifacts/qa/${file}`);
}
const privy = page.locator("#privy-dialog");
const closePrivy = privy.locator('button[aria-label="close modal"]');
const connect = page
  .locator(".j-entry")
  .getByRole("button", { name: "Connect wallet", exact: true });
async function openChooser() {
  await connect.click();
  await expect(privy.getByText("Select your wallet", { exact: true })).toBeVisible();
}
try {
  await page.goto(baseURL, { waitUntil: "domcontentloaded" });
  await check("Public app config loads with wallet authentication enabled", async () => {
    await expect
      .poll(() =>
        report.publicAppConfigs.some((app) => app.status === 200 && app.wallet_auth === true),
      )
      .toBe(true);
    assert.equal(
      await page.evaluate(() => Boolean(window.ethereum || window.solana)),
      false,
      "A wallet provider was unexpectedly injected.",
    );
    // The public configuration response precedes connector initialization.
    await page.waitForTimeout(1500);
  });
  await check(
    "Direct entry Connect opens an actionable Privy chooser without a native dialog",
    async () => {
      await openChooser();
      report.nativeDialogsAtChooser = await page.locator("dialog:modal").count();
      await screenshot("chooser-open");
      assert.equal(
        report.nativeDialogsAtChooser,
        0,
        "A Closeout native modal owns the top layer and blocks Privy.",
      );
      await closePrivy.click({ trial: true });
      await expect(privy.getByText("MetaMask", { exact: true }).first()).toBeVisible();
      assert.equal(await page.getByText("Wallet connected", { exact: true }).count(), 0);
    },
  );
  await check("Dismiss clears connecting and permits opening the chooser again", async () => {
    await closePrivy.click();
    await expect(privy).toHaveCount(0);
    await expect(connect).toBeEnabled();
    await openChooser();
    await expect(page.locator("dialog:modal")).toHaveCount(0);
    await closePrivy.click({ trial: true });
    await screenshot("chooser-reopened");
    await closePrivy.click();
    await expect(privy).toHaveCount(0);
    await expect(connect).toBeEnabled();
  });
  await check("No real wallet, account history, auth action, or order was created", async () => {
    const history = await page.evaluate(() => localStorage.getItem("closeout-orders-v1"));
    assert.ok(history === null || history === "[]", "Unexpected order history in fresh context.");
    const actions = report.blockedWrites.filter(
      ({ path: pathname }) => !pathname.startsWith("/cdn-cgi/"),
    );
    assert.deepEqual(actions, [], "Unexpected action request was attempted and blocked.");
    assert.equal(await page.getByText("Wallet connected", { exact: true }).count(), 0);
    assert.deepEqual(report.pageErrors, []);
    assert.deepEqual(
      report.accountLookups,
      [],
      "Opening a chooser must not invent an account or load holdings.",
    );
    assert.deepEqual(report.blockedWebSockets, []);
    report.sourceHashesAfter = {};
    for (const [file, expected] of Object.entries(report.sourceHashes)) {
      const actual = createHash("sha256")
        .update(await readFile(path.join(root, file)))
        .digest("hex");
      report.sourceHashesAfter[file] = actual;
      assert.equal(actual, expected, `${file} changed during the chooser check.`);
    }
  });
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.failure = error.message;
  await screenshot("failure").catch(() => {});
  process.exitCode = 1;
} finally {
  await Promise.allSettled(responseReads);
  report.finishedAt = new Date().toISOString();
  await browser.close();
  await writeFile(path.join(output, `${stem}.json`), `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    JSON.stringify(
      {
        passed: report.passed,
        publicAppConfigs: report.publicAppConfigs,
        report: `.artifacts/qa/${stem}.json`,
        failure: report.failure,
      },
      null,
      2,
    ),
  );
}
