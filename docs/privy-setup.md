# Privy integration checkpoint

Checked September 12, 2026 IST. The user completed Privy dashboard sign-in in Brave. A development app was already available there; no additional application or secret was created by the agent.

The public App ID is `cmtxfl71h00hj0cl5lvwb4kp8`. It is configured as `NEXT_PUBLIC_PRIVY_APP_ID` in `.env.local`, which is ignored by Git. The development server was restarted with that configuration. The integration requires no app secret or custom client ID.

The public SDK configuration endpoint returned HTTP 200 and `wallet_auth: true`. At the [latest recorded check](qa/privy-dashboard-config.json) it still returned name `app` and `allowed_domains: []`. This endpoint requires the public `privy-app-id` request header; a plain fetch without it returned HTTP 400. No authenticated dashboard API was used. The requested final dashboard values are name **Closeout** and exactly these local origins:

- `http://localhost:3000`
- `http://127.0.0.1:3000`

The agent reached Basics → Domains through Brave but could not reliably enter/save values: native automation returned `noWindowsAvailable`, `cgWindowNotFound`, clipboard timeouts and inconsistent input updates. These settings have been handed to the user. Do not claim they are saved until the public configuration verifies them. A production deployment will require its own exact origin and environment variable at build time.

`npm run test:privy` uses a fresh isolated Chromium context and actual public Privy configuration. It opens Closeout’s wallet dialog, invokes its inner Connect button, verifies the Privy chooser is actionable, dismisses it and repeats. It selects no wallet and creates no authentication, linked account, signature or order. Only the exact anonymous Privy analytics endpoint is allowed to POST; other writes are blocked. [Current report](qa/privy-integration-current.json) and before/after screenshots record the native-dialog overlap and its fix.

The current app uses external Ethereum wallets only, Polygon as its chain, and no automatic embedded-wallet creation. Real wallet authentication and the financial flow remain separate user-authorized checks.

Primary references: [Privy React setup](https://docs.privy.io/basics/react/setup), [app credentials](https://docs.privy.io/basics/get-started/dashboard/create-new-app), [branding](https://docs.privy.io/basics/get-started/dashboard/configuring-appearance), [allowed origins](https://docs.privy.io/recipes/dashboard/allowed-domains).
