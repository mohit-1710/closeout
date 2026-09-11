import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';

// Start the app separately (npm run dev, or npm run build && npm start).
// This smoke test never connects a wallet or submits a real order. Live-market
// failures/empty states are controlled GET fixtures; all fills are Example mode.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'docs/qa');
const baseURL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const report = { startedAt: new Date().toISOString(), baseURL, browser: 'Chromium',
  scope: 'GET failure/empty fixtures and explicitly synthetic example orders in an isolated context, compatible with configured Privy. No wallet connection, authentication, linking, signature, real balance, or real order. Exact anonymous Privy initialization analytics and known CDN background requests are blocked and recorded separately.',
  checks: [], screenshots: [], pageErrors: [], unexpectedWrites: [], blockedInitializationAnalytics: [], blockedCdnBackground: [], consoleErrors: [] };

function requestClass(method, target, hasAuthorization = false) {
  const url = new URL(target);
  if (url.origin === 'https://auth.privy.io' && url.pathname.startsWith('/cdn-cgi/challenge-platform/')) return 'cdn-background';
  if (method === 'POST' && url.origin === 'https://auth.privy.io' && url.pathname === '/api/v1/analytics_events' && !url.search && !hasAuthorization) return 'anonymous-initialization';
  return ['GET', 'HEAD', 'OPTIONS'].includes(method) ? 'read' : 'unexpected-write';
}

