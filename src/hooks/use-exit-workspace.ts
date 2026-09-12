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
import { exampleMarkets, exampleBook, examplePositions } from "@/lib/example-data";
import { buildQuote } from "@/lib/quote";
import { compactOrderHistory, decodeOrderHistory } from "@/lib/order-history";
import { reconcileOrder } from "@/lib/order-status";
import type { AccountProfile } from "@/lib/account-profile";
import { readRecentProfile, RECENT_PROFILE_KEY, type RecentProfile } from "@/lib/recent-profile";
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
  try {
    const r = await fetch(url, {
      signal: signal ?? AbortSignal.timeout(15000),
      cache: "no-store",
    });
    let d;
    try {
      d = await r.json();
    } catch {
      throw new Error("We couldn't read the response. Your input is saved; please try again.");
    }
    if (!r.ok) throw new Error(d.error ?? "Polymarket is unavailable right now. Please retry.");
    return d as T;
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new Error("This is taking longer than expected. Your input is saved; please retry.");
    }
    if (error instanceof TypeError) {
      throw new Error("We couldn't reach Polymarket. Check your connection and try again.");
    }
    throw error;
  }
}
const STORAGE = "closeout-orders-v1";
const activeStatuses = ["unknown", "open", "matched", "settling"];

export function useExitWorkspace(initialMode: DataMode = "live"): WorkspaceController {
  const wallet = useTradingWallet();
  const [mode, setMode] = useState<DataMode>(initialMode);
  const [markets, setMarkets] = useState<Market[]>([]),
    [marketState, setMarketState] = useState<LoadState>("idle"),
    [marketError, setMarketError] = useState<string | null>(null);
  const [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [searchRevision, setSearchRevision] = useState(0),
    [discoveryRequested, setDiscoveryRequested] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null),
    [outcomeIndex, setOutcomeIndex] = useState(0);
  const [book, setBook] = useState<OrderBook | null>(null),
    [bookState, setBookState] = useState<LoadState>("idle"),
    [bookError, setBookError] = useState<string | null>(null);
  const [shares, setShares] = useState(""),
    [floorPrice, setFloorPrice] = useState(""),
    [orderType, setOrderType] = useState<"FAK" | "FOK">("FAK");
  const [accountInput, setAccountInput] = useState(""),
    [accountAddress, setAccountAddress] = useState<string | null>(null),
    [resolvedInput, setResolvedInput] = useState<string | null>(null);
  const [profile, setProfile] = useState<AccountProfile | null>(null),
    [profileState, setProfileState] = useState<LoadState>("idle"),
    [profileError, setProfileError] = useState<string | null>(null);
  const [recentProfile, setRecentProfile] = useState<RecentProfile | null>(null);
  const [positions, setPositions] = useState<Position[]>(
      initialMode === "example" ? examplePositions : [],
    ),
    [positionState, setPositionState] = useState<LoadState>(
      initialMode === "example" ? "ready" : "idle",
    ),
    [positionError, setPositionError] = useState<string | null>(null);
  const [positionHasMore, setPositionHasMore] = useState(false),
    [selectedPosition, setSelectedPosition] = useState<Position | null>(null),
    [positionSelectionState, setPositionSelectionState] = useState<LoadState>("idle");
  const [availableShares, setAvailableShares] = useState<string | null>(null),
    [collateralBalance, setCollateralBalance] = useState<string | null>(null);
  const [geoStatus, setGeoStatus] = useState<WorkspaceController["geoStatus"]>("checking");
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
    pendingPortfolio = useRef<{
      id: number;
      source: "manual" | "wallet";
      signer: string | null;
    } | null>(null),
    contextRef = useRef(""),
    bookContextRef = useRef(""),
    selectionRequest = useRef(0),
    historyHealthyRef = useRef(true);
  const ordersRef = useRef(orders);
  ordersRef.current = orders;
  const selectedMarket = markets.find((m) => m.id === selectedId) ?? null;
  const tokenId = selectedMarket?.outcomes[outcomeIndex]?.tokenId ?? "";
  const contextKey = `${mode}:${tokenId}:${wallet.address ?? ""}:${accountAddress ?? ""}`;
  contextRef.current = contextKey;
  bookContextRef.current = `${mode}:${selectedMarket?.conditionId ?? ""}:${tokenId}`;
  const identityRef = useRef({ mode, signer: wallet.address });
  identityRef.current = { mode, signer: wallet.address };
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
          const base = [...disk, ...ordersRef.current.filter((o) => o.mode === "example")];
          const next = fn(base);
          localStorage.setItem(
            STORAGE,
            JSON.stringify(compactOrderHistory(next.filter((o) => o.mode === "live"))),
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
      return navigator.locks.request("closeout-history", { mode: "exclusive" }, apply);
    },
    [],
  );
  useEffect(() => {
    try {
      setRecentProfile(readRecentProfile(localStorage.getItem(RECENT_PROFILE_KEY)));
    } catch {
      // A disabled storage preference cannot block a public portfolio lookup.
    }
  }, []);
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
        const next = [...disk, ...ordersRef.current.filter((o) => o.mode === "example")];
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
  useEffect(
    () => () => {
      sessionRef.current?.dispose();
      positionRequest.current++;
      selectionRequest.current++;
    },
    [],
  );
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
    const pending = pendingPortfolio.current;
    if (pending?.source === "wallet" && pending.signer !== wallet.address) {
      positionRequest.current++;
      pendingPortfolio.current = null;
      setProfileState("error");
      setProfileError("The connected wallet changed. Find positions again for the current wallet.");
      setProfile(null);
      setAccountAddress(null);
      setResolvedInput(null);
      setPositions([]);
      setPositionState("idle");
    }
  }, [wallet.address]);

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
      setMarketState("ready");
      return () => controller.abort();
    }
    if (!discoveryRequested) {
      setMarketState("idle");
      return () => controller.abort();
    }
    get<{ markets: Market[] }>(`/api/markets?q=${encodeURIComponent(query)}`, controller.signal)
      .then((d) => {
        if (id !== marketRequest.current) return;
        setMarkets(d.markets);
        setSelectedId(null);
        setSelectedPosition(null);
        setShares("");
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
  }, [mode, query, searchRevision, discoveryRequested]);

  const refreshBook = useCallback(
    async (showLoading = true): Promise<OrderBook | null> => {
      if (!tokenId || !selectedMarket) return null;
      const id = ++bookRequest.current,
        key = bookContextRef.current;
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
        if (id !== bookRequest.current || key !== bookContextRef.current) return null;
        setBook(fresh);
        setBookState("ready");
        setNow(Date.now());
        const bestBid = fresh.bids.reduce(
          (best, level) => (!best || new Decimal(level.price).gt(best) ? level.price : best),
          "",
        );
        setFloorPrice((p) => p || bestBid);
        return fresh;
      } catch (e) {
        if (id === bookRequest.current && key === bookContextRef.current) {
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
    if (!selectedMarket || !quote) blockers.push("Select a market and enter your exit amount.");
    if (positionSelectionState === "loading")
      blockers.push("Wait for the selected position to finish loading.");
    if (mode === "live") {
      if (!wallet.address) blockers.push("Connect the wallet that owns your Polymarket account.");
      if (!accountAddress || accountInput.trim().toLowerCase() !== resolvedInput)
        blockers.push("Load your Polymarket account address to review an exit.");
      if (geoStatus !== "allowed") blockers.push(geoDetail);
      if (unresolved)
        blockers.push("Reconcile the pending order in Activity before submitting another exit.");
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
        blockers.push(`Only ${availableShares} unreserved shares are available.`);
    } else if (!selectedPosition || selectedPosition.tokenId !== tokenId) {
      blockers.push("Choose a sample position before reviewing its exit.");
    } else if (/^\d+(\.\d+)?$/.test(shares) && new Decimal(shares).gt(selectedPosition.size)) {
      blockers.push(`This sample position contains ${selectedPosition.size} shares.`);
    }
    return [...new Set(blockers)];
  }, [
    quote,
    selectedMarket,
    mode,
    wallet.address,
    accountAddress,
    accountInput,
    resolvedInput,
    geoStatus,
    geoDetail,
    unresolved,
    ordersLoaded,
    historyHealthy,
    availableShares,
    shares,
    selectedPosition,
    positionSelectionState,
    tokenId,
  ]);

  async function ensureSession(): Promise<TradingSession> {
    if (!wallet.address || !accountAddress || !validAddress(accountAddress))
      throw new Error("Connect the account owner and load its Polymarket account address.");
    const key = `${wallet.address.toLowerCase()}:${accountAddress.toLowerCase()}`;
    if (sessionRef.current && sessionKeyRef.current === key) return sessionRef.current;
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
  async function loadPortfolio(
    source: "manual" | "wallet",
    resumedInput?: string,
  ): Promise<boolean> {
    if (busy.current) return false;
    const input =
      source === "wallet" ? (wallet.address ?? "") : (resumedInput ?? accountInput).trim();
    const requestedMode = mode;
    const requestedSigner = wallet.address;
    const id = ++positionRequest.current;
    const current = () =>
      id === positionRequest.current &&
      identityRef.current.mode === requestedMode &&
      (source !== "wallet" || identityRef.current.signer === requestedSigner);

    if (mode === "example") {
      setPositions(examplePositions);
      setPositionState("ready");
      setPositionError(null);
      return true;
    }
    if (!input) {
      setProfileState("error");
      setProfileError(
        source === "wallet"
          ? "Connect the wallet you use with Polymarket to find its profile."
          : "Paste a Polymarket profile link, username or 0x account address.",
      );
      return false;
    }

    pendingPortfolio.current = { id, source, signer: requestedSigner };
    if (resumedInput !== undefined) setAccountInput(input);

    // Public portfolio discovery is independent of trade authority. A failed
    // import keeps the input editable and never leaves an old account active.
    selectionRequest.current++;
    bookRequest.current++;
    setSelectedId(null);
    setSelectedPosition(null);
    setPositionSelectionState("idle");
    setBook(null);
    setBookState("idle");
    setShares("");
    setFloorPrice("");
    setAccountAddress(null);
    setResolvedInput(null);
    setAvailableShares(null);
    setProfile(null);
    setProfileState("loading");
    setProfileError(null);
    setPositionState("idle");
    setPositionError(null);
    setPositionHasMore(false);
    setPositions([]);
    setReviewOpen(false);
    reviewed.current = null;
    let profileResolved = false;
    try {
      const result = await get<{ profile: AccountProfile }>(
        `/api/profile?input=${encodeURIComponent(input)}&source=${source}`,
        AbortSignal.timeout(30_000),
      );
      if (!current()) return false;
      const next = result.profile;
      // Bind the resolved account to exactly the input that produced it. Keep
      // a manually entered profile link intact if a later positions read fails.
      setProfile(next);
      setProfileState("ready");
      setAccountAddress(next.accountAddress);
      const nextInput = source === "wallet" ? next.accountAddress : input;
      setAccountInput(nextInput);
      setResolvedInput(nextInput.trim().toLowerCase());
      profileResolved = true;
      setPositionState("loading");
      const data = await get<{ positions: Position[]; hasMore?: boolean }>(
        `/api/positions?account=${encodeURIComponent(next.accountAddress)}`,
      );
      if (!current()) return false;
      setPositions(data.positions);
      setPositionState("ready");
      setPositionHasMore(data.hasMore === true);
      const bookmark: RecentProfile = {
        accountAddress: next.accountAddress,
        displayName: next.displayName,
        username: next.username,
      };
      setRecentProfile(bookmark);
      try {
        localStorage.setItem(RECENT_PROFILE_KEY, JSON.stringify(bookmark));
      } catch {
        // Only the convenience bookmark is lost. Trading history has its own
        // separate, fail-closed persistence contract.
      }
      return true;
    } catch (error) {
      if (!current()) return false;
      if (profileResolved) {
        setPositionState("error");
        setPositionError(message(error));
      } else {
        setProfileState("error");
        setProfileError(message(error));
      }
      return false;
    } finally {
      if (pendingPortfolio.current?.id === id) pendingPortfolio.current = null;
    }
  }

  function resetPortfolio(nextMode: DataMode = mode) {
    positionRequest.current++;
    pendingPortfolio.current = null;
    selectionRequest.current++;
    marketRequest.current++;
    bookRequest.current++;
    setProfile(null);
    setProfileState("idle");
    setProfileError(null);
    setAccountInput("");
    setAccountAddress(null);
    setResolvedInput(null);
    setPositions(nextMode === "example" ? examplePositions : []);
    setPositionState(nextMode === "example" ? "ready" : "idle");
    setPositionError(null);
    setPositionHasMore(false);
    setSelectedPosition(null);
    setPositionSelectionState("idle");
    setMarkets(nextMode === "example" ? exampleMarkets : []);
    setMarketState(nextMode === "example" ? "ready" : "idle");
    setMarketError(null);
    setSelectedId(null);
    setOutcomeIndex(0);
    setBook(null);
    setBookState("idle");
    setBookError(null);
    setShares("");
    setFloorPrice("");
    setOrderType("FAK");
    setAvailableShares(null);
    setSearch("");
    setQuery("");
    setDiscoveryRequested(false);
    setReviewOpen(false);
    reviewed.current = null;
  }
  async function selectPosition(position: Position): Promise<boolean> {
    if (busy.current) return false;
    const selection = ++selectionRequest.current,
      requestMode = mode;
    marketRequest.current++;
    setPositionError(null);
    setPositionSelectionState("loading");
    if (position.redeemable) {
      setPositionError(
        "This position is ready to redeem on Polymarket. It does not need an open-market exit.",
      );
      setPositionSelectionState("error");
      return false;
    }
    let market = markets.find((m) => m.conditionId === position.conditionId);
    if (!market && mode === "live") {
      try {
        const d = await get<{ markets: Market[] }>(
          `/api/markets?conditionId=${position.conditionId}`,
        );
        if (selection !== selectionRequest.current || requestMode !== identityRef.current.mode)
          return false;
        market = d.markets[0];
        if (market) setMarkets((ms) => [market!, ...ms.filter((m) => m.id !== market!.id)]);
      } catch (e) {
        if (selection === selectionRequest.current && requestMode === identityRef.current.mode) {
          setPositionError(message(e));
          setPositionSelectionState("error");
        }
        return false;
      }
    }
    if (!market) {
      setPositionError("This position’s market is unavailable. Try another position or retry.");
      setPositionSelectionState("error");
      return false;
    }
    const index = market.outcomes.findIndex((o) => o.tokenId === position.tokenId);
    if (index < 0) {
      setPositionError(
        "The position could not be matched to its market. Refresh the positions and try again.",
      );
      setPositionSelectionState("error");
      return false;
    }
    setSelectedId(market.id);
    setOutcomeIndex(index);
    setSelectedPosition(position);
    setPositionSelectionState("ready");
    setMarketState("ready");
    setFloorPrice("");
    setShares(new Decimal(position.size).toDecimalPlaces(2, Decimal.ROUND_DOWN).toFixed());
    setReviewOpen(false);
    return true;
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
        if (key !== contextRef.current) throw new Error("Account or market changed. Review again.");
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
        throw new Error("Could not refresh this market. Close review and try again.");
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
      setReviewError("This review has expired or changed. Close it and review a fresh quote.");
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
          throw new Error("Order history could not be saved. No order was submitted.");
        if (mode === "example") {
          await writeOrders((prev) =>
            prev.map((o) =>
              o.id === id
                ? {
                    ...o,
                    matchedShares: r!.quote.filledShares,
                    settledShares: r!.quote.filledShares,
                    netReceipt: r!.quote.netReceipt,
                    status: r!.quote.status === "partial" ? "partial" : "settled",
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
            session.accountAddress.toLowerCase() !== accountAddress?.toLowerCase() ||
            session.signerAddress.toLowerCase() !== wallet.address?.toLowerCase() ||
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
            throw new Error(`Polymarket rejected this order: ${response.message}`);
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
          setReviewError("Another tab is handling this account. Wait and refresh Activity.");
          return;
        }
        try {
          const saved = decodeOrderHistory(localStorage.getItem(STORAGE));
          if (
            saved.some(
              (o) =>
                o.accountAddress?.toLowerCase() === accountAddress?.toLowerCase() &&
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
          setReviewError("Could not verify saved order history. No new submission was authorized.");
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
          o.mode === "live" && o.accountAddress?.toLowerCase() === accountAddress?.toLowerCase(),
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
      writeOrders((prev) => prev.map((o) => (o.id === id ? reconcileOrder(o, remote, trades) : o)));
      setToast("Cancellation requested. Activity shows the venue’s current state.");
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
      if (stopped || running || busy.current || !session || document.visibilityState !== "visible")
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
    if (positionSelectionState === "loading") setPositionSelectionState("idle");
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
        resetPortfolio(m);
        setMode(m);
        setWalletError(null);
      }),
    markets,
    marketState,
    marketError,
    search,
    onSearchChange: setSearch,
    onSearch: () =>
      edit(() => {
        setDiscoveryRequested(true);
        setQuery(search.trim());
        setSearchRevision((n) => n + 1);
      }),
    selectedMarket,
    onSelectMarket: (id) =>
      edit(() => {
        setSelectedId(id);
        setSelectedPosition(null);
        setShares("");
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
        pendingPortfolio.current = null;
        setPositions([]);
        setAccountAddress(null);
        setResolvedInput(null);
        setAvailableShares(null);
        setProfile(null);
        setProfileState("idle");
        setProfileError(null);
        setPositionState("idle");
        setPositionError(null);
        setPositionHasMore(false);
        setSelectedPosition(null);
        setPositionSelectionState("idle");
        setSelectedId(null);
        setShares("");
        setFloorPrice("");
      }),
    onLoadPositions: () => loadPortfolio("manual"),
    onLoadConnectedPositions: () => loadPortfolio("wallet"),
    onResetPortfolio: () => edit(() => resetPortfolio()),
    recentProfile,
    onResumeRecentProfile: () =>
      recentProfile
        ? loadPortfolio("manual", recentProfile.accountAddress)
        : Promise.resolve(false),
    onForgetRecentProfile: () => {
      setRecentProfile(null);
      try {
        localStorage.removeItem(RECENT_PROFILE_KEY);
      } catch {
        /* Preference storage is optional. */
      }
    },
    profile,
    profileState,
    profileError,
    positions,
    positionState,
    positionError,
    positionHasMore,
    selectedPosition,
    positionSelectionState,
    onSelectPosition: selectPosition,
    walletStatus: wallet.status,
    signerAddress: wallet.address,
    accountAddress,
    walletError: walletError ?? wallet.error,
    onConnect: () => void wallet.connect().catch((e) => setWalletError(message(e))),
    onDisconnect: () => edit(() => wallet.disconnect()),
    connectLabel: wallet.connectLabel,
    availableShares: mode === "example" ? (selectedPosition?.size ?? null) : availableShares,
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
