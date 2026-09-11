# Closeout design brief

**Promise:** Know what your exit could return.

**Direction:** A calm, dark trading workstation. Slate and ink surfaces, one lime accent, clear edges, no gradients. The interface is a working instrument, not a landing page.

**Density:** Compact on desktop, comfortable touch targets on mobile. The selected market, sell-side liquidity and exit ticket share one workspace. No marketing cards or invented activity.

**Typography:** A deliberate sans for labels and market questions; tabular monospace for prices, share counts, fees and receipts. Strong hierarchy comes from scale and space, with three weights. The net receipt gets the strongest emphasis; the remaining position stays visible beside it.

## Layout

- Header: custom split-arrow wordmark, product navigation, persistent live/simulation state, wallet action. No unrelated links.
- Left: integrated market search and a compact list. Positions are a separate view with an explicit wallet/address requirement. Selected rows use a quiet accent edge rather than a filled neon block.
- Center: selected market question, outcome choice, bid-depth visualization, executable-level table and order activity. The chart is generated from the supplied book; it is not a synthetic price history. Empty books stay empty.
- Right: exit ticket with share amount and price floor, available shares when known, a quote breakdown and review action. The planner supplies calculations and blocking reasons.
- Mobile: Markets / Exit / Activity controls switch between useful panels. The ticket precedes secondary depth detail. Inputs and action targets remain at least 40px; narrow screens never hide the net/fee/remaining breakdown.

## Trust and interaction rules

1. Live market data is distinct from live order execution. Simulation is labeled throughout the ticket, confirmation and lifecycle; simulated balances and results never appear as real holdings or completed trades.
2. The floor input is a minimum **pUSD price per share**, matching the shared DTO's decimal string (for example, `0.52`). It is not an aggregate net-total constraint. Outcome labels may show the same value in cents for quick scanning; order input and review retain explicit pUSD units.
3. Quote review shows requested shares, currently fillable shares, gross proceeds, fees, estimated net proceeds and remaining shares. Unknown amounts render as an em dash, not zero.
4. Inputs preserve the user's decimal strings. Financial calculations remain in the shared planner; display formatting never changes order values. Tiny nonzero amounts remain distinguishable from zero.
5. Market, book, position and order states each support loading, empty, error and retry. A data-source failure cannot silently become a simulated success.
6. Confirmation is explicit. Wallet rejection returns to the editable state; order submission is never optimistically labeled filled. Cancel is available only for eligible lifecycle states and updates from the supplied service result.
7. Native buttons, labeled fields, visible focus rings, logical tab order, arrow-key tab navigation, `/` search shortcut and Escape-dismissable review make the workspace keyboard usable.
8. Motion is limited to 100–150ms state feedback and a brief dialog arrival. Reduced motion removes nonessential transitions. No mount animation delays the first useful interaction.
9. Market and order links point to actual supplied destinations. There are no placeholder buttons, fabricated wallet values or undisclosed telemetry.

## Component boundary

`ExitWorkspace` is a client presentation component with a single `workspace: WorkspaceController` prop from `src/lib/types.ts`, exported both named and default. The root owns network requests, wallet integration, order math, review lifecycle and persistence. The component owns only local presentation state such as the visible mobile panel, depth view and wallet/address dialog.

Required model groups: mode and execution capability; market search/results/selection; selected outcome; book and freshness; wallet/positions; editable amount/floor; planner result and validation; orders and operation status. Required actions: search, select market/outcome, edit inputs, refresh, import/connect, review/submit and cancel.

## Visual verification

Inspect desktop 1280px, tablet 768px and mobile 375px. Check the default state, empty live response, source error, quote with remaining shares, review dialog, simulation lifecycle and cancellation. Ensure money never truncates, focus returns to the trigger and keyboard navigation reaches every visible action. Confirm the chart reflects book data and a missing balance is never presented as an actual zero balance.

Palette and font tokens in the root-owned `brand.md` remain authoritative. These choices are delegated by the user; no brand questionnaire or external telemetry is required.

## Completed browser verification

The Chromium smoke suite is runnable with `npm run test:browser` against a separately running app. `BASE_URL` can override the default local server. Its 13 checks cover explicit example selection, live-source failure and empty responses, same-query retry, market search, fraction controls, positive floor validation, partial FAK versus blocked FOK, book views, modal keyboard behavior, a simulated lifecycle, export and responsive panels. The 250-share example at a 0.60 pUSD floor shows 140 fillable and 110 unsold shares; its activity is labeled **Partially settled / Simulated**.

Screenshots at 1280px, 768px and 375px were visually inspected. The mobile dialog keeps both actions visible. All three widths pass horizontal-overflow checks. A separate unintercepted public read returned 40 live markets and an order book without browser exceptions. Wallet connection, signing, real order submission, cancellation and final live proceeds reconciliation were deliberately not exercised by this UI QA.

See [the browser report](qa/browser-smoke.json), [live-read evidence](qa/live-read-browser.json) and [QA notes](qa/README.md). HTTP error fixtures are labeled as fixtures; they are not evidence that the upstream service was unavailable.
