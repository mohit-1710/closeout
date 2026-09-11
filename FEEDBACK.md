# Integration feedback

Observations made while building, not submitted.

- September12 IST: older Polymarket CLOB documentation URLs redirect to unified SDK pages. The similarly named @polymarket/sdk package is not the official current @polymarket/client0.10.0. Using primary docs and inspecting installed declarations avoids incompatible authentication/order methods.

## Privy

Pending public App ID. No qualifying live Privy integration or sponsor eligibility claimed before setup and verified use.

## Integrated build review — September 12 IST

Browser QA found the SDK declaration/runtime export mismatch for AssetType; importing from the pinned bindings package fixed actual bundling. Same-query market retries now use a request revision, and discovery no longer clears an unchanged selected book.

Independent review found and fixed account lookup races, session binding across provider awaits, overlapping cancellation, corruption of saved history, missing trade references incorrectly becoming terminal, and a live partial remainder no longer being polled. Cross-tab account locks now cover the final history check through persisted order response; history writes are serialized separately. Pending records survive terminal-history pruning; capacity exhaustion fails closed.

Tests cover decimal estimation, public-response identity and precision, order/fill reconciliation, stored-history integrity and retention, and mocked wallet/trading-service safeguards. Browser tests use explicit fictional fills and GET fixtures. Actual public reads were also tested separately. No live wallet execution is claimed.
