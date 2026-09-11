# Closeout UI verification

Run a development or production server, then run `npm run test:browser`. To use another origin: `BASE_URL=http://127.0.0.1:3001 npm run test:browser`. The script launches an isolated headless Chromium context and closes it on completion. It requires the Playwright Chromium browser.

[browser-smoke.json](browser-smoke.json) records 13 passing checks, screenshots and browser exceptions. The configured-Privy rerun refreshed 11 fixture/example screenshots. The separate earlier public live screenshot retains its own timestamp; all 12 show the app with the headline “Know what your exit could return.” Current source and screenshot hashes are in [ui-final-proof.json](ui-final-proof.json). The script supplies error or empty fixtures for market/eligibility GET reads, then requires a user action to enter Example mode. No wallet is connected, no signature is requested and no real order is submitted.

With Privy configured, the harness blocks the exact anonymous initialization `POST https://auth.privy.io/api/v1/analytics_events` and Privy's CDN challenge-platform background requests, recording these separately from action attempts. The analytics exception requires the exact HTTPS origin/path, POST, no query and no Authorization header. Other non-read requests—including authentication, linking and order writes—are blocked and fail the suite. GET, HEAD and OPTIONS remain read/preflight methods. Twelve focused guard cases check the endpoint boundary, authenticated requests, lookalike hosts, method changes and auth/link/order rejection. Request bodies, headers, query strings and opaque CDN tokens are not recorded.

This run recorded one blocked initialization analytics POST, one blocked CDN background GET, zero unexpected action writes and zero uncaught browser errors. Its native wallet-dialog check opens and dismisses only Closeout's shell. Actual Privy chooser open/dismiss/reopen coverage is separate in [privy-integration-current.json](privy-integration-current.json); this 13-check suite does not authenticate a user or validate deployment-origin configuration.

The example tests validate 250 requested shares at a 0.60 pUSD floor: 140 currently fillable, 110 unsold, FOK disabled, then FAK review and an explicitly simulated partial settlement. Keyboard tests cover `/` search, fill-policy arrow navigation, modal Escape and focus return. The export retains the fictional notice and contains no transaction hash. Mobile tests exercise all three panels and the review dialog.

The suite also found a same-market search/book invalidation bug; the hook owner corrected it and the regression flow now passes. UI corrections include positive floor validation, visible position warnings, disabled confirmation on review errors, busy-review Escape protection, the confirmed “Partially settled” label and a clear null-net explanation for live activity.

Visual inspection covered:

- [Desktop example](closeout-example-desktop.png), [FOK block](closeout-example-fok-blocked-desktop.png), [review](closeout-review-desktop.png), [wallet dialog](closeout-wallet-dialog-desktop.png) and [activity](closeout-activity-desktop.png).
- [Tablet 768px](closeout-example-tablet.png).
- [Mobile 375px](closeout-example-mobile.png), [market selection](closeout-markets-mobile.png), [review](closeout-review-mobile.png) and [activity](closeout-activity-mobile.png).
- [Live-error fixture](closeout-live-error-fixture-desktop.png), which remains live and exposes an explicit Example action.
- [Earlier actual public live read](closeout-live-desktop.png), separately dated in [live-read-browser.json](live-read-browser.json): 40 markets and a real order book, with no wallet or position lookup. It was not rerun as part of the Privy harness update.

All three target widths had zero document/body horizontal overflow. Native dialogs use viewport screenshots; ordinary pages use full-page captures. Screenshots include the development server’s Next.js indicator where it was visible. No image conceals live data errors or fabricates a fill.

This verifies the UI and synthetic lifecycle. Live wallet authorization, actual execution, cancellation, final pUSD reconciliation and real-user acceptance remain separate validation work. [ui-format-contrast.json](ui-format-contrast.json) contains the focused numeric edge-case and palette contrast checks.
