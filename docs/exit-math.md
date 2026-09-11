# Sell-side exit math

Verified against the official sources below on September 12, 2026. This module is a **pure snapshot estimator**, with no wallet, signing, network request or order placement. It never claims that visible liquidity will remain available or that an estimate is a receipt.

## Contract for the UI

`calculateExitPlan(input)` accepts decimal **strings** for shares, prices, sizes and fee coefficients. Monetary JavaScript numbers are rejected. Explicitly select `FAK` or `FOK`, and supply one of:

- `{ kind: "known", rate: "0.05", exponent: 1 }` for a verified market fee curve. This is an example, not a category default.
- `{ kind: "none" }` only when the source explicitly establishes no applicable modeled fee.
- `{ kind: "unknown", reason: "Fee schedule unavailable" }` when metadata is missing. A failed fee lookup must never become zero fees.

The result is either `valid: false` with path-specific `issues`, or `valid: true` with:

| Field | Meaning |
|---|---|
| `available` | The candidate highest-bid-first sweep at or above the floor. Remains visible when fees, snapshot age or policy prevent proceeding. |
| `estimate` | The modeled result after FAK/FOK and local gates. Zero proposed fill on a block or insufficient FOK depth. This is never an observed execution. |
| `depthSteps` | All sorted bid levels, per-level used size/proceeds/fees, cumulative totals and an exclusion reason where no shares are used. These describe `available`, including when `estimate` is zero. |
| `status` | `full`, `partial`, `no-fill` or `blocked`. Stale/unknown-fee policy blocks take precedence over an otherwise calculable fill. |
| `passesSnapshotChecks` | All local checks pass and some fill is modeled. Not permission, order acceptance, market availability or a guarantee. |
| `meetsMinNetReceipt` | Receipt check on the order-type result before policy blocking. Null for unknown fees. FOK with inadequate depth compares zero, not the tempting candidate partial receipt. |
| `freshness` | Explicit observation-time check; missing, invalid, stale and future timestamps cannot pass. |

Financial outputs are canonical decimal strings. Averages are gross prices, share-weighted and rounded down to at most 18 decimal places; the worst fill is the lowest consumed bid. No-fill averages are null. Unknown fees and net proceeds are null even though gross depth is available. Do not display null as `$0`.

## Math and constraints

The local sell model for each candidate price level is:

```text
take       = min(remaining requested shares, bid size) if bid price >= floor
gross      = take * price
fee        = take * rate * (price * (1 - price)) ^ exponent
net        = gross - fee
```

Calculate fees at each fill price, then sum. A fee computed once using the average price is generally different. The floor applies to the **gross price per share**. `minNetReceipt` applies to the **total modeled receipt after only the supplied fee**, without prorating it for a partial fill. Its default is zero; an explicitly malformed value is rejected.

The official fee page currently gives the exponent-one curve, market-dependent taker coefficients and five-decimal fee precision. Both the full docs and July 10 help page currently list sports at `0.05`; a cached search excerpt still showed `0.03`. Use current per-market metadata rather than a cached category rate. [Official fee formula and precision](https://docs.polymarket.com/trading/fees), [current help corroboration](https://help.polymarket.com/en/articles/13364478-trading-fees).

The current market schema exposes fee-enabled state, rate and exponent; it also exposes trading status and matching delays. **Missing schedule/fee-enabled state is unknown, not fee-free.** This module supports explicitly supplied integer exponents 0–8; unsupported exponents fail rather than approximate silently. The model does not subtract prospective rebates. [Official market fields, fee and timing sections](https://docs.polymarket.com/market-data/market-details).

By default, the module retains the exact unrounded fee curve. If the caller supplies `roundingDecimals`, each consumed displayed level uses explicit half-up rounding at that precision. That is a **modeling assumption**, not a claim that the exchange aggregates matches that way. The public precision prose does not settle all rounding-boundary or individual-match splitting details. An aggregated price level may contain several matches, so even a five-decimal modeled fee can differ from actual fees. The output always warns about this limitation. Rounded fees above a fill's proceeds are rejected rather than producing a negative receipt.

FAK consumes available eligible depth and leaves the remainder unfilled. FOK with insufficient eligible depth models zero fill. A passing minimum-receipt check is **not** an enforceable total-receipt condition: an FAK order can fill less than the snapshot predicts; even full quantity at a gross floor can produce a different net receipt. This read-only module does not prepare an order or assert settlement. Official order docs also distinguish an accepted delayed order from a matched/settled fill. [Order types, sell-price limits and lifecycle](https://docs.polymarket.com/trading/place-orders).

Gas, builder fees, intermediary fees, conversion/bridge charges and withdrawal costs are outside this single fee model. Thus `netReceipt` means **after modeled sell fee**, not all-in money received by the user. The UI must identify the actual collateral unit from the adapter; this module does not equate pUSD, USDC and bank USD.

## Data integrity and freshness

- Validate every input bid, including unused and below-floor rows. A price must be strictly between 0 and 1; size and requested shares must be positive. A floor may be 0 or 1. Nondecimal strings, negative values, NaN, infinity, exponent notation, monetary numbers, sparse rows and excessive precision are rejected.
- The input represents **aggregated price levels**. Equivalent duplicates such as `0.5` and `0.50` are errors; silently adding them can double-count a duplicated snapshot. An upstream adapter with verified distinct orders must aggregate them intentionally before this function.
- Valid unsorted data is sorted descending in a new array. Inputs and Decimal's global precision remain unchanged.
- Decimal strings allow at most 18 integer and 18 fractional digits, at most 10,000 bid levels and integer exponent at most 8. A private 512-significant-digit Decimal clone keeps the supported products and sums exact; division is restricted to the displayed average.
- `checkSnapshotFreshness({timestampMs, nowMs, maxAgeMs, allowedFutureSkewMs?})` requires explicit milliseconds. Values must be nonnegative safe integers. Age exactly equal to the limit passes; one millisecond more fails. Future time fails unless covered by explicit skew tolerance. The calculator has no hidden `Date.now()` call or default age policy. Root UI's proposed 15-second policy is a product choice, not an exchange freshness guarantee.
- Timestamp freshness does not prove that the feed is complete or correctly sequenced. Market identity, accepting-orders status, minimum size/tick, balance/allowance, account authority, restrictions and actual execution/settlement require separate checks. The calculator is not an order-admission validator.

## Worked integration example

```ts
const result = calculateExitPlan({
  shares: "100",
  floorPrice: "0.60",
  minNetReceipt: "40",
  bids: [
    { price: "0.65", size: "40" },
    { price: "0.60", size: "30" },
    { price: "0.55", size: "100" },
  ],
  orderType: "FAK",
  fee: { kind: "known", rate: "0.05", exponent: 1 },
  snapshot: { timestampMs: 100_000, nowMs: 101_000, maxAgeMs: 15_000 },
});
```

The snapshot suggests 70 shares sold, 30 remaining, 44 gross, 0.815 modeled fee and 43.185 net. The last level is below the floor. FOK with the same request instead suggests no fill while preserving that candidate ladder. Unknown fees preserve 44 gross but null fees/net and block the plan. A minimum total receipt of 50 blocks the FAK plan rather than shrinking the user's requirement to fit the available partial fill.

## Verification

`src/lib/exit-plan.test.ts` exercises exact decimal accounting, descending sweeps, floor equality, partial/no fills, sufficient/insufficient FOK, fee curvature and explicit rounding, unknown fees, minimum-receipt boundaries, malformed/duplicate data, immutable input, global precision isolation and freshness boundaries. These tests verify the estimator's policy and arithmetic; they do not certify live fee settlement or available liquidity.
