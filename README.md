# Closeout

**Know what your prediction-market exit can actually fill.** Closeout lets a trader inspect live bids, set a per-share price floor, estimate fees and unsold shares, and review a price-bounded immediate sell from an existing Polymarket account.

Built for ETHOnline 2026. The initial wedge is an exit workflow for traders managing existing positions. Customer willingness to pay remains a hypothesis; this repository does not claim paid users, recovered funds, or guaranteed execution.

## Run locally

Use **Node 24 or newer** (verified on Node 26.7.0). Public data parsing preserves JSON decimal lexemes and depends on the modern JSON reviver context.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Live public data is the default. No key or wallet is required to browse markets and plan an indicative exit. Choose **Example** explicitly to explore fictional markets and simulated fills.

```sh
npm test
npm run typecheck
npm run build
# With the dev server running and Privy configured:
npm run test:privy
```

For a production server: `npm run build` followed by `npm start`. The public API routes need outbound HTTPS access to Gamma, CLOB and the Data API.

## What works

- Live market discovery/search, outcome selection, current bid depth, minimum price and share-size checks.
- Decimal-safe FAK/FOK exit estimates using the market's fee parameters. FAK allows partial fills and cancels the unmatched remainder; FOK requires the whole amount to fill or cancels.
- Public account-position import (first 100 positions, with a notice if more exist), clearly separate from authority to trade.
- Existing-wallet connection on Polygon. Optional Privy external-wallet connection when configured.
- Browser-only owner authentication, balance/reservation/approval checks, explicit review and order authorization.
- Order-specific cancellation, fill reconciliation, five-second polling while active, separate matched/confirmed amounts, and JSON activity export.
- Persistent local order metadata, cross-tab account locks and protected pending-history retention to prevent blind retries after uncertain submissions. No private keys or API credentials are stored by Closeout.
- Explicit fictional example mode. It never supplies replacement data after a failed live request.

## Privy setup

This local workspace now has the public App ID configured in an ignored `.env.local`. The real Privy chooser has been tested without selecting or connecting a wallet. Dashboard name and allowed origins are tracked in [owner actions](ACTION-REQUIRED.md).

For another checkout, copy `.env.example` to `.env.local`, then set `NEXT_PUBLIC_PRIVY_APP_ID` to your **public app ID**. Allow your localhost/deployment origin in the Privy dashboard. No app secret belongs in this repository or a `NEXT_PUBLIC_` variable. Restart the server after changing environment variables.

Without this ID, Closeout uses an injected Ethereum wallet. With it, Privy connects an existing external owner wallet; it does not create an unrelated embedded wallet and pretend that wallet owns an existing Polymarket portfolio. A real configured Privy flow must be demonstrated before claiming sponsor-track eligibility.

## Live execution requirements

Connect the signer that owns an existing funded Polymarket account. Load that account wallet's address from its Polymarket profile; it may differ from the signer address. Closeout rejects unsupported owner/session-key mappings. The account must already be deployed and have the correct venue exchange approval for its outcome tokens.

Review requests CLOB authentication and then refreshes balances and the quote. Confirm requests a signed immediate SELL. Orders go directly from the browser to the venue. Geography is checked from the browser's IP; unknown or restricted eligibility disables live submission. Account restrictions still apply. Closeout neither deploys an account nor silently changes token approvals.

The displayed floor is **gross pUSD per share**. It is not an after-fee net receipt guarantee. Current venue fees and liquidity can change; order-book levels can split into several matches, affecting fee rounding. Book fetches expire after 15 seconds for review; the venue book's last-change timestamp is retained separately. pUSD proceeds are not a bank withdrawal or an assertion of USDC redeemability.

## Verification boundary

Public market, depth, metadata, empty public position lookup, and browser geographic reads have been exercised against live endpoints. Core calculations, response normalization, order reconciliation and trading service safeguards have automated tests. Desktop/tablet/mobile example flows have browser QA artifacts in `docs/qa/`.

**No real wallet was connected, and no real order, approval, deposit or withdrawal was sent during this build.** End-to-end authenticated wallet execution still requires the account owner's explicit test. Privy's public configuration and chooser open/dismiss/reopen flow have been verified; see `docs/qa/privy-integration-current.json`. The service is implemented; a successful real trade is not claimed.

If a submission loses its response, do not retry. Closeout keeps that account locked until the order outcome is known. An unknown intent without an order ID currently needs manual inspection on Polymarket; there is intentionally no casual “clear and retry” button. Live submission requires Web Locks on HTTPS or localhost. Corrupt history blocks execution, and unresolved records cannot be evicted by newer terminal history. Browser-local metadata can be erased by the user or browser, so also verify venue history after changing devices or clearing storage.

## Architecture

`src/lib/exit-plan.ts` is the pure decimal engine. `public-data.ts` validates public provider responses and binds each book to its condition and token. `trading-client.ts` wraps the current unified SDK with owner, chain, geography, inventory and approval checks. `order-status.ts` reconciles confirmed trade records without treating a placement response as settlement. `use-exit-workspace.ts` coordinates the flow and persists nonsecret order metadata. The API routes are fixed-origin, read-only endpoints; credentials and signing remain in the browser.

Package versions are locked. `@polymarket/client@0.10.0` exposes `AssetType` in declarations but omits its runtime root export; the code imports it from the matching `@polymarket/bindings/clob` package instead. Details and primary sources are in [the execution integration memo](docs/execution-integration.md).

The initial dependency scan's high-severity Axios/ws findings were resolved with bounded patch-version overrides. Remaining wallet-stack transitive moderate advisories are recorded in `docs/qa/dependency-audit.json`; do not interpret this prototype as independently audited production trading software.

## Submission material

[Build scope](docs/build-context.md) · [Demo script](docs/demo-script.md) · [Submission draft](docs/submission-draft.md) · [Remaining owner actions](ACTION-REQUIRED.md) · [Design brief](docs/design-brief.md)
