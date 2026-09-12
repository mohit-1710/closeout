import type { Metadata } from "next";
import { TradingWorkspace } from "@/components/trading-workspace";
export const metadata: Metadata = {
  title: "Exit planner",
  description: "Inspect live prediction-market liquidity and build your exit plan.",
  robots: { index: false, follow: true },
};
export default async function AppPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string | string[] }>;
}) {
  const params = await searchParams;
  return (
    <TradingWorkspace
      key={params.mode === "example" ? "example" : "live"}
      initialMode={params.mode === "example" ? "example" : "live"}
    />
  );
}
