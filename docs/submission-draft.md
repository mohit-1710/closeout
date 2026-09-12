# Closeout — ETHOnline 2026 draft

Prepared September 12, 2026 IST. [Open the copyable fields](submission.html). This document does not record a saved or final event submission.

## Project fields

**Name:** Closeout

**Emoji:** 🚪

**Category:** DeFi

**Topic:** Prediction markets

**Short description** — 63 characters; form maximum 100:

Know what your prediction-market exit can fill before you sign.

## Description

Closeout helps a Polymarket trader work out how much of an existing position can sell before authorizing an exit. A displayed market price does not show what the whole position could return, what fees remove, or how many shares might remain unsold.

Choose a market, enter the shares to sell and set a minimum price per share. Closeout reads live bids and estimates proceeds, venue fees and unsold shares. Choose to sell what is available at that floor or require the entire amount to fill. The app keeps accepted, matched and confirmed fills separate, so an accepted order is not presented as money received.

Live public data and the configured Privy wallet chooser are tested. Example mode lets reviewers try partial fills and insufficient liquidity with clearly fictional data. The owner authentication and order flow are implemented, but have not been tested with a real wallet or trade. Final net receipts remain unknown; no savings, paid users or traction are claimed.

## How it's made

Closeout is built with Next.js, React and TypeScript. Read-only server routes fetch Polymarket markets, positions and order books. Decimal.js preserves precision when calculating fillable shares, fees and the remainder at a chosen price floor.

The wallet flow uses Privy's external Ethereum wallet chooser, Viem and the current Polymarket unified SDK on Polygon. It is designed for the signer that owns an existing Polymarket account. Public address lookup grants no trading authority. Before an order, the app checks the account, chain, geography, available shares, token approval and a refreshed quote. Signing and submission stay in the browser.

The app tracks each order and its fills separately. Browser locks and persistent pending records prevent a blind retry after an uncertain submission. A match is never treated as confirmed settlement, and final net receipts are left unknown. Automated tests cover the calculations, response parsing, reconciliation and service safeguards. Browser tests cover the example flow and the real Privy chooser; no real trade has been sent.

Codex generated and revised substantial parts of the app source, tests and documentation. Mohit supplied the company-first brief and configured Privy. The repository includes the actual build and planning notes, preserved commit history and open-source dependencies.

## Links and remaining form fields

- **Public repository:** [https://github.com/mohit-1710/closeout](https://github.com/mohit-1710/closeout) — publication and push confirmed September 12 IST. Preserve the actual commit history.
- **Demonstration URL:** [https://closeout-ashen.vercel.app](https://closeout-ashen.vercel.app) — public deployment and read-only market/book responses verified September 12, 2026, 15:55:50 UTC. [Deployment check](qa/deployment-public-reads.json). Use this live app URL in the required demonstration field; this document does not record whether it has been saved there.
- **Demo video URL:** not recorded or uploaded yet. Do not substitute a placeholder.
- **Team:** Mohit; confirm intended members and profiles in the event dashboard.
- **Participation and judging choice:** verify in the private dashboard. No acceptance, stake or check-in status is inferred from these draft fields.

## Privy integration field

Privy supplies the external-wallet chooser for the owner of an existing Polymarket account. The Closeout app is configured with wallet authentication and both local development origins. An isolated browser test verifies that its real chooser opens, closes and reopens without selecting a wallet. The subsequent owner authorization and financial flow are implemented but have not been exercised with a real account. We have not yet demonstrated the completed financial flow required for the Best financial flow prize.

## Partner feedback field

Privy's chooser could open behind our native HTML wallet dialog, making it inaccessible. Closing the native dialog synchronously before calling connectWallet fixed the handoff. A short integration example covering native dialog or nested modal handoffs would help developers. We added a browser test that opens, dismisses and reopens the real chooser without connecting a wallet.

## AI and reused-code disclosure

Codex generated and revised substantial parts of the frontend (src/components/), planning and integration code (src/lib/, src/hooks/), tests and documentation. Mohit supplied the company-first brief, authorized the build and configured the Privy app. The repository uses the Next.js scaffold and open-source Privy, Polymarket, Viem, Decimal.js and UI dependencies. The build and integration notes record the implementation decisions.

Do not describe AI-generated work as unaided work or claim human review that has not happened. Retain the actual planning and build artifacts; do not invent an older codebase or conceal reused code.

## Run and demonstrate

Use Node 24 or newer. Run npm ci and npm run dev, then open http://localhost:3000. Public market browsing needs no wallet or key. Example mode is explicitly fictional. Set the public NEXT_PUBLIC_PRIVY_APP_ID to demonstrate the configured chooser. No app secret is required. See README.md for account and execution requirements.

See [README](../README.md) and the [2:45 demo script](demo-script.md).

Start the draft early and keep editing until close, as instructed in the event form. Keep public GitHub commits as work progresses. Final deadline: **September 13, 2026, 16:00 UTC / 21:30 IST**. The video must be **2–4 minutes, at least 720p**, with clear human narration rather than music/text or AI voiceover. Do not speed up footage. [Official submission instructions, checked September 12 IST](https://ethglobal.com/events/ethonline2026/info/details).

Official source checks: [project creation](https://ethglobal.com/events/ethonline2026/info/start) asks for a name and brief description; [Privy requirements](https://ethglobal.com/events/ethonline2026/prizes/privy) require a working financial flow and use of a Privy wallet. The short-description maximum and two long-field minimums come from the signed-in form inspected September 12 IST. Description is 975 characters; How it's made is 1350, both above the 280-character minimum. No sponsor eligibility or final submission is claimed by this draft.
