import { useMemo, useState } from "react";
import { Search, X, ExternalLink, Cpu, Code2, BookOpen, Clock, CalendarDays, Download, Presentation } from "lucide-react";
import { cn } from "@/lib/utils";
import { SIH2026_PROBLEMS, useSihProblems } from "@/lib/sih2026Problems";

// ─── Derived constants ────────────────────────────────────────────────────────
// ALL_ORGS and ALL_THEMES are computed inside the component from live data

// Deadline helpers
const DEADLINE = new Date("2026-09-20T23:59:59");
function getDaysLeft() {
  const diff = DEADLINE - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}
function deadlineUrgency(days) {
  if (days === 0) return { bg: "bg-red-600",      text: "text-white",     label: "TODAY",         ring: "ring-red-500"      };
  if (days <= 7)  return { bg: "bg-red-500/20",   text: "text-red-300",   label: `${days}d left`, ring: "ring-red-500/40"   };
  if (days <= 14) return { bg: "bg-amber-500/20", text: "text-amber-300", label: `${days}d left`, ring: "ring-amber-500/40" };
  return           { bg: "bg-emerald-500/15", text: "text-emerald-300", label: `${days}d left`, ring: "ring-emerald-500/30" };
}

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
  return THEME_COLOR[theme] ?? "bg-[rgba(147,197,253,0.08)] border-[rgba(147,197,253,0.15)] text-[#94a3b8]";
}

const PPTX_PATH = "/SIH2026-IDEA-Presentation-Format.pptx";

