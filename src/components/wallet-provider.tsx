"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { PrivyProvider, useConnectWallet, usePrivy, useWallets } from "@privy-io/react-auth";
import { getAddress, isAddress, type EIP1193Provider } from "viem";
import { polygon } from "viem/chains";

export interface TradingWalletContext {
  status: "disconnected" | "connecting" | "connected";
  address: string | null;
  error: string | null;
  connectLabel: string;
  connect(): Promise<void>;
  disconnect(): void;
  getProvider(): Promise<EIP1193Provider>;
}
type EventProvider = EIP1193Provider & {
  on?: (event: string, listener: (value: unknown) => void) => void;
  removeListener?: (event: string, listener: (value: unknown) => void) => void;
};
type WalletState = Pick<TradingWalletContext, "status" | "address" | "error">;
const WalletContext = createContext<TradingWalletContext | null>(null);
const disconnected: WalletState = {
  status: "disconnected",
  address: null,
  error: null,
};

function errorMessage(error: unknown) {
  if (error && typeof error === "object" && "code" in error && error.code === 4001)
    return "Wallet request canceled. No trade was submitted.";
  return error instanceof Error ? error.message : "Could not connect the wallet. Please try again.";
}

async function ensurePolygon(provider: EIP1193Provider) {
  const chain = await provider.request({ method: "eth_chainId" });
  if (BigInt(chain) === 137n) return;
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x89" }],
    });
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === 4902))
      throw error;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: "0x89",
          chainName: "Polygon",
          nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
          rpcUrls: ["https://polygon-rpc.com"],
          blockExplorerUrls: ["https://polygonscan.com"],
        },
      ],
    });
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x89" }],
    });
  }
}

function useWalletConnection() {
  const [state, setState] = useState<WalletState>(disconnected);
  const providerRef = useRef<EventProvider | null>(null);
  const addressRef = useRef<string | null>(null);
  const generation = useRef(0);
  const cleanupRef = useRef<(() => void) | null>(null);
  const disconnect = useCallback((message: string | null = null) => {
    generation.current += 1;
    cleanupRef.current?.();
    cleanupRef.current = null;
    providerRef.current = null;
    addressRef.current = null;
    setState({ ...disconnected, error: message });
  }, []);
  useEffect(
    () => () => {
      generation.current += 1;
      cleanupRef.current?.();
    },
    [],
  );
  const start = useCallback(() => {
    disconnect();
    setState({ status: "connecting", address: null, error: null });
    return generation.current;
  }, [disconnect]);
  const fail = useCallback(
    (error: unknown, attempt: number) => {
      if (attempt === generation.current) disconnect(errorMessage(error));
    },
    [disconnect],
  );
  const adopt = useCallback(
    async (provider: EIP1193Provider, attempt: number) => {
      await ensurePolygon(provider);
      const addresses = await provider.request({ method: "eth_accounts" });
      const first = addresses[0];
      if (!first || !isAddress(first))
        throw new Error("The wallet did not provide an Ethereum account.");
      const chain = await provider.request({ method: "eth_chainId" });
      if (BigInt(chain) !== 137n) throw new Error("Switch this wallet to Polygon to continue.");
      if (attempt !== generation.current) throw new Error("Connection was canceled.");
      const selected = getAddress(first);
      const events = provider as EventProvider;
      const invalidate = () =>
        disconnect("Wallet account or network changed. Reconnect to review the correct account.");
      for (const event of ["accountsChanged", "chainChanged", "disconnect"])
        events.on?.(event, invalidate);
      cleanupRef.current = () => {
        for (const event of ["accountsChanged", "chainChanged", "disconnect"])
          events.removeListener?.(event, invalidate);
      };
      providerRef.current = events;
      addressRef.current = selected;
      setState({ status: "connected", address: selected, error: null });
    },
    [disconnect],
  );
  const getProvider = useCallback(async () => {
    const provider = providerRef.current;
    const address = addressRef.current;
    if (!provider || !address) throw new Error("Connect your wallet first.");
    try {
      const [addresses, chain] = await Promise.all([
        provider.request({ method: "eth_accounts" }),
        provider.request({ method: "eth_chainId" }),
      ]);
      if (
        provider !== providerRef.current ||
        !addresses[0] ||
        addresses[0].toLowerCase() !== address.toLowerCase() ||
        BigInt(chain) !== 137n
      ) {
        throw new Error("Wallet connection changed. Reconnect before trading.");
      }
      return provider;
    } catch (error) {
      disconnect(errorMessage(error));
      throw error;
    }
  }, [disconnect]);
  return { state, start, fail, adopt, disconnect, getProvider };
}

