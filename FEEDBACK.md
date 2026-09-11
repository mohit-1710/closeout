# Integration feedback

Observations made while building, not submitted.

- September12 IST: older Polymarket CLOB documentation URLs redirect to unified SDK pages. The similarly named @polymarket/sdk package is not the official current @polymarket/client0.10.0. Using primary docs and inspecting installed declarations avoids incompatible authentication/order methods.

## Privy

Current public App ID: `cmtxg359900sd0cjp3cacl9m6`. The new app's public configuration verifies name **Closeout**, wallet authentication enabled, and exactly `http://localhost:3000` and `http://127.0.0.1:3000` as allowed origins. Name and local origin setup are complete. All four actual chooser smoke checks and the production build passed with this app; a connected-wallet financial flow and sponsor eligibility are not claimed.

## Integrated build review — September 12 IST

Browser QA found the SDK declaration/runtime export mismatch for AssetType; importing from the pinned bindings package fixed actual bundling. Same-query market retries now use a request revision, and discovery no longer clears an unchanged selected book.

Independent review found and fixed account lookup races, session binding across provider awaits, overlapping cancellation, corruption of saved history, missing trade references incorrectly becoming terminal, and a live partial remainder no longer being polled. Cross-tab account locks now cover the final history check through persisted order response; history writes are serialized separately. Pending records survive terminal-history pruning; capacity exhaustion fails closed.

Tests cover decimal estimation, public-response identity and precision, order/fill reconciliation, stored-history integrity and retention, and mocked wallet/trading-service safeguards. Browser tests use explicit fictional fills and GET fixtures. Actual public reads were also tested separately. No live wallet execution is claimed.

## Privy activation — September 12 IST

The initial activation used development app `cmtxfl71h00hj0cl5lvwb4kp8`, named `app`. Actual SDK initialization exposed a modal-layer bug: Closeout’s native wallet dialog made Privy’s separate chooser inaccessible. The Connect action now closes the native dialog synchronously before opening Privy. An isolated browser test verified that app's chooser opens, dismisses and reopens; no wallet was selected and all auth/link/order writes were blocked. Native Brave input/window failures initially left its dashboard name and allowed origins pending.

Mohit subsequently supplied the new public Closeout App ID above. Its public configuration confirms the completed name and origin setup, replacing that earlier pending action. The development server was restarted with the new public ID; all four actual chooser smoke checks and the production build passed. No wallet was selected, authenticated, linked or used to sign or trade. Earlier passing artifacts were retained under `previous-app` names. A secret exposed in conversation is not used by the integration; revoke it in Privy. No replacement secret is needed, and no secret value is recorded here.
