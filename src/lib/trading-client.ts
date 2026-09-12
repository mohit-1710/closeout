"use client";

import Decimal from "decimal.js";
import {
  OrderSide,
  OrderType,
  SignerType,
  createSecureClient,
  production,
  type ClobTrade,
  type OpenOrder,
  type OrderResponse,
  type CancelOrdersResponse,
} from "@polymarket/client";
import { AssetType } from "@polymarket/bindings/clob";
import { fetchBalanceAllowance } from "@polymarket/client/actions";
import { signerFrom } from "@polymarket/client/viem";
import {
  createWalletClient,
  custom,
  formatUnits,
  getAddress,
  isAddress,
  type EIP1193Provider,
} from "viem";
import { polygon } from "viem/chains";

export type GeoResult = {
  status: "allowed" | "blocked" | "unknown";
  detail: string;
};
export type ExitRequest = {
  tokenId: string;
  shares: string;
  floorPrice: string;
  orderType: "FAK" | "FOK";
};
export type TradingBalances = {
  available: string;
  collateral: string;
  held: string;
  reserved: string;
  approvalsReady: boolean;
};
export interface TradingSession {
  signerAddress: string;
  accountAddress: string;
  readBalances(tokenId: string): Promise<TradingBalances>;
  placeExit(request: ExitRequest): Promise<OrderResponse>;
  getOrder(id: string): Promise<OpenOrder>;
  cancelOrder(id: string): Promise<CancelOrdersResponse>;
  getTradesForOrder(id: string): Promise<ClobTrade[]>;
  dispose(): void;
}

type EventProvider = EIP1193Provider & {
  on?: (event: string, listener: (value: unknown) => void) => void;
  removeListener?: (event: string, listener: (value: unknown) => void) => void;
};

/** A POST may have reached the venue. This must not trigger an automatic retry. */
export class SubmissionUncertainError extends Error {
  readonly submissionUncertain = true;
  constructor(cause: unknown) {
    super(
      "The venue did not confirm this submission. Check your Polymarket orders before trying another exit.",
      { cause },
    );
    this.name = "SubmissionUncertainError";
  }
}

