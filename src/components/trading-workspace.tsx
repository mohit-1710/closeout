"use client";
import { ExitWorkspace } from "./exit-workspace";
import { useExitWorkspace } from "@/hooks/use-exit-workspace";
import type { DataMode } from "@/lib/types";
export function TradingWorkspace({ initialMode }: { initialMode: DataMode }) {
  return <ExitWorkspace workspace={useExitWorkspace(initialMode)} />;
}
