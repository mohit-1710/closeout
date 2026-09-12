import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
const sans = Geist({ subsets: ["latin"], variable: "--font-geist-sans", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });
const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  axes: ["SOFT", "WONK", "opsz"],
});
const description =
  "Plan your prediction-market exit before you sign. See available liquidity, estimated fees and the shares that would remain at your price floor.";
export const metadata: Metadata = {
  metadataBase: new URL("https://closeout-ashen.vercel.app"),
  title: { default: "Closeout — Know your exit. Before you sign.", template: "%s · Closeout" },
  description,
  applicationName: "Closeout",
  openGraph: {
    type: "website",
    siteName: "Closeout",
    title: "Closeout — Know your exit. Before you sign.",
    description,
    images: [
      {
        url: "/og-closeout.png",
        width: 1200,
        height: 630,
        alt: "Closeout — prediction-market exits, on your terms",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Closeout — Know your exit. Before you sign.",
    description,
    images: ["/og-closeout.png"],
  },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
