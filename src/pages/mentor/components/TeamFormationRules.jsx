import { useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
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
      desc: "Every department should choose problem statements across all given ministries. These 2-member pairs collectively form the final 6-member team submitted to SIH.",
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
      desc: "The final 6-member team structure submitted to SIH is decided exclusively by the SPOC and assigned mentors.",
      featured: true,
    },
  ];

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/50 bg-card/40 p-5 sm:p-6 transition-all duration-300",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/20 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-base font-bold text-white">
              Team Formation & Ministry Guidelines
            </h3>
            <span className="rounded border border-border/50 px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
              37 Ministries
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Official rules for mentors and SPOCs when organizing participant pairs and teams
          </p>
        </div>

        {compact && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-white transition-colors border border-border/40 px-3 py-1.5 rounded-lg"
          >
            <span>{isExpanded ? "Collapse" : "View Rules"}</span>
            {isExpanded
              ? <ChevronUp className="size-3.5" />
              : <ChevronDown className="size-3.5" />
            }
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {rules.map((rule) => (
            <div
              key={rule.num}
              className={cn(
                "flex flex-col rounded-xl border p-4 transition-colors",
                rule.featured
                  ? "sm:col-span-2 border-[#c9a227]/40 bg-[#c9a227]/5"
                  : "border-border/30 bg-card/30 hover:border-border/60"
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-muted-foreground bg-muted/20 px-1.5 py-0.5 rounded border border-border/30">
                    {rule.num}
                  </span>
                  <h4 className="text-xs font-bold text-white">
                    {rule.title}
                  </h4>
                </div>
                <span className="text-[10px] font-semibold text-[#c9a227] border border-[#c9a227]/30 px-2 py-0.5 rounded shrink-0">
                  {rule.highlight}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {rule.desc}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
