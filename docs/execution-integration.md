# Execution integration

The [/app workspace](https://closeout-ashen.vercel.app/app) starts with a public portfolio, then lets the user choose a position and plan a sell exit. Public lookup and planning need no authentication. Live execution uses an existing owner-controlled Polymarket account, an explicit review and the connected wallet. Example mode starts with a fictional portfolio and produces fictional activity only.

Actual wallet authentication, signatures, live order submission, cancellation, approvals and funded execution remain unvalidated. The implementation has fixture coverage; public reads and the real Privy chooser have separate browser checks. Final live net proceeds remain unreconciled. See [verification](verification.md).

## SDK and runtime boundary

[The trading adapter](../src/lib/trading-client.ts) contains the venue-specific integration. The installed versions are `@polymarket/client` 0.10.0, matching `@polymarket/bindings` 0.10.0 and Viem 2.56.3. Use the committed lockfile and revalidate this boundary when upgrading. The [official TypeScript SDK guide](https://docs.polymarket.com/getting-started/typescript) describes the upstream client.

`TradingSession` exposes balance reads, exit placement, exact-order reads, cancellation, related trades and disposal. It receives an EIP-1193 provider plus explicit signer and account addresses. Viem's `custom(provider)` transport and the SDK's `signerFrom` adapter connect wallet signing to the venue client.

Two details depend on the pinned runtime:

- `AssetType` comes from `@polymarket/bindings/clob`; importing it from the client package's declarations did not provide a usable runtime export. Balance reads use `fetchBalanceAllowance` from the client's actions package.
- `resolveExitExchange` follows the pinned SDK's token-namespace and negative-risk selector for its three exchange routes. It validates addresses from the runtime production configuration and fails closed if that configuration changes. It has no hardcoded fallback address.

## Public account discovery

The [profile route](../src/app/api/profile/route.ts) accepts `input` and `source=manual|wallet`, returning `{profile: {accountAddress, displayName, username, resolvedFromProfile}}`. Its [adapter](../src/lib/account-profile.ts) makes credential-free requests only to fixed Gamma endpoints. It does not create a secure SDK client.

| Entry | Resolution rule |
| --- | --- |
| Connected-wallet address, `source=wallet` | A valid public profile mapping is required. Missing mapping is an actionable error, never a fallback to the signer address. |
| Manual account address | Use the verified provider mapping when available. Only a genuine profile 404 allows lookup of the exact entered address with `resolvedFromProfile=false`. |
| Manual handle or `polymarket.com/@profile` URL | Require exactly one case-insensitive name match in a complete bounded search result, then verify the matching account through its public profile. Ambiguous, partial or conflicting results require an account address instead. |

Gamma's raw profile field is `proxyWallet`; the pinned SDK calls its normalized field `wallet`. Closeout reads the raw field and validates provider consistency. This naming distinction does not establish whether the connected signer owns that account. See the official [public-profile endpoint](https://docs.polymarket.com/api-reference/profiles/get-public-profile-by-wallet-address) and [search endpoint](https://docs.polymarket.com/api-reference/search/search-markets-events-and-profiles).

After resolution, `/api/positions` loads public holdings. Selecting a position resolves its market through `/api/markets` and its outcome book through `/api/book`. These four GET routes do not sign or submit. Manual input remains the original profile string; `resolvedInput` binds that normalized entry to the resolved account, including when a later positions request fails. A recent-profile bookmark stores only a public address and labels; resuming it performs a fresh lookup.

Public reads can continue independently of the signer. A connected-wallet lookup is tied to the initiating wallet, while a manually imported portfolio is not replaced merely because another wallet connects for review. An imported account can be inspected without being tradable by that signer.

## Account authorization

Session creation checks the connected signer on Polygon, verifies deployed code when the account differs from the signer, and requires the SDK to resolve the exact account/signer pair as `OWNER`. Session-key mappings are unsupported. A successful public profile lookup does not satisfy this check.

The adapter supplies the existing account explicitly and rejects SDK `sendTransaction` requests. Closeout does not deploy account wallets or grant missing trading approvals. The user must complete those prerequisites on the venue. See the [official wallet and authentication model](https://docs.polymarket.com/trading/wallets-auth).

The [wallet provider](../src/components/wallet-provider.tsx) supports Privy external wallets or an injected provider. Connection opens the wallet chooser directly; it is separate from venue authentication. The current connection flow selects Polygon and can request a network switch. Venue authentication happens only through an explicit review action and may request a signature. Account, chain or disconnect events invalidate the session. The adapter rechecks the account and Polygon chain after signing, before submission. Credentials remain within the in-memory session.

## Review and submission flow

1. The user selects an imported or sample position. Its shares initialize the amount at supported precision; the first book initializes an empty floor to the best bid. The user can edit either. There is no automatically selected market or arbitrary initial trade size.
2. Public book and fee data produce an indicative quote through the [quote engine](../src/lib/quote.ts). Review is blocked while position selection is pending. Live review authenticates the owner session, reads available holdings and approvals, fetches fresh public inputs and rebuilds the quote.
3. Confirmation checks that the selected market, inputs and wallet context still match the review. A quote older than 15 seconds must be reviewed again; age uses fetch time rather than the last time the book changed.
4. The [workspace controller](../src/hooks/use-exit-workspace.ts) acquires an account execution lock and saves an intent before a live submission.
5. The adapter checks geographic eligibility from the user's browser, current unreserved shares, approvals, minimum order size and tick alignment. It creates and signs a `SELL` market order with the share quantity, minimum price and FAK or FOK mode, then posts once.
6. Activity retains the response and reconciles the exact order and related trades. An accepted response is not treated as confirmed settlement.

The minimum price is a gross price per share, not a guaranteed final net receipt. FAK permits an immediate partial fill and cancels the unfilled remainder; FOK requires the full quantity or no fill. Closeout does not expose resting GTC/GTD orders. See [official order semantics](https://docs.polymarket.com/trading/place-orders) and [exit math](exit-math.md).

Public book requests are keyed by mode, condition and outcome token. Review and confirmation retain the stronger mode/token/signer/account binding plus exact amount, floor and order type. Changes invalidate the reviewed plan rather than transferring permission to the newly selected position.

## Financial checks

[Public parsing](../src/lib/public-data.ts) uses fixed upstream endpoints and checks the requested market/token identity. Unknown fee data blocks execution rather than becoming a zero-fee assumption. Balances use six-decimal raw units; available shares subtract existing sell reservations. Bounded pagination fails when the full relevant order or trade set cannot be established.

The quote models venue fees per depth level and displays gross proceeds, estimated fees, estimated net and unsold shares. Closeout's service fee is currently zero. Network, intermediary, conversion and withdrawal costs are excluded. Displayed pUSD is venue collateral, not a bank payout. Actual fill splitting and rounding can differ from the indicative estimate.

## Lifecycle, uncertainty and local history

[Order reconciliation](../src/lib/order-status.ts) verifies order identity, account, token, side, mode, quantities and related trade evidence. Only confirmed trade amounts contribute to settled shares. Live `netReceipt` stays `null`; Activity states that final net proceeds are not reconciled.

Active orders are polled while the workspace is visible. Cancellation is an explicit action against the owned order and cannot reverse already settled shares. See the [official lifecycle reference](https://docs.polymarket.com/concepts/order-lifecycle).

A failed order POST may still have reached the venue. The adapter raises `SubmissionUncertainError` and does not retry automatically. An unresolved submission without a verified order ID keeps the account blocked in Closeout. There is no automatic order-ID recovery or unlock flow; inspecting the venue does not itself clear that block. The intent is not silently dropped or converted into a failed trade.

Browser Web Locks serialize execution by account and history writes within the same origin. The [history decoder and compactor](../src/lib/order-history.ts) preserve unresolved intents and block on corruption or unsafe capacity exhaustion. This local history is not a server audit log or a cross-device execution lock. See [architecture](architecture.md) for responsibilities and extension points.
