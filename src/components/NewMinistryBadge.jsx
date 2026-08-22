import { Sparkles } from "lucide-react";
import { NEW_MINISTRIES } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * Renders a small "New" badge if the given ministry was newly added
 * to the official SIH 2026 Problem Statements.
 * Pass inline={true} for a compact inline chip.
 */
export function NewMinistryBadge({ ministry, inline = false, className }) {
  if (!ministry || !NEW_MINISTRIES.has(ministry)) return null;

  if (inline) {
    return (
      <span
        title="This ministry was newly added to the official SIH 2026 Problem Statements"
        className={cn(
          "inline-flex items-center gap-1 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 shrink-0",
          className
        )}
      >
        <Sparkles className="size-2.5 shrink-0" />
        New
      </span>
    );
  }

  return (
    <span
      title="This ministry was newly added to the official SIH 2026 Problem Statements"
      className={cn(
        "inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
        className
      )}
    >
      <Sparkles className="size-3 shrink-0" />
      New
    </span>
  );
}
