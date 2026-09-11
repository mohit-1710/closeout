# Closeout execution integration

Verified 2026-09-12 from current official documentation, npm registry and exact published TypeScript declarations. No wallet connected, signature requested, order placed, approval sent or funds moved.

## Decision

Use **`@polymarket/client@0.10.0` with `viem@2.56.3`**, pinned initially. The official unified SDK is `@polymarket/client`, despite stale search snippets and earlier `@polymarket/sdk` references. npm latest client was published September 9. `@polymarket/sdk@8.0.1` was published March 6; legacy `@polymarket/clob-client-v2@1.1.0` July 17. Do not mix their method names. Official migration replaces the previous CLOB and relayer packages. [Official SDK](https://docs.polymarket.com/getting-started/typescript), [migration](https://docs.polymarket.com/getting-started/migrate-from-previous-sdks), [registry version](https://registry.npmjs.org/@polymarket/client/0.10.0).

For the first execution path, connect the **owner signer of an existing Polymarket account**, explicitly select its funded account-wallet address, preview a SELL, request user confirmation, submit one price-bounded FAK/FOK, and reconcile every fill. A new unrelated Privy embedded wallet has none of that existing account's positions. Do not confuse an address entered for a public portfolio preview with signing authority.

## Browser signer and Privy

`@polymarket/client/viem` exports `signerFrom(walletClient)`. Adapt an injected EIP-1193 wallet with Viem's `custom(provider)`, Polygon chain 137 and the selected signer account. Privy browser wallets expose the same provider through `wallet.getEthereumProvider()` after `wallet.switchChain(137)`. The Polymarket `/privy` import is an adapter for **`@privy-io/node` on the server**, not its React SDK. Never put Privy app secrets or builder secrets in client code. [Polymarket wallet integrations](https://docs.polymarket.com/getting-started/typescript#wallet-integrations), [Privy Viem integration](https://docs.privy.io/wallets/connectors/ethereum/integrations/viem).

Pass the account-wallet address from the user's Polymarket profile, which can differ from the EOA signer. `client.account` reports signer, wallet and wallet type. Existing types are Deposit Wallet, legacy Safe and legacy Proxy. If `wallet` is omitted, `createSecureClient` selects the deterministic Deposit Wallet and **may deploy it**. Therefore do not call authentication automatically from a watch-only preview. EOA trading is documented only for allowlisted EOAs and needs POL for on-chain actions. L1 signing creates/derives CLOB credentials; the SDK handles authenticated trading requests. Credentials remain sensitive. [Wallets and authentication](https://docs.polymarket.com/trading/wallets-auth).

## Implemented boundary (September 12 build)

`src/lib/trading-client.ts` now implements the session contract used by the app; `src/components/wallet-provider.tsx` provides injected-wallet connection or optional Privy external-wallet selection when an app ID exists. No embedded wallet is created automatically. Connection events invalidate the prior account/network state, and each service operation checks the active account and Polygon chain again. Session credentials are memory-only. SDK `SESSION_KEY` guesses for unrelated account addresses are rejected; this build supports the existing owner signer.

Current verification: 16 service mock tests passed, and project-wide TypeScript check passed with installed Viem 2.56.3. Tests cover raw balance units and reservations, account ownership, absent deployment/approvals, geographic failures, concurrent wallet changes, submission uncertainty, cancellation, exact-order fill filtering, and all three SDK exchange routes. No real signing or transactions were tested.

**Runtime correction:** 0.10.0 declares `AssetType` through the root SDK types but its ESM root does not export it. Import the actual value from `@polymarket/bindings/clob`; declare that package directly. `OrderSide`, `OrderType`, `SignerType` and standalone balance actions were checked as real runtime exports. The initial typecheck alone did not catch this upstream mismatch.

The implementation uses the pinned SDK's runtime `production.contracts`, validates its addresses, and mirrors the SDK's reserved-bit position namespace selector. Gamma protocol v1 routes to standard/neg-risk exchanges with EIP-712 version 2; protocol v2 positions route to ExchangeV3. These version numbers are distinct. There is no stale hardcoded address fallback; missing runtime configuration disables trading. Recheck this internal SDK mapping when upgrading the pinned package.

A fresh isolated Chromium page on `http://127.0.0.1:3000` successfully read the direct geography endpoint (HTTP 200, `blocked:false`, country IN). No IP address was logged. This verifies local browser CORS, not every deployment or user. A blocked or unknown response remains a submission blocker; Closeout does not attempt a routing workaround.

## Exact order API

A price-bounded immediate sell uses `placeMarketOrder({ assetId, side: OrderSide.SELL, shares, minPrice, orderType })`. `shares` is a human-readable share quantity, **not USD**. FAK fills available liquidity and cancels the rest; FOK fills all or none. `minPrice` is a per-share execution floor, **not a guaranteed net proceeds amount after fees**. `placeLimitOrder({assetId,side,price,size})` instead creates a resting GTC order; adding `expiration` selects GTD. Do not pass FAK/FOK to the resting-order API. Validate current tick size, minimum size, accepting-orders state and sufficient unreserved position inventory. `assetId` is preferred in 0.10.0; `tokenId` is still a deprecated accepted alias. [Place orders](https://docs.polymarket.com/trading/place-orders).

The SDK's declarations differ from some prose: `fetchBalanceAllowance` and `fetchMarketInfo` are **standalone action exports**, not bound default-client methods. The following exact example compiled with TypeScript 5.9.3, strict mode, ES2022/Bundler, against the pinned packages. It was not executed against a wallet. A production handler must validate all inputs, bind the position to the authenticated wallet, obtain explicit user intent and retain submission state before invoking `postOrder`.

```sh
npm install @polymarket/client@0.10.0 @polymarket/bindings@0.10.0 viem@2.56.3
```

```ts
import {AssetType} from '@polymarket/bindings/clob';
import {createPublicClient, createSecureClient, OrderSide, OrderType, type SecureClient} from '@polymarket/client';
import {fetchMarketInfo,fetchBalanceAllowance} from '@polymarket/client/actions';
import {signerFrom} from '@polymarket/client/viem';
import {createWalletClient, custom, type EIP1193Provider, type Address} from 'viem';
import {polygon} from 'viem/chains';
export async function connect(provider:EIP1193Provider, signerAddress:Address, accountWallet:Address) {
 const walletClient=createWalletClient({account:signerAddress,chain:polygon,transport:custom(provider)});
 return createSecureClient({wallet:accountWallet,signer:signerFrom(walletClient)});
}
export async function preview(user:string, assetId:string, conditionId:string) {
 const c=createPublicClient();
 return Promise.all([c.listPositions({user,pageSize:100}).firstPage(),c.fetchOrderBook({assetId}),fetchMarketInfo(c,{conditionId}),c.fetchTradingApprovalsState({user})]);
}
export async function sell(c:SecureClient,assetId:string,shares:string,minPrice:string,allOrNothing=false) {
 const balance=await fetchBalanceAllowance(c,{assetType:AssetType.CONDITIONAL,assetId});
 const signed=await c.createMarketOrder({assetId,side:OrderSide.SELL,shares,minPrice,orderType:allOrNothing?OrderType.FOK:OrderType.FAK});
 const response=await c.postOrder(signed);
 if(!response.ok) return {kind:'rejected' as const,response,balance};
 if(response.status==='delayed'||response.tradeIds.length===0) return {kind:'pending' as const,response,balance};
 const hashes=await c.waitForOrderFillSettlement(response);
 const order=await c.fetchOrder({orderId:response.orderId});
 return {kind:'fills-settled' as const,response,hashes,order,balance};
}
export async function manage(c:SecureClient,orderId:string,assetId:string) {
 const order=await c.fetchOrder({orderId});
 const trades=await c.listAccountTrades({assetId}).firstPage();
 const cancel=await c.cancelOrder({orderId});
 return {order,trades,cancel};
}

```

The `manage` function illustrates three separate calls; do not automatically cancel merely because a UI opens status details. Cancellation itself must be a deliberate action. Prefer tracking individual order IDs; never use account-wide cancellation as a routine exit shortcut.

## Completion and retry semantics

`response.ok` means accepted, not completed. `matched` means matched, not final on-chain success. `delayed` has zero amounts and empty trade IDs while matching is pending. `waitForOrderFillSettlement(response)` waits only for the response's known trade IDs; with none, it returns immediately and **does not wait for delayed matching**. Its default timeout is 30 seconds and a timeout does not undo a trade. For delayed orders, subscribe to `{topic:'user'}`, refresh the specific order and account trades, then wait for resulting trade IDs. [Place orders](https://docs.polymarket.com/trading/place-orders), [real-time updates](https://docs.polymarket.com/trading/realtime-order-updates).

Order and trade states are separate. Trade progression is MATCHED → MINED → CONFIRMED, with RETRYING and terminal FAILED. Some SDK trade objects use the `TRADE_STATUS_` prefix; normalize actual response enums. Cancellation can remove only unfilled quantity, never reverse a settled fill, and is unavailable during a pending matching delay. After submission uncertainty, reconcile the known order ID/trades before any new order; don't blindly resubmit a second exit. The sample's `fills-settled` label intentionally does not claim the full position was sold. Compare requested versus matched shares and current remaining inventory. [Order lifecycle](https://docs.polymarket.com/concepts/order-lifecycle), [manage orders](https://docs.polymarket.com/trading/manage-orders).

## Public reads, balances and fees

| Job | Credential-free endpoint or SDK action |
| --- | --- |
| Market discovery | `https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=...`; `listMarkets` / `fetchMarket` |
| Position preview | `https://data-api.polymarket.com/v2/positions?user=ACCOUNT_WALLET&limit=...`; `listPositions({user,pageSize})` |
| Executable depth | `https://clob.polymarket.com/book?token_id=...`; `fetchOrderBook({assetId})` |
| Constraints and fee model | `https://clob.polymarket.com/clob-markets/CONDITION_ID`; `fetchMarketInfo(publicClient,{conditionId})` from `/actions` |
| Legacy fee-rate read | `https://clob.polymarket.com/fee-rate?token_id=...` returns `base_fee`; do not assume this alone is a flat percentage |
| Tick size | `https://clob.polymarket.com/tick-size?token_id=...` |
| Approval readiness | `publicClient.fetchTradingApprovalsState({user})` |
| Builder fee rates, if a builder code used | `https://clob.polymarket.com/fees/builder-fees/BUILDER_CODE` |
| Geographic eligibility | `https://polymarket.com/api/geoblock` |

Authenticated reads include conditional-token balance/allowance, exact order status, open orders and account fills. For balances use `fetchBalanceAllowance(client,{assetType:AssetType.CONDITIONAL,assetId})`; verify base-unit normalization before comparing with share decimals. Reservations in existing orders reduce available sell inventory. Position-list defaults exclude very small dust and OPEN can include settled-but-unredeemed positions: distinguish tradeable exits from redemption. These details were checked in the exact package declarations/source maps; public API responses still need adapter tests.

Fees are set at matching. The current fee page gives `shares × feeRate × p × (1-p)`, varies by market category, and says makers have no platform fee. Retrieve the actual market's fee parameters and add any builder fees rather than hardcoding the category table or legacy `base_fee`. Estimate fees per consumed book level; show estimated net proceeds, not just bid price. Current quickstart/lifecycle use **pUSD** collateral on Polygon; the fee page retains some USDC terminology. Do not label sell proceeds as withdrawable native USDC without a conversion/withdrawal step. [Fees](https://docs.polymarket.com/trading/fees), [market details](https://docs.polymarket.com/market-data/market-details), [quickstart](https://docs.polymarket.com/trading/quickstart).

## Funding and approvals

An exit needs the outcome tokens in the correct Polymarket account plus Conditional Tokens ERC-1155 exchange approval. Buying instead requires pUSD and ERC-20 allowance. Smart-wallet setup/approval transactions need Relayer or Builder authorization; `setupTradingApprovals()` checks and fills missing approvals. Existing approved accounts can sign/post orders without newly provisioning a builder account. The SDK can attempt approval recovery on placement; handle missing authorization explicitly rather than treating it as an execution failure. For Closeout's initial scope, onboard already funded/approved accounts and provide a clear readiness screen before execution. [Wallet setup](https://docs.polymarket.com/trading/wallets-auth), [order requirements](https://docs.polymarket.com/concepts/order-lifecycle).

## Geography and transport

Run the public geo check from the **user's browser/IP**, not solely from a server whose country is different. Current docs distinguish fully blocked jurisdictions from close-only regimes (some frontend + API, some frontend-only). `blocked` is only a boolean in the endpoint's documented response; it does not by itself encode that full taxonomy. Respect the venue's current response and account close-only restrictions. Do not route through a proxy to defeat a user's restriction. For an ambiguous `blocked` result, keep public preview available and disable execution pending explicit venue-supported eligibility handling. India is not in the current listed restrictions, but this is not a guarantee about every user's account or IP. [Geographic restrictions](https://docs.polymarket.com/api-reference/geoblock).

Transport test: Python urllib requests received HTTP 403, while normal Node native `fetch` returned 200 for CLOB time, Gamma market discovery and geoblock. Node requests with a browser Origin returned wildcard CORS for the sampled CLOB book and fee-rate endpoints. This is a transport distinction, not evidence of geographic unavailability. No headers, credentials or challenge bypass were used. The public Data v2 positions endpoint and CLOB market-info endpoint also returned 200 with wildcard CORS. A real `createPublicClient().fetchMarket()` plus standalone `fetchMarketInfo()` SDK read of the official quickstart market succeeded, returning feeInfo `{rate:0.04,exponent:1}`, tickSize `0.001` and outcome token IDs. This validates one public SDK read, not the fee parameters of other markets. Browser runtime and authenticated wallet execution remain untested.

## Integration limits and next concrete check

The package sample is typechecked, not transaction-tested. Before enabling the live button, verify a public market → book → actual fee model and a connected user's owned position; then test wallet authentication and read-only balances. A live order requires explicit per-order confirmation. Store desired shares, price floor, signed order identity, returned order ID, matched amount, fee estimate/actual fill records, settlement hashes and remainder. A safe demo can show real public data and simulated execution states clearly labeled until a user elects a live trade. This memo does not establish complete execution, fees saved or customer demand.
