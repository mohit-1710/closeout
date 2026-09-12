import { useEffect, useId, useMemo, useRef, useState } from "react";
import Decimal from "decimal.js";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import type { ExitQuote, WorkspaceController } from "@/lib/types";
import { Busy, decimal, editableDecimal, Notice, Num, numberText, timestamp } from "./primitives";

export function QuoteTotals({
  quote,
  requested,
  blocked = false,
  noFillUnderTerms = false,
}: {
  quote: ExitQuote | null;
  requested: string;
  blocked?: boolean;
  noFillUnderTerms?: boolean;
}) {
  return (
    <div className="j-quote-totals">
      <div className="j-net-label">
        {noFillUnderTerms
          ? "No fill under all-or-nothing"
          : blocked
            ? "Available-depth estimate"
            : "Estimated net proceeds"}
      </div>
      <p className="j-net-value">
        <Num value={quote?.netReceipt} kind="money" />
        <span>pUSD</span>
      </p>
      <dl className="j-breakdown">
        <div>
          <dt>Gross proceeds</dt>
          <dd>
            <Num value={quote?.grossReceipt} kind="money" /> pUSD
          </dd>
        </div>
        <div>
          <dt>Estimated venue fee</dt>
          <dd>
            <Num value={quote?.fees} kind="money" /> pUSD
          </dd>
        </div>
        <div>
          <dt>Closeout fee</dt>
          <dd>
            <Num value="0" kind="money" /> pUSD
          </dd>
        </div>
        <div className="j-breakdown-divider">
          <dt>Shares that can fill</dt>
          <dd>
            <Num value={quote?.filledShares} />
            <span className="j-muted">
              {" "}
              / <Num value={requested} />
            </span>
          </dd>
        </div>
        <div className="j-remaining">
          <dt>Shares left unsold</dt>
          <dd>
            <Num value={quote?.remainingShares} />
          </dd>
        </div>
      </dl>
    </div>
  );
}
function FetchedAt({ value }: { value: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <span title={timestamp(value)}>
      Fetched {Math.max(0, Math.floor((now - value) / 1000))}s ago
    </span>
  );
}
export function ExitPlanner({
  workspace: w,
  onBack,
  onConnect,
  onActivity,
}: {
  workspace: WorkspaceController;
  onBack: () => void;
  onConnect: () => void;
  onActivity: () => void;
}) {
  const id = useId();
  const estimateRef = useRef<HTMLElement>(null);
  const [touched, setTouched] = useState({ shares: false, floor: false });
  const sharesRef = useRef<HTMLInputElement>(null),
    floorRef = useRef<HTMLInputElement>(null);
  const market = w.selectedMarket,
    position = w.selectedPosition;
  const amount = decimal(w.shares),
    floor = decimal(w.floorPrice);
  const available = w.availableShares ?? position?.size ?? null;
  const sharesError =
    touched.shares && (!amount || amount.lte(0))
      ? "Enter more than 0 shares."
      : touched.shares && amount && decimal(available) && amount.gt(available!)
        ? "This exceeds the shares shown for this position."
        : null;
  const floorError =
    touched.floor && (!floor || floor.lte(0) || floor.gte(1))
      ? "Enter a price greater than 0 and below 1 pUSD per share."
      : null;
  const levels = useMemo(() => {
    let cumulative = new Decimal(0);
    return (w.book?.bids ?? [])
      .filter((b) => decimal(b.price)?.gt(0) && decimal(b.size)?.gt(0))
      .slice()
      .sort((a, b) => new Decimal(b.price).comparedTo(a.price))
      .map((b) => {
        cumulative = cumulative.add(b.size);
        return { ...b, cumulative: cumulative.toFixed() };
      });
  }, [w.book]);
  const hints = levels.filter((b, i) => i === 0 || b.price !== levels[i - 1].price).slice(0, 3);
  const noBuyers = w.bookState === "ready" && !!w.book && levels.length === 0;
  const quote = w.bookState === "error" || noBuyers ? null : w.quote;
  const controlsLocked = w.reviewLoading || w.submitting || w.positionSelectionState === "loading";
  const loading = w.bookState === "loading" && !w.book;
  const usable =
    !!quote && ["ready", "partial"].includes(quote.status) && !!decimal(quote.filledShares)?.gt(0);
  const blockedGeo = w.mode === "live" && ["blocked", "unknown"].includes(w.geoStatus);
  const pending =
    w.mode === "live" &&
    w.executionBlockers.some((s) => /pending order|pending exit|unresolved/i.test(s));
  const needsAmount = !amount || amount.lte(0) || (!!decimal(available) && amount.gt(available!));
  const needsFloor = !floor || floor.lte(0) || floor.gte(1);
  // The quote engine intentionally reports zero fill for an unfillable FOK order.
  // Use its explicit blocker instead of interpreting those zeroes as book depth.
  const insufficientFokDepth =
    w.orderType === "FOK" &&
    !!quote &&
    quote.status === "blocked" &&
    quote.blockers.includes(
      "There is not enough depth for an all-or-none fill. Lower the size or choose partial fills.",
    );
  const quoteBlockers = quote?.blockers ?? [];
  const otherBlockers = w.executionBlockers.filter((s) => !quoteBlockers.includes(s));
  let action = {
    label: w.mode === "example" ? "Review simulated exit" : "Verify account & review",
    disabled: false,
    run: () => w.onReview(),
  };
  if (w.reviewLoading || w.submitting)
    action = {
      label: w.submitting ? "Submitting…" : "Preparing your review…",
      disabled: true,
      run: () => {},
    };
  else if (w.bookState === "error")
    action = { label: "Retry live quote", disabled: false, run: w.onRefresh };
  else if (loading || w.bookState === "loading")
    action = { label: "Updating the estimate…", disabled: true, run: () => {} };
  else if (noBuyers) action = { label: "Check for buyers", disabled: false, run: w.onRefresh };
  else if (needsAmount)
    action = {
      label: "Set shares to sell",
      disabled: false,
      run: () => sharesRef.current?.focus(),
    };
  else if (needsFloor)
    action = {
      label: "Set your minimum price",
      disabled: false,
      run: () => floorRef.current?.focus(),
    };
  else if (insufficientFokDepth)
    action = {
      label: "Switch to sell available",
      disabled: false,
      run: () => w.onOrderTypeChange("FAK"),
    };
  else if (!usable && quote?.status === "empty")
    action = {
      label: "Adjust your minimum price",
      disabled: false,
      run: () => floorRef.current?.focus(),
    };
  else if (blockedGeo)
    action = { label: "Live execution unavailable", disabled: true, run: () => {} };
  else if (w.mode === "live" && w.geoStatus === "checking")
    action = { label: "Checking trading availability…", disabled: true, run: () => {} };
  else if (pending) action = { label: "View pending exit", disabled: false, run: onActivity };
  else if (w.mode === "live" && w.walletStatus !== "connected")
    action = {
      label: w.walletStatus === "connecting" ? "Connecting wallet…" : "Connect wallet to review",
      disabled: w.walletStatus === "connecting",
      run: onConnect,
    };
  else if (!usable || !w.executionEnabled)
    action = { label: "Review unavailable", disabled: true, run: () => {} };
  function act() {
    setTouched({ shares: true, floor: true });
    if (!action.disabled) action.run();
  }
  function fraction(value: string) {
    const n = decimal(available);
    if (n) w.onSharesChange(n.mul(value).toDecimalPlaces(2, Decimal.ROUND_DOWN).toFixed());
  }
  if (!position || !market) return null;
  return (
    <section className="j-planner" aria-labelledby={`${id}-title`}>
      <button className="j-text-link j-back" disabled={controlsLocked} onClick={onBack}>
        <ArrowLeft size={16} aria-hidden />
        Back to positions
      </button>
      <div className="j-page-heading">
        <div>
          <h1 id={`${id}-title`}>Plan your exit.</h1>
          <p className="j-lead">Set your floor. See what can fill.</p>
        </div>
      </div>
      <div className="j-plan-grid">
        <div className="j-plan-inputs">
          <div className="j-selected-position">
            <div className="j-selected-top">
              <span className="j-outcome">Selling {position.outcome}</span>
              {w.mode === "live" && market.slug && (
                <a
                  className="j-text-link"
                  href={`https://polymarket.com/event/${encodeURIComponent(market.slug)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Market
                  <ExternalLink size={14} aria-hidden />
                </a>
              )}
            </div>
            <h2>{position.title}</h2>
            <p>
              <Num value={position.size} /> shares held
              {w.mode === "example" ? " · fictional" : " · public holdings"}
            </p>
          </div>
          <form
            className="j-plan-form"
            onSubmit={(e) => {
              e.preventDefault();
              act();
            }}
            noValidate
          >
            <div className="j-field">
              <div className="j-label-row">
                <label htmlFor={`${id}-shares`}>Shares to sell</label>
                <span>
                  of <Num value={available} /> shares
                </span>
              </div>
              <div className="j-amount-input">
                <input
                  ref={sharesRef}
                  disabled={controlsLocked}
                  id={`${id}-shares`}
                  value={w.shares}
                  onChange={(e) => editableDecimal(e.target.value, w.onSharesChange)}
                  onBlur={() => setTouched((v) => ({ ...v, shares: true }))}
                  inputMode="decimal"
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="0"
                  aria-invalid={!!sharesError}
                  aria-describedby={sharesError ? `${id}-shares-error` : undefined}
                />
                <span>shares</span>
              </div>
              <div className="j-fractions">
                {[
                  ["25%", ".25"],
                  ["50%", ".5"],
                  ["75%", ".75"],
                  ["All", "1"],
                ].map(([label, value]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => fraction(value)}
                    disabled={available === null || controlsLocked}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {sharesError && (
                <p id={`${id}-shares-error`} className="j-field-error">
                  {sharesError}
                </p>
              )}
            </div>
            <div className="j-field">
              <div className="j-label-row">
                <label htmlFor={`${id}-floor`}>Minimum price</label>
                <span>pUSD per share</span>
              </div>
              <div className="j-amount-input">
                <input
                  ref={floorRef}
                  disabled={controlsLocked}
                  id={`${id}-floor`}
                  value={w.floorPrice}
                  onChange={(e) => editableDecimal(e.target.value, w.onFloorPriceChange)}
                  onBlur={() => setTouched((v) => ({ ...v, floor: true }))}
                  inputMode="decimal"
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="0.50"
                  aria-invalid={!!floorError}
                  aria-describedby={`${id}-floor-help${floorError ? ` ${id}-floor-error` : ""}`}
                />
                <span>pUSD</span>
              </div>
              <p className="j-field-help" id={`${id}-floor-help`}>
                Don’t sell below this price per share. Starts at the best bid when you choose a
                position; fees come out of the proceeds.
              </p>
              {floorError && (
                <p className="j-field-error" id={`${id}-floor-error`}>
                  {floorError}
                </p>
              )}
              {hints.length > 0 && (
                <div className="j-floor-options">
                  <span>Try a floor from the current bids</span>
                  <div>
                    {hints.map((b, i) => (
                      <button
                        type="button"
                        key={b.price}
                        disabled={controlsLocked}
                        onClick={() => w.onFloorPriceChange(b.price)}
                        aria-label={`Use minimum price ${b.price} pUSD per share (${b.cumulative} shares of depth)`}
                        aria-pressed={!!floor?.eq(b.price)}
                      >
                        <strong>
                          <Num value={b.price} kind="price" />
                          {i === 0 && <span>Best bid</span>}
                        </strong>
                        <small>
                          <Num value={b.cumulative} /> shares of depth
                        </small>
                      </button>
                    ))}
                  </div>
                  <p>Depth includes buyers at or above that price, before your order limits.</p>
                </div>
              )}
            </div>
            <fieldset className="j-fill-policy" disabled={controlsLocked}>
              <legend>If only part can sell</legend>
              <div>
                {[
                  {
                    value: "FAK",
                    title: "Sell available",
                    description: "Fill what can sell. Cancel the rest.",
                  },
                  {
                    value: "FOK",
                    title: "All or nothing",
                    description: "Sell the full amount, or none.",
                  },
                ].map((p) => (
                  <label
                    key={p.value}
                    className="j-policy-option"
                    data-selected={w.orderType === p.value}
                  >
                    <input
                      type="radio"
                      name={`${id}-policy`}
                      value={p.value}
                      checked={w.orderType === p.value}
                      onChange={() => w.onOrderTypeChange(p.value as "FAK" | "FOK")}
                    />
                    <span>
                      <strong>{p.title}</strong>
                      <span>{p.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <button type="submit" className="j-sr-only" tabIndex={-1}>
              Continue to review
            </button>
          </form>
          <details className="j-depth-detail">
            <summary>
              <span>
                Inspect the order book
                <span className="j-muted">
                  {w.mode === "example"
                    ? "Optional · fictional bid depth"
                    : "Optional · live bid depth"}
                </span>
              </span>
              <ChevronDown size={19} aria-hidden />
            </summary>
            <div>
              {w.bookState === "error" ? (
                <Notice error>
                  {w.bookError}
                  <button className="j-text-link" onClick={w.onRefresh}>
                    Retry order book
                  </button>
                </Notice>
              ) : levels.length === 0 ? (
                <p className="j-muted">No bids are available for this outcome.</p>
              ) : (
                <>
                  <div className="j-depth-header">
                    <span>Price / share</span>
                    <span>Buyer shares</span>
                    <span>At your floor</span>
                  </div>
                  {levels.slice(0, 20).map((b, i) => (
                    <div
                      className="j-depth-row"
                      key={`${b.price}-${i}`}
                      data-eligible={!!floor && decimal(b.price)!.gte(floor)}
                    >
                      <Num value={b.price} kind="price" />
                      <Num value={b.size} />
                      <span>
                        {floor && decimal(b.price)!.gte(floor) ? "Eligible" : "Below floor"}
                      </span>
                    </div>
                  ))}
                  {levels.length > 20 && (
                    <p className="j-field-help">
                      Showing the highest 20 of {levels.length} bid levels. The estimate uses the
                      available book.
                    </p>
                  )}
                </>
              )}
            </div>
          </details>
        </div>
        <aside ref={estimateRef} className="j-estimate" aria-label="Exit estimate">
          <div className="j-estimate-heading">
            <span>{w.mode === "example" ? "Fictional estimate" : "Live estimate"}</span>
            <button
              className="j-icon-button"
              onClick={w.onRefresh}
              disabled={w.bookState === "loading" || controlsLocked}
              aria-label="Refresh exit estimate"
            >
              <RefreshCw
                size={17}
                className={w.bookState === "loading" ? "j-spin" : ""}
                aria-hidden
              />
            </button>
          </div>
          {loading ? (
            <div className="j-quote-loading" role="status">
              <span className="j-skeleton" />
              <span className="j-skeleton" />
              <p>Reading the latest buyers and fees…</p>
            </div>
          ) : w.bookState === "error" ? (
            <Notice error title="Live estimate unavailable">
              {w.bookError ||
                "The order book did not load. Your inputs are saved; retry to get an estimate."}
            </Notice>
          ) : noBuyers ? (
            <Notice title="No buyers for this outcome">
              This order book has no bids. An exit estimate needs buyers; changing your floor cannot
              create liquidity. Refresh to check again.
            </Notice>
          ) : (
            <div aria-live="polite" aria-atomic="true">
              <QuoteTotals
                quote={quote}
                requested={w.shares}
                blocked={quote?.status === "blocked"}
                noFillUnderTerms={insufficientFokDepth}
              />
            </div>
          )}
          {insufficientFokDepth && (
            <Notice title="The full amount cannot fill at this floor">
              “All or nothing” leaves all shares unsold when the full amount cannot fill. Switch to
              “Sell available” to estimate a partial exit, or change your amount or floor.
            </Notice>
          )}
          {!insufficientFokDepth && quoteBlockers.length > 0 && (
            <Notice error>{quoteBlockers[0]}</Notice>
          )}
          {blockedGeo && (
            <Notice title="Planning is available; live execution isn’t">
              {w.geoStatus === "blocked"
                ? "Polymarket does not permit trading from this location."
                : "We couldn’t verify trading availability for this connection."}{" "}
              You can still inspect and adjust this plan.
            </Notice>
          )}
          {!blockedGeo && pending && (
            <Notice title="A previous exit needs attention">
              Check its status in Activity before submitting another order.
            </Notice>
          )}
          {!blockedGeo &&
            !pending &&
            w.mode === "live" &&
            w.walletStatus === "connected" &&
            !w.executionEnabled &&
            otherBlockers.length > 0 && <Notice>{otherBlockers[0]}</Notice>}
          {w.walletError && <Notice error>{w.walletError}</Notice>}
          <button
            className="j-button j-primary j-full j-review-button"
            onClick={act}
            disabled={action.disabled}
            aria-busy={w.reviewLoading || w.submitting || w.walletStatus === "connecting"}
          >
            {w.reviewLoading || w.submitting || w.walletStatus === "connecting" ? (
              <Busy>{action.label}</Busy>
            ) : (
              <>
                {action.label}
                <ArrowRight size={18} aria-hidden />
              </>
            )}
          </button>
          <p className="j-review-help">
            {w.mode === "example"
              ? "Review the fictional result. No wallet or real order."
              : blockedGeo
                ? "Your plan does not authorize a trade."
                : "A sign-in signature verifies ownership. Selling needs a separate confirmation."}
          </p>
          <div className="j-estimate-foot">
            <ShieldCheck size={16} aria-hidden />
            <span>Quote first. You confirm the order.</span>
          </div>
          <details className="j-estimate-notes">
            <summary>
              Fees, timing and assumptions
              <ChevronDown size={16} aria-hidden />
            </summary>
            <div>
              <p>
                pUSD is the venue’s collateral. This estimate includes the modeled venue fee and no
                Closeout service fee. Network, intermediary, conversion and withdrawal costs are
                excluded.
              </p>
              <p>
                A snapshot cannot guarantee a fill or final receipt. Matched shares are not
                confirmed settlement.
              </p>
              {quote?.warnings.map((s) => (
                <p key={s}>{s}</p>
              ))}
            </div>
          </details>
          {w.book && (
            <p className="j-fetched">
              <FetchedAt value={w.book.fetchedAt} /> · Refreshed again for review
            </p>
          )}
        </aside>
      </div>
      <div className="j-mobile-summary" aria-label="Current exit summary">
        <div>
          <span>
            {noBuyers
              ? "Order book"
              : insufficientFokDepth
                ? "All or nothing · no fill"
                : quote?.status === "blocked"
                  ? "Depth estimate"
                  : "Est. net proceeds"}
          </span>
          <strong>
            {noBuyers ? (
              "No buyers available"
            ) : (
              <>
                <Num value={quote?.netReceipt} kind="money" /> <small>pUSD</small>
              </>
            )}
          </strong>
          <span>
            {noBuyers ? (
              "Refresh to check again"
            ) : (
              <>
                <Num value={quote?.filledShares} /> of <Num value={w.shares} /> shares can fill
              </>
            )}
          </span>
        </div>
        <button
          className="j-button j-secondary"
          onClick={() =>
            estimateRef.current?.scrollIntoView({ behavior: "instant", block: "start" })
          }
        >
          See estimate
          <ArrowRight size={16} aria-hidden />
        </button>
      </div>
    </section>
  );
}
