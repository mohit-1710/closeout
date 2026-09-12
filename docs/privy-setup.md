# Privy setup

Closeout uses Privy to connect an existing external Ethereum wallet in the [/app workspace](https://closeout-ashen.vercel.app/app). The provider is mounted only on that route. Connecting a wallet does not authenticate a Polymarket trading session or prove ownership of an address entered for position lookup.

## Configure an application

1. Enable wallet authentication in the Privy dashboard.
2. Copy [`.env.example`](../.env.example) to an ignored local environment file and set `NEXT_PUBLIC_PRIVY_APP_ID` to the public App ID. Set the same variable in the intended deployment environment.
3. Allow the exact origins that should offer wallet login: production uses `https://closeout-ashen.vercel.app`; local development commonly uses `http://localhost:3000` or `http://127.0.0.1:3000`.
4. Restart local development or rebuild the deployment after changing the public identifier.

No app secret or custom client ID is needed for this browser integration. Without a public App ID, Closeout uses its injected-wallet connection path. See the [official React setup](https://docs.privy.io/basics/react/setup).

Allowed origins include the scheme and exact development port, but no `/app` path. Approve preview origins deliberately; a wildcard covering unrelated `vercel.app` applications is inappropriate. Privy's [allowed-domain documentation](https://docs.privy.io/recipes/dashboard/allowed-domains) describes the dashboard controls.

## Application behavior

The [wallet provider](../src/components/wallet-provider.tsx) configures wallet-only login, Ethereum external wallets, Polygon as the trading chain and no automatic embedded-wallet creation. It exposes an EIP-1193 provider to the workspace. Account or chain changes invalidate the active execution context.

Closeout closes its native wallet dialog before opening Privy's separate chooser so the modal layers do not overlap. The chooser establishes connection only. The user separately reviews and authorizes the venue session, and the [trading adapter](../src/lib/trading-client.ts) checks the signer/account relationship before execution.

## Verification

With the app running on an allowed origin, run:

```sh
npm run test:privy
```

For production:

```sh
BASE_URL=https://closeout-ashen.vercel.app QA_LABEL=production npm run test:privy
```

The isolated browser check reads actual public configuration and opens, dismisses and reopens the real chooser. It selects no wallet and blocks authentication, linking, signing and order actions. Known anonymous initialization requests are identified separately from financial writes. Reports are generated under ignored `.artifacts/qa/`.

Passing this check does not establish actual wallet authentication, signing, live order submission, cancellation or funded execution. Those remain unvalidated, and final live net proceeds remain unreconciled. See [verification](verification.md) and [execution integration](execution-integration.md).
