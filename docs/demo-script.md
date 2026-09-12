# Closeout demo — target 2:45

Use your own human narration and normal-speed screen capture. The finalist brief is **2–4 minutes, at least 720p, clear speech rather than music**. Aim for 2:45, leaving room inside the limit for natural pauses. This is a recording script, not a completed video or generated voice track.

Open [Closeout](https://closeout-ashen.vercel.app) in a clean browser window at a readable size. Begin in **Live** mode, with no wallet connected. Keep the actual UI and its mode labels visible. No live trade, wallet selection or signature is needed for this recording. Follow the [recording and export checklist](video-checklist.md).

## 0:00–0:18 — The exit decision

**Show:** The Closeout workspace and its headline. Point to the exit ticket.

> Closeout helps a prediction trader understand an exit before signing. A displayed market price does not tell you how much your whole position can sell for, what fees remove, or what remains unsold. This workspace brings those numbers together.

## 0:18–0:50 — Real book, indicative quote

**Show:** Select a current live market. Enter an illustrative share amount and a valid minimum price. Toggle to bid levels, then back to the depth chart. Point to gross proceeds, venue fee, estimated net and remaining shares. These inputs are a plan, not a claim that you own the shares.

> Here is a current Polymarket book. I can inspect the available bids, enter a share amount, and set a minimum price per share. The quote estimates proceeds after the venue fee and shows what may remain unsold. It is a snapshot, not a guaranteed fill. Network, intermediary and conversion costs are excluded.

**If the live source is unavailable:** Show the actual error and replace the live narration with: “The live source is unavailable in this capture. I’m explicitly switching to Example mode to demonstrate the planner.” Do not describe the example as live data. Use the remaining time to explain the visible bid table and price floor.

## 0:50–1:22 — Make partial liquidity visible

**Show:** Click **Example**. Select the Atlas market, Yes outcome. Set **250 shares**, **0.60 pUSD/share**, and **Sell available**. Hold the fillable and unsold rows long enough to read. Select **All or nothing**, show the blocked state, then return to **Sell available**.

> I’m choosing Example mode now. These markets, balances and fills are fictional. At a floor of zero point six pUSD per share, only one hundred forty of the two hundred fifty requested shares can fill. One hundred ten remain unsold. All or nothing blocks the exit because the book cannot fill the whole amount at my floor. Sell available permits the partial plan.

If the earlier live-error fallback already switched modes, begin with “We’re in Example mode now.”

## 1:22–1:52 — Review and follow the result

**Show:** Click **Review simulated exit**. Pause on requested shares, floor, fillable shares, fees and remainder. Click **Simulate exit**. Show **Partially settled**, **Simulated**, and the fictional-result explanation in Activity. Do not show a real transaction explorer or invent a receipt.

> Review keeps the price floor, fillable amount, fee and remainder together before confirmation. I’ll simulate this partial exit. Activity explicitly labels the result as simulated; no funds moved. The implementation distinguishes a match from confirmed settlement. This recording does not demonstrate a real settled trade, a real receipt, or measured savings.

## 1:52–2:24 — Account ownership and Privy

**Show:** Open the wallet and positions dialog. Point to the read-only public-address field without entering a real account. Click the inner wallet-connect control to open the configured **Privy wallet chooser**. Show the chooser, dismiss it, and return to Closeout. Do not select a wallet or authenticate.

> Entering a public address is read-only; it does not authorize trading. Privy opens the chooser for the account owner’s existing wallet. I’m stopping at that chooser, without connecting or signing. Live execution requires the owner’s authorization and checks holdings and allowances. An uncertain submission is kept unresolved so a missing response does not invite a duplicate sell.

Only record the chooser if it actually opens on the recording origin. The current evidence covers opening, dismissing and reopening it, not successful wallet authentication or a live order. If it fails during rehearsal, resolve the setup before recording or state that limitation rather than implying a completed connection.

## 2:24–2:45 — The next proof

**Show:** Return to the exit ticket and the clearly labeled example Activity. End on the product, not a terminal or unverified metric slide.

> The next test is with repeat prediction traders holding positions that are awkward to unwind. We need to observe completed exits and repeated use, then test willingness to pay. Today’s demo shows a working planner, public-data integration and a labeled simulation. It does not establish customer demand.

## Rehearsal notes

- The spoken copy is approximately 309 words. Read naturally at about 130–140 words per minute, with short pauses for clicks and numbers. The exported file’s actual length decides compliance; the timeline is a target.
- If long, shorten the technical explanation before cutting the partial-fill demonstration or its fictional labels. Keep all mode switches and the final result understandable.
- Use **pUSD** for displayed proceeds. A receipt estimate is not a bank withdrawal or final reconciled net proceeds.
- No paid customer, real trade, fee saving, deployment, sponsor eligibility or award is established by this recording. Only add a claim if its separate evidence exists.
- Recording, human narration and submission remain owner actions. Nothing in this package has been uploaded or submitted.
