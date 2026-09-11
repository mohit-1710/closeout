import type { Market, OrderBook, Position } from "./types";
// Deliberately fictional. Never substituted for a failed live response.
export const exampleMarkets: Market[] = [
  {
    id: "example-launch",
    conditionId: "example-condition-launch",
    question: "Will the Atlas mission launch before the end of the month?",
    slug: "",
    category: "Example · Space",
    volume24h: 0,
    liquidity: 0,
    endDate: null,
    active: true,
    acceptingOrders: true,
    outcomes: [
      { label: "Yes", tokenId: "example-yes", price: "0.62" },
      { label: "No", tokenId: "example-no", price: "0.38" },
    ],
  },
  {
    id: "example-energy",
    conditionId: "example-condition-energy",
    question: "Will clean energy supply exceed 40% this quarter?",
    slug: "",
    category: "Example · Energy",
    volume24h: 0,
    liquidity: 0,
    endDate: null,
    active: true,
    acceptingOrders: true,
    outcomes: [
      { label: "Yes", tokenId: "example-energy-yes", price: "0.44" },
      { label: "No", tokenId: "example-energy-no", price: "0.56" },
    ],
  },
];
export function exampleBook(tokenId: string, now = Date.now()): OrderBook {
  const yes = tokenId === "example-yes",
    no = tokenId === "example-no",
    base = yes ? 62 : no ? 38 : tokenId.endsWith("yes") ? 44 : 56;
  const prices = [0, 1, 2, 4, 6, 9, 12, 16, 20];
  const sizes = ["30", "45", "65", "90", "110", "145", "180", "210", "280"];
  return {
    tokenId,
    acceptingOrders: true,
    bids: prices.map((d, i) => ({
      price: ((base - d) / 100).toFixed(2),
      size: sizes[i],
    })),
    asks: [
      { price: ((base + 1) / 100).toFixed(2), size: "100" },
      { price: ((base + 3) / 100).toFixed(2), size: "175" },
    ],
    tickSize: "0.01",
    minOrderSize: "5",
    timestampMs: now,
    fetchedAt: now,
    hash: "fictional-example",
    fee: { kind: "known", rate: "0.05", exponent: 1, roundingDecimals: 5 },
  };
}
export const examplePositions: Position[] = [
  {
    tokenId: "example-yes",
    conditionId: "example-condition-launch",
    title: exampleMarkets[0].question,
    outcome: "Yes",
    size: "250",
    currentPrice: "0.62",
    value: "155",
    slug: "",
    redeemable: false,
  },
];
