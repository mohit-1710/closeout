"use client";
import { ExitWorkspace } from "@/components/exit-workspace";
import { useExitWorkspace } from "@/hooks/use-exit-workspace";
export default function Home() {
  return <ExitWorkspace workspace={useExitWorkspace()} />;
}
