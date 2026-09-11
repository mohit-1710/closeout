# Owner actions before the live demo

Local building and testing continue without these.

1. **Revoke the exposed Privy secret:** Closeout uses only the public App ID; the secret pasted in conversation is unused and should be revoked in Privy. No replacement secret is needed. App setup itself is complete: the new public ID `cmtxg359900sd0cjp3cacl9m6` returns name **Closeout**, wallet authentication enabled, and exactly **http://localhost:3000** and **http://127.0.0.1:3000** as allowed origins. All four actual chooser smoke checks and the production build passed with the new app. Add the exact production origin when deploying.
2. **Own-account verification:** Connect the owner signer of an existing funded/approved Polymarket account and load its account-wallet address. First verify read-only positions, balances, allowances and the review quote. A real order requires your separate, explicit per-order authorization in the app; none has been sent by the build agent.
3. **Hackathon participation:** Verify your private ETHOnline dashboard shows accepted/staked eligibility. Public event deadlines cannot establish your personal eligibility or excuse missed check-ins.
4. **Demo:** Record a 2–4 minute human-voiced walkthrough, at least 720p, using the final working app. Show example mode honestly if a real trade is not verified. Submit by **September 13, 2026 16:00 UTC /21:30 IST**; target 20:30 IST. Use the event dashboard's current requirements if they differ.

No submission, deployment, outreach, token approval, wallet funding, or trade was performed by this build.
