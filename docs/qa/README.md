# Closeout UI verification

Run a development or production server, then run `npm run test:browser`. To use another origin: `BASE_URL=http://127.0.0.1:3001 npm run test:browser`. The script launches an isolated headless Chromium context and closes it on completion. It requires the Playwright Chromium browser.

[browser-smoke.json](browser-smoke.json) records 13 passing checks, screenshots and browser exceptions. The final rerun and all 12 screenshots use the headline “Know what your exit could return.”; current source and screenshot hashes are in [ui-final-proof.json](ui-final-proof.json). The script intercepts only GET market/eligibility reads with explicit error or empty fixtures, then requires a user action to enter Example mode. Unexpected non-GET requests are blocked and fail the suite. No wallet is connected, no signature is requested and no real order is submitted.

The example tests validate 250 requested shares at a 0.60 pUSD floor: 140 currently fillable, 110 unsold, FOK disabled, then FAK review and an explicitly simulated partial settlement. Keyboard tests cover `/` search, fill-policy arrow navigation, modal Escape and focus return. The export retains the fictional notice and contains no transaction hash. Mobile tests exercise all three panels and the review dialog.

The suite also found a same-market search/book invalidation bug; the hook owner corrected it and the regression flow now passes. UI corrections include positive floor validation, visible position warnings, disabled confirmation on review errors, busy-review Escape protection, the confirmed “Partially settled” label and a clear null-net explanation for live activity.

Visual inspection covered:

- [Desktop example](closeout-example-desktop.png), [FOK block](closeout-example-fok-blocked-desktop.png), [review](closeout-review-desktop.png), [wallet dialog](closeout-wallet-dialog-desktop.png) and [activity](closeout-activity-desktop.png).
- [Tablet 768px](closeout-example-tablet.png).
- [Mobile 375px](closeout-example-mobile.png), [market selection](closeout-markets-mobile.png), [review](closeout-review-mobile.png) and [activity](closeout-activity-mobile.png).
- [Live-error fixture](closeout-live-error-fixture-desktop.png), which remains live and exposes an explicit Example action.
- [Actual public live read](closeout-live-desktop.png), separately documented in [live-read-browser.json](live-read-browser.json): 40 markets and a real order book, with no wallet or position lookup.

All three target widths had zero document/body horizontal overflow. Native dialogs use viewport screenshots; ordinary pages use full-page captures. Screenshots include the development server’s Next.js indicator where it was visible. No image conceals live data errors or fabricates a fill.

This verifies the UI and synthetic lifecycle. Live wallet authorization, actual execution, cancellation, final pUSD reconciliation and real-user acceptance remain separate validation work. [ui-format-contrast.json](ui-format-contrast.json) contains the focused numeric edge-case and palette contrast checks.
