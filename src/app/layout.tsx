import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "@/components/wallet-provider";
export const metadata: Metadata = {
  title: "Closeout — Know your exit",
  description:
    "Plan a prediction-market exit against live liquidity. See estimated proceeds, set your price floor, and track actual order settlement.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
