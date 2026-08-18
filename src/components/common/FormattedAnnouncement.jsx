import { useMemo } from "react";
import { cn } from "@/lib/utils";

export function FormattedAnnouncement({ content, className }) {
  const parsed = useMemo(() => {
    if (!content) return { title: "", lines: [] };

    // Clean emojis and leading/trailing whitespace per line
    const rawLines = content
      .split("\n")
      .map((line) => line.replace(/\p{Extended_Pictographic}/gu, "").trim())
      .filter((line) => line.length > 0);

    if (rawLines.length === 0) return { title: "", lines: [] };

    // Check if the first line is a title/header line
    let title = "";
    let lines = [...rawLines];

    const firstLineLower = lines[0].toLowerCase();
    if (
      firstLineLower.includes("attention") ||
      firstLineLower.includes("update") ||
      firstLineLower.includes("announcement") ||
      firstLineLower.includes("important") ||
      lines[0].endsWith(":")
    ) {
      title = lines.shift().replace(/:$/, "");
    }

    return { title, lines };
  }, [content]);

  if (!content) return null;

  return (
    <div className={cn("space-y-3 pt-0.5", className)}>
      {parsed.title && (
        <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight border-b border-[#c9a227]/25 pb-2">
          {parsed.title}
        </h3>
      )}

      <div className="space-y-3">
        {parsed.lines.map((line, idx) => {
          const lower = line.toLowerCase();

          // Highlight status/alert lines (e.g. CLOSED, OPEN, URGENT)
          if (
            lower.includes("closed") ||
            lower.includes("opened") ||
            lower.includes("urgent") ||
            lower.includes("deadline")
          ) {
            return (
              <div
                key={idx}
                className="inline-flex items-center gap-2.5 rounded-xl bg-[#c9a227]/15 border border-[#c9a227]/35 px-4 py-2 text-xs sm:text-sm font-bold text-[#e8c058] shadow-sm"
              >
                <span className="size-2 rounded-full bg-[#e8c058] animate-pulse" />
                <span>{line}</span>
              </div>
            );
          }

          // Format structured labels like "Next Step:", "Note:", "Action Required:"
          if (line.includes(":") && (lower.startsWith("next step") || lower.startsWith("note") || lower.startsWith("action") || lower.startsWith("important"))) {
            const colonIndex = line.indexOf(":");
            const label = line.substring(0, colonIndex).trim();
            const body = line.substring(colonIndex + 1).trim();

            return (
              <div
                key={idx}
                className="rounded-2xl border border-border/40 bg-[#0c121e]/90 p-3.5 text-xs sm:text-sm space-y-1 shadow-sm"
              >
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#c9a227] block">
                  {label}
                </span>
                <p className="text-white/95 font-medium leading-relaxed">
                  {body}
                </p>
              </div>
            );
          }

          // Format footer notices ("Please keep an eye...", "For queries...")
          if (lower.startsWith("please") || lower.includes("keep an eye") || lower.includes("further instructions")) {
            return (
              <div
                key={idx}
                className="pt-2 border-t border-border/20 text-xs text-muted-foreground italic font-medium"
              >
                {line}
              </div>
            );
          }

          // Default body text line
          return (
            <p key={idx} className="text-xs sm:text-sm text-white/90 leading-relaxed font-medium">
              {line}
            </p>
          );
        })}
      </div>
    </div>
  );
}
