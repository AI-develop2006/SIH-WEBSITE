import { useState, useMemo } from "react";
import { BookOpen, Filter, Search, X, ExternalLink, Cpu, Code2, Download, Presentation, Clock, CalendarDays, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SIH2026_PROBLEMS } from "@/lib/sih2026Problems";
import { SIH2026ProblemsView } from "@/components/common/SIH2026ProblemsView";

// ─── Ministry-filtered sub-view ───────────────────────────────────────────────
const THEME_COLOR = {
  "Disaster Management":                "bg-red-500/15 border-red-500/30 text-red-300",
  "Smart Automation":                   "bg-blue-500/15 border-blue-500/30 text-blue-300",
  "Transportation & Logistics":         "bg-sky-500/15 border-sky-500/30 text-sky-300",
  "Agriculture, FoodTech & Rural Development": "bg-green-500/15 border-green-500/30 text-green-300",
  "MedTech / BioTech / HealthTech":     "bg-pink-500/15 border-pink-500/30 text-pink-300",
  "Space Technology":                   "bg-indigo-500/15 border-indigo-500/30 text-indigo-300",
  "Blockchain & Cybersecurity":         "bg-amber-500/15 border-amber-500/30 text-amber-300",
  "Robotics and Drones":                "bg-cyan-500/15 border-cyan-500/30 text-cyan-300",
  "Clean & Green Technology":           "bg-emerald-500/15 border-emerald-500/30 text-emerald-300",
  "Smart Education":                    "bg-violet-500/15 border-violet-500/30 text-violet-300",
  "Renewable / Sustainable Energy":     "bg-yellow-500/15 border-yellow-500/30 text-yellow-300",
  "Smart Resource Conservation":        "bg-teal-500/15 border-teal-500/30 text-teal-300",
  "Smart Vehicles":                     "bg-orange-500/15 border-orange-500/30 text-orange-300",
  "Heritage & Culture":                 "bg-rose-500/15 border-rose-500/30 text-rose-300",
  "Travel & Tourism":                   "bg-lime-500/15 border-lime-500/30 text-lime-300",
  "Fitness & Sports":                   "bg-fuchsia-500/15 border-fuchsia-500/30 text-fuchsia-300",
  "Miscellaneous":                      "bg-slate-500/15 border-slate-500/30 text-slate-300",
};
function themeBadge(theme) {
  return THEME_COLOR[theme] ?? "bg-muted/20 border-border/30 text-muted-foreground";
}

const DEADLINE = new Date("2026-09-20T23:59:59");
function getDaysLeft() {
  return Math.max(0, Math.ceil((DEADLINE - new Date()) / (1000 * 60 * 60 * 24)));
}

// ─── Ministry → PS organization matcher ──────────────────────────────────────
// The ministry name stored in spoc_final_teams (from constants.js) often has
// parenthetical acronyms that differ from the organization field in the PS dataset.
// e.g. "Ministry of Home Affairs (MHA)"  ↔  "Ministry of Home Affairs"
//      "Ministry of Earth Sciences (MoES)" ↔  "Ministry of Earth Sciences (MoES)"  ← exact
//      "Defence Research and Development Organisation (DRDO)" ↔ "DRDO"  ← short alias
//
// Strategy:
//  1. Try exact match first.
//  2. Try stripping parenthetical acronym from both sides and re-matching.
//  3. Try matching against known short-alias overrides.

const SHORT_ALIAS_MAP = {
  "drdo":   "Defence Research and Development Organisation (DRDO)",
  "isro":   "Indian Space Research Organisation (ISRO)",
  "ntro":   "National Technical Research Organisation (NTRO)",
  "bel":    "Bharat Electronics Limited (BEL)",
  "mrpl":   "Mangalore Refinery and Petrochemicals Limited (MRPL)",
  "aicte":  "All India Council for Technical Education (AICTE)",
  "mospi":  "Ministry of Statistics and Programme Implementation (MoSPI)",
};

// Build a set of unique organization values in the PS dataset for O(1) lookup
const PS_ORGS = new Set(SIH2026_PROBLEMS.map((p) => p.organization));

