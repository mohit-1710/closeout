# Owner actions before the live demo

Local building and testing continue without these.

1. **Privy dashboard settings:** Sign-in is complete in Brave, and the public App ID is configured in the ignored `.env.local`. Wallet authentication is enabled and the real Privy chooser passes open/dismiss/reopen tests. The remaining dashboard steps are to set the app name to **Closeout** and allow **http://localhost:3000** and **http://127.0.0.1:3000** under Basics → Domains. The last public-config check still showed name `app` and an empty allowed-origins list. Native Brave automation repeatedly returned window/input errors; these two settings were handed to Mohit. No app secret is needed.
2. **Own-account verification:** Connect the owner signer of an existing funded/approved Polymarket account and load its account-wallet address. First verify read-only positions, balances, allowances and the review quote. A real order requires your separate, explicit per-order authorization in the app; none has been sent by the build agent.
3. **Hackathon participation:** Verify your private ETHOnline dashboard shows accepted/staked eligibility. Public event deadlines cannot establish your personal eligibility or excuse missed check-ins.
4. **Demo:** Record a 2–4 minute human-voiced walkthrough, at least 720p, using the final working app. Show example mode honestly if a real trade is not verified. Submit by **September 13, 2026 16:00 UTC /21:30 IST**; target 20:30 IST. Use the event dashboard's current requirements if they differ.

No submission, deployment, outreach, token approval, wallet funding, or trade was performed by this build.