function InjectedWalletProvider({ children }: { children: ReactNode }) {
  const connection = useWalletConnection();
  const connect = useCallback(async () => {
    const attempt = connection.start();
    try {
      const provider = (window as Window & { ethereum?: EIP1193Provider }).ethereum;
      if (!provider)
        throw new Error(
          "Install an Ethereum wallet such as Rabby or MetaMask, then reload this page.",
        );
      await provider.request({ method: "eth_requestAccounts" });
      await connection.adopt(provider, attempt);
    } catch (error) {
      connection.fail(error, attempt);
    }
  }, [connection.start, connection.adopt, connection.fail]);
  const disconnect = useCallback(() => connection.disconnect(), [connection.disconnect]);
  const value = useMemo(
    () => ({
      ...connection.state,
      connectLabel: "Connect wallet",
      connect,
      disconnect,
      getProvider: connection.getProvider,
    }),
    [connection.state, connect, disconnect, connection.getProvider],
  );
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

function PrivyWalletConnection({ children }: { children: ReactNode }) {
  const connection = useWalletConnection();
  const { ready } = usePrivy();
  const { wallets } = useWallets();
  const observedWallet = useRef<string | null>(null);
  const pending = useRef<{
    attempt: number;
    resolve: () => void;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const finish = useCallback(() => {
    const current = pending.current;
    if (current) {
      clearTimeout(current.timer);
      pending.current = null;
      current.resolve();
    }
  }, []);
  const { connectWallet } = useConnectWallet({
    onSuccess: async ({ wallet }) => {
      const current = pending.current;
      if (!current) return;
      try {
        if (!("getEthereumProvider" in wallet))
          throw new Error("Choose an Ethereum wallet that owns your Polymarket account.");
        const provider = await wallet.getEthereumProvider();
        await connection.adopt(provider as unknown as EIP1193Provider, current.attempt);
      } catch (error) {
        connection.fail(error, current.attempt);
      } finally {
        finish();
      }
    },
    onError: (error) => {
      const current = pending.current;
      if (current)
        connection.fail(
          new Error(`Wallet connection was not completed (${error}).`),
          current.attempt,
        );
      finish();
    },
  });
  const disconnect = useCallback(() => {
    finish();
    observedWallet.current = null;
    connection.disconnect();
  }, [finish, connection.disconnect]);
  useEffect(() => () => finish(), [finish]);
  useEffect(() => {
    const address = connection.state.address?.toLowerCase();
    if (connection.state.status !== "connected" || !address) {
      observedWallet.current = null;
      return;
    }
    if (wallets.some((wallet) => wallet.address.toLowerCase() === address)) {
      observedWallet.current = address;
    } else if (observedWallet.current === address) {
      // A connect callback can precede useWallets' update. Only treat a removal
      // as disconnection after this wallet has appeared in the connected list.
      observedWallet.current = null;
      connection.disconnect("Wallet disconnected. Reconnect before trading.");
    }
  }, [wallets, connection.state.status, connection.state.address, connection.disconnect]);
  const connect = useCallback(async () => {
    if (pending.current) return;
    const attempt = connection.start();
    if (!ready) {
      connection.fail(
        new Error("Wallet connection is still loading. Try again in a moment."),
        attempt,
      );
      return;
    }
    return new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        connection.fail(new Error("Wallet connection expired. Please reconnect."), attempt);
        finish();
      }, 120_000);
      pending.current = { attempt, resolve, timer };
      try {
        connectWallet({ walletChainType: "ethereum-only" });
      } catch (error) {
        connection.fail(error, attempt);
        finish();
      }
    });
  }, [connection.start, connection.fail, ready, finish, connectWallet]);
  const value = useMemo(
    () => ({
      ...connection.state,
      connectLabel: "Connect wallet",
      connect,
      disconnect,
      getProvider: connection.getProvider,
    }),
    [connection.state, connect, disconnect, connection.getProvider],
  );
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID?.trim();
  if (!appId) return <InjectedWalletProvider>{children}</InjectedWalletProvider>;
  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["wallet"],
        defaultChain: polygon,
        supportedChains: [polygon],
        appearance: { walletChainType: "ethereum-only" },
        embeddedWallets: { ethereum: { createOnLogin: "off" } },
      }}
    >
      <PrivyWalletConnection>{children}</PrivyWalletConnection>
    </PrivyProvider>
  );
}

export function useTradingWallet(): TradingWalletContext {
  const context = useContext(WalletContext);
  if (!context) throw new Error("useTradingWallet must be used inside WalletProvider.");
  return context;
}
