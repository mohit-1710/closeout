import Decimal from "decimal.js";
import { CircleAlert, LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
export { useClientReady } from "@/hooks/use-client-ready";

export function decimal(value: string | number | null | undefined): Decimal | null {
  if (value == null || value === "") return null;
  try {
    const n = new Decimal(value);
    return n.isFinite() ? n : null;
  } catch {
    return null;
  }
}

/** Display formatting only. Order calculations stay in the shared quote engine. */
export function numberText(
  value: string | number | null | undefined,
  kind: "amount" | "money" | "price" = "amount",
) {
  const n = decimal(value);
  if (!n) return "—";
  if (n.isZero()) return kind === "money" ? "0.00" : "0";
  const rounded =
    kind === "money"
      ? n.toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      : kind === "price"
        ? n.toSignificantDigits(5, Decimal.ROUND_HALF_UP)
        : n.toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
  if (rounded.isZero())
    return `${n.isNegative() ? "−" : ""}<${kind === "money" ? "0.01" : "0.0001"}`;
  if (kind !== "money" && rounded.abs().lt("0.001")) {
    const digits = rounded.abs().toFixed().split(".")[1] ?? "";
    const zeros = digits.match(/^0*/)?.[0].length ?? 0;
    if (zeros >= 3)
      return `${rounded.isNegative() ? "−" : ""}0.0${String(zeros)
        .split("")
        .map((n) => "₀₁₂₃₄₅₆₇₈₉"[Number(n)])
        .join("")}${digits.slice(zeros, zeros + 4)}`;
  }
  const [whole, fraction] = (kind === "money" ? rounded.toFixed(2) : rounded.toFixed()).split(".");
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${fraction ? `.${fraction}` : ""}`;
}
export function Num({
  value,
  kind = "amount",
}: {
  value: string | number | null | undefined;
  kind?: "amount" | "money" | "price";
}) {
  const raw = decimal(value)?.toFixed();
  return (
    <span className="j-num" title={raw} aria-label={raw ?? "Not available"}>
      {numberText(value, kind)}
    </span>
  );
}
export function shortAddress(value: string) {
  return value.length > 16 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
}
export function editableDecimal(value: string, change: (s: string) => void) {
  if (/^\d*\.?\d*$/.test(value)) change(value);
}
export function timestamp(value: number | undefined) {
  return value && Number.isFinite(value)
    ? `${new Date(value).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "UTC" })} UTC`
    : "Not available";
}
export function Busy({ children }: { children: ReactNode }) {
  return (
    <>
      <LoaderCircle size={18} className="j-spin" aria-hidden />
      {children}
    </>
  );
}
export function Notice({
  children,
  error = false,
  title,
  action,
}: {
  children: ReactNode;
  error?: boolean;
  title?: string;
  action?: ReactNode;
}) {
  return (
    <div
      className="j-notice"
      data-tone={error ? "error" : "info"}
      role={error ? "alert" : undefined}
    >
      <CircleAlert size={18} aria-hidden />
      <div>
        {title && <strong>{title}</strong>}
        <div>{children}</div>
        {action && <div className="j-notice-action">{action}</div>}
      </div>
    </div>
  );
}
export function PositionSkeleton() {
  return (
    <div className="j-loading-list" role="status" aria-label="Loading positions">
      {[0, 1, 2].map((n) => (
        <div className="j-loading-row" key={n}>
          <span className="j-skeleton" />
          <span className="j-skeleton" />
        </div>
      ))}
    </div>
  );
}
