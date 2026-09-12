# Build verification

September 12, 2026 IST. Executed locally on Node 26.7.0 / npm 11.19.0.

- `npm test`: 209 passing tests across 6 files after reconciliation and history review.
- `npm run typecheck`: passed during integration; production build repeats TypeScript.
- `npm run build`: production compilation/static rendering and the 3 public GET API routes passed again with the new Closeout Privy App ID and modal fix.
- `npm run test:browser`: 13 checks covering explicit example FAK/FOK, mode isolation, error/empty/retry behavior, review dialogs/focus, export and 375/768/1280 responsive layouts. See `browser-smoke.json` for latest exact result.
- `npm run test:privy`: 4 checks against the actual public Privy configuration and chooser, rerun successfully for app `cmtxg359900sd0cjp3cacl9m6`. Open/dismiss/reopen succeeds after releasing the native modal layer. No wallet was selected or connected; no auth, signature or order was attempted. See `privy-integration-current.json`.
- Public dashboard configuration: HTTP 200, name **Closeout**, wallet authentication enabled, and both `http://localhost:3000` and `http://127.0.0.1:3000` allowed. See `privy-dashboard-config.json` and `../privy-setup.md`. Earlier app configuration and chooser evidence are archived as `*previous-app*`; the general 13-check browser suite predates this App ID change.
- Actual credential-free browser/server reads: discovery/search/condition lookup/book/current fee model and zero-address public positions, plus the browser geographic endpoint. See `live-read-browser.json` and integration memo.
  - 16 trading-service tests use mocked SDK/provider calls. Real wallet auth, signatures, approvals and live sells remain untested.
- Dependency audit: 0 high/critical; 23 moderate transitive wallet-stack advisories remain. See `dependency-audit.json`.

## Published checks and deployment

The public repository is [mohit-1710/closeout](https://github.com/mohit-1710/closeout). [GitHub Checks run 34703514251](https://github.com/mohit-1710/closeout/actions/runs/34703514251) passed locked dependency installation, tests and the production build on Node 24 for commit `b65de78d81c59c083e9ecbd3113478b5ae8426e5`. Browser/Privy checks are not part of that workflow.

Vercel's production deployment for that commit reached READY at [closeout-ashen.vercel.app](https://closeout-ashen.vercel.app). Public GET smoke checks at September 12, 15:55:50 UTC passed: page HTTP 200 with the Closeout title; 40 markets; an inspected book with 20 bids, 67 asks and known fee metadata. These observations are a snapshot, not fixed market quantities. See [deployment-public-reads.json](deployment-public-reads.json) and [deployment setup](../deployment.md).

The deployed Privy origin is pending owner configuration and a chooser check. No event submission is verified. Browser simulations contain no transaction hashes and are labeled as fictional; no real order was sent.
