"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Decimal from "decimal.js";
import { useTradingWallet } from "@/components/wallet-provider";
import {
  createTradingSession,
  checkGeo,
  SubmissionUncertainError,
  type TradingSession,
} from "@/lib/trading-client";
import {
  exampleMarkets,
  exampleBook,
  examplePositions,
} from "@/lib/example-data";
import { buildQuote } from "@/lib/quote";
import { compactOrderHistory, decodeOrderHistory } from "@/lib/order-history";
import { reconcileOrder } from "@/lib/order-status";
import type {
  DataMode,
  ExitQuote,
  LoadState,
  Market,
  OrderBook,
  Position,
  TrackedOrder,
  WorkspaceController,
} from "@/lib/types";
const validAddress = (s: string) => /^0x[0-9a-fA-F]{40}$/.test(s);
const message = (e: unknown) =>
  e instanceof Error ? e.message : "The request could not be completed.";
async function get<T>(url: string, signal?: AbortSignal): Promise<T> {
  const r = await fetch(url, {
    signal: signal ?? AbortSignal.timeout(15000),
    cache: "no-store",
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error ?? "The venue request failed.");
  return d as T;
}
const STORAGE = "closeout-orders-v1";
const activeStatuses = ["unknown", "open", "matched", "settling"];

export function useExitWorkspace(): WorkspaceController {
  const wallet = useTradingWallet();
  const [mode, setMode] = useState<DataMode>("live");
  const [markets, setMarkets] = useState<Market[]>([]),
    [marketState, setMarketState] = useState<LoadState>("loading"),
    [marketError, setMarketError] = useState<string | null>(null);
  const [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [searchRevision, setSearchRevision] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null),
    [outcomeIndex, setOutcomeIndex] = useState(0);
  const [book, setBook] = useState<OrderBook | null>(null),
    [bookState, setBookState] = useState<LoadState>("idle"),
    [bookError, setBookError] = useState<string | null>(null);
  const [shares, setShares] = useState("250"),
    [floorPrice, setFloorPrice] = useState(""),
    [orderType, setOrderType] = useState<"FAK" | "FOK">("FAK");
  const [accountInput, setAccountInput] = useState(""),
    [accountAddress, setAccountAddress] = useState<string | null>(null);
  const [positions, setPositions] = useState<Position[]>([]),
    [positionState, setPositionState] = useState<LoadState>("idle"),
    [positionError, setPositionError] = useState<string | null>(null);
  const [availableShares, setAvailableShares] = useState<string | null>(null),
    [collateralBalance, setCollateralBalance] = useState<string | null>(null);
  const [geoStatus, setGeoStatus] =
    useState<WorkspaceController["geoStatus"]>("checking");
  const [geoDetail, setGeoDetail] = useState("Checking venue eligibility.");
  const [orders, setOrders] = useState<TrackedOrder[]>([]),
    [ordersLoaded, setOrdersLoaded] = useState(false),
    [orderError, setOrderError] = useState<string | null>(null),
    [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false),
    [reviewLoading, setReviewLoading] = useState(false),
    [submitting, setSubmitting] = useState(false),
    [reviewError, setReviewError] = useState<string | null>(null);
  const [historyHealthy, setHistoryHealthy] = useState(true);
  const [toast, setToast] = useState<string | null>(null),
    [now, setNow] = useState(0),
    [walletError, setWalletError] = useState<string | null>(null);
  const sessionRef = useRef<TradingSession | null>(null),
    sessionKeyRef = useRef(""),
    busy = useRef(false),
    bookRequest = useRef(0),
    marketRequest = useRef(0),
    positionRequest = useRef(0),
    contextRef = useRef(""),
    positionContextRef = useRef(""),
    selectionRequest = useRef(0),
    historyHealthyRef = useRef(true);
  const ordersRef = useRef(orders);
  ordersRef.current = orders;
  const selectedMarket = markets.find((m) => m.id === selectedId) ?? null;
  const tokenId = selectedMarket?.outcomes[outcomeIndex]?.tokenId ?? "";
  const contextKey = `${mode}:${tokenId}:${wallet.address ?? ""}:${accountAddress ?? ""}`;
  contextRef.current = contextKey;
  positionContextRef.current = `${mode}:${accountInput.trim().toLowerCase()}`;
  const reviewed = useRef<{
    context: string;
    shares: string;
    floor: string;
    orderType: "FAK" | "FOK";
    quote: ExitQuote;
  } | null>(null);

  const writeOrders = useCallback(
    async (fn: (prev: TrackedOrder[]) => TrackedOrder[]): Promise<boolean> => {
      const apply = () => {
        if (!historyHealthyRef.current) {
          const next = fn(ordersRef.current);
          ordersRef.current = next;
          setOrders(next);
          return false;
        }
        try {
          const disk = decodeOrderHistory(localStorage.getItem(STORAGE));
          const base = [
            ...disk,
            ...ordersRef.current.filter((o) => o.mode === "example"),
          ];
          const next = fn(base);
          localStorage.setItem(
            STORAGE,
            JSON.stringify(
              compactOrderHistory(next.filter((o) => o.mode === "live")),
            ),
          );
          ordersRef.current = next;
          setOrders(next);
          return true;
        } catch {
          historyHealthyRef.current = false;
          setHistoryHealthy(false);
          setOrderError(
            "Order history could not be verified or saved. Reconcile venue orders before restoring history.",
          );
          return false;
        }
      };
      if (!navigator.locks) {
        const next = fn(ordersRef.current);
        ordersRef.current = next;
        setOrders(next);
        return false;
      }
      return navigator.locks.request(
        "closeout-history",
        { mode: "exclusive" },
        apply,
      );
    },
    [],
  );
  useEffect(() => {
    try {
      const saved = decodeOrderHistory(localStorage.getItem(STORAGE));
      setOrders(saved);
      ordersRef.current = saved;
    } catch {
      historyHealthyRef.current = false;
      setHistoryHealthy(false);
      setOrderError(
        "Saved order history could not be verified. Reconcile your venue orders before repairing or resetting local history.",
      );
    }
    setOrdersLoaded(true);
  }, []);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== STORAGE && event.key !== null) return;
      try {
        const disk = decodeOrderHistory(localStorage.getItem(STORAGE));
        const next = [
          ...disk,
          ...ordersRef.current.filter((o) => o.mode === "example"),
        ];
        ordersRef.current = next;
        setOrders(next);
      } catch {
        historyHealthyRef.current = false;
        setHistoryHealthy(false);
        setOrderError(
          "Order history changed to an invalid state in another tab. Reconcile venue orders before continuing.",
        );
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    let cancelled = false;
    checkGeo()
      .then((g) => {
        if (!cancelled) {
          setGeoStatus(g.status);
          setGeoDetail(g.detail);
        }
      })
      .catch(() => {
        if (!cancelled) setGeoStatus("unknown");
      });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => () => sessionRef.current?.dispose(), []);
  useEffect(() => {
    sessionRef.current?.dispose();
    sessionRef.current = null;
    sessionKeyRef.current = "";
    setAvailableShares(null);
    setCollateralBalance(null);
    setReviewOpen(false);
    reviewed.current = null;
  }, [wallet.address, accountAddress, mode]);

  useEffect(() => {
    const id = ++marketRequest.current,
      controller = new AbortController();
    setMarketState("loading");
    setMarketError(null);
    if (mode === "example") {
      const values = exampleMarkets.filter((m) =>
        m.question.toLowerCase().includes(query.toLowerCase()),
      );
      setMarkets(values);
      setSelectedId(values[0]?.id ?? null);
      setOutcomeIndex(0);
      setFloorPrice("");
      setMarketState("ready");
      return () => controller.abort();
    }
    get<{ markets: Market[] }>(
      `/api/markets?q=${encodeURIComponent(query)}`,
      controller.signal,
    )
      .then((d) => {
        if (id !== marketRequest.current) return;
        setMarkets(d.markets);
        setSelectedId(d.markets[0]?.id ?? null);
        setOutcomeIndex(0);
        setFloorPrice("");
        setMarketState("ready");
      })
      .catch((e) => {
        if (controller.signal.aborted || id !== marketRequest.current) return;
        setMarkets([]);
        setSelectedId(null);
        setMarketState("error");
        setMarketError(message(e));
      });
    return () => controller.abort();
  }, [mode, query, searchRevision]);

  const refreshBook = useCallback(
    async (showLoading = true): Promise<OrderBook | null> => {
      if (!tokenId || !selectedMarket) return null;
      const id = ++bookRequest.current,
        key = contextRef.current;
      if (showLoading) setBookState("loading");
      setBookError(null);
      try {
        const fresh =
          mode === "example"
            ? exampleBook(tokenId)
            : (
                await get<{ book: OrderBook }>(
                  `/api/book?tokenId=${tokenId}&conditionId=${selectedMarket.conditionId}`,
                )
              ).book;
        if (id !== bookRequest.current || key !== contextRef.current)
          return null;
        setBook(fresh);
        setBookState("ready");
        setNow(Date.now());
        setFloorPrice(
          (p) =>
            p ||
            fresh.bids[Math.min(2, fresh.bids.length - 1)]?.price ||
            fresh.tickSize,
        );
        return fresh;
      } catch (e) {
        if (id === bookRequest.current && key === contextRef.current) {
          setBookState("error");
          setBookError(message(e));
          setBook(null);
        }
        return null;
      }
    },
    [tokenId, selectedMarket, mode],
  );
  useEffect(() => {
    setBook(null);
    setAvailableShares(null);
    setReviewOpen(false);
    reviewed.current = null;
    if (tokenId) void refreshBook();
    else setBookState("idle");
    return () => {
      bookRequest.current++;
    };
  }, [tokenId, mode, refreshBook]);
  useEffect(() => {
    if (!tokenId || reviewOpen || submitting) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void refreshBook(false);
    }, 10000);
    return () => clearInterval(id);
  }, [tokenId, refreshBook, reviewOpen, submitting]);
  const quote = useMemo(
    () =>
      book && floorPrice
        ? buildQuote(book, shares, floorPrice, orderType, now || Date.now())
        : null,
    [book, shares, floorPrice, orderType, now],
  );
  const visibleOrders = orders.filter(
    (o) =>
      o.mode === mode &&
      (mode === "example" ||
        !accountAddress ||
        o.accountAddress?.toLowerCase() === accountAddress.toLowerCase()),
  );
  const unresolved = orders.some(
    (o) =>
      o.mode === "live" &&
      o.accountAddress?.toLowerCase() === accountAddress?.toLowerCase() &&
      activeStatuses.includes(o.status),
  );
  const executionBlockers = useMemo(() => {
    const blockers = [...(quote?.blockers ?? [])];
    if (!selectedMarket || !quote)
      blockers.push("Select a market and enter your exit amount.");
    if (mode === "live") {
      if (!wallet.address)
        blockers.push("Connect the wallet that owns your Polymarket account.");
      if (
        !accountAddress ||
        accountInput.trim().toLowerCase() !== accountAddress.toLowerCase()
      )
        blockers.push(
          "Load your Polymarket account address to review an exit.",
        );
      if (geoStatus !== "allowed") blockers.push(geoDetail);
      if (unresolved)
        blockers.push(
          "Reconcile the pending order in Activity before submitting another exit.",
        );
      if (!ordersLoaded) blockers.push("Loading saved order history.");
      if (ordersLoaded && !navigator.locks)
        blockers.push(
          "This browser cannot coordinate submissions between tabs. Use a current browser on HTTPS or localhost.",
        );
      if (!historyHealthy)
        blockers.push(
          "Local order history is unavailable or invalid. Reconcile venue orders before restoring history.",
        );
      if (
        availableShares !== null &&
        /^\d+(\.\d+)?$/.test(shares) &&
        new Decimal(shares).gt(availableShares)
      )
        blockers.push(
          `Only ${availableShares} unreserved shares are available.`,
        );
    } else if (/^\d+(\.\d+)?$/.test(shares) && new Decimal(shares).gt("250"))
      blockers.push("The fictional example account holds 250 shares.");
    return [...new Set(blockers)];
  }, [
    quote,
    selectedMarket,
    mode,
    wallet.address,
    accountAddress,
    accountInput,
    geoStatus,
    geoDetail,
    unresolved,
    ordersLoaded,
    historyHealthy,
    availableShares,
    shares,
  ]);

  async function ensureSession(): Promise<TradingSession> {
    if (!wallet.address || !accountAddress || !validAddress(accountAddress))
      throw new Error(
        "Connect the account owner and load its Polymarket account address.",
      );
    const key = `${wallet.address.toLowerCase()}:${accountAddress.toLowerCase()}`;
    if (sessionRef.current && sessionKeyRef.current === key)
      return sessionRef.current;
    const current = contextRef.current,
      signer = wallet.address,
      account = accountAddress;
    const provider = await wallet.getProvider();
    if (current !== contextRef.current)
      throw new Error("The account changed. Review this exit again.");
    const session = await createTradingSession(provider, signer, account);
    if (current !== contextRef.current) {
      session.dispose();
      throw new Error("The account changed. Review this exit again.");
    }
    sessionRef.current = session;
    sessionKeyRef.current = key;
    return session;
  }
  async function loadPositions() {
    if (busy.current) return;
    const address = accountInput.trim(),
      id = ++positionRequest.current,
      requestContext = `${mode}:${accountInput.trim().toLowerCase()}`;
    if (mode === "example") {
      setPositions(examplePositions);
      setPositionState("ready");
      setPositionError(null);
      return;
    }
    if (!validAddress(address)) {
      setPositionError(
        "Enter the 0x account address shown on your Polymarket profile.",
      );
      setPositionState("error");
      return;
    }
    setAccountAddress(address);
    setPositionState("loading");
    setPositionError(null);
    setPositions([]);
    try {
      const d = await get<{ positions: Position[]; hasMore?: boolean }>(
        `/api/positions?account=${address}`,
      );
      if (
        id !== positionRequest.current ||
        requestContext !== positionContextRef.current
      )
        return;
      setPositions(d.positions);
      setPositionState("ready");
      if (d.hasMore)
        setPositionError(
          "Showing the first 100 positions. Additional positions may exist on Polymarket.",
        );
    } catch (e) {
      if (
        id === positionRequest.current &&
        requestContext === positionContextRef.current
      ) {
        setPositionState("error");
        setPositionError(message(e));
      }
    }
  }
  async function selectPosition(position: Position) {
    if (busy.current) return;
    const selection = ++selectionRequest.current,
      key = contextRef.current;
    marketRequest.current++;
    if (position.redeemable) {
      setPositionError(
        "This position is redeemable. Redeem it on Polymarket; it is not an open-market exit.",
      );
      return;
    }
    let market = markets.find((m) => m.conditionId === position.conditionId);
    if (!market && mode === "live") {
      try {
        const d = await get<{ markets: Market[] }>(
          `/api/markets?conditionId=${position.conditionId}`,
        );
        if (
          selection !== selectionRequest.current ||
          key !== contextRef.current
        )
          return;
        market = d.markets[0];
        if (market)
          setMarkets((ms) => [
            market!,
            ...ms.filter((m) => m.id !== market!.id),
          ]);
      } catch (e) {
        if (
          selection === selectionRequest.current &&
          key === contextRef.current
        )
          setPositionError(message(e));
        return;
      }
    }
    if (!market) {
      setPositionError("This position’s market is unavailable.");
      return;
    }
    const index = market.outcomes.findIndex(
      (o) => o.tokenId === position.tokenId,
    );
    if (index < 0) {
      setPositionError("Position token does not match the market.");
      return;
    }
    setSelectedId(market.id);
    setOutcomeIndex(index);
    setFloorPrice("");
    setShares(
      new Decimal(position.size)
        .toDecimalPlaces(2, Decimal.ROUND_DOWN)
        .toFixed(),
    );
    setReviewOpen(false);
  }
  async function review() {
    if (busy.current || executionBlockers.length) return;
    busy.current = true;
    setReviewOpen(true);
    setReviewLoading(true);
    setReviewError(null);
    const key = contextRef.current;
    try {
      if (mode === "live") {
        const session = await ensureSession();
        const balances = await session.readBalances(tokenId);
        if (key !== contextRef.current)
          throw new Error("Account or market changed. Review again.");
        setAvailableShares(balances.available);
        setCollateralBalance(balances.collateral);
        if (!balances.approvalsReady)
          throw new Error(
            "This account needs trading approvals on Polymarket before Closeout can sell.",
          );
        if (new Decimal(shares).gt(balances.available))
          throw new Error(
            `Only ${balances.available} unreserved shares are available in this account.`,
          );
      }
      const fresh = await refreshBook(false);
      if (!fresh || key !== contextRef.current)
        throw new Error(
          "Could not refresh this market. Close review and try again.",
        );
      const next = buildQuote(fresh, shares, floorPrice, orderType);
      if (next.blockers.length) throw new Error(next.blockers[0]);
      reviewed.current = {
        context: key,
        shares,
        floor: floorPrice,
        orderType,
        quote: next,
      };
    } catch (e) {
      setReviewError(message(e));
      reviewed.current = null;
    } finally {
      busy.current = false;
      setReviewLoading(false);
    }
  }
  async function confirm() {
    const r = reviewed.current;
    if (busy.current || !r) return;
    if (
      r.context !== contextRef.current ||
      r.shares !== shares ||
      r.floor !== floorPrice ||
      r.orderType !== orderType ||
      Date.now() - r.quote.snapshotAt > 15000
    ) {
      setReviewError(
        "This review has expired or changed. Close it and review a fresh quote.",
      );
      reviewed.current = null;
      return;
    }
    if (executionBlockers.length) {
      setReviewError(executionBlockers[0]);
      return;
    }
    async function submitLocked() {
      if (r!.context !== contextRef.current) {
        setReviewError("The account or market changed. Review again.");
        return;
      }
      busy.current = true;
      setSubmitting(true);
      setReviewError(null);
      const id = `${mode === "example" ? "example" : "intent"}-${crypto.randomUUID()}`;
      const intent: TrackedOrder = {
        id,
        market: selectedMarket!.question,
        outcome: selectedMarket!.outcomes[outcomeIndex].label,
        tokenId,
        requestedShares: shares,
        matchedShares: "0",
        settledShares: null,
        price: floorPrice,
        netReceipt: null,
        status: "unknown",
        mode,
        createdAt: Date.now(),
        transactionHashes: [],
        detail: "Submission is in progress. Do not submit a duplicate order!.",
        canCancel: false,
        accountAddress: accountAddress ?? undefined,
        orderType,
      };
      const persisted = await writeOrders((prev) => [intent, ...prev]);
      try {
        if (mode === "live" && !persisted)
          throw new Error(
            "Order history could not be saved. No order was submitted.",
          );
        if (mode === "example") {
          await writeOrders((prev) =>
            prev.map((o) =>
              o.id === id
                ? {
                    ...o,
                    matchedShares: r!.quote.filledShares,
                    settledShares: r!.quote.filledShares,
                    netReceipt: r!.quote.netReceipt,
                    status:
                      r!.quote.status === "partial" ? "partial" : "settled",
                    detail:
                      "Simulation only. Fictional fills and proceeds; no wallet signature or transaction was created.",
                  }
                : o,
            ),
          );
          setToast("Example exit simulated. No trade was sent.");
        } else {
          const session = sessionRef.current;
          if (
            !session ||
            session.accountAddress.toLowerCase() !==
              accountAddress?.toLowerCase() ||
            session.signerAddress.toLowerCase() !==
              wallet.address?.toLowerCase() ||
            r!.context !== contextRef.current
          )
            throw new Error(
              "Trading authorization changed. No order was submitted. Review this account again.",
            );
          const response = await session.placeExit({
            tokenId,
            shares,
            floorPrice,
            orderType,
          });
          if (!response.ok) {
            await writeOrders((prev) =>
              prev.map((o) =>
                o.id === id
                  ? {
                      ...o,
                      status: "failed",
                      detail: `Venue rejected this order: ${response.message}`,
                    }
                  : o,
              ),
            );
            throw new Error(
              `Polymarket rejected this order: ${response.message}`,
            );
          }
          await writeOrders((prev) =>
            prev.map((o) =>
              o.id === id
                ? {
                    ...o,
                    id: response.orderId,
                    status: response.status === "matched" ? "matched" : "open",
                    matchedShares: response.makingAmount,
                    transactionHashes: [],
                    detail:
                      response.status === "delayed"
                        ? "Accepted with a matching delay. Settlement is pending."
                        : "Accepted by the venue. Refresh to verify fills and settlement.",
                    canCancel: response.status === "live",
                  }
                : o,
            ),
          );
          setToast("Order submitted. Follow its confirmed fills in Activity.");
        }
        setReviewOpen(false);
        reviewed.current = null;
      } catch (e) {
        setReviewError(message(e));
        setOrderError(message(e));
        await writeOrders((prev) =>
          prev.map((o) =>
            o.id === id && o.status === "unknown"
              ? e instanceof SubmissionUncertainError
                ? {
                    ...o,
                    detail: `Submission outcome is not verified: ${message(e)} Check the account on Polymarket before any retry.`,
                  }
                : {
                    ...o,
                    status: "failed",
                    detail: `Order was not submitted: ${message(e)}`,
                  }
              : o,
          ),
        );
      } finally {
        busy.current = false;
        setSubmitting(false);
      }
    }
    if (mode === "example") {
      await submitLocked();
      return;
    }
    if (!navigator.locks) {
      setReviewError(
        "Use a browser supporting Web Locks on HTTPS or localhost. No order was sent.",
      );
      return;
    }
    await navigator.locks.request(
      `closeout-account-${accountAddress?.toLowerCase()}`,
      { mode: "exclusive", ifAvailable: true },
      async (lock) => {
        if (!lock) {
          setReviewError(
            "Another tab is handling this account. Wait and refresh Activity.",
          );
          return;
        }
        try {
          const saved = decodeOrderHistory(localStorage.getItem(STORAGE));
          if (
            saved.some(
              (o) =>
                o.accountAddress?.toLowerCase() ===
                  accountAddress?.toLowerCase() &&
                activeStatuses.includes(o.status),
            )
          ) {
            ordersRef.current = [
              ...saved,
              ...ordersRef.current.filter((o) => o.mode === "example"),
            ];
            setOrders(ordersRef.current);
            setReviewError(
              "This account has a pending order. Reconcile it in Activity before another exit.",
            );
            return;
          }
          await submitLocked();
        } catch {
          historyHealthyRef.current = false;
          setHistoryHealthy(false);
          setReviewError(
            "Could not verify saved order history. No new submission was authorized.",
          );
        }
      },
    );
  }
  async function refreshOrders() {
    if (mode === "example") {
      setToast("Example activity contains fictional results only.");
      return;
    }
    if (busy.current) return;
    busy.current = true;
    setOrderError(null);
    try {
      const session = await ensureSession();
      const matching = ordersRef.current.filter(
        (o) =>
          o.mode === "live" &&
          o.accountAddress?.toLowerCase() === accountAddress?.toLowerCase(),
      );
      for (const order of matching) {
        if (order.id.startsWith("intent-")) {
          setOrderError(
            "A submission has no verified order ID. Check your Polymarket account before retrying; this account remains locked in Closeout.",
          );
          continue;
        }
        const [remote, trades] = await Promise.all([
          session.getOrder(order.id),
          session.getTradesForOrder(order.id),
        ]);
        const next = reconcileOrder(order, remote, trades);
        writeOrders((prev) => prev.map((o) => (o.id === next.id ? next : o)));
      }
      if (tokenId) {
        const b = await session.readBalances(tokenId);
        setAvailableShares(b.available);
        setCollateralBalance(b.collateral);
      }
    } catch (e) {
      setOrderError(message(e));
    } finally {
      busy.current = false;
    }
  }
  async function cancelOrder(id: string) {
    if (busy.current || mode === "example") return;
    const order = ordersRef.current.find((o) => o.id === id);
    if (!order?.canCancel) return;
    busy.current = true;
    setCancellingOrderId(id);
    setOrderError(null);
    try {
      const session = await ensureSession();
      await session.cancelOrder(id);
      const [remote, trades] = await Promise.all([
        session.getOrder(id),
        session.getTradesForOrder(id),
      ]);
      writeOrders((prev) =>
        prev.map((o) => (o.id === id ? reconcileOrder(o, remote, trades) : o)),
      );
      setToast(
        "Cancellation requested. Activity shows the venue’s current state.",
      );
    } catch (e) {
      setOrderError(message(e));
    } finally {
      busy.current = false;
      setCancellingOrderId(null);
    }
  }
  useEffect(() => {
    if (mode !== "live" || !accountAddress) return;
    let stopped = false,
      running = false;
    const id = setInterval(async () => {
      const session = sessionRef.current;
      if (
        stopped ||
        running ||
        busy.current ||
        !session ||
        document.visibilityState !== "visible"
      )
        return;
      const pending = ordersRef.current.filter(
        (o) =>
          o.mode === "live" &&
          o.accountAddress?.toLowerCase() === accountAddress.toLowerCase() &&
          activeStatuses.includes(o.status) &&
          !o.id.startsWith("intent-"),
      );
      if (!pending.length) return;
      running = true;
      try {
        for (const order of pending) {
          const [remote, trades] = await Promise.all([
            session.getOrder(order.id),
            session.getTradesForOrder(order.id),
          ]);
          if (stopped) return;
          const next = reconcileOrder(order, remote, trades);
          writeOrders((prev) => prev.map((o) => (o.id === next.id ? next : o)));
        }
      } catch (e) {
        if (!stopped) setOrderError(message(e));
      } finally {
        running = false;
      }
    }, 5000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [mode, accountAddress, wallet.address, writeOrders]);
  function edit(fn: () => void) {
    if (busy.current) {
      setToast("Wait for the current wallet request to finish.");
      return;
    }
    selectionRequest.current++;
    setReviewOpen(false);
    reviewed.current = null;
    fn();
  }
  function exportHistory() {
    const data = {
      product: "Closeout",
      exportedAt: new Date().toISOString(),
      mode,
      notice:
        mode === "example"
          ? "FICTIONAL EXAMPLE — NO REAL TRANSACTIONS"
          : "Local order records. Estimated and matched amounts are not proof of settlement.",
      orders: visibleOrders,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `closeout-${mode}-activity.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return {
    mode,
    onModeChange: (m) =>
      edit(() => {
        positionRequest.current++;
        bookRequest.current++;
        marketRequest.current++;
        setMarkets([]);
        setSelectedId(null);
        setBook(null);
        setMarketState("loading");
        setMode(m);
        setSearch("");
        setQuery("");
        setPositions(m === "example" ? examplePositions : []);
        setPositionState(m === "example" ? "ready" : "idle");
        setPositionError(null);
        setAccountInput("");
        setAccountAddress(null);
        setFloorPrice("");
        setWalletError(null);
      }),
    markets,
    marketState,
    marketError,
    search,
    onSearchChange: setSearch,
    onSearch: () =>
      edit(() => {
        setQuery(search.trim());
        setSearchRevision((n) => n + 1);
      }),
    selectedMarket,
    onSelectMarket: (id) =>
      edit(() => {
        setSelectedId(id);
        setOutcomeIndex(0);
        setFloorPrice("");
      }),
    outcomeIndex,
    onOutcomeChange: (i) =>
      edit(() => {
        setOutcomeIndex(i);
        setFloorPrice("");
      }),
    book,
    bookState,
    bookError,
    onRefresh: () => void refreshBook(),
    shares,
    onSharesChange: (s) => edit(() => setShares(s)),
    floorPrice,
    onFloorPriceChange: (s) => edit(() => setFloorPrice(s)),
    orderType,
    onOrderTypeChange: (t) => edit(() => setOrderType(t)),
    quote,
    accountInput,
    onAccountInputChange: (s) =>
      edit(() => {
        setAccountInput(s);
        positionRequest.current++;
        setPositions([]);
        setAccountAddress(null);
        setAvailableShares(null);
      }),
    onLoadPositions: () => void loadPositions(),
    positions,
    positionState,
    positionError,
    onSelectPosition: (p) => void selectPosition(p),
    walletStatus: wallet.status,
    signerAddress: wallet.address,
    accountAddress,
    walletError: walletError ?? wallet.error,
    onConnect: () =>
      void wallet.connect().catch((e) => setWalletError(message(e))),
    onDisconnect: () => edit(() => wallet.disconnect()),
    connectLabel: wallet.connectLabel,
    availableShares: mode === "example" ? "250" : availableShares,
    collateralBalance: mode === "example" ? null : collateralBalance,
    executionEnabled: executionBlockers.length === 0 && !submitting,
    executionBlockers,
    geoStatus,
    orders: visibleOrders,
    orderError,
    onRefreshOrders: () => void refreshOrders(),
    onCancelOrder: (id) => void cancelOrder(id),
    cancellingOrderId,
    reviewOpen,
    reviewLoading,
    submitting,
    reviewError,
    onReview: () => void review(),
    onCloseReview: () => {
      if (!busy.current) {
        setReviewOpen(false);
        reviewed.current = null;
      }
    },
    onConfirm: () => void confirm(),
    toast,
    onDismissToast: () => setToast(null),
    onExport: exportHistory,
  };
}
