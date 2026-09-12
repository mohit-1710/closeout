export type DataMode = "live" | "example";
export type LoadState = "idle" | "loading" | "ready" | "error";
export interface Outcome {
  label: string;
  tokenId: string;
  price: string | null;
}
export interface Market {
  id: string;
  conditionId: string;
  question: string;
  slug: string;
  category: string;
  volume24h: number;
  liquidity: number;
  endDate: string | null;
  outcomes: Outcome[];
  acceptingOrders: boolean;
  active: boolean;
}
export interface BookLevel {
  price: string;
  size: string;
}
export interface OrderBook {
  acceptingOrders: boolean;
  tokenId: string;
  bids: BookLevel[];
  asks: BookLevel[];
  tickSize: string;
  minOrderSize: string;
  timestampMs: number;
  fetchedAt: number;
  hash: string;
  fee:
    | {
        kind: "known";
        rate: string;
        exponent: number;
        roundingDecimals?: number;
      }
    | { kind: "none" }
    | { kind: "unknown"; reason?: string };
}
export interface ExitQuote {
  status: "ready" | "partial" | "blocked" | "empty";
  requestedShares: string;
  filledShares: string;
  remainingShares: string;
  grossReceipt: string;
  fees: string | null;
  netReceipt: string | null;
  averagePrice: string | null;
  worstPrice: string | null;
  fillPercent: number;
  depth: {
    price: string;
    shares: string;
    cumulativeShares: string;
    receipt: string;
  }[];
  blockers: string[];
  warnings: string[];
  snapshotAt: number;
}
export interface Position {
  tokenId: string;
  conditionId: string;
  title: string;
  outcome: string;
  size: string;
  currentPrice: string;
  value: string;
  slug: string;
  redeemable: boolean;
}
export type OrderStatus =
  "open" | "matched" | "partial" | "settling" | "settled" | "cancelled" | "failed" | "unknown";
export interface TrackedOrder {
  id: string;
  market: string;
  outcome: string;
  tokenId: string;
  requestedShares: string;
  matchedShares: string;
  settledShares: string | null;
  price: string;
  netReceipt: string | null;
  status: OrderStatus;
  mode: DataMode;
  createdAt: number;
  transactionHashes: string[];
  detail: string;
  canCancel: boolean;
  accountAddress?: string;
  orderType?: string;
}
export interface WorkspaceController {
  mode: DataMode;
  onModeChange: (mode: DataMode) => void;
  markets: Market[];
  marketState: LoadState;
  marketError: string | null;
  search: string;
  onSearchChange: (s: string) => void;
  onSearch: () => void;
  selectedMarket: Market | null;
  onSelectMarket: (id: string) => void;
  outcomeIndex: number;
  onOutcomeChange: (index: number) => void;
  book: OrderBook | null;
  bookState: LoadState;
  bookError: string | null;
  onRefresh: () => void;
  shares: string;
  onSharesChange: (s: string) => void;
  floorPrice: string;
  onFloorPriceChange: (s: string) => void;
  orderType: "FAK" | "FOK";
  onOrderTypeChange: (s: "FAK" | "FOK") => void;
  quote: ExitQuote | null;
  accountInput: string;
  onAccountInputChange: (s: string) => void;
  onLoadPositions: () => void;
  positions: Position[];
  positionState: LoadState;
  positionError: string | null;
  onSelectPosition: (p: Position) => void;
  walletStatus: "disconnected" | "connecting" | "connected";
  signerAddress: string | null;
  accountAddress: string | null;
  walletError: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
  connectLabel: string;
  availableShares: string | null;
  collateralBalance: string | null;
  executionEnabled: boolean;
  executionBlockers: string[];
  geoStatus: "checking" | "allowed" | "blocked" | "unknown";
  orders: TrackedOrder[];
  orderError: string | null;
  onRefreshOrders: () => void;
  onCancelOrder: (id: string) => void;
  cancellingOrderId: string | null;
  reviewOpen: boolean;
  reviewLoading: boolean;
  submitting: boolean;
  reviewError: string | null;
  onReview: () => void;
  onCloseReview: () => void;
  onConfirm: () => void;
  toast: string | null;
  onDismissToast: () => void;
  onExport: () => void;
}
