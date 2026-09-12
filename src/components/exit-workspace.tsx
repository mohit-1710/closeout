"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import Decimal from "decimal.js";
import Link from "next/link";
import {
  Activity,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  Download,
  ExternalLink,
  FlaskConical,
  Info,
  Layers3,
  ListFilter,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Wallet,
  X,
} from "lucide-react";
import { CloseoutLogo } from "@/components/brand";
import type { BookLevel, OrderBook, TrackedOrder, WorkspaceController } from "@/lib/types";
import "./exit-workspace.css";

export interface ExitWorkspaceProps {
  workspace: WorkspaceController;
}

function decimal(value: string | number | null | undefined): Decimal | null {
  if (value == null || value === "") return null;
  try {
    const d = new Decimal(value);
    return d.isFinite() ? d : null;
  } catch {
    return null;
  }
}

/** Presentation only: the shared planner owns order calculations. */
function numberText(
  value: string | number | null | undefined,
  kind: "amount" | "money" | "price" | "compact" = "amount",
) {
  const d = decimal(value);
  if (!d) return "—";
  const abs = d.abs();
  if (d.isZero()) return kind === "money" ? "0.00" : "0";
  if (kind === "compact") {
    for (const [scale, suffix] of [
      ["1000000000000", "T"],
      ["1000000000", "B"],
      ["1000000", "M"],
      ["1000", "K"],
    ]) {
      if (abs.gte(scale))
        return `${d.div(scale).toDecimalPlaces(1, Decimal.ROUND_HALF_UP).toFixed()}${suffix}`;
    }
  }
  const precision = kind === "money" ? 2 : kind === "price" ? 5 : 4;
  const rounded =
    kind === "price"
      ? d.toSignificantDigits(precision, Decimal.ROUND_HALF_UP)
      : d.toDecimalPlaces(precision, Decimal.ROUND_HALF_UP);
  if (rounded.isZero())
    return `${d.isNegative() ? "−" : ""}<${kind === "money" ? "0.01" : "0.0001"}`;
  if (kind !== "money" && abs.lt("0.001")) {
    const digits = rounded.abs().toFixed().split(".")[1] ?? "";
    const zeros = digits.match(/^0*/)?.[0].length ?? 0;
    if (zeros >= 3) {
      const subscripts = "₀₁₂₃₄₅₆₇₈₉";
      return `${d.isNegative() ? "−" : ""}0.0${String(zeros)
        .split("")
        .map((n) => subscripts[Number(n)])
        .join("")}${digits.slice(zeros, zeros + 4)}`;
    }
  }
  const text = kind === "money" ? rounded.toFixed(2) : rounded.toFixed();
  const [whole, fraction] = text.split(".");
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${fraction ? `.${fraction}` : ""}`;
}

function Num({
  value,
  kind = "amount",
  className = "",
}: {
  value: string | number | null | undefined;
  kind?: "amount" | "money" | "price" | "compact";
  className?: string;
}) {
  const raw = decimal(value)?.toFixed();
  return (
    <span className={`co-num ${className}`} title={raw} aria-label={raw ?? "Not available"}>
      {numberText(value, kind)}
    </span>
  );
}

function shortAddress(value: string) {
  return value.length > 16 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
}
function dateLabel(value: string | number | null) {
  if (value == null) return "No end date";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
    : "Date unavailable";
}
function timestamp(value: number | undefined) {
  if (!value || !Number.isFinite(value)) return "Awaiting book";
  return `${new Date(value).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "UTC" })} UTC`;
}
function editableDecimal(value: string, change: (s: string) => void) {
  if (/^\d*\.?\d*$/.test(value)) change(value);
}
function tabArrows(event: KeyboardEvent<HTMLElement>) {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  const elements = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
  );
  const index = elements.indexOf(document.activeElement as HTMLButtonElement);
  if (index < 0 || !elements.length) return;
  event.preventDefault();
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? elements.length - 1
        : (index + (event.key === "ArrowRight" ? 1 : -1) + elements.length) % elements.length;
  elements[next].focus();
  elements[next].click();
}

function EmptyState({
  title,
  children,
  action,
  compact = false,
  error = false,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  error?: boolean;
}) {
  return (
    <div
      className={`co-empty ${compact ? "co-empty-compact" : ""}`}
      role={error ? "alert" : undefined}
    >
      {error ? (
        <CircleAlert size={24} aria-hidden />
      ) : (
        <Layers3 size={24} strokeWidth={1.5} aria-hidden />
      )}
      <strong>{title}</strong>
      <p>{children}</p>
      {action}
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="co-skeleton-list" role="status" aria-label="Loading markets">
      {[0, 1, 2, 3].map((i) => (
        <div key={i}>
          <div className="co-skeleton co-skeleton-wide" />
          <div className="co-skeleton co-skeleton-short" />
        </div>
      ))}
    </div>
  );
}

function BookDepth({ book, floor, table }: { book: OrderBook; floor: string; table: boolean }) {
  const rows = useMemo(() => {
    let cumulative = 0;
    return book.bids
      .filter((b) => {
        const p = decimal(b.price),
          s = decimal(b.size);
        return p?.gt(0) && p.lte(1) && s?.gt(0) && Number.isFinite(Number(b.size));
      })
      .slice()
      .sort((a, b) => Number(b.price) - Number(a.price))
      .map((b) => {
        cumulative += Number(b.size);
        return { ...b, cumulative };
      });
  }, [book]);
  if (!rows.length)
    return (
      <EmptyState title="No bids to exit into" compact>
        There are no available buyers in this order book. Refresh to check again; an empty book
        cannot fill an exit.
      </EmptyState>
    );
  const maxSize = rows.at(-1)!.cumulative;
  const floorNumber = Number(floor);
  const floorIsValid = decimal(floor)?.gt(0) && decimal(floor)?.lt(1);
  const maxPrice = Math.min(
    1,
    Math.max(Number(rows[0].price) + 0.015, floorIsValid ? floorNumber + 0.015 : 0),
  );
  const minPrice = Math.max(
    0,
    Math.min(Number(rows.at(-1)!.price) - 0.015, floorIsValid ? floorNumber - 0.015 : 1),
  );
  const priceRange = Math.max(0.02, maxPrice - minPrice);
  const x = (v: number) => 64 + (v / maxSize) * 402;
  const y = (v: number) => 168 - ((v - minPrice) / priceRange) * 144;
  let path = `M ${x(0)} ${y(Number(rows[0].price))}`;
  rows.forEach((r, i) => {
    if (i > 0) path += ` V ${y(Number(r.price))}`;
    path += ` H ${x(r.cumulative)}`;
  });
  const area = `${path} L ${x(maxSize)} 168 L ${x(0)} 168 Z`;
  const visibleRows = rows.slice(0, 50);
  if (table)
    return (
      <div className="co-table-scroll">
        <table className="co-depth-table">
          <caption className="co-sr-only">
            Available bids, descending price. Prices in pUSD per share.
          </caption>
          <thead>
            <tr>
              <th scope="col">Price / share</th>
              <th scope="col">Shares</th>
              <th scope="col">Cumulative</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((r, i) => (
              <tr
                key={`${r.price}-${i}`}
                className={floorIsValid && Number(r.price) < floorNumber ? "co-below-floor" : ""}
              >
                <td>
                  <Num value={r.price} kind="price" />
                </td>
                <td>
                  <Num value={r.size} />
                </td>
                <td>
                  <span
                    className="co-row-depth"
                    style={{ width: `${Math.min(100, (r.cumulative / maxSize) * 100)}%` }}
                  />
                  <Num value={r.cumulative} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 50 && <p className="co-field-hint">Showing the 50 best bid levels.</p>}
      </div>
    );
  return (
    <div className="co-chart-wrap">
      <div className="co-chart-caption">
        <span className="co-legend-key">
          <span className="co-legend-line" />
          Available bids
        </span>
        {floorIsValid && (
          <span className="co-floor-caption">
            Your floor <Num value={floor} kind="price" /> pUSD
          </span>
        )}
      </div>
      <svg
        className="co-chart"
        viewBox="0 0 480 208"
        role="img"
        aria-label={`Cumulative buy-side depth for ${numberText(maxSize)} shares. The line shows the available price as more shares are sold.`}
      >
        {[0, 0.5, 1].map((ratio) => (
          <g key={ratio}>
            <line
              className="co-chart-grid"
              x1="64"
              x2="466"
              y1={24 + ratio * 144}
              y2={24 + ratio * 144}
            />
            <text x="0" y={28 + ratio * 144}>
              {numberText(maxPrice - ratio * priceRange, "price")}
            </text>
          </g>
        ))}
        <path d={area} className="co-chart-fill" />
        <path d={path} className="co-chart-line" />
        {floorIsValid && (
          <g>
            <line
              x1="64"
              x2="466"
              y1={y(floorNumber)}
              y2={y(floorNumber)}
              className="co-floor-line"
            />
            <text
              x="464"
              y={Math.max(13, y(floorNumber) - 6)}
              textAnchor="end"
              style={{ fill: "var(--co-warning)" }}
            >
              Your floor
            </text>
          </g>
        )}
        <text x="64" y="194">
          0
        </text>
        <text x="265" y="194" textAnchor="middle">
          {numberText(maxSize / 2, "compact")}
        </text>
        <text x="466" y="194" textAnchor="end">
          {numberText(maxSize, "compact")} shares
        </text>
      </svg>
      <div className="co-chart-legend">
        <span>Price in pUSD / share</span>
        <span>Cumulative shares →</span>
      </div>
    </div>
  );
}

const orderLabels: Record<TrackedOrder["status"], string> = {
  open: "Open",
  matched: "Matched · not settled",
  partial: "Partially settled",
  settling: "Settling",
  settled: "Settled",
  cancelled: "Cancelled",
  failed: "Failed",
  unknown: "Status unknown",
};

function OrderRow({ order, workspace }: { order: TrackedOrder; workspace: WorkspaceController }) {
  const cancelling = workspace.cancellingOrderId === order.id;
  return (
    <article className="co-order-row">
      <div>
        <span className="co-order-title">
          Sell {order.outcome} · <Num value={order.requestedShares} /> shares
        </span>
        <p className="co-order-question">{order.market}</p>
        <div className="co-order-meta">
          <span
            className="co-order-status"
            data-tone={
              order.status === "failed" || order.status === "unknown"
                ? "error"
                : ["open", "partial", "matched", "settling"].includes(order.status)
                  ? "pending"
                  : undefined
            }
          >
            <span className="co-status-dot" />
            {orderLabels[order.status]}
          </span>
          {order.mode === "example" && (
            <span className="co-badge co-badge-simulation">Simulated</span>
          )}
          <time
            dateTime={
              Number.isFinite(order.createdAt) ? new Date(order.createdAt).toISOString() : undefined
            }
          >
            {dateLabel(order.createdAt)}
          </time>
        </div>
        <p className="co-order-detail">{order.detail}</p>
        {order.transactionHashes.length > 0 && (
          <div className="co-order-links">
            {order.transactionHashes.map((hash) => (
              <a
                key={hash}
                href={`https://polygonscan.com/tx/${encodeURIComponent(hash)}`}
                target="_blank"
                rel="noreferrer"
              >
                Transaction {shortAddress(hash)} <ExternalLink size={11} aria-hidden />
              </a>
            ))}
          </div>
        )}
      </div>
      <div className="co-order-values">
        <Num value={order.netReceipt} kind="money" />
        <span className="co-small co-muted"> pUSD</span>
        {order.mode === "live" && order.netReceipt === null && (
          <small>Final net proceeds not reconciled</small>
        )}
        <small>
          <Num value={order.matchedShares} /> / <Num value={order.requestedShares} /> matched
        </small>
        {order.settledShares !== null && (
          <small>
            <Num value={order.settledShares} /> settled
          </small>
        )}
        {order.canCancel && (
          <div className="co-order-actions">
            <button
              className="co-button co-button-quiet"
              onClick={() => workspace.onCancelOrder(order.id)}
              disabled={cancelling || !!workspace.cancellingOrderId}
              aria-busy={cancelling}
            >
              {cancelling ? (
                <LoaderCircle size={12} className="co-spin" aria-hidden />
              ) : (
                <X size={12} aria-hidden />
              )}{" "}
              {cancelling ? "Cancelling…" : "Cancel"}
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

export function ExitWorkspace({ workspace: w }: ExitWorkspaceProps) {
  const [listTab, setListTab] = useState<"markets" | "positions">("markets");
  const [mobilePanel, setMobilePanel] = useState<"markets" | "exit" | "activity">("exit");
  const [depthTable, setDepthTable] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [touched, setTouched] = useState({ shares: false, floor: false });
  const searchRef = useRef<HTMLInputElement>(null);
  const walletRef = useRef<HTMLDialogElement>(null);
  const reviewRef = useRef<HTMLDialogElement>(null);
  const uid = useId();
  const market = w.selectedMarket;
  const outcome = market?.outcomes[w.outcomeIndex];
  const amount = decimal(w.shares),
    floor = decimal(w.floorPrice);
  const sharesError =
    touched.shares && (!amount || amount.lte(0)) ? "Enter more than 0 shares." : null;
  const floorError =
    touched.floor && (!floor || floor.lte(0) || floor.gte(1))
      ? "Enter a price greater than 0 and below 1 pUSD."
      : null;
  const quoteUsable =
    w.quote &&
    (w.quote.status === "ready" || w.quote.status === "partial") &&
    decimal(w.quote.filledShares)?.gt(0);
  const reviewEnabled =
    w.executionEnabled &&
    !!market &&
    !!quoteUsable &&
    !!amount?.gt(0) &&
    !!floor?.gt(0) &&
    !!floor.lt(1) &&
    w.bookState !== "loading" &&
    !w.reviewLoading;
  const executionNotices = w.executionBlockers.filter(
    (message) => !w.quote?.blockers.includes(message),
  );
  const activeOrders = w.orders.filter(
    (o) => !["settled", "cancelled", "failed"].includes(o.status),
  ).length;
  const bestBid = w.book?.bids.reduce<BookLevel | null>(
    (best, b) => (!best || Number(b.price) > Number(best.price) ? b : best),
    null,
  );
  const bookShares = w.book?.bids.reduce(
    (total, b) => total + (Number.isFinite(Number(b.size)) ? Number(b.size) : 0),
    0,
  );
  const bookStale = w.book ? Date.now() - w.book.fetchedAt > 15_000 : false;
  // Visual proportion only. The quote remains the sole source of fill estimates.
  const filled = decimal(w.quote?.filledShares);
  const fillPercent =
    amount?.gt(0) && filled
      ? Decimal.max(0, Decimal.min(100, filled.div(amount).mul(100))).toNumber()
      : 0;
  const hasRemainder = !!decimal(w.quote?.remainingShares)?.gt(0);

  useEffect(() => {
    const dialog = reviewRef.current;
    if (!dialog) return;
    if (w.reviewOpen && !dialog.open) dialog.showModal();
    if (!w.reviewOpen && dialog.open) dialog.close();
  }, [w.reviewOpen]);
  useEffect(() => {
    const dialog = walletRef.current;
    if (!dialog) return;
    if (walletOpen && !dialog.open) dialog.showModal();
    if (!walletOpen && dialog.open) dialog.close();
  }, [walletOpen]);
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (
        event.key !== "/" ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.defaultPrevented
      )
        return;
      const target = event.target as HTMLElement;
      if (
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
        target.isContentEditable ||
        reviewRef.current?.open ||
        walletRef.current?.open
      )
        return;
      event.preventDefault();
      setMobilePanel("markets");
      setListTab("markets");
      requestAnimationFrame(() => searchRef.current?.focus());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function chooseMarket(id: string) {
    w.onSelectMarket(id);
    setMobilePanel("exit");
    setTouched({ shares: false, floor: false });
  }
  function setFraction(fraction: string) {
    const available = decimal(w.availableShares);
    if (available)
      w.onSharesChange(available.mul(fraction).toDecimalPlaces(2, Decimal.ROUND_DOWN).toFixed());
  }
  function review() {
    setTouched({ shares: true, floor: true });
    if (reviewEnabled) w.onReview();
  }

  return (
    <div className="co-workspace" data-mobile-panel={mobilePanel}>
      <a className="co-skip-link" href={`#${uid}-ticket`}>
        Skip to exit ticket
      </a>
      <header className="co-header">
        <div className="co-header-left">
          <Link className="co-brand" href="/" aria-label="Closeout home">
            <CloseoutLogo />
          </Link>
          <span className="co-product-label">Exit workspace</span>
        </div>
        <div className="co-header-actions">
          <div className="co-mode-control" aria-label="Data mode">
            <button aria-pressed={w.mode === "live"} onClick={() => w.onModeChange("live")}>
              <span className="co-status-dot" />
              Live
            </button>
            <button aria-pressed={w.mode === "example"} onClick={() => w.onModeChange("example")}>
              <FlaskConical size={13} aria-hidden />
              Example
            </button>
          </div>
          <button
            className="co-button co-wallet-button"
            aria-label={
              w.accountAddress
                ? `Wallet and positions for ${shortAddress(w.accountAddress)}`
                : "Connect wallet and inspect positions"
            }
            onClick={() => setWalletOpen(true)}
            aria-haspopup="dialog"
          >
            <Wallet size={15} aria-hidden />
            <span className="co-wallet-button-label">
              {w.walletStatus === "connecting"
                ? "Connecting…"
                : w.accountAddress
                  ? shortAddress(w.accountAddress)
                  : "Connect wallet"}
            </span>
            <ChevronDown size={13} aria-hidden />
          </button>
        </div>
      </header>

      <main className="co-main">
        <div className="co-intro">
          <div>
            <Link className="co-back-link" href="/">
              <ArrowLeft size={13} aria-hidden />
              Back to site
            </Link>
            <h1>Your exit, clearly.</h1>
            <p className="co-intro-description">
              Set your floor. See what can fill. Decide what happens next.
            </p>
          </div>
          <div className="co-intro-meta" data-mode={w.mode}>
            <span className="co-live-label">
              <span className="co-status-dot" />
              {w.mode === "example" ? "Example workspace" : "Polymarket order book"}
            </span>
            <p>
              {w.mode === "example"
                ? "Synthetic data · no funds move"
                : "Live data · execution requires authorization"}
            </p>
          </div>
        </div>
        {w.mode === "example" && (
          <div className="co-banner">
            <span>
              <FlaskConical size={15} aria-hidden />
              Example mode uses synthetic markets, balances and fills. No funds move.
            </span>
            <button className="co-button co-button-quiet" onClick={() => w.onModeChange("live")}>
              Use live data
              <ArrowUpRight size={13} aria-hidden />
            </button>
          </div>
        )}
        {w.toast && (
          <div className="co-banner" role="status">
            <span>
              <Info size={15} aria-hidden />
              {w.toast}
            </span>
            <button
              className="co-icon-button"
              aria-label="Dismiss notification"
              onClick={w.onDismissToast}
            >
              <X size={16} aria-hidden />
            </button>
          </div>
        )}
        <nav
          className="co-mobile-nav"
          role="tablist"
          aria-label="Workspace panels"
          onKeyDown={tabArrows}
        >
          {(
            [
              ["markets", Search, "Markets"],
              ["exit", ArrowDownRight, "Exit"],
              ["activity", Activity, "Activity"],
            ] as const
          ).map(([key, Icon, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={mobilePanel === key}
              tabIndex={mobilePanel === key ? 0 : -1}
              onClick={() => setMobilePanel(key)}
            >
              <Icon size={15} aria-hidden />
              {label}
              {key === "activity" && activeOrders > 0 ? ` (${activeOrders})` : ""}
            </button>
          ))}
        </nav>

        <div className="co-shell">
          <aside className="co-sidebar" aria-label="Markets and positions">
            <div className="co-side-top">
              <div className="co-section-heading">
                <h2 className="co-section-title">Find your market</h2>
                <ListFilter size={15} className="co-muted" aria-hidden />
              </div>
              <form
                className="co-search"
                onSubmit={(e) => {
                  e.preventDefault();
                  w.onSearch();
                }}
              >
                <label htmlFor={`${uid}-search`} className="co-sr-only">
                  Search markets
                </label>
                <Search size={15} aria-hidden />
                <input
                  id={`${uid}-search`}
                  ref={searchRef}
                  type="search"
                  autoComplete="off"
                  placeholder="Search markets"
                  value={w.search}
                  onChange={(e) => w.onSearchChange(e.target.value)}
                />
                <kbd aria-hidden>/</kbd>
              </form>
            </div>
            <div className="co-tabs" role="tablist" aria-label="Market list" onKeyDown={tabArrows}>
              <button
                role="tab"
                aria-selected={listTab === "markets"}
                tabIndex={listTab === "markets" ? 0 : -1}
                onClick={() => setListTab("markets")}
              >
                Markets<span className="co-count">{w.markets.length}</span>
              </button>
              <button
                role="tab"
                aria-selected={listTab === "positions"}
                tabIndex={listTab === "positions" ? 0 : -1}
                onClick={() => setListTab("positions")}
              >
                My positions<span className="co-count">{w.positions.length || ""}</span>
              </button>
            </div>
            {listTab === "markets" ? (
              <>
                {w.marketState === "loading" ? (
                  <SkeletonList />
                ) : w.marketState === "error" ? (
                  <EmptyState
                    title="Live markets unavailable"
                    error
                    compact
                    action={
                      <div className="co-empty-actions">
                        <button className="co-button co-button-quiet" onClick={w.onSearch}>
                          <RefreshCw size={13} aria-hidden />
                          Retry
                        </button>
                        <button className="co-button" onClick={() => w.onModeChange("example")}>
                          Try example mode
                        </button>
                      </div>
                    }
                  >
                    {w.marketError ??
                      "The market source could not be reached. Retry or explore an explicitly simulated example."}
                  </EmptyState>
                ) : w.markets.length ? (
                  <div className="co-market-list">
                    {w.markets.map((m) => (
                      <button
                        key={m.id}
                        className="co-market-row"
                        aria-current={market?.id === m.id ? "true" : undefined}
                        onClick={() => chooseMarket(m.id)}
                      >
                        <span className="co-market-row-title">{m.question}</span>
                        <span className="co-market-row-meta">
                          <span>{m.category || "Prediction"}</span>
                          <span className="co-market-row-price">
                            <span className="co-market-price-label">{m.outcomes[0]?.label}</span>{" "}
                            <span className="co-num">
                              {m.outcomes[0]?.price != null
                                ? `${numberText(decimal(m.outcomes[0].price)?.mul(100).toFixed(), "price")}¢`
                                : "—"}
                            </span>
                          </span>
                        </span>
                        <span className="co-market-row-meta co-market-row-detail">
                          <span>{m.acceptingOrders ? "Open for orders" : "Orders paused"}</span>
                          <span>Vol ${numberText(m.volume24h, "compact")}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title={w.search ? "No matching markets" : "No markets available"}
                    compact
                    action={
                      <button className="co-button co-button-quiet" onClick={w.onSearch}>
                        Refresh markets
                      </button>
                    }
                  >
                    {w.search
                      ? "Try a shorter name or another market question."
                      : "Refresh to check the current market list."}
                  </EmptyState>
                )}
              </>
            ) : (
              <>
                {w.positionError && w.positionState !== "error" && (
                  <div className="co-position-notice" role="status">
                    <Info size={14} aria-hidden />
                    <p>{w.positionError}</p>
                  </div>
                )}
                {w.positionState === "loading" ? (
                  <SkeletonList />
                ) : w.positionState === "error" ? (
                  <EmptyState
                    title="Positions unavailable"
                    error
                    compact
                    action={
                      <button className="co-button" onClick={w.onLoadPositions}>
                        Retry positions
                      </button>
                    }
                  >
                    {w.positionError ?? "Unable to load positions for this address."}
                  </EmptyState>
                ) : w.positions.length ? (
                  <div className="co-market-list">
                    {w.positions.map((p) => (
                      <button
                        key={p.tokenId}
                        className="co-market-row"
                        aria-current={p.tokenId === outcome?.tokenId ? "true" : undefined}
                        onClick={() => {
                          w.onSelectPosition(p);
                          setMobilePanel("exit");
                        }}
                      >
                        <span className="co-market-row-title">{p.title}</span>
                        <span className="co-market-row-meta">
                          <span>{p.outcome}</span>
                          <span>
                            <Num value={p.size} /> shares
                          </span>
                        </span>
                        {p.redeemable && (
                          <span className="co-field-hint">Resolved · redeemable at venue</span>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title={
                      w.accountAddress || w.accountInput
                        ? "No positions found"
                        : "Bring your position"
                    }
                    compact
                    action={
                      <button className="co-button" onClick={() => setWalletOpen(true)}>
                        <Wallet size={14} aria-hidden />
                        {w.accountAddress ? "View another address" : "Load positions"}
                      </button>
                    }
                  >
                    {w.accountAddress || w.accountInput
                      ? "No positions were returned for this address. You can still inspect market depth."
                      : "Connect a wallet or enter a public address to view its positions."}
                  </EmptyState>
                )}
              </>
            )}
            <div className="co-side-footer">
              <ShieldCheck size={17} strokeWidth={1.5} aria-hidden />
              <p>
                Your floor stays in your control.
                <br />A quote is a snapshot, not a fill.
              </p>
            </div>
          </aside>

          <section className="co-center" aria-label="Selected market">
            <div className="co-market-head">
              <div className="co-market-kicker">
                <span>
                  {market?.category || "PREDICTION MARKET"}
                  {w.mode === "example" && " · EXAMPLE"}
                </span>
                {market?.slug && w.mode === "live" && (
                  <a
                    href={`https://polymarket.com/event/${encodeURIComponent(market.slug)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View market
                    <ExternalLink size={12} aria-hidden />
                  </a>
                )}
              </div>
              <h2>{market?.question || "A clearer path out of your position."}</h2>
              {market ? (
                <div
                  className="co-outcomes"
                  role="radiogroup"
                  aria-label="Outcome to sell"
                  onKeyDown={tabArrows}
                >
                  {market.outcomes.map((o, index) => (
                    <button
                      key={o.tokenId}
                      className="co-outcome"
                      role="radio"
                      aria-checked={w.outcomeIndex === index}
                      tabIndex={w.outcomeIndex === index ? 0 : -1}
                      onClick={() => w.onOutcomeChange(index)}
                    >
                      <span className="co-outcome-check">
                        {w.outcomeIndex === index && <Check size={12} aria-hidden />}
                        {o.label}
                      </span>
                      <span className="co-num">
                        {o.price != null
                          ? `${numberText(decimal(o.price)?.mul(100).toFixed(), "price")}¢`
                          : "—"}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="co-muted co-small">
                  Select a market to inspect its available bids and plan an exit.
                </p>
              )}
            </div>
            <section className="co-depth" aria-labelledby={`${uid}-depth-title`}>
              <div className="co-depth-heading">
                <div>
                  <h3 className="co-section-title" id={`${uid}-depth-title`}>
                    Liquidity for your exit
                  </h3>
                  <p>
                    {outcome
                      ? `${outcome.label} shares · buy-side order book`
                      : "The bids your sell order can reach"}
                  </p>
                </div>
                <div className="co-depth-switch" aria-label="Depth display">
                  <button
                    aria-pressed={!depthTable}
                    aria-label="Show depth chart"
                    onClick={() => setDepthTable(false)}
                  >
                    <Activity size={15} aria-hidden />
                  </button>
                  <button
                    aria-pressed={depthTable}
                    aria-label="Show bid levels"
                    onClick={() => setDepthTable(true)}
                  >
                    <Layers3 size={15} aria-hidden />
                  </button>
                  <button
                    onClick={w.onRefresh}
                    disabled={!market || w.bookState === "loading"}
                    aria-label="Refresh order book"
                  >
                    <RefreshCw
                      size={14}
                      className={w.bookState === "loading" ? "co-spin" : ""}
                      aria-hidden
                    />
                  </button>
                </div>
              </div>
              {w.bookState === "loading" && !w.book ? (
                <div
                  className="co-skeleton co-skeleton-chart"
                  role="status"
                  aria-label="Loading order book"
                />
              ) : w.bookState === "error" ? (
                <EmptyState
                  title="Order book unavailable"
                  error
                  compact
                  action={
                    <button className="co-button co-button-quiet" onClick={w.onRefresh}>
                      <RefreshCw size={13} aria-hidden />
                      Retry book
                    </button>
                  }
                >
                  {w.bookError ??
                    "The venue did not return an order book. No exit estimate is available."}
                </EmptyState>
              ) : w.book ? (
                <BookDepth book={w.book} floor={w.floorPrice} table={depthTable} />
              ) : (
                <EmptyState title="Choose a market to see depth" compact>
                  Live bids show how many shares can sell at each price. You stay in control of the
                  floor.
                </EmptyState>
              )}
              <dl className="co-book-summary">
                <div>
                  <dt>
                    Best bid <span className="co-small">· pUSD</span>
                  </dt>
                  <dd>
                    <Num value={bestBid?.price} kind="price" />
                  </dd>
                </div>
                <div>
                  <dt>Available shares</dt>
                  <dd>
                    <Num value={bookShares} kind="compact" />
                  </dd>
                </div>
                <div>
                  <dt>Book fetched</dt>
                  <dd className="co-book-time">{timestamp(w.book?.fetchedAt)}</dd>
                </div>
              </dl>
              {bookStale && (
                <p className="co-field-hint">
                  This snapshot is over 15 seconds old. Review refreshes it before confirmation.
                </p>
              )}
            </section>
            <section className="co-activity" aria-labelledby={`${uid}-activity-title`}>
              <div className="co-activity-head">
                <h3 className="co-section-title" id={`${uid}-activity-title`}>
                  Exit activity{" "}
                  <span className="co-count">
                    {w.orders.length > 0 ? ` / ${w.orders.length}` : ""}
                  </span>
                </h3>
                <div className="co-inline">
                  <button
                    className="co-icon-button"
                    aria-label="Export exit activity"
                    title="Export activity"
                    onClick={w.onExport}
                    disabled={!w.orders.length}
                  >
                    <Download size={14} aria-hidden />
                  </button>
                  <button
                    className="co-icon-button"
                    aria-label="Refresh order statuses"
                    title="Refresh status"
                    onClick={w.onRefreshOrders}
                    disabled={!w.orders.length}
                  >
                    <RefreshCw size={14} aria-hidden />
                  </button>
                </div>
              </div>
              {w.orderError && (
                <div className="co-activity-error" role="alert">
                  <CircleAlert size={14} aria-hidden />
                  <span>{w.orderError}</span>
                  <button className="co-button co-button-quiet" onClick={w.onRefreshOrders}>
                    Retry
                  </button>
                </div>
              )}
              {w.orders.length ? (
                w.orders.map((order) => <OrderRow key={order.id} order={order} workspace={w} />)
              ) : (
                <EmptyState title="No exits submitted" compact>
                  Reviewed exits will appear here, with matched shares and settlement tracked
                  separately.
                </EmptyState>
              )}
            </section>
          </section>

          <aside className="co-ticket" id={`${uid}-ticket`} aria-label="Exit ticket">
            <div className="co-ticket-heading">
              <div>
                <span className="co-eyebrow">In your control</span>
                <h2>Plan your exit</h2>
              </div>
              <span className={`co-badge ${w.mode === "example" ? "co-badge-simulation" : ""}`}>
                {w.mode === "example" ? "Simulation" : "Sell only"}
              </span>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                review();
              }}
              noValidate
            >
              <div className="co-field">
                <div className="co-field-heading">
                  <label htmlFor={`${uid}-shares`}>Shares to sell</label>
                  <span>
                    {w.availableShares !== null ? (
                      <>
                        <Num value={w.availableShares} /> available
                        {w.mode === "example" ? " · example" : ""}
                      </>
                    ) : (
                      "Balance not loaded"
                    )}
                  </span>
                </div>
                <div className="co-input-wrap">
                  <input
                    id={`${uid}-shares`}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="0"
                    value={w.shares}
                    onChange={(e) => editableDecimal(e.target.value, w.onSharesChange)}
                    onBlur={() => setTouched((v) => ({ ...v, shares: true }))}
                    aria-invalid={!!sharesError}
                    aria-describedby={sharesError ? `${uid}-shares-error` : undefined}
                  />
                  <span className="co-input-unit" title={outcome?.label || "Shares"}>
                    {outcome?.label || "Shares"}
                  </span>
                </div>
                <div className="co-quick-amounts" aria-label="Portion of available shares">
                  {[
                    ["25%", ".25"],
                    ["50%", ".5"],
                    ["75%", ".75"],
                    ["Max", "1"],
                  ].map(([label, fraction]) => (
                    <button
                      type="button"
                      key={label}
                      onClick={() => setFraction(fraction)}
                      disabled={w.availableShares === null}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {sharesError && (
                  <p className="co-error-text" id={`${uid}-shares-error`}>
                    {sharesError}
                  </p>
                )}
              </div>
              <div className="co-field">
                <div className="co-field-heading">
                  <label htmlFor={`${uid}-floor`}>Minimum price</label>
                  <span>pUSD / share</span>
                </div>
                <div className="co-input-wrap">
                  <input
                    id={`${uid}-floor`}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="0.50"
                    value={w.floorPrice}
                    onChange={(e) => editableDecimal(e.target.value, w.onFloorPriceChange)}
                    onBlur={() => setTouched((v) => ({ ...v, floor: true }))}
                    aria-invalid={!!floorError}
                    aria-describedby={`${uid}-floor-hint${floorError ? ` ${uid}-floor-error` : ""}`}
                  />
                  <SlidersHorizontal size={16} className="co-muted" aria-hidden />
                </div>
                <p className="co-field-hint" id={`${uid}-floor-hint`}>
                  Do not sell below this price per share. Fees are deducted from the proceeds.
                </p>
                {floorError && (
                  <p className="co-error-text" id={`${uid}-floor-error`}>
                    {floorError}
                  </p>
                )}
              </div>
              <fieldset className="co-order-type">
                <legend>If only part can fill</legend>
                <div
                  className="co-order-type-controls"
                  role="radiogroup"
                  aria-label="Fill policy"
                  onKeyDown={tabArrows}
                >
                  <button
                    type="button"
                    className="co-type-button"
                    role="radio"
                    aria-checked={w.orderType === "FAK"}
                    tabIndex={w.orderType === "FAK" ? 0 : -1}
                    onClick={() => w.onOrderTypeChange("FAK")}
                  >
                    <strong>Sell available</strong>
                    <small>Cancel any remainder</small>
                  </button>
                  <button
                    type="button"
                    className="co-type-button"
                    role="radio"
                    aria-checked={w.orderType === "FOK"}
                    tabIndex={w.orderType === "FOK" ? 0 : -1}
                    onClick={() => w.onOrderTypeChange("FOK")}
                  >
                    <strong>All or nothing</strong>
                    <small>Fill all shares or none</small>
                  </button>
                </div>
              </fieldset>
              <div className="co-quote" aria-live="polite" aria-atomic="true">
                <span className="co-net-label">
                  {w.quote?.status === "blocked"
                    ? "Depth estimate · exit blocked"
                    : "Estimated net proceeds"}
                  <ArrowDownRight size={14} aria-hidden />
                </span>
                <p className="co-net-value">
                  <Num value={w.quote?.netReceipt} kind="money" />
                  <small>pUSD</small>
                </p>
                <dl className="co-breakdown">
                  <div>
                    <dt>Gross proceeds</dt>
                    <dd>
                      <Num value={w.quote?.grossReceipt} kind="money" /> pUSD
                    </dd>
                  </div>
                  <div>
                    <dt>Estimated venue fee</dt>
                    <dd>
                      <Num value={w.quote?.fees} kind="money" /> pUSD
                    </dd>
                  </div>
                  <div>
                    <dt>Closeout fee</dt>
                    <dd className="co-num">0.00 pUSD</dd>
                  </div>
                  <div className="co-breakdown-divider">
                    <dt>Shares that can fill</dt>
                    <dd>
                      <Num value={w.quote?.filledShares} /> / <Num value={w.shares} />
                    </dd>
                  </div>
                  <div className="co-unsold-row" data-has-remainder={hasRemainder}>
                    <dt>Shares left unsold</dt>
                    <dd>
                      <Num value={w.quote?.remainingShares} />
                    </dd>
                  </div>
                </dl>
                {w.quote && (
                  <div className="co-fill-track" aria-hidden="true">
                    <span style={{ width: `${fillPercent}%` }} />
                  </div>
                )}
                <p className="co-cost-scope">
                  Excludes network, intermediary and conversion costs.
                </p>
              </div>
              {!!w.quote?.blockers.length && (
                <div className="co-inline-notice" data-tone="error" role="alert">
                  <CircleAlert size={15} aria-hidden />
                  <div>
                    {w.quote.blockers.map((s) => (
                      <p key={s}>{s}</p>
                    ))}
                  </div>
                </div>
              )}
              {!!w.quote?.warnings.length && (
                <details className="co-estimate-warnings">
                  <summary>
                    <Info size={14} aria-hidden />
                    Estimate assumptions <span className="co-count">{w.quote.warnings.length}</span>
                    <ChevronDown size={13} aria-hidden />
                  </summary>
                  <div>
                    {w.quote.warnings.map((s) => (
                      <p key={s}>{s}</p>
                    ))}
                  </div>
                </details>
              )}
              {!w.executionEnabled && executionNotices.length > 0 && (
                <div className="co-inline-notice">
                  <LockKeyhole size={15} aria-hidden />
                  <div>
                    {executionNotices.map((s) => (
                      <p key={s}>{s}</p>
                    ))}
                  </div>
                </div>
              )}
              <button
                className="co-button co-button-primary co-ticket-submit"
                type="submit"
                disabled={!reviewEnabled || w.submitting}
                aria-busy={w.reviewLoading}
              >
                <span>
                  {w.reviewLoading
                    ? "Refreshing your plan…"
                    : w.mode === "example"
                      ? "Review simulated exit"
                      : "Review exit"}
                </span>
                {w.reviewLoading ? (
                  <LoaderCircle size={16} className="co-spin" aria-hidden />
                ) : (
                  <ArrowRight size={16} aria-hidden />
                )}
              </button>
              <p className="co-ticket-disclaimer">
                {w.mode === "example"
                  ? "Explore the flow. No wallet signature or real order."
                  : "Review a fresh quote before authorizing an order."}
              </p>
            </form>
            <details className="co-details">
              <summary>What does this estimate include?</summary>
              <p>
                Available bids at or above your floor, the venue fee when known, and a zero Closeout
                service fee. Network, intermediary and conversion costs are excluded. It is a
                snapshot, not a guaranteed receipt. Liquidity can change before the venue accepts
                your order. Matched shares are not settled proceeds.
              </p>
              <p>
                pUSD is the venue collateral shown by this workspace. A displayed amount is not a
                bank withdrawal or a guarantee of dollar redemption.
              </p>
            </details>
          </aside>
        </div>
        <footer className="co-footer">
          <p>
            <ShieldCheck size={12} aria-hidden />
            {w.mode === "example"
              ? "Synthetic example · no funds move"
              : "Your wallet authorizes. The venue executes."}
          </p>
          <p>
            BOOK DEPTH, NOT A PRICE PROMISE <span aria-hidden>↗</span>
          </p>
        </footer>
      </main>

      <dialog
        ref={walletRef}
        className="co-dialog"
        aria-labelledby={`${uid}-wallet-title`}
        onCancel={() => setWalletOpen(false)}
        onClose={() => setWalletOpen(false)}
      >
        <div className="co-dialog-head">
          <h2 id={`${uid}-wallet-title`}>Your wallet & positions</h2>
          <button
            className="co-icon-button"
            aria-label="Close wallet dialog"
            onClick={() => setWalletOpen(false)}
          >
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className="co-dialog-body">
          {w.mode === "example" && (
            <div className="co-inline-notice" data-tone="warning">
              <FlaskConical size={15} aria-hidden />
              You are in example mode. Its balances and orders are synthetic.
            </div>
          )}
          <div className="co-wallet-connect">
            <Wallet size={24} strokeWidth={1.5} aria-hidden />
            <div>
              <strong>
                {w.walletStatus === "connected" ? "Wallet connected" : "Connect to authorize exits"}
              </strong>
              <p>
                {w.accountAddress ? (
                  <span className="co-address">{w.accountAddress}</span>
                ) : (
                  "Inspect first. Your wallet approves any live order."
                )}
              </p>
            </div>
          </div>
          <button
            className="co-button co-wallet-connect-button"
            onClick={() => {
              if (w.walletStatus === "connected") {
                w.onDisconnect();
                return;
              }
              // A native modal makes Privy's separately mounted chooser inert. Release
              // the top layer synchronously before handing focus to the wallet flow.
              walletRef.current?.close();
              setWalletOpen(false);
              w.onConnect();
            }}
            disabled={w.walletStatus === "connecting"}
            aria-busy={w.walletStatus === "connecting"}
          >
            {w.walletStatus === "connecting" && (
              <LoaderCircle size={14} className="co-spin" aria-hidden />
            )}
            {w.walletStatus === "connected" ? "Disconnect wallet" : w.connectLabel}
          </button>
          {w.walletError && (
            <p role="alert" className="co-error-text">
              {w.walletError}
            </p>
          )}
          <form
            className="co-wallet-form"
            onSubmit={(e) => {
              e.preventDefault();
              w.onLoadPositions();
              setListTab("positions");
              setMobilePanel("markets");
              setWalletOpen(false);
            }}
          >
            <label htmlFor={`${uid}-address`}>Or inspect a public Polygon address</label>
            <input
              id={`${uid}-address`}
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="0x…"
              value={w.accountInput}
              onChange={(e) => w.onAccountInputChange(e.target.value)}
            />
            <p>Read-only. Entering an address does not grant permission to trade its positions.</p>
            <button
              className="co-button"
              type="submit"
              disabled={!w.accountInput.trim() || w.positionState === "loading"}
            >
              {w.positionState === "loading" ? "Loading positions…" : "Load positions"}
              <ArrowRight size={14} aria-hidden />
            </button>
          </form>
        </div>
      </dialog>

      <dialog
        ref={reviewRef}
        className="co-dialog"
        aria-labelledby={`${uid}-review-title`}
        onCancel={(e) => {
          if (w.submitting || w.reviewLoading) e.preventDefault();
          else w.onCloseReview();
        }}
        onClose={() => {
          if (w.reviewOpen && !w.submitting && !w.reviewLoading) w.onCloseReview();
        }}
      >
        <div className="co-dialog-head">
          <h2 id={`${uid}-review-title`}>
            {w.mode === "example" ? "Review simulated exit" : "Review your exit"}
          </h2>
          <button
            className="co-icon-button"
            aria-label="Close exit review"
            onClick={w.onCloseReview}
            disabled={w.submitting || w.reviewLoading}
          >
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className="co-dialog-body">
          <span className={`co-badge ${w.mode === "example" ? "co-badge-simulation" : ""}`}>
            {w.mode === "example"
              ? "Simulation · no funds move"
              : "Live order · wallet authorization"}
          </span>
          <p className="co-dialog-market">{market?.question}</p>
          <p className="co-muted co-small">
            Sell {outcome?.label} ·{" "}
            {w.orderType === "FAK" ? "Fill available, cancel remainder" : "Fill all or cancel"}
          </p>
          <div className="co-quote">
            <span className="co-net-label">Estimated net proceeds</span>
            <p className="co-net-value">
              <Num value={w.quote?.netReceipt} kind="money" />
              <small>pUSD</small>
            </p>
            <dl className="co-breakdown">
              <div>
                <dt>Requested shares</dt>
                <dd>
                  <Num value={w.quote?.requestedShares} />
                </dd>
              </div>
              <div>
                <dt>Minimum price / share</dt>
                <dd>
                  <Num value={w.floorPrice} kind="price" /> pUSD
                </dd>
              </div>
              <div>
                <dt>Currently fillable</dt>
                <dd>
                  <Num value={w.quote?.filledShares} /> shares
                </dd>
              </div>
              <div>
                <dt>Shares left unsold</dt>
                <dd>
                  <Num value={w.quote?.remainingShares} />
                </dd>
              </div>
              <div className="co-breakdown-divider">
                <dt>Gross proceeds</dt>
                <dd>
                  <Num value={w.quote?.grossReceipt} kind="money" /> pUSD
                </dd>
              </div>
              <div>
                <dt>Venue fee</dt>
                <dd>
                  <Num value={w.quote?.fees} kind="money" /> pUSD
                </dd>
              </div>
              <div>
                <dt>Closeout fee</dt>
                <dd className="co-num">0.00 pUSD</dd>
              </div>
            </dl>
          </div>
          <div className="co-inline-notice">
            <Clock3 size={15} aria-hidden />
            <span>
              Book snapshot {timestamp(w.quote?.snapshotAt)}. Price and available size can change. A
              match is not confirmed settlement.
            </span>
          </div>
          {w.reviewError && (
            <div className="co-inline-notice" data-tone="error" role="alert">
              <CircleAlert size={15} aria-hidden />
              <span>{w.reviewError}</span>
            </div>
          )}
          {w.quote?.blockers.map((s) => (
            <p className="co-error-text" key={s}>
              {s}
            </p>
          ))}
          {w.mode === "live" && !w.executionEnabled && (
            <div className="co-inline-notice" data-tone="warning">
              <LockKeyhole size={15} aria-hidden />
              <span>
                {w.executionBlockers.join(" ") ||
                  "Connect an eligible wallet to authorize this exit."}
              </span>
            </div>
          )}
          <div className="co-dialog-actions">
            <button
              className="co-button co-button-quiet"
              onClick={w.onCloseReview}
              disabled={w.submitting || w.reviewLoading}
            >
              Back to plan
            </button>
            <button
              className="co-button co-button-primary"
              onClick={w.onConfirm}
              disabled={
                w.submitting ||
                w.reviewLoading ||
                !!w.reviewError ||
                !quoteUsable ||
                !w.executionEnabled
              }
              aria-busy={w.submitting}
            >
              {w.submitting ? (
                <LoaderCircle size={15} className="co-spin" aria-hidden />
              ) : (
                <ArrowRight size={15} aria-hidden />
              )}
              {w.submitting
                ? "Submitting…"
                : w.mode === "example"
                  ? "Simulate exit"
                  : "Authorize exit"}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}

export default ExitWorkspace;
