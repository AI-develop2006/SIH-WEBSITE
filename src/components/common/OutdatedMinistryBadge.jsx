import { AlertTriangle } from "lucide-react";
import { OUTDATED_MINISTRIES } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * Renders a small "Outdated" warning badge if the given ministry
 * is not present in the official SIH 2026 Problem Statements.
 * Pass inline={true} to render it as a compact inline chip.
 */
export function OutdatedMinistryBadge({ ministry, inline = false, className }) {
  if (!ministry || !OUTDATED_MINISTRIES.has(ministry)) return null;

  if (inline) {
    return (
      <span
        title="This ministry is not listed in the official SIH 2026 Problem Statements"
        className={cn(
          "inline-flex items-center gap-1 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full border border-amber-500/40 bg-amber-500/12 text-amber-400 shrink-0",
          className
        )}
      >
        <AlertTriangle className="size-2.5 shrink-0" />
        Outdated
      </span>
    );
  }

  return (
    <span
      title="This ministry is not listed in the official SIH 2026 Problem Statements"
      className={cn(
        "inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-400",
        className
      )}
    >
      <AlertTriangle className="size-3 shrink-0" />
      Outdated
    </span>
  );
}
