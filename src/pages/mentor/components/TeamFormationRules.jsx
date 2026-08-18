import { useState } from "react";
import { cn } from "@/lib/utils";

export function TeamFormationRules({ className, compact = false }) {
  const [isExpanded, setIsExpanded] = useState(!compact);

  const rules = [
    {
      num: "01",
      title: "2-Member Team Structure",
      highlight: "Exactly 2 Members",
      desc: "Every formed team must consist of exactly 2 members from the same department.",
    },
    {
      num: "02",
      title: "Full Ministry Coverage",
      highlight: "Cover all 37 Ministries",
      desc: "Every department should choose the problem statements from the given ministries.",
    },
    {
      num: "03",
      title: "Department Constraint",
      highlight: "Same Dept Only",
      desc: "Both members in a 2-member team must be from the exact same department.",
    },
    {
      num: "04",
      title: "Skill & Domain Diversity",
      highlight: "No Identical Skills/Domains",
      desc: "The two members in the same team must not have the same skillset or domain of interest.",
    },
    {
      num: "05",
      title: "Final Decision Authority",
      highlight: "SPOC & Mentors Only",
      desc: "The final 2-member team structure is decided exclusively by the SPOC and assigned mentors.",
      featured: true,
    },
  ];

  return (
    <div
      className={cn(
        "rounded-3xl border border-[#c9a227]/30 bg-gradient-to-b from-[#121929] to-[#0a0f18] p-5 sm:p-6 shadow-2xl transition-all duration-300",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#c9a227]/20 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-base sm:text-lg font-extrabold tracking-tight text-white">
              Team Formation & Ministry Guidelines
            </h3>
            <span className="rounded-full bg-[#c9a227]/20 border border-[#c9a227]/40 px-3 py-0.5 text-[11px] font-extrabold uppercase text-[#e8c058]">
              37 Ministries
            </span>
          </div>
          <p className="text-xs text-muted-foreground font-medium mt-1">
            Official rules for mentors and SPOCs when organizing participant pairs and teams
          </p>
        </div>

        {compact && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 text-xs font-extrabold text-[#c9a227] hover:text-[#e8c058] transition-colors bg-[#c9a227]/10 hover:bg-[#c9a227]/20 px-3.5 py-1.5 rounded-xl border border-[#c9a227]/30"
          >
            <span>{isExpanded ? "Collapse Rules" : "View All Rules (5)"}</span>
            <span className="text-xs">{isExpanded ? "▲" : "▼"}</span>
          </button>
        )}
      </div>

      {/* Structured Rules Cards Grid */}
      {isExpanded && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
          {rules.map((rule) => (
            <div
              key={rule.num}
              className={cn(
                "group relative flex flex-col justify-between rounded-2xl border p-4.5 transition-all duration-200",
                rule.featured
                  ? "sm:col-span-2 border-[#c9a227]/50 bg-gradient-to-r from-[#172136] to-[#0e1626] shadow-lg"
                  : "border-border/40 bg-[#0c121e]/90 hover:border-[#c9a227]/40 hover:bg-[#11192a]"
              )}
            >
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-black text-[#c9a227] bg-[#c9a227]/15 px-2 py-0.5 rounded-md border border-[#c9a227]/30">
                      {rule.num}
                    </span>
                    <h4 className="text-xs sm:text-sm font-extrabold text-white">
                      {rule.title}
                    </h4>
                  </div>
                  <span className="text-[10px] font-bold text-[#e8c058] bg-[#c9a227]/10 border border-[#c9a227]/25 px-2 py-0.5 rounded-full self-start sm:self-auto shrink-0">
                    {rule.highlight}
                  </span>
                </div>
                <p className="text-xs text-slate-300/90 leading-relaxed font-medium mt-2">
                  {rule.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
