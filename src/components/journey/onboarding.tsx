import { useId, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ExternalLink,
  Eye,
  FlaskConical,
  Search,
  Wallet,
} from "lucide-react";
import type { Position, WorkspaceController } from "@/lib/types";
import { Busy, Notice, Num, PositionSkeleton, shortAddress, useClientReady } from "./primitives";

type EntryProps = {
  workspace: WorkspaceController;
  onConnect: () => void;
  onLoad: () => void;
  onExample: () => void;
  onResume: () => void;
  error: string | null;
};
export function PositionEntry({
  workspace: w,
  onConnect,
  onLoad,
  onExample,
  onResume,
  error,
}: EntryProps) {
  const id = useId();
  const mounted = useClientReady();
  const loading = w.profileState === "loading" || w.positionState === "loading";
  const message = error || w.profileError || w.positionError;
  return (
    <section className="j-entry" aria-labelledby={`${id}-title`}>
      <div className="j-entry-intro">
        <span className="j-eyebrow">Start with what you hold</span>
        <h1 id={`${id}-title`}>
          Bring your
          <br className="j-desktop-break" /> Polymarket positions.
        </h1>
        <p className="j-lead">
          Choose a position. See what could sell, what fees take, and what you would keep.
        </p>
        <ol className="j-entry-steps">
          <li>
            <span>1</span>
            <div>
              <strong>Find your position</strong>
              <p>Use your wallet or a public profile.</p>
            </div>
          </li>
          <li>
            <span>2</span>
            <div>
              <strong>Set your exit</strong>
              <p>Choose an amount and a minimum price.</p>
            </div>
          </li>
          <li>
            <span>3</span>
            <div>
              <strong>Review before selling</strong>
              <p>Check the latest estimate before you confirm.</p>
            </div>
          </li>
        </ol>
      </div>
      <div className="j-entry-panel">
        {w.recentProfile && (
          <div className="j-recent-profile">
            <span className="j-recent-label">Recently viewed · public lookup</span>
            <strong>
              {w.recentProfile.displayName ||
                w.recentProfile.username ||
                shortAddress(w.recentProfile.accountAddress)}
            </strong>
            <p>Saved on this browser. Continue to fetch current positions.</p>
            <div className="j-actions">
              <button
                className="j-button j-secondary"
                onClick={onResume}
                disabled={!mounted || loading}
                aria-busy={loading}
              >
                {loading ? (
                  <Busy>Loading fresh positions…</Busy>
                ) : (
                  <>
                    Continue with this profile
                    <ArrowRight size={16} aria-hidden />
                  </>
                )}
              </button>
              <button
                className="j-text-link"
                onClick={w.onForgetRecentProfile}
                disabled={!mounted || loading}
              >
                Forget
              </button>
            </div>
          </div>
        )}
        <div className="j-connect-block">
          <div className="j-icon-tile">
            <Wallet size={25} strokeWidth={1.5} aria-hidden />
          </div>
          <h2>
            {w.walletStatus === "connected"
              ? "Find this wallet’s positions"
              : "Use your Polymarket wallet"}
          </h2>
          <p>We’ll look up its public profile and positions. Connecting does not place an order.</p>
          <button
            className="j-button j-primary j-full"
            onClick={onConnect}
            disabled={!mounted || loading || w.walletStatus === "connecting"}
            aria-busy={loading || w.walletStatus === "connecting"}
          >
            {w.walletStatus === "connecting" ? (
              <Busy>Connecting wallet…</Busy>
            ) : loading ? (
              <Busy>Finding positions…</Busy>
            ) : (
              <>
                {w.walletStatus === "connected" ? "Load connected wallet" : "Connect wallet"}
                <ArrowRight size={18} aria-hidden />
              </>
            )}
          </button>
          {w.walletStatus === "connected" && w.signerAddress && (
            <p className="j-connected-caption">
              <Check size={14} aria-hidden />
              <span title={w.signerAddress}>{shortAddress(w.signerAddress)} connected</span>
            </p>
          )}
          {w.walletError && <Notice error>{w.walletError}</Notice>}
        </div>
        <div className="j-or">
          <span>or look up a public account</span>
        </div>
        <form
          className="j-profile-form"
          aria-busy={!mounted || loading}
          onSubmit={(e) => {
            e.preventDefault();
            onLoad();
          }}
        >
          <label htmlFor={`${id}-profile`}>Public profile or account address</label>
          <input
            id={`${id}-profile`}
            disabled={!mounted}
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder={mounted ? "polymarket.com/@name or 0x…" : "Preparing position lookup…"}
            value={w.accountInput}
            onChange={(e) => w.onAccountInputChange(e.target.value)}
            aria-invalid={!!message}
            aria-describedby={`${id}-help${message ? ` ${id}-error` : ""}`}
          />
          <p className="j-field-help" id={`${id}-help`}>
            Paste a Polymarket profile link or trading account address. This lookup is read-only.
          </p>
          {message && (
            <div id={`${id}-error`}>
              <Notice error title="We couldn’t load that portfolio">
                {message}
              </Notice>
            </div>
          )}
          <button
            type="submit"
            className="j-button j-secondary j-full"
            disabled={!mounted || loading || !w.accountInput.trim()}
            aria-busy={loading}
          >
            {loading ? (
              <Busy>Looking up positions…</Busy>
            ) : (
              <>
                Find positions
                <ArrowRight size={17} aria-hidden />
              </>
            )}
          </button>
        </form>
        <details className="j-help">
          <summary>
            Used email or Google on Polymarket?
            <ChevronDown size={17} aria-hidden />
          </summary>
          <div>
            <p>
              Open your profile on Polymarket and copy its public profile link or account address.
              Your trading account can differ from your connected wallet address.
            </p>
            <p>Paste that public link or address above—not your email or login details.</p>
            <a
              className="j-text-link"
              href="https://polymarket.com"
              target="_blank"
              rel="noreferrer"
            >
              Open Polymarket
              <ExternalLink size={14} aria-hidden />
            </a>
          </div>
        </details>
        <div className="j-sample-entry">
          <FlaskConical size={18} aria-hidden />
          <div>
            <span>Want to see how it works first?</span>
            <button className="j-text-link" disabled={!mounted || loading} onClick={onExample}>
              Try a sample position
              <ArrowRight size={15} aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

type PortfolioProps = {
  workspace: WorkspaceController;
  onChoose: (p: Position) => void;
  onEdit: () => void;
  onRetry: () => void;
  onExample: () => void;
  onContinue: () => void;
  selecting: string | null;
  error: string | null;
};
export function PortfolioView({
  workspace: w,
  onChoose,
  onEdit,
  onRetry,
  onExample,
  onContinue,
  selecting,
  error,
}: PortfolioProps) {
  const [filter, setFilter] = useState("");
  const mounted = useClientReady();
  const id = useId();
  const loading = w.positionState === "loading" || w.profileState === "loading";
  const selectionError =
    error ||
    (w.positionSelectionState === "error"
      ? w.positionError ||
        w.marketError ||
        w.bookError ||
        "This position’s market could not be loaded. Try again or choose another position."
      : null);
  const positions = w.positions.filter((p) =>
    `${p.title} ${p.outcome}`.toLowerCase().includes(filter.toLowerCase()),
  );
  return (
    <section className="j-portfolio" aria-labelledby={`${id}-title`}>
      <div className="j-page-heading">
        <div>
          <span className="j-eyebrow">01 / Choose position</span>
          <h1 id={`${id}-title`}>
            {w.mode === "example" ? "Pick a sample position." : "Choose a position to exit."}
          </h1>
          <p className="j-lead">
            {w.mode === "example"
              ? "Start with Atlas, then see how your minimum price changes what can fill."
              : "Choose what you want to sell. You’ll set the amount and price next."}
          </p>
        </div>
      </div>
      <div className="j-account-strip">
        <div className="j-account-identity">
          <span className="j-icon-tile">
            {w.mode === "example" ? (
              <FlaskConical size={21} aria-hidden />
            ) : (
              <Eye size={21} aria-hidden />
            )}
          </span>
          <div>
            <strong>
              {w.mode === "example"
                ? "Sample portfolio"
                : w.profile?.displayName || w.profile?.username || "Public portfolio"}
            </strong>
            <p>
              {w.mode === "example" ? (
                "Fictional holdings · no funds move"
              ) : (
                <>
                  <span className="j-address" title={w.accountAddress ?? undefined}>
                    {w.accountAddress ? shortAddress(w.accountAddress) : "Loading account…"}
                  </span>
                  <span> · Read-only</span>
                </>
              )}
            </p>
          </div>
        </div>
        {w.mode === "live" && (
          <button
            className="j-button j-quiet"
            onClick={onEdit}
            disabled={!mounted || loading || !!selecting}
          >
            Change account
          </button>
        )}
      </div>
      {selectionError && (
        <Notice error title="We couldn’t open this position">
          {selectionError}
        </Notice>
      )}
      {w.selectedPosition && !selecting && (
        <div className="j-resume">
          <p>Your current plan is still here.</p>
          <button className="j-text-link" onClick={onContinue}>
            Continue plan
            <ArrowRight size={15} aria-hidden />
          </button>
        </div>
      )}
      <div className="j-position-list">
        <div className="j-list-heading">
          <h2>
            {w.mode === "example" ? "Sample position" : "Positions"}
            {w.positionState === "ready" && <span>{w.positions.length}</span>}
          </h2>
          {w.positions.length > 5 && (
            <div className="j-position-search">
              <Search size={17} aria-hidden />
              <label className="j-sr-only" htmlFor={`${id}-search`}>
                Filter your positions
              </label>
              <input
                id={`${id}-search`}
                type="search"
                disabled={!mounted}
                placeholder="Find a position"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
          )}
        </div>
        {loading ? (
          <PositionSkeleton />
        ) : w.positionState === "error" || w.profileState === "error" ? (
          <div className="j-empty">
            <h3>Portfolio unavailable</h3>
            <p>
              {w.positionError || w.profileError || "The public position service did not respond."}
            </p>
            <div className="j-actions">
              <button className="j-button j-primary" onClick={onRetry}>
                Retry lookup
              </button>
              <button className="j-button j-secondary" onClick={onEdit}>
                Edit account
              </button>
            </div>
          </div>
        ) : w.positions.length === 0 ? (
          <div className="j-empty">
            <Eye size={28} aria-hidden />
            <h3>No positions found for this account</h3>
            <p>
              Check that you copied your Polymarket trading account or profile. An external wallet
              address can be different.
            </p>
            <div className="j-actions">
              <button className="j-button j-primary" onClick={onEdit}>
                Use another account
              </button>
              <button className="j-button j-secondary" onClick={onExample}>
                Try a sample position
              </button>
              <button className="j-text-link" onClick={onRetry}>
                Refresh positions
              </button>
            </div>
          </div>
        ) : positions.length === 0 ? (
          <div className="j-empty">
            <h3>No matching positions</h3>
            <p>Try a market name or clear the filter.</p>
            <button className="j-button j-secondary" onClick={() => setFilter("")}>
              Clear filter
            </button>
          </div>
        ) : (
          <div>
            {positions.map((p) => (
              <div className="j-position-item" key={p.tokenId}>
                {p.redeemable ? (
                  <div className="j-position-redeemable">
                    <div>
                      <span className="j-outcome">{p.outcome}</span>
                      <h3>{p.title}</h3>
                      <p>
                        <Num value={p.size} /> shares · Ready to redeem
                      </p>
                    </div>
                    <a
                      className="j-text-link"
                      href="https://polymarket.com/portfolio"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Redeem on Polymarket
                      <ExternalLink size={15} aria-hidden />
                    </a>
                  </div>
                ) : (
                  <button
                    className="j-position-button"
                    onClick={() => onChoose(p)}
                    disabled={!mounted || !!selecting || w.positionSelectionState === "loading"}
                    aria-busy={selecting === p.tokenId}
                  >
                    <div>
                      <span className="j-outcome">{p.outcome}</span>
                      <h3>{p.title}</h3>
                      <p>
                        <Num value={p.size} /> shares held
                      </p>
                    </div>
                    <span className="j-position-action">
                      {selecting === p.tokenId ? (
                        <Busy>Opening…</Busy>
                      ) : (
                        <>
                          Plan exit
                          <ArrowRight size={20} aria-hidden />
                        </>
                      )}
                    </span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {w.positionHasMore && (
        <Notice title="Showing the first 100 positions">
          This portfolio has more positions than this lookup returns. A missing position may be
          outside this result.
        </Notice>
      )}
      {w.mode === "live" && w.positions.length > 0 && (
        <p className="j-footnote">
          Public holdings let you plan. Ownership, available shares and open orders are checked when
          you review.
        </p>
      )}
    </section>
  );
}
