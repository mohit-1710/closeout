# Closeout — submission draft

**One-liner:** Know what your prediction-market exit can fill before you sign.

**Description:** Closeout helps an existing prediction-market trader plan a price-bounded exit against current bid depth. Enter the shares to sell and a minimum price per share; see estimated net proceeds, venue fees and shares left unsold. Choose partial immediate execution (FAK) or all-or-none execution (FOK), authorize from the account's actual owner wallet, and follow matched fills through venue confirmation.

**Problem and user:** A trader unwinding a position needs to know what the available liquidity supports and what remains after an incomplete exit. A displayed market price alone does not answer that question. Closeout combines planning, preflight checks and execution status in one focused workflow.

**Built during ETHOnline:** Next.js frontend and public-data adapters; exact decimal exit planning with current market fee parameters; browser wallet integration; unified SDK execution with per-order review; balance/reservation/approval checks; order-specific cancellation and confirmation tracking; fictional example mode; responsive UI and automated tests. See git history and test artifacts for the actual build record.

**Stack:** Next.js/React/TypeScript, Decimal.js, Viem, Polygon, current Polymarket unified SDK. Optional Privy external-wallet connection requires the real public App ID and allowed origin. No secret is exposed to the browser.

**What makes the implementation careful:** Unknown fees and stale fetches block submission. Public portfolio lookup does not grant trading authority. An accepted or matched response is not recorded as settled proceeds. Failed or uncertain requests remain visible, with duplicate-submit protection. There is no fake live-data fallback.

**Validation:** Public data and browser geography tested live; calculation/adapter/state/service tests and responsive browser checks recorded locally. No live wallet signature or real financial transaction was performed during the build. Customer and payment validation are still open. Update this paragraph only when additional evidence exists.

**Sponsor selection:** Privy is the candidate if the final configured wallet flow satisfies the current Financial Flow requirements. Do not claim eligibility or submit to the track merely because the dependency exists. Select no more than the event's permitted partner tracks and complete required partner feedback.

**AI and external-code disclosure:** Codex assisted research, implementation, documentation and testing. Open-source SDKs implement venue/wallet protocols; Closeout's app logic is in this repository. The demo must use human narration under the event's rules. No copied project is claimed as original work.

**Still required for the actual form:** Public source repository URL, deployed URL, actual demo video link, team details, verified participation state, final chosen sponsor track and its required feedback. This is a local draft and has not been submitted.
