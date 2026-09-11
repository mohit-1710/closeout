# Privy integration checkpoint

Updated September 12, 2026 IST. The current Privy app is **Closeout**, with public App ID `cmtxg359900sd0cjp3cacl9m6`.

It is configured as `NEXT_PUBLIC_PRIVY_APP_ID` in the Git-ignored `.env.local`, and the development server was restarted. The integration requires no app secret or custom client ID. An app secret was exposed in the conversation; revoke that exposed secret in Privy. Closeout does not use it, and no replacement secret is needed for this browser integration.

The new app's public SDK configuration was verified with HTTP 200, name `Closeout`, `wallet_auth: true`, and exactly these allowed origins:

- `http://localhost:3000`
- `http://127.0.0.1:3000`

Local name and origin setup is complete. The public configuration endpoint is `https://auth.privy.io/api/v1/apps/cmtxg359900sd0cjp3cacl9m6`, using the public `privy-app-id` header and local `Origin`; no authenticated dashboard API is needed to check these values. A production deployment will require its own exact origin and the public environment variable at build time.

`npm run test:privy` uses a fresh isolated Chromium context and actual public Privy configuration. It opens Closeout’s wallet dialog, invokes its inner Connect button, verifies the Privy chooser is actionable, dismisses it and repeats. It selects no wallet and creates no authentication, linked account, signature or order. Only the exact anonymous Privy analytics endpoint is allowed to POST; other writes are blocked. All four smoke checks passed for the new Closeout app, and the production build also passed with its public ID configured. The [current smoke report](qa/privy-integration-current.json) and [public configuration check](qa/privy-dashboard-config.json) record the new App ID, name and origins.

The earlier setup used development app `cmtxfl71h00hj0cl5lvwb4kp8`, then named `app` with no allowed-domain entries. Brave input failures left its branding/origins unfinished. That earlier app produced the before-fix failure report and the first passing chooser test. The native-dialog overlap was fixed during that test. Its configuration and passing chooser artifacts were archived with `previous-app` names; the original before-fix report remains historical evidence, not a check of the replacement app.

The current app uses external Ethereum wallets only, Polygon as its chain, and no automatic embedded-wallet creation. Real wallet authentication and the financial flow remain separate user-authorized checks.

Primary references: [Privy React setup](https://docs.privy.io/basics/react/setup), [app credentials](https://docs.privy.io/basics/get-started/dashboard/create-new-app), [branding](https://docs.privy.io/basics/get-started/dashboard/configuring-appearance), [allowed origins](https://docs.privy.io/recipes/dashboard/allowed-domains).
