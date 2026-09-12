import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  ExternalLink,
  RefreshCw,
  X,
} from "lucide-react";
import type { TrackedOrder, WorkspaceController } from "@/lib/types";
import { Busy, Notice, Num, shortAddress } from "./primitives";

const labels: Record<TrackedOrder["status"], string> = {
  open: "Open",
  matched: "Matched · not settled",
  partial: "Partially settled",
  settling: "Settling",
  settled: "Settled",
  cancelled: "Cancelled",
  failed: "Failed",
  unknown: "Status unknown",
};
function OrderRow({
  order,
  workspace: w,
}: {
  order: TrackedOrder;
  workspace: WorkspaceController;
}) {
  const cancelling = w.cancellingOrderId === order.id;
  return (
    <article className="j-order">
      <div className="j-order-header">
        <span className="j-order-status" data-status={order.status}>
          {labels[order.status]}
        </span>
        {order.mode === "example" && <span className="j-badge">Simulated</span>}
        <time dateTime={new Date(order.createdAt).toISOString()}>
          {new Date(order.createdAt).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </time>
      </div>
      <h2>{order.market}</h2>
      <p className="j-order-description">
        Sell {order.outcome} · <Num value={order.requestedShares} /> shares at a minimum{" "}
        <Num value={order.price} kind="price" /> pUSD
      </p>
      <dl className="j-order-amounts">
        <div>
          <dt>Matched shares</dt>
          <dd>
            <Num value={order.matchedShares} />
          </dd>
        </div>
        <div>
          <dt>Confirmed settled shares</dt>
          <dd>
            <Num value={order.settledShares} />
          </dd>
        </div>
        <div>
          <dt>{order.mode === "example" ? "Fictional net proceeds" : "Final net proceeds"}</dt>
          <dd>
            {order.mode === "live" && order.netReceipt === null ? (
              <span className="j-unreconciled">Not reconciled</span>
            ) : (
              <>
                <Num value={order.netReceipt} kind="money" /> pUSD
              </>
            )}
          </dd>
        </div>
      </dl>
      <p className="j-order-detail">{order.detail}</p>
      {order.mode === "live" && order.netReceipt === null && (
        <p className="j-field-help">
          Final net proceeds are not reconciled. This does not mean zero proceeds.
        </p>
      )}
      <div className="j-order-links">
        {order.transactionHashes.map((hash) => (
          <a
            key={hash}
            className="j-text-link"
            href={`https://polygonscan.com/tx/${encodeURIComponent(hash)}`}
            target="_blank"
            rel="noreferrer"
          >
            Transaction {shortAddress(hash)}
            <ExternalLink size={14} aria-hidden />
          </a>
        ))}
        {order.canCancel && (
          <button
            className="j-button j-secondary"
            onClick={() => w.onCancelOrder(order.id)}
            disabled={!!w.cancellingOrderId}
            aria-busy={cancelling}
          >
            {cancelling ? (
              <Busy>Cancelling…</Busy>
            ) : (
              <>
                <X size={16} aria-hidden />
                Cancel unfilled remainder
              </>
            )}
          </button>
        )}
      </div>
    </article>
  );
}
export function ActivityView({
  workspace: w,
  onBack,
  onPositions,
  onLive,
}: {
  workspace: WorkspaceController;
  onBack: () => void;
  onPositions: () => void;
  onLive: () => void;
}) {
  const orders = w.orders.filter((o) => o.mode === w.mode);
  const completedExample =
    w.mode === "example" && orders.some((o) => ["settled", "partial"].includes(o.status));
  return (
    <section className="j-activity">
      <button className="j-text-link j-back" onClick={onBack}>
        <ArrowLeft size={16} aria-hidden />
        {w.selectedPosition ? "Back to plan" : "Back to positions"}
      </button>
      <div className="j-page-heading">
        <div>
          <span className="j-eyebrow">Follow your exit</span>
          <h1>Activity.</h1>
          <p className="j-lead">
            {w.mode === "example"
              ? "Fictional orders, with every step visible."
              : "Order acceptance, matches and settlement stay separate."}
          </p>
        </div>
        <div className="j-actions">
          <button className="j-button j-secondary" onClick={w.onExport} disabled={!orders.length}>
            <Download size={16} aria-hidden />
            Export activity
          </button>
          <button
            className="j-icon-button"
            onClick={w.onRefreshOrders}
            disabled={!orders.length}
            aria-label="Refresh order statuses"
          >
            <RefreshCw size={18} aria-hidden />
          </button>
        </div>
      </div>
      {completedExample && (
        <div className="j-example-complete">
          <span className="j-icon-tile">
            <Check size={24} aria-hidden />
          </span>
          <div>
            <h2>You’ve walked through an exit.</h2>
            <p>
              This result is fictional. Try another floor, or bring your own positions to start a
              real plan.
            </p>
            <div className="j-actions">
              <button className="j-button j-primary" onClick={onLive}>
                Bring my real positions
                <ArrowRight size={17} aria-hidden />
              </button>
              <button className="j-button j-secondary" onClick={onBack}>
                Adjust the sample plan
              </button>
            </div>
          </div>
        </div>
      )}
      {w.orderError && (
        <Notice
          error
          title="Activity needs attention"
          action={
            <button className="j-text-link" onClick={w.onRefreshOrders}>
              Refresh order status
              <RefreshCw size={15} aria-hidden />
            </button>
          }
        >
          {w.orderError}
        </Notice>
      )}
      {orders.length ? (
        <div className="j-order-list">
          {orders.map((order) => (
            <OrderRow key={order.id} order={order} workspace={w} />
          ))}
        </div>
      ) : (
        <div className="j-empty j-activity-empty">
          <Activity size={30} aria-hidden />
          <h2>No exits submitted yet</h2>
          <p>Choose a position and review a plan. Orders will appear here after you confirm.</p>
          <button className="j-button j-primary" onClick={onPositions}>
            Choose a position
            <ArrowRight size={17} aria-hidden />
          </button>
        </div>
      )}
      {w.mode === "live" && orders.length > 0 && (
        <p className="j-footnote">
          An uncertain submission without a verified order ID keeps the account blocked. There is no
          automatic ID recovery or “clear and retry” shortcut.
        </p>
      )}
    </section>
  );
}
