import { useEffect, useId, useRef } from "react";
import { ArrowRight, X } from "lucide-react";
import type { WorkspaceController } from "@/lib/types";
import { Busy, decimal, Notice, Num, timestamp } from "./primitives";
import { QuoteTotals } from "./exit-planner";

export function ReviewDialog({
  workspace: w,
  onConfirm,
}: {
  workspace: WorkspaceController;
  onConfirm: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const busy = w.reviewLoading || w.submitting;
  const usable =
    !!w.quote &&
    ["ready", "partial"].includes(w.quote.status) &&
    !!decimal(w.quote.filledShares)?.gt(0);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (w.reviewOpen && !dialog.open) dialog.showModal();
    if (!w.reviewOpen && dialog.open) dialog.close();
  }, [w.reviewOpen]);
  return (
    <dialog
      ref={ref}
      className="j-review-dialog"
      aria-labelledby={`${id}-title`}
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else w.onCloseReview();
      }}
      onClose={() => {
        if (w.reviewOpen && !busy) w.onCloseReview();
      }}
    >
      <div className="j-review-head">
        <div>
          <span className="j-eyebrow">03 / Review</span>
          <h2 id={`${id}-title`}>
            {w.mode === "example" ? "Review simulated exit" : "Review your exit"}
          </h2>
        </div>
        <button
          className="j-icon-button"
          onClick={w.onCloseReview}
          disabled={busy}
          aria-label="Close exit review"
        >
          <X size={21} aria-hidden />
        </button>
      </div>
      <div className="j-review-body">
        <span className="j-badge">
          {w.mode === "example"
            ? "Fictional · no funds move"
            : "Live order · separate confirmation"}
        </span>
        <h3>{w.selectedPosition?.title || w.selectedMarket?.question}</h3>
        <p className="j-muted">
          Sell {w.selectedPosition?.outcome} ·{" "}
          {w.orderType === "FAK"
            ? "Fill available, cancel the remainder"
            : "Fill all shares or none"}
        </p>
        <dl className="j-review-terms">
          <div>
            <dt>Shares to sell</dt>
            <dd>
              <Num value={w.shares} />
            </dd>
          </div>
          <div>
            <dt>Minimum price / share</dt>
            <dd>
              <Num value={w.floorPrice} kind="price" /> pUSD
            </dd>
          </div>
        </dl>
        <QuoteTotals quote={w.quote} requested={w.shares} />
        <p className="j-review-snapshot">
          Book fetched {timestamp(w.quote?.snapshotAt)}. Liquidity can change before the venue
          accepts an order. A match is not confirmed settlement.
        </p>
        {w.reviewError && (
          <Notice error title="Review needs attention">
            {w.reviewError}
          </Notice>
        )}
        {w.quote?.blockers.map((message) => (
          <Notice error key={message}>
            {message}
          </Notice>
        ))}
        {w.mode === "live" && !w.executionEnabled && !w.reviewError && (
          <Notice>
            {w.executionBlockers[0] || "This account is not ready to submit an exit."}
          </Notice>
        )}
        <div className="j-review-actions">
          <button className="j-button j-secondary" onClick={w.onCloseReview} disabled={busy}>
            Back to plan
          </button>
          <button
            className="j-button j-primary"
            onClick={onConfirm}
            disabled={busy || !!w.reviewError || !usable || !w.executionEnabled}
            aria-busy={busy}
          >
            {busy ? (
              <Busy>{w.submitting ? "Submitting…" : "Refreshing…"}</Busy>
            ) : (
              <>
                {w.mode === "example" ? "Simulate exit" : "Confirm & submit exit"}
                <ArrowRight size={17} aria-hidden />
              </>
            )}
          </button>
        </div>
        <p className="j-review-help">
          {w.mode === "example"
            ? "This creates an example Activity entry, not a trade."
            : "This action requests your order signature and submits to Polymarket. Estimated proceeds are not a guaranteed receipt."}
        </p>
      </div>
    </dialog>
  );
}