/** Must run in the user's browser: a server's IP is not the user's location. */
export async function checkGeo(): Promise<GeoResult> {
  if (typeof window === "undefined")
    return {
      status: "unknown",
      detail: "Check eligibility from your browser before trading.",
    };
  try {
    const response = await fetch("https://polymarket.com/api/geoblock", {
      cache: "no-store",
      credentials: "omit",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("Eligibility service unavailable");
    const data: unknown = await response.json();
    if (
      !data ||
      typeof data !== "object" ||
      !("blocked" in data) ||
      typeof data.blocked !== "boolean" ||
      !("country" in data) ||
      typeof data.country !== "string" ||
      !/^[A-Z]{2}$/.test(data.country)
    ) {
      throw new Error("Incomplete eligibility response");
    }
    return data.blocked
      ? {
          status: "blocked",
          detail:
            "Polymarket reports a trading restriction for your location. Closeout will not submit orders.",
        }
      : {
          status: "allowed",
          detail: "The venue location check passed. Account and market restrictions still apply.",
        };
  } catch {
    return {
      status: "unknown",
      detail:
        "Could not verify venue eligibility. Public previews remain available; trading is disabled.",
    };
  }
}

function decimal(value: string, label: string): Decimal {
  if (!/^\d+(?:\.\d+)?$/.test(value)) throw new Error(`${label} must be a positive decimal.`);
  const number = new Decimal(value);
  if (!number.isFinite() || number.lte(0)) throw new Error(`${label} must be greater than zero.`);
  return number;
}

function assetId(value: string): string {
  if (!/^(?:\d+|0x[0-9a-fA-F]{64})$/.test(value))
    throw new Error("Invalid outcome token identifier.");
  if (BigInt(value) < 0n || BigInt(value) >= 1n << 256n)
    throw new Error("Outcome token identifier exceeds uint256.");
  return value;
}

/** Mirrors the pinned SDK's protocol.ts namespace check and orders/context.ts selector.
 * Gamma protocol v1 uses the standard/neg-risk exchange (EIP-712 v2); protocol
 * v2 position IDs use exchangeV3. These version numbers are not interchangeable.
 * `contracts` is runtime config omitted from public declarations: validate it and
 * fail closed on SDK changes instead of retaining a stale fallback address.
 */
export function resolveExitExchange(tokenId: string, negRisk: boolean): string {
  const token = BigInt(assetId(tokenId));
  const reservedBits = ((1n << 64n) - 1n) << 40n;
  const key =
    (token & reservedBits) === 0n ? "exchangeV3" : negRisk ? "negRiskExchange" : "standardExchange";
  const contracts: unknown = Reflect.get(production, "contracts");
  const exchange: unknown =
    contracts && typeof contracts === "object" ? Reflect.get(contracts, key) : undefined;
  if (typeof exchange !== "string" || !isAddress(exchange))
    throw new Error("Could not verify the exchange for this market. Trading is disabled.");
  return getAddress(exchange);
}

/** Invoke only from an explicit authenticate/review action: authentication requests a signature. */
export async function createTradingSession(
  provider: EIP1193Provider,
  signerAddress: string,
  accountAddress: string,
): Promise<TradingSession> {
  if (!isAddress(signerAddress) || !isAddress(accountAddress))
    throw new Error("Enter valid signer and Polymarket account addresses.");
  const signer = getAddress(signerAddress);
  const account = getAddress(accountAddress);
  const eventProvider = provider as EventProvider;
  let invalid = false;
  let submitting = false;
  let uncertain = false;
  const invalidate = () => {
    invalid = true;
  };
  for (const event of ["accountsChanged", "chainChanged", "disconnect"])
    eventProvider.on?.(event, invalidate);
  const removeListeners = () => {
    for (const event of ["accountsChanged", "chainChanged", "disconnect"])
      eventProvider.removeListener?.(event, invalidate);
  };
  async function assertSession() {
    if (invalid)
      throw new Error("Wallet connection changed. Reconnect and review your exit again.");
    const [accounts, chain] = await Promise.all([
      provider.request({ method: "eth_accounts" }),
      provider.request({ method: "eth_chainId" }),
    ]);
    if (
      invalid ||
      !accounts[0] ||
      accounts[0].toLowerCase() !== signer.toLowerCase() ||
      BigInt(chain) !== 137n
    ) {
      invalid = true;
      throw new Error("Use the connected account on Polygon, then reconnect to Closeout.");
    }
  }
  try {
    await assertSession();
    // Avoid createSecureClient's implicit new-wallet deployment path.
    if (account !== signer) {
      const code = await provider.request({
        method: "eth_getCode",
        params: [account, "latest"],
      });
      if (!code || code === "0x" || /^0x0+$/.test(code))
        throw new Error(
          "This account wallet is not deployed. Use your existing funded Polymarket account.",
        );
    }
    const walletClient = createWalletClient({
      account: signer,
      chain: polygon,
      transport: custom(provider),
    });
    const adapter = signerFrom(walletClient);
    const client = await createSecureClient({
      wallet: account,
      signer: {
        getAddress: async () => {
          await assertSession();
          return adapter.getAddress();
        },
        signTypedData: async (payload) => {
          await assertSession();
          return adapter.signTypedData(payload);
        },
        signMessage: async (payload) => {
          await assertSession();
          return adapter.signMessage(payload);
        },
        // Closeout neither deploys wallets nor silently changes approvals.
        sendTransaction: async () => {
          throw new Error("Set up this account and its trading approvals on Polymarket first.");
        },
      },
    });
    await assertSession();
    // The SDK defaults unrecognized signer/wallet mappings to SESSION_KEY. Never accept that guess here.
    if (
      client.account.signerType !== SignerType.OWNER ||
      client.account.wallet.toLowerCase() !== account.toLowerCase() ||
      client.account.signer.toLowerCase() !== signer.toLowerCase()
    ) {
      throw new Error(
        "The connected wallet is not the owner of this Polymarket account. Session-key accounts are not supported in Closeout.",
      );
    }

    async function ownedOrder(id: string) {
      await assertSession();
      const order = await client.fetchOrder({ orderId: id });
      if (order.makerAddress.toLowerCase() !== account.toLowerCase())
        throw new Error("This order belongs to a different account.");
      return order;
    }

    async function readBalances(tokenId: string): Promise<TradingBalances> {
      await assertSession();
      const token = assetId(tokenId);
      const [position, collateral, book] = await Promise.all([
        fetchBalanceAllowance(client, {
          assetType: AssetType.CONDITIONAL,
          assetId: token,
        }),
        fetchBalanceAllowance(client, { assetType: AssetType.COLLATERAL }),
        client.fetchOrderBook({ assetId: token }),
      ]);
      let reserved = new Decimal(0);
      let pages = 0;
      for await (const page of client.listOpenOrders({ assetId: token })) {
        if (++pages > 50)
          throw new Error(
            "Too many open orders to verify available shares. Review them on Polymarket first.",
          );
        for (const order of page.items) {
          if (
            order.makerAddress.toLowerCase() === account.toLowerCase() &&
            order.side.toUpperCase() === "SELL"
          ) {
            reserved = reserved.add(
              Decimal.max(0, new Decimal(order.originalSize).sub(order.sizeMatched)),
            );
          }
        }
      }
      // SDK balance is raw six-decimal base units; open-order sizes are human units.
      const held = new Decimal(formatUnits(BigInt(position.balance), 6));
      const exchange = resolveExitExchange(token, book.negRisk).toLowerCase();
      const allowance = Object.entries(position.allowances).find(
        ([address]) => address.toLowerCase() === exchange,
      )?.[1];
      await assertSession();
      return {
        available: Decimal.max(0, held.sub(reserved)).toFixed(),
        collateral: formatUnits(BigInt(collateral.balance), 6),
        held: held.toFixed(),
        reserved: reserved.toFixed(),
        approvalsReady: allowance !== undefined && BigInt(allowance) > 0n,
      };
    }

    return {
      signerAddress: signer,
      accountAddress: account,
      readBalances,
      async placeExit(request) {
        if (submitting) throw new Error("An exit submission is already in progress.");
        if (uncertain)
          throw new SubmissionUncertainError("A previous submission has not been reconciled.");
        submitting = true;
        try {
          await assertSession();
          const geo = await checkGeo();
          if (geo.status !== "allowed") throw new Error(geo.detail);
          const token = assetId(request.tokenId);
          const shares = decimal(request.shares, "Shares");
          const floor = decimal(request.floorPrice, "Minimum price");
          if (floor.gte(1)) throw new Error("The minimum price must be below 1 pUSD per share.");
          if (shares.decimalPlaces() > 2)
            throw new Error("Use at most two decimal places for share quantity.");
          if (request.orderType !== "FAK" && request.orderType !== "FOK")
            throw new Error("Choose FAK or FOK execution.");
          const [balances, book] = await Promise.all([
            readBalances(token),
            client.fetchOrderBook({ assetId: token }),
          ]);
          if (!balances.approvalsReady)
            throw new Error(
              "Outcome-token trading approval is missing. Set it up on Polymarket first.",
            );
          if (shares.gt(balances.available))
            throw new Error("The requested exit exceeds unreserved shares in this account.");
          if (shares.lt(book.minOrderSize))
            throw new Error(`This market requires at least ${book.minOrderSize} shares per order.`);
          if (!floor.mod(new Decimal(String(book.tickSize))).eq(0))
            throw new Error(`Use a minimum price in increments of ${book.tickSize}.`);
          const signed = await client.createMarketOrder({
            assetId: token,
            side: OrderSide.SELL,
            shares: shares.toFixed(),
            minPrice: floor.toFixed(),
            orderType: request.orderType === "FOK" ? OrderType.FOK : OrderType.FAK,
          });
          // A chain/account change while the signature prompt was open invalidates the order.
          await assertSession();
          try {
            // No automatic allowance recovery, no retry, and no matched=>settled conversion.
            return await client.postOrder(signed);
          } catch (error) {
            uncertain = true;
            throw new SubmissionUncertainError(error);
          }
        } finally {
          submitting = false;
        }
      },
      getOrder: ownedOrder,
      async cancelOrder(id) {
        await ownedOrder(id);
        await assertSession();
        return client.cancelOrder({ orderId: id });
      },
      async getTradesForOrder(id) {
        const order = await ownedOrder(id);
        const trades: ClobTrade[] = [];
        let pages = 0;
        for await (const page of client.listAccountTrades({
          assetId: order.assetId,
        })) {
          if (++pages > 50)
            throw new Error("Trade reconciliation is incomplete. Check the order on Polymarket.");
          for (const trade of page.items) {
            if (
              trade.takerOrderId === id ||
              trade.makerOrders.some((maker) => maker.orderId === id)
            )
              trades.push(trade);
          }
        }
        await assertSession();
        return trades;
      },
      dispose() {
        invalid = true;
        removeListeners();
        void client.closeSubscriptions().catch(() => undefined);
        // No storage and no credential revocation that could disrupt another app's session.
      },
    };
  } catch (error) {
    invalid = true;
    removeListeners();
    throw error;
  }
}