// Guard regressions must not turn a telemetry exception into an auth/order bypass.
const guardCases = [
  ['POST', 'https://auth.privy.io/api/v1/analytics_events', false, 'anonymous-initialization'],
  ['POST', 'https://auth.privy.io/api/v1/analytics_events', true, 'unexpected-write'],
  ['PUT', 'https://auth.privy.io/api/v1/analytics_events', false, 'unexpected-write'],
  ['POST', 'https://auth.privy.io/api/v1/analytics_events/extra', false, 'unexpected-write'],
  ['POST', 'https://auth.privy.io/api/v1/analytics_events?session=fixture', false, 'unexpected-write'],
  ['POST', 'https://auth.privy.io.example.com/api/v1/analytics_events', false, 'unexpected-write'],
  ['POST', 'https://auth.privy.io/api/v1/authenticate', false, 'unexpected-write'],
  ['POST', 'https://auth.privy.io/api/v1/link', false, 'unexpected-write'],
  ['POST', 'https://clob.polymarket.com/order', false, 'unexpected-write'],
  ['POST', 'https://auth.privy.io/cdn-cgi/challenge-platform/h/g/jsd/oneshot/fixture', false, 'cdn-background'],
  ['POST', 'https://clob.polymarket.com/cdn-cgi/order', false, 'unexpected-write'],
  ['OPTIONS', 'https://auth.privy.io/api/v1/apps/fixture', false, 'read'],
];
for (const [method, target, auth, expected] of guardCases) assert.equal(requestClass(method, target, auth), expected);
report.routeGuardChecks = guardCases.length;
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, reducedMotion: 'reduce', acceptDownloads: true });
let marketResponse = 'error';
let marketRequests = 0;
await context.route('**/*', async (route) => {
  const request = route.request(), url = new URL(request.url());
  const kind = requestClass(request.method(), request.url(), Boolean(request.headers().authorization));
  // Do not log request bodies, headers, query strings, or opaque challenge tokens.
  const metadata = { method: request.method(), host: url.hostname, path: kind === 'cdn-background' ? '/cdn-cgi/challenge-platform/[redacted]' : url.pathname };
  if (kind === 'anonymous-initialization') {
    report.blockedInitializationAnalytics.push(metadata);
    return route.abort('blockedbyclient');
  }
  if (kind === 'cdn-background') {
    report.blockedCdnBackground.push(metadata);
    return route.abort('blockedbyclient');
  }
  if (kind === 'unexpected-write') {
    report.unexpectedWrites.push(metadata);
    return route.abort('blockedbyclient');
  }
  if (url.pathname === '/api/markets') {
    marketRequests += 1;
    return route.fulfill({ status: marketResponse === 'error' ? 503 : 200, contentType: 'application/json',
      body: JSON.stringify(marketResponse === 'error' ? { error: 'Smoke fixture: live market source unavailable.' } : { markets: [] }) });
  }
  if (url.hostname === 'polymarket.com' && url.pathname === '/api/geoblock') {
    // Unknown eligibility stays blocked. This is not a bypass of an eligibility check.
    return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Smoke fixture: eligibility unavailable.' }) });
  }
  return route.continue();
});
const page = await context.newPage();
page.setDefaultTimeout(15_000);
page.on('pageerror', (error) => report.pageErrors.push(error.message));
page.on('console', (entry) => { if (entry.type() === 'error') report.consoleErrors.push(entry.text()); });
async function check(name, test) { await test(); report.checks.push({ name, passed: true }); console.log(`PASS ${name}`); }
async function screenshot(name) {
  // A modal backdrop covers the viewport. A full-page composite would misleadingly
  // show the offscreen page without a backdrop, so dialog evidence uses the viewport.
  const modalOpen = await page.locator('dialog[open]').count();
  await page.screenshot({ path: path.join(output, name), fullPage: !modalOpen, animations: 'disabled' });
  report.screenshots.push(`docs/qa/${name}`);
}
async function noOverflow() {
  const sizes = await page.evaluate(() => ({ width: window.innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  assert.ok(sizes.document <= sizes.width + 1 && sizes.body <= sizes.width + 1, `Horizontal overflow: ${JSON.stringify(sizes)}`);
}
const ticket = page.getByRole('complementary', { name: 'Exit ticket' });
const quoteRow = (label) => ticket.locator('.co-breakdown > div').filter({ has: page.getByText(label, { exact: true }) });
try {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await check('Live GET failure stays live, with no synthetic market or balance fallback', async () => {
    await expect(page.getByText('Live markets unavailable', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Live', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Example', exact: true })).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByText('Balance not loaded', { exact: true })).toBeVisible();
    await expect(page.locator('.co-market-row')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Review exit', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Try example mode', exact: true })).toBeVisible();
    await noOverflow();
    await screenshot('closeout-live-error-fixture-desktop.png');
  });
  await check('Same-query Retry performs another GET; empty response remains empty', async () => {
    const previous = marketRequests;
    marketResponse = 'empty';
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(page.getByText('No markets available', { exact: true })).toBeVisible();
    assert.ok(marketRequests > previous, 'Retry did not request markets again');
    await expect(page.locator('.co-market-row')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Example', exact: true })).toHaveAttribute('aria-pressed', 'false');
    marketResponse = 'error';
    await page.getByRole('button', { name: 'Refresh markets', exact: true }).click();
    await expect(page.getByText('Live markets unavailable', { exact: true })).toBeVisible();
  });
  await check('Explicit Example mode exposes fictional data and a working market search', async () => {
    await page.getByRole('button', { name: 'Try example mode', exact: true }).click();
    await expect(page.getByText('Example mode uses synthetic markets, balances and fills. No funds move.', { exact: true })).toBeVisible();
    await expect(page.locator('.co-market-row')).toHaveCount(2);
    await page.keyboard.press('/');
    await expect(page.getByRole('searchbox', { name: 'Search markets' })).toBeFocused();
    await page.getByRole('searchbox', { name: 'Search markets' }).fill('zz-no-such-example');
    await page.getByRole('searchbox', { name: 'Search markets' }).press('Enter');
    await expect(page.getByText('No matching markets', { exact: true })).toBeVisible();
    await page.getByRole('searchbox', { name: 'Search markets' }).fill('Atlas');
    await page.getByRole('searchbox', { name: 'Search markets' }).press('Enter');
    await expect(page.locator('.co-market-row')).toHaveCount(1);
    await page.getByRole('searchbox', { name: 'Search markets' }).fill('');
    await page.getByRole('searchbox', { name: 'Search markets' }).press('Enter');
    await expect(page.locator('.co-market-row')).toHaveCount(2);
  });
  await check('Fraction controls and strict positive floor validation work', async () => {
    await page.getByRole('button', { name: '25%', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Shares to sell' })).toHaveValue('62.5');
    await page.getByRole('button', { name: 'Max', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Shares to sell' })).toHaveValue('250');
    await page.getByRole('textbox', { name: 'Minimum price' }).fill('0');
    await page.getByRole('textbox', { name: 'Minimum price' }).press('Tab');
    await expect(page.getByText('Enter a price greater than 0 and below 1 pUSD.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Review simulated exit', exact: true })).toBeDisabled();
    await page.getByRole('textbox', { name: 'Minimum price' }).fill('0.60');
  });
  await check('FAK visibly estimates 140 / 250 fillable and 110 unsold', async () => {
    await expect(quoteRow('Shares that can fill')).toContainText('140 / 250');
    await expect(quoteRow('Shares left unsold')).toContainText('110');
    await expect(page.getByRole('button', { name: 'Review simulated exit', exact: true })).toBeEnabled();
    await noOverflow();
    await screenshot('closeout-example-desktop.png');
  });
  await check('FOK blocks insufficient full depth; keyboard returns to FAK', async () => {
    await page.getByRole('radio', { name: 'All or nothing Fill all shares or none' }).click();
    await expect(ticket.getByText('Depth estimate · exit blocked', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Review simulated exit', exact: true })).toBeDisabled();
    await screenshot('closeout-example-fok-blocked-desktop.png');
    await page.getByRole('radio', { name: 'All or nothing Fill all shares or none' }).press('ArrowLeft');
    await expect(page.getByRole('radio', { name: 'Sell available Cancel any remainder' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('button', { name: 'Review simulated exit', exact: true })).toBeEnabled();
  });
  await check('Depth table and chart show the supplied order book', async () => {
    await page.getByRole('button', { name: 'Show bid levels', exact: true }).click();
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(9);
    await page.getByRole('button', { name: 'Show depth chart', exact: true }).click();
    await expect(page.getByRole('img', { name: /Cumulative buy-side depth/ })).toBeVisible();
  });
  await check('Wallet dialog opens, Escape closes, focus returns; no connection is requested', async () => {
    const trigger = page.locator('.co-wallet-button');
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Your wallet & positions' });
    await expect(dialog).toBeVisible();
    await screenshot('closeout-wallet-dialog-desktop.png');
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
  });
  await check('Review supports back/Escape, then explicitly simulates one partial exit', async () => {
    const trigger = page.getByRole('button', { name: 'Review simulated exit', exact: true });
    const dialog = page.getByRole('dialog', { name: 'Review simulated exit', exact: true });
    await trigger.click();
    await expect(dialog.getByRole('button', { name: 'Simulate exit', exact: true })).toBeEnabled();
    await expect(dialog.getByText('Simulation · no funds move', { exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'Back to plan', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await expect(dialog.getByRole('button', { name: 'Simulate exit', exact: true })).toBeEnabled();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await trigger.click();
    await expect(dialog.getByRole('button', { name: 'Simulate exit', exact: true })).toBeEnabled();
    await screenshot('closeout-review-desktop.png');
    await dialog.getByRole('button', { name: 'Simulate exit', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.locator('.co-order-row')).toHaveCount(1);
    await expect(page.locator('.co-order-row').getByText('Partially settled', { exact: true })).toBeVisible();
    await expect(page.locator('.co-order-row').getByText('Simulated', { exact: true })).toBeVisible();
    await expect(page.locator('.co-order-row')).toContainText('140 settled');
    await expect(page.locator('.co-order-row')).toContainText('Fictional fills and proceeds');
    await expect(page.locator('.co-order-row').getByRole('button', { name: 'Cancel', exact: true })).toHaveCount(0);
    await screenshot('closeout-activity-desktop.png');
  });
  await check('Activity export preserves example attribution and empty real transaction hashes', async () => {
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export exit activity', exact: true }).click();
    const file = await download;
    assert.equal(file.suggestedFilename(), 'closeout-example-activity.json');
    const downloaded = await file.path();
    const data = JSON.parse(await readFile(downloaded, 'utf8'));
    assert.equal(data.mode, 'example');
    assert.match(data.notice, /FICTIONAL EXAMPLE/);
    assert.equal(data.orders.length, 1);
    assert.equal(data.orders[0].settledShares, '140');
    assert.deepEqual(data.orders[0].transactionHashes, []);
  });
  await check('Tablet 768px layout has no horizontal overflow', async () => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await noOverflow();
    await screenshot('closeout-example-tablet.png');
  });
  await check('Mobile 375px Exit / Markets / Activity remain usable with no horizontal overflow', async () => {
    await page.setViewportSize({ width: 375, height: 812 });
    const navigation = page.getByRole('tablist', { name: 'Workspace panels' });
    await navigation.getByRole('tab', { name: 'Exit', exact: true }).click();
    await noOverflow();
    await expect(ticket).toBeVisible();
    await screenshot('closeout-example-mobile.png');
    await page.getByRole('button', { name: 'Review simulated exit', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Review simulated exit', exact: true });
    await expect(dialog.getByRole('button', { name: 'Simulate exit', exact: true })).toBeEnabled();
    const bounds = await dialog.boundingBox();
    assert.ok(bounds && bounds.width <= 375 && bounds.height <= 812, 'Mobile review exceeds viewport');
    await screenshot('closeout-review-mobile.png');
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await navigation.getByRole('tab', { name: 'Markets', exact: true }).click();
    await expect(page.getByRole('searchbox', { name: 'Search markets' })).toBeVisible();
    await expect(ticket).not.toBeVisible();
    await noOverflow();
    await screenshot('closeout-markets-mobile.png');
    await navigation.getByRole('tab', { name: /^Activity/ }).click();
    await expect(page.getByText('Partially settled', { exact: true })).toBeVisible();
    await noOverflow();
    await screenshot('closeout-activity-mobile.png');
    await navigation.getByRole('tab', { name: 'Exit', exact: true }).click();
    await expect(ticket).toBeVisible();
  });
  await check('No uncaught browser errors or auth/link/order/financial write attempts occurred', async () => {
    assert.deepEqual(report.pageErrors, []);
    assert.deepEqual(report.unexpectedWrites, []);
  });
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.failure = error instanceof Error ? error.stack : String(error);
  await screenshot('closeout-smoke-failure.png').catch(() => {});
  console.error(report.failure);
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  report.marketFixtureRequests = marketRequests;
  await writeFile(path.join(output, 'browser-smoke.json'), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}