export function SIH2026ProblemsView() {
  const problems = useSihProblems();
  const [search, setSearch]           = useState("");
  const [orgFilter, setOrgFilter]     = useState("all");
  const [themeFilter, setThemeFilter] = useState("all");
  const [catFilter, setCatFilter]     = useState("all");

  const ALL_ORGS   = useMemo(() => [...new Set(problems.map((p) => p.organization))].sort(), [problems]);
  const ALL_THEMES = useMemo(() => [...new Set(problems.map((p) => p.theme))].sort(), [problems]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return problems.filter((p) => {
      if (orgFilter   !== "all" && p.organization !== orgFilter)   return false;
      if (themeFilter !== "all" && p.theme        !== themeFilter)  return false;
      if (catFilter   !== "all" && p.category     !== catFilter)    return false;
      if (needle) {
        const hay = [p.psNumber, p.organization, p.title, p.theme].join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [search, orgFilter, themeFilter, catFilter]);

  const softwareCount = filtered.filter((p) => p.category === "Software").length;
  const hardwareCount = filtered.filter((p) => p.category === "Hardware").length;
  const hasFilters    = search || orgFilter !== "all" || themeFilter !== "all" || catFilter !== "all";

  const daysLeft = getDaysLeft();
  const urgency  = deadlineUrgency(daysLeft);

  function clearAll() {
    setSearch(""); setOrgFilter("all"); setThemeFilter("all"); setCatFilter("all");
  }

  return (
    <div className="space-y-5">

      {/* ── Header row: title + deadline pill ── */}
      <div className="rounded-2xl border border-[rgba(201,162,39,0.25)] bg-[#0a1226]/60 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              <BookOpen className="size-4 text-[#c9a227] shrink-0" />
              SIH 2026 — Problem Statements
            </h2>
            <p className="text-[11px] text-[#94a3b8]">
              All <span className="text-white font-bold">226</span> official problem statements from{" "}
              <a href="https://sih.gov.in/sih2026PS" target="_blank" rel="noreferrer"
                className="text-[#c9a227] hover:underline inline-flex items-center gap-0.5">
                sih.gov.in <ExternalLink className="size-3" />
              </a>
            </p>
          </div>

          {/* Deadline pill */}
          <div className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-2xl border ring-1 shrink-0 self-start",
            urgency.bg, urgency.ring,
            daysLeft === 0 ? "border-red-500" : "border-transparent"
          )}>
            <CalendarDays className={cn("size-4 shrink-0", urgency.text)} />
            <div>
              <p className={cn("text-[10px] font-bold uppercase tracking-wider", urgency.text)}>
                Idea Submission Deadline
              </p>
              <p className="text-sm font-extrabold text-white">20 September 2026</p>
            </div>
            <span className={cn(
              "ml-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-xl font-extrabold text-xs tabular-nums",
              daysLeft <= 7  ? "bg-red-500 text-white" :
              daysLeft <= 14 ? "bg-amber-500 text-black" :
                               "bg-emerald-500/30 text-emerald-200"
            )}>
              <Clock className="size-3 shrink-0" />
              {urgency.label}
            </span>
          </div>
        </div>
      </div>

      {/* ── Idea Presentation Format card ── */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-[#c9a227] bg-gradient-to-br from-[#c9a227]/10 via-[#0a1226]/60 to-[#0a1226]/40 p-5">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#c9a227] to-transparent opacity-80" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#c9a227]/15 border border-[#c9a227]/30">
              <Presentation className="size-5 text-[#c9a227]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-extrabold text-white">Idea Presentation Format</span>
                <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-[#c9a227] text-black uppercase tracking-wider">
                  Official
                </span>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border border-[#c9a227]/30 bg-[#c9a227]/10 text-[#e8c058]">
                  .pptx
                </span>
              </div>
              <p className="text-[11px] text-[#94a3b8] mt-0.5">
                SIH 2026 official slide deck template · Use this format for your idea submission
              </p>
            </div>
          </div>

          <a
            href={PPTX_PATH}
            download="SIH2026-IDEA-Presentation-Format.pptx"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#c9a227] hover:bg-[#e8c058] text-black font-extrabold text-sm transition-all shadow-lg shadow-[#c9a227]/20 hover:scale-[1.02] active:scale-[0.98] shrink-0 cursor-pointer"
          >
            <Download className="size-4 shrink-0" />
            Download Template
          </a>
        </div>
      </div>

      {/* ── Stat pills ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Showing",  value: filtered.length,         color: "text-white"      },
          { label: "Software", value: softwareCount,           color: "text-blue-300"   },
          { label: "Hardware", value: hardwareCount,           color: "text-orange-300" },
          { label: "Total",    value: problems.length, color: "text-[#e8c058]"  },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-[rgba(147,197,253,0.10)] bg-[#0a1226]/60 p-3">
            <p className={cn("text-2xl font-black tabular-nums", s.color)}>{s.value}</p>
            <p className="text-[10px] text-[#94a3b8] font-semibold uppercase tracking-wide mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="rounded-2xl border border-[rgba(147,197,253,0.10)] bg-[#0a1226]/60 p-4 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[#94a3b8] pointer-events-none" />
          <input
            type="text"
            placeholder="Search PS number, title, theme, organisation…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-[rgba(147,197,253,0.14)] bg-[#050b18]/60 pl-9 pr-8 py-2 text-xs text-white placeholder:text-[#94a3b8]/50 outline-none focus:border-[#c9a227]/50 transition-all"
          />
          {search && (
            <button type="button" onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-white cursor-pointer">
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Category chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8] shrink-0">Category:</span>
          {[
            { id: "all",      label: "All",      icon: null                          },
            { id: "Software", label: "Software", icon: <Code2 className="size-3 shrink-0" /> },
            { id: "Hardware", label: "Hardware", icon: <Cpu   className="size-3 shrink-0" /> },
          ].map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCatFilter(c.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer",
                catFilter === c.id
                  ? "bg-[#c9a227] text-black border-[#c9a227]"
                  : "bg-[#0a1226]/60 border-[rgba(147,197,253,0.14)] text-[#94a3b8] hover:text-white hover:border-[rgba(147,197,253,0.3)]"
              )}
            >
              {c.icon}
              {c.label}
            </button>
          ))}
        </div>

        {/* Organisation + Theme dropdowns */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="flex-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8] mb-1 block">Organisation / Ministry</label>
            <select
              value={orgFilter}
              onChange={(e) => setOrgFilter(e.target.value)}
              className="w-full rounded-xl border border-[rgba(147,197,253,0.14)] bg-[#050b18]/60 px-3 py-2 text-xs text-white outline-none focus:border-[#c9a227]/50 transition-all cursor-pointer"
            >
              <option value="all">All Organisations ({problems.length})</option>
              {ALL_ORGS.map((org) => {
                const count = problems.filter((p) => p.organization === org).length;
                return <option key={org} value={org}>{org} ({count})</option>;
              })}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8] mb-1 block">Theme</label>
            <select
              value={themeFilter}
              onChange={(e) => setThemeFilter(e.target.value)}
              className="w-full rounded-xl border border-[rgba(147,197,253,0.14)] bg-[#050b18]/60 px-3 py-2 text-xs text-white outline-none focus:border-[#c9a227]/50 transition-all cursor-pointer"
            >
              <option value="all">All Themes</option>
              {ALL_THEMES.map((t) => {
                const count = problems.filter((p) => p.theme === t).length;
                return <option key={t} value={t}>{t} ({count})</option>;
              })}
            </select>
          </div>
        </div>

        {hasFilters && (
          <div className="flex items-center justify-between gap-2 border-t border-[rgba(147,197,253,0.10)] pt-2">
            <p className="text-[10px] text-[#94a3b8]">
              Showing <span className="text-white font-bold">{filtered.length}</span> of {problems.length}
            </p>
            <button type="button" onClick={clearAll} className="text-xs text-red-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer">
              <X className="size-3" /> Clear filters
            </button>
          </div>
        )}
      </div>

      {/* ── Results table ── */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center rounded-2xl border border-[rgba(147,197,253,0.08)] bg-[#0a1226]/40 text-sm text-[#94a3b8]">
          No problem statements match your filters.
        </div>
      ) : (
        <div className="rounded-2xl border border-[rgba(147,197,253,0.12)] overflow-hidden">
          <div className="overflow-x-auto max-h-[65vh] overflow-y-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10">
                <tr>
                  {["#", "PS No.", "Organisation", "Problem Statement Title", "Cat", "Theme"].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-[#94a3b8] whitespace-nowrap border-b border-[rgba(147,197,253,0.10)] bg-[#0a1226]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, idx) => (
                  <tr key={p.psNumber} className="border-b border-[rgba(147,197,253,0.06)] last:border-0 hover:bg-[rgba(147,197,253,0.04)] transition-colors">
                    <td className="px-3 py-3 text-[10px] text-[#94a3b8] tabular-nums w-8">{idx + 1}</td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className="text-[11px] font-extrabold text-[#c9a227] font-mono">{p.psNumber}</span>
                    </td>
                    <td className="px-3 py-3 max-w-[180px]">
                      <span className="text-[11px] text-[#94a3b8] leading-snug line-clamp-2">{p.organization}</span>
                    </td>
                    <td className="px-3 py-3 max-w-[400px]">
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
