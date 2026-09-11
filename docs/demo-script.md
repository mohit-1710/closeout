# Closeout demo — about 3 minutes

Record your own voice and normal-speed screen capture, at least 720p. This is a rehearsal script, not an AI narration track. Recheck the private submission dashboard before recording.

**0:00–0:25 — User and problem**

“Closeout is for a prediction trader who wants to exit an existing position. The last displayed price does not tell them how much their whole position can sell for, what fees remove, or what remains unsold. We put that exit decision in one place.”

**0:25–1:10 — Live data**

Start in Live mode. Open a current market and show its bids. Enter the number of shares and a minimum price per share. Move the floor and point to estimated proceeds and unsold shares. Open the table so the estimate is traceable to actual bid levels. Explain that the snapshot is indicative and refreshes before review.

**1:10–1:55 — Partial versus all-or-none**

Explicitly choose Example mode: “These are fictional values so I can demonstrate the failure cases without moving funds.” Keep the default 250 shares and 0.60 floor in the Atlas market. There are 140 shares at/above the floor; 110 remain unsold. Switch to FOK: the entire exit is blocked because the available depth cannot fill 250. Return to FAK, review, and simulate. Show the simulation badge and fictional partial result.

**1:55–2:35 — Existing account and lifecycle**

Show the wallet/position dialog. Explain that an entered public address is watch-only; the owner must connect and authorize the account. Closeout checks unreserved holdings and the correct token allowance, refreshes the quote, then asks for an explicit signed SELL. Matched is separate from confirmed settlement. A lost submission response locks retries instead of sending another sell. Show only the integration you actually verified; if no real wallet/trade was tested, say so plainly.

**2:35–3:00 — Company path and next proof**

“The wedge is a reliable exit workflow for active traders. Next we test it with traders holding positions that are awkward to unwind, measure completed exits and repeated use, and test willingness to pay. We are not claiming demand or savings from the simulation.”

If Privy is configured, demonstrate its actual wallet connection step and name its necessary role. If it is not configured, omit any claim that the sponsor integration was demonstrated.
