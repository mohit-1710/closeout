# Build verification

September 12, 2026 IST. Executed locally on Node 26.7.0 / npm 11.19.0.

- `npm test`: 209 passing tests across 6 files after reconciliation and history review.
- `npm run typecheck`: passed during integration; production build repeats TypeScript.
- `npm run build`: production compilation/static rendering and the 3 public GET API routes passed again with the configured Privy App ID and modal fix.
- `npm run test:browser`: 13 checks covering explicit example FAK/FOK, mode isolation, error/empty/retry behavior, review dialogs/focus, export and 375/768/1280 responsive layouts. See `browser-smoke.json` for latest exact result.
- `npm run test:privy`: 4 checks against the actual public Privy configuration and chooser. Open/dismiss/reopen succeeds after releasing the native modal layer. No wallet was selected or connected; no auth, signature or order was attempted. See `privy-integration-current.json`.
- Public dashboard configuration: HTTP 200, wallet authentication enabled. The latest check still shows name `app` and an empty allowed-origins list; see `privy-dashboard-config.json` and the pending settings in `../privy-setup.md`.
- Actual credential-free browser/server reads: discovery/search/condition lookup/book/current fee model and zero-address public positions, plus the browser geographic endpoint. See `live-read-browser.json` and integration memo.
  - 16 trading-service tests use mocked SDK/provider calls. Real wallet auth, signatures, approvals and live sells remain untested.
- Dependency audit: 0 high/critical; 23 moderate transitive wallet-stack advisories remain. See `dependency-audit.json`.

No production deployment or event submission was performed. Browser simulations contain no transaction hashes and are labeled as fictional.