function stripAcronym(s) {
  // Remove trailing " (XXX)" or " (Xxx Xxx)" abbreviations, trim
  return s.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

function resolveMinistryOrgs(ministry) {
  if (!ministry) return new Set();

  // 1. Exact match
  if (PS_ORGS.has(ministry)) return new Set([ministry]);

  // 2. Strip acronym from the ministry name, check against PS orgs
  const stripped = stripAcronym(ministry);
  if (stripped !== ministry && PS_ORGS.has(stripped)) return new Set([stripped]);

  // 3. Check if any PS org, when stripped, equals the stripped ministry name
  const strippedLower = stripped.toLowerCase();
  const matched = new Set();
  for (const org of PS_ORGS) {
    if (stripAcronym(org).toLowerCase() === strippedLower) matched.add(org);
    // Also check ministry stripped against org exact
    if (org.toLowerCase() === strippedLower) matched.add(org);
  }
  if (matched.size > 0) return matched;

  // 4. Short-alias: check if the ministry string contains a known short alias
  const ministryLower = ministry.toLowerCase();
  for (const [alias, fullName] of Object.entries(SHORT_ALIAS_MAP)) {
    if (ministryLower === alias || ministryLower.includes(`(${alias})`)) {
      if (PS_ORGS.has(fullName)) return new Set([fullName]);
      // Check the PS set for the alias directly (e.g. "DRDO" as org)
      const aliasUpper = alias.toUpperCase();
      if (PS_ORGS.has(aliasUpper)) return new Set([aliasUpper]);
    }
  }
  // 5. The PS org itself might be a short alias that the ministry name contains
  for (const org of PS_ORGS) {
    const orgLower = org.toLowerCase();
    if (ministryLower.includes(orgLower) || orgLower.includes(strippedLower)) {
      matched.add(org);
    }
  }
  return matched;
}

const PPTX_PATH = "/SIH2026-IDEA-Presentation-Format.pptx";

/**
 * Shown when the participant is in a final SPOC team that has a ministry assigned.
 */
function MinistryProblemsView({ ministry }) {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [themeFilter, setThemeFilter] = useState("all");

  // Resolve the set of PS organization names that correspond to this ministry.
  // resolveMinistryOrgs handles acronym stripping, alias mapping, etc.
  // Falls back to a case-insensitive exact/substring match only when the
  // resolver returns an empty set (i.e. no known mapping found).
  const ministryProblems = useMemo(() => {
    const resolvedOrgs = resolveMinistryOrgs(ministry);
    if (resolvedOrgs.size > 0) {
      return SIH2026_PROBLEMS.filter((p) => resolvedOrgs.has(p.organization));
    }
    // Fallback: plain case-insensitive exact match on organization field
    const needle = ministry.trim().toLowerCase();
    return SIH2026_PROBLEMS.filter((p) =>
      p.organization.toLowerCase() === needle
    );
  }, [ministry]);

  const allThemes = useMemo(
    () => [...new Set(ministryProblems.map((p) => p.theme))].sort(),
    [ministryProblems]
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return ministryProblems.filter((p) => {
      if (catFilter   !== "all" && p.category !== catFilter)   return false;
      if (themeFilter !== "all" && p.theme    !== themeFilter)  return false;
      if (needle) {
        const hay = [p.psNumber, p.title, p.theme].join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [ministryProblems, catFilter, themeFilter, search]);

  const swCount = filtered.filter((p) => p.category === "Software").length;
  const hwCount = filtered.filter((p) => p.category === "Hardware").length;

  if (ministryProblems.length === 0) {
    return (
      <div className="rounded-2xl border border-border/30 bg-card/20 p-8 text-center space-y-2">
        <Building2 className="size-8 text-muted-foreground/40 mx-auto" />
        <p className="text-sm font-semibold text-muted-foreground">
          No problem statements found for <span className="text-white font-bold">{ministry}</span> in the official dataset.
        </p>
        <p className="text-xs text-muted-foreground/60">
          Check the "All Problems" tab for the complete list.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Ministry banner */}
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/8 px-5 py-3.5 flex items-center gap-3">
        <Building2 className="size-5 text-emerald-400 shrink-0" />
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Your Ministry</p>
          <p className="text-sm font-extrabold text-white truncate">{ministry}</p>
        </div>
        <span className="ml-auto text-xs font-extrabold px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 shrink-0">
          {ministryProblems.length} PS
        </span>
      </div>

      {/* Stat pills */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Showing",  value: filtered.length,          color: "text-white"      },
          { label: "Software", value: swCount,                  color: "text-blue-300"   },
          { label: "Hardware", value: hwCount,                  color: "text-orange-300" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border/30 bg-card/40 p-2.5">
            <p className={cn("text-xl font-black tabular-nums", s.color)}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-border/40 bg-card/30 p-3 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search title, PS number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-border/50 bg-card/60 pl-9 pr-8 py-2 text-xs text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 transition-all"
          />
          {search && (
            <button type="button" onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white cursor-pointer">
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          {/* Category */}
          <div className="flex items-center gap-2 flex-wrap">
            {["all", "Software", "Hardware"].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCatFilter(c)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer",
                  catFilter === c
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card/30 border-border/30 text-muted-foreground hover:text-white"
                )}
              >
                {c === "Software" && <Code2 className="size-3 shrink-0" />}
                {c === "Hardware" && <Cpu   className="size-3 shrink-0" />}
                {c === "all" ? "All" : c}
              </button>
            ))}
          </div>

          {/* Theme */}
          {allThemes.length > 1 && (
            <select
              value={themeFilter}
              onChange={(e) => setThemeFilter(e.target.value)}
              className="flex-1 rounded-xl border border-border/50 bg-card/60 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary/50 cursor-pointer"
            >
              <option value="all">All Themes ({ministryProblems.length})</option>
              {allThemes.map((t) => {
                const cnt = ministryProblems.filter((p) => p.theme === t).length;
                return <option key={t} value={t}>{t} ({cnt})</option>;
              })}
            </select>
          )}
        </div>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="py-10 text-center rounded-2xl border border-border/20 bg-card/10 text-sm text-muted-foreground">
          No problems match your filters.
        </div>
      ) : (
        <div className="rounded-2xl border border-border/40 overflow-hidden">
          <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10">
                <tr>
                  {["#", "PS No.", "Problem Statement Title", "Cat", "Theme"].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap border-b border-border/40 bg-card/80">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, idx) => (
                  <tr key={p.psNumber} className="border-b border-border/20 last:border-0 hover:bg-muted/10 transition-colors">
                    <td className="px-3 py-3 text-[10px] text-muted-foreground tabular-nums w-8">{idx + 1}</td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className="text-[11px] font-extrabold text-primary font-mono">{p.psNumber}</span>
                    </td>
                    <td className="px-3 py-3 max-w-[420px]">
                      <span className="text-xs font-semibold text-white leading-snug line-clamp-2">{p.title}</span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {p.category === "Software" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-300">
                          <Code2 className="size-2.5 shrink-0" /> SW
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-300">
                          <Cpu className="size-2.5 shrink-0" /> HW
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 max-w-[160px]">
                      <span className={cn("inline-block text-[9px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap", themeBadge(p.theme))}>
                        {p.theme}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * ProblemStatementsSection
 *
 * Two sub-tabs:
 *  1. "All Problems" — full SIH2026ProblemsView (same as mentor/SPOC)
 *  2. "My Ministry"  — only shown when participant is in a final team with a ministry;
 *                      filters the dataset to that ministry
 *
 * Props:
 *   myFinalTeam  – the participant's final SPOC team object (or null)
 */
export function ProblemStatementsSection({ myFinalTeam }) {
  const ministry = myFinalTeam?.ministry ?? null;
  const hasMinistry = Boolean(ministry);

  // Default to ministry tab if they have one, otherwise all-problems
  const [subTab, setSubTab] = useState(hasMinistry ? "ministry" : "all");
  const daysLeft = getDaysLeft();

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BookOpen className="size-4 text-primary shrink-0" />
          <h2 className="text-sm font-extrabold text-foreground">
            SIH 2026 Problem Statements
          </h2>
          {/* Deadline badge */}
          <span className={cn(
            "inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1 rounded-full border tabular-nums",
            daysLeft <= 7  ? "bg-red-500/15 border-red-500/30 text-red-300" :
            daysLeft <= 14 ? "bg-amber-500/15 border-amber-500/30 text-amber-300" :
                             "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
          )}>
            <Clock className="size-3 shrink-0" />
            {daysLeft === 0 ? "Due TODAY" : `${daysLeft}d to submit`}
          </span>
        </div>

        {/* Download template */}
        <a
          href={PPTX_PATH}
          download="SIH2026-IDEA-Presentation-Format.pptx"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs transition-all shadow cursor-pointer shrink-0"
        >
          <Download className="size-3.5 shrink-0" />
          Download Idea Template
        </a>
      </div>

      {/* Sub-tab switcher */}
      <div className="flex items-center gap-1 bg-card/30 border border-border/40 rounded-2xl p-1">
        <button
          type="button"
          onClick={() => setSubTab("all")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer",
            subTab === "all"
              ? "bg-primary text-primary-foreground shadow"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/20"
          )}
        >
          <BookOpen className="size-3.5 shrink-0" />
          All Problems
          <span className="text-[10px] font-extrabold opacity-70">226</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab("ministry")}
          disabled={!hasMinistry}
          title={!hasMinistry ? "Only available when you are in a final team with a ministry assigned" : undefined}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all",
            !hasMinistry
              ? "text-muted-foreground/40 cursor-not-allowed"
              : subTab === "ministry"
              ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 shadow cursor-pointer"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/20 cursor-pointer"
          )}
        >
          <Building2 className="size-3.5 shrink-0" />
          My Ministry
          {hasMinistry ? (
            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 max-w-[100px] truncate hidden sm:inline">
              {ministry}
            </span>
          ) : (
            <span className="text-[9px] text-muted-foreground/50 hidden sm:inline">Final team only</span>
          )}
        </button>
      </div>

      {/* Tab content */}
      {subTab === "all" && <SIH2026ProblemsView />}
      {subTab === "ministry" && hasMinistry && <MinistryProblemsView ministry={ministry} />}
    </div>
  );
}
