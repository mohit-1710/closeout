# Verification

The automated suites verify different boundaries. Passing a fixture or opening a wallet chooser does not establish a successful live trade.

## Current coverage

The September 12, 2026 redesign passed the following local checks:

| Suite | Result | What it covers |
| --- | --- | --- |
| Vitest | 209 tests in 6 files | Decimal quotes, public parsing, preflight, order status, history and trading adapter behavior. Provider and SDK interactions are mocked. |
| Site smoke | 25 checks | Public routes, navigation, keyboard focus, FAQs, interactive quote preview, intentional example entry, responsive layout and icon/social assets. |
| Workspace smoke | 13 checks | Controlled live-read failure and retry, example planning, FAK/FOK, review, fictional partial fill, activity export and responsive controls. |
| Privy smoke | 4 checks | Actual public app config, actionable wallet chooser, dismissal/reopening and absence of account or order actions. |
| Build | Passed | Next.js compilation, generated routes and TypeScript checking. |

Site and workspace tests use isolated Chromium contexts. They do not reuse an owner's browser profile. Request guards reject authentication and financial actions; the Privy suite permits only the requests needed to display its chooser. Known initialization analytics and blocked background requests are identified separately in reports. Controlled HTTP failures in the workspace suite are intentional fixtures.

Public pages are checked at 1440, 768 and 375 pixels. The workspace suite also checks its 1280-pixel desktop layout. Tests verify overflow, keyboard navigation, review transitions and the distinction between live and fictional data. Visual review complements these assertions; it is not an exhaustive accessibility audit.

## Reproduce

Install with Node 24+ and the committed lockfile:

```sh
npm ci
npm test
npm run format:check
npm run build
npm run typecheck
```

The build generates the Next.js types required by standalone `typecheck`. The [GitHub workflow](../.github/workflows/checks.yml) runs installation, unit tests, formatting and the production build on pushes and pull requests. Browser suites run separately.

Start the app in another terminal with `npm run dev` or `npm start`, then run:

```sh
npm run test:site
npm run test:browser
npm run test:privy
```

Privy needs a configured public App ID, wallet authentication enabled, and the exact origin allowed. No app secret is required. See [setup](privy-setup.md).

To inspect another deployment, pass its origin; workspace scripts append `/app` themselves:

```sh
BASE_URL=https://closeout-ashen.vercel.app QA_LABEL=production npm run test:site
BASE_URL=https://closeout-ashen.vercel.app QA_LABEL=production npm run test:privy
```

Reports and raw screenshots are written to `.artifacts/qa/`, which is ignored by Git and excluded from deployment. `QA_LABEL` distinguishes site and Privy runs; the workspace suite replaces its latest `browser-smoke.json` and associated captures. Curated README images live in `docs/images/` and show the actual production build using fictional example data.

## What remains unverified

No real wallet authentication, signature, live order, cancellation, approval, deposit or withdrawal was performed for these checks. A live public read or an empty address lookup does not verify funded holdings or execution authority. An accepted order is not evidence of a confirmed fill.

Order-status reconciliation is implemented and tested against fixtures. Final live `netReceipt` remains `null` until proceeds reconciliation is implemented; estimated proceeds must not be described as money received. Network and intermediary costs are excluded from the estimate. See [exit math](exit-math.md) and [execution boundaries](execution-integration.md).

These checks do not establish customer adoption, measured savings, product-market fit or an independent security audit.
