import { WalletProvider } from "@/components/wallet-provider";
export default function TradingLayout({ children }: { children: React.ReactNode }) {
  return <WalletProvider>{children}</WalletProvider>;
}
