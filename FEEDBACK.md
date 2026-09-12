# Integration feedback

These observations describe the installed integrations and useful documentation improvements. Dependency versions are pinned in [package.json](package.json). This file does not imply that feedback has been submitted to a provider.

## Polymarket TypeScript SDK

### Keep runtime exports aligned with declarations

During integration with `@polymarket/client` 0.10.0, importing `AssetType` from the client package passed type checking but failed against the published runtime exports. Closeout imports that runtime value from the matching `@polymarket/bindings` package instead. A smoke check against the published ESM package, alongside declaration checks, would catch this class of mismatch. The workaround is contained in the [trading adapter](src/lib/trading-client.ts).

### Show an existing-account execution path

An example covering an existing owner-controlled trading account without deploying an account or granting new approvals would help applications keep read, authentication and transaction boundaries explicit. Closeout validates the account's owner relationship and rejects missing deployment or approval prerequisites; its signer adapter does not authorize setup transactions. Other supported SDK wallet types are outside this implementation. See [wallet and authentication documentation](https://docs.polymarket.com/trading/wallets-auth).

### Separate order acceptance from confirmed settlement

A worked lifecycle example with partial quantities, trade references and cancellation of an unfilled remainder would help prevent applications from treating an accepted order as received proceeds. Closeout's [reconciler](src/lib/order-status.ts) checks confirmed trade evidence; final live net proceeds remain unreconciled. The [official lifecycle reference](https://docs.polymarket.com/concepts/order-lifecycle) provides the underlying states.

## Privy React SDK

Closeout initially opened Privy's chooser while its own native HTML dialog remained modal, making the separate chooser inaccessible. Closing the native dialog before invoking Privy resolved the application-level integration problem. A note about native dialogs and portaled wallet choosers would be useful in integration guidance; this finding does not establish a Privy SDK defect.

The actual chooser has been checked for opening, dismissal and reopening in isolated browser contexts. No wallet was selected, authenticated, linked or used to sign or trade during those checks. The current [wallet provider](src/components/wallet-provider.tsx) uses external wallets without automatically creating embedded wallets.

## Scope of these observations

Unit and service checks use controlled fixtures. Public reads, fictional example flows and the real wallet chooser have separate browser coverage. Actual wallet authentication, signatures, live orders, cancellation, approvals and funded execution remain unvalidated. See [verification](docs/verification.md) and [execution integration](docs/execution-integration.md) for the current boundaries.
