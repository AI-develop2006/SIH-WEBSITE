import { useState, useMemo, useCallback } from "react";
import { BookOpen, Filter, Search, X, ExternalLink, Cpu, Code2, Download, Presentation, Clock, CalendarDays, Building2, CheckCircle2, AlertTriangle, Lock, Pencil, Sparkles, MessageSquare, ChevronDown, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { SIH2026_PROBLEMS } from "@/lib/sih2026Problems";
import { SIH2026ProblemsView } from "@/components/common/SIH2026ProblemsView";
import { selectFinalTeamPs, submitCustomPs, submitPsChangeRequest, fetchMyPsChangeRequests } from "@/lib/data";

// AICTE ministry name (Open Innovation) — any ministry containing "aicte" triggers custom PS mode
const AICTE_MINISTRY = "AICTE";
function isOpenInnovationMinistry(ministry) {
  return ministry?.toLowerCase().includes("aicte") ?? false;
}

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

// ─── Open Innovation view (AICTE) ────────────────────────────────────────────
// For teams assigned to AICTE, there are no pre-defined problem statements.
// Instead the team writes their own problem statement title.
function OpenInnovationView({ ministry, lockedTitle, onSubmit, submitting, myFinalTeam, onRequestSent }) {
  const [draft, setDraft] = useState(lockedTitle ?? "");
  const [showConfirm, setShowConfirm] = useState(false);
  const charCount = draft.trim().length;
  const isValid   = charCount >= 10 && charCount <= 500;

  // If already locked, show read-only view
  if (lockedTitle) {
    return (
      <div className="space-y-4">
        {/* Ministry banner */}
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/8 px-5 py-3.5 flex items-center gap-3">
          <Building2 className="size-5 text-emerald-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Your Ministry</p>
            <p className="text-sm font-extrabold text-white truncate">{ministry}</p>
          </div>
          <span className="ml-auto text-xs font-extrabold px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 shrink-0 flex items-center gap-1">
            <Sparkles className="size-3 shrink-0" /> Open Innovation
          </span>
        </div>

        {/* Confirmed custom PS */}
        <div className="rounded-2xl border border-violet-500/40 bg-violet-500/10 px-5 py-4 flex items-start gap-3">
          <Lock className="size-5 text-violet-400 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-violet-400">
                Your Team's Confirmed Problem Statement
              </p>
              <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-300">
                🔒 Locked
              </span>
            </div>
            <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 mb-2">
              <Sparkles className="size-3 shrink-0" /> Open Innovation · AICTE
            </span>
            <p className="text-sm font-semibold text-white leading-relaxed">{lockedTitle}</p>
          </div>
        </div>

        {/* PS Change Request panel */}
        {myFinalTeam && (
          <PsChangeRequestPanel
            myFinalTeam={myFinalTeam}
            isAicte={true}
            onRequestSent={onRequestSent}
          />
        )}
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
        <span className="ml-auto text-xs font-extrabold px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 shrink-0 flex items-center gap-1">
          <Sparkles className="size-3 shrink-0" /> Open Innovation
        </span>
      </div>

      {/* Explanation card */}
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/8 px-5 py-4 space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-amber-400 shrink-0" />
          <p className="text-sm font-extrabold text-white">Open Innovation — Write Your Own Problem Statement</p>
        </div>
        <p className="text-xs text-amber-200/80 leading-relaxed">
          AICTE falls under the <span className="font-bold text-white">Open Innovation</span> category. There are no pre-defined problem statements — your team defines its own.
          Write a clear, meaningful title for the problem you are solving.
        </p>
        <p className="text-xs text-amber-200/60 leading-relaxed">
          This will be visible to your SPOC and mentor. Once confirmed, it <span className="font-bold text-red-300">cannot be changed</span>.
        </p>
      </div>

      {/* Input form */}
      <div className="rounded-2xl border border-border/40 bg-card/30 p-4 space-y-3">
        <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Problem Statement Title <span className="text-red-400">*</span>
        </label>
        <textarea
          rows={4}
          placeholder="e.g. A smart waste management system that uses computer vision to classify and sort municipal solid waste in real time…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={500}
          className="w-full rounded-xl border border-border/50 bg-card/60 px-4 py-3 text-sm text-white placeholder:text-muted-foreground/40 focus:outline-none focus:border-amber-500/50 transition-all resize-none leading-relaxed"
        />
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className={cn(
            "text-[10px] font-semibold",
            charCount < 10 ? "text-red-400" :
            charCount > 450 ? "text-amber-400" :
            "text-muted-foreground"
          )}>
            {charCount}/500 characters
            {charCount < 10 && charCount > 0 && " (minimum 10)"}
          </p>
          <button
            type="button"
            disabled={!isValid || submitting}
            onClick={() => setShowConfirm(true)}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow"
          >
            <Lock className="size-3.5 shrink-0" />
            Confirm & Lock Problem Statement
          </button>
        </div>
      </div>

      {/* Confirmation dialog */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setShowConfirm(false)}
        >
          <div
            className="relative w-full max-w-md rounded-2xl border border-amber-500/50 bg-[#0d1421] p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/30">
                <AlertTriangle className="size-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">Confirm Open Innovation PS</h3>
                <p className="text-xs text-amber-400 font-semibold mt-0.5">This action cannot be undone</p>
              </div>
            </div>

            {/* Warning */}
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/8 px-4 py-3 space-y-1.5">
              <p className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <Lock className="size-3.5 shrink-0" /> ⚠️ Please read before confirming
              </p>
              <p className="text-xs text-amber-200/80 leading-relaxed">
                Once confirmed, <span className="font-bold text-white">your entire team will be locked into this problem statement</span>. There is <span className="font-bold text-red-300">no way to change it</span> afterwards.
              </p>
              <p className="text-xs text-amber-200/80 leading-relaxed">
                Make sure you have <span className="font-bold text-white">discussed and agreed with all your team members</span> before proceeding.
              </p>
            </div>

            {/* Preview */}
            <div className="rounded-xl border border-violet-500/30 bg-violet-500/8 px-4 py-3 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-violet-400">You are confirming</p>
              <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300">
                <Sparkles className="size-3 shrink-0" /> Open Innovation · AICTE
              </span>
              <p className="text-xs text-white leading-relaxed mt-1">{draft.trim()}</p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-border/50 text-xs font-bold text-muted-foreground hover:text-white hover:border-border/80 transition-all"
              >
                Cancel — Go Back
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={async () => {
                  setShowConfirm(false);
                  await onSubmit(draft.trim());
                }}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                <Lock className="size-3.5 shrink-0" />
                Yes, Confirm & Lock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Shown when the participant is in a final SPOC team that has a ministry assigned.
 */
function MinistryProblemsView({ ministry, selectedPsNumber, onSelectPs, savingPs, myFinalTeam, onRequestSent }) {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [themeFilter, setThemeFilter] = useState("all");
  // Confirmation dialog state
  const [pendingPs, setPendingPs] = useState(null); // the PS number waiting for confirmation
  const isLocked = Boolean(selectedPsNumber); // once set, it's locked forever

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

      {/* Selected PS banner — shown when team has a chosen problem statement */}
      {selectedPsNumber && (() => {
        const selPs = SIH2026_PROBLEMS.find((p) => p.psNumber === selectedPsNumber);
        return selPs ? (
          <div className="rounded-2xl border border-violet-500/40 bg-violet-500/10 px-5 py-3.5 flex items-start gap-3">
            <Lock className="size-5 text-violet-400 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-violet-400 mb-0.5">Your Team's Confirmed Problem Statement</p>
              <p className="text-[11px] font-extrabold text-white font-mono">{selPs.psNumber}</p>
              <p className="text-xs text-violet-200 leading-snug mt-0.5">{selPs.title}</p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                selPs.category === "Software"
                  ? "border-blue-500/30 bg-blue-500/10 text-blue-300"
                  : "border-orange-500/30 bg-orange-500/10 text-orange-300"
              )}>
                {selPs.category === "Software" ? "SW" : "HW"}
              </span>
              <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-300">
                🔒 Locked
              </span>
            </div>
          </div>
        ) : null;
      })()}

      {/* PS Change Request panel — only when PS is locked */}
      {selectedPsNumber && myFinalTeam && (
        <PsChangeRequestPanel
          myFinalTeam={myFinalTeam}
          isAicte={false}
          onRequestSent={onRequestSent}
        />
      )}

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
                  {["#", "PS No.", "Problem Statement Title", "Cat", "Theme", ""].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap border-b border-border/40 bg-card/80">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, idx) => {
                  const isSelected = selectedPsNumber && p.psNumber === selectedPsNumber;
                  return (
                  <tr key={p.psNumber} className={cn(
                    "border-b border-border/20 last:border-0 transition-colors",
                    isSelected
                      ? "bg-violet-500/15 hover:bg-violet-500/20"
                      : "hover:bg-muted/10"
                  )}>
                    <td className="px-3 py-3 text-[10px] text-muted-foreground tabular-nums w-8">{idx + 1}</td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-extrabold text-primary font-mono">{p.psNumber}</span>
                        {isSelected && (
                          <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-300">
                            ✓ Selected
                          </span>
                        )}
                      </div>
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
                    <td className="px-3 py-3 whitespace-nowrap">
                      {onSelectPs && (
                        isLocked ? (
                          /* PS is locked — show a muted lock icon in place of the button */
                          isSelected ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-xl border border-violet-500/40 bg-violet-500/15 text-violet-300">
                              <Lock className="size-3 shrink-0" /> Confirmed
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/40 flex items-center gap-1">
                              <Lock className="size-3 shrink-0" /> Locked
                            </span>
                          )
                        ) : (
                          <button
                            type="button"
                            disabled={savingPs}
                            onClick={() => setPendingPs(p.psNumber)}
                            className="text-[10px] font-bold px-2.5 py-1 rounded-xl border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border-border/30 bg-card/30 text-muted-foreground hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-violet-300"
                          >
                            Select
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Confirmation Warning Dialog ─────────────────────────────────── */}
      {pendingPs && (() => {
        const ps = SIH2026_PROBLEMS.find((p) => p.psNumber === pendingPs);
        return (
          <div
            className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setPendingPs(null)}
          >
            <div
              className="relative w-full max-w-md rounded-2xl border border-amber-500/50 bg-[#0d1421] p-6 shadow-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/30">
                  <AlertTriangle className="size-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Confirm Problem Statement</h3>
                  <p className="text-xs text-amber-400 font-semibold mt-0.5">This action cannot be undone</p>
                </div>
              </div>

              {/* Warning text */}
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/8 px-4 py-3 space-y-1.5">
                <p className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Lock className="size-3.5 shrink-0" />
                  ⚠️ Please read before confirming
                </p>
                <p className="text-xs text-amber-200/80 leading-relaxed">
                  Once you confirm this problem statement, <span className="font-bold text-white">your entire team will be locked into it</span>. There is <span className="font-bold text-red-300">no way to change it</span> afterwards.
                </p>
                <p className="text-xs text-amber-200/80 leading-relaxed">
                  Make sure you have <span className="font-bold text-white">discussed this decision with all your team members</span> before proceeding.
                </p>
              </div>

              {/* Selected PS preview */}
              {ps && (
                <div className="rounded-xl border border-violet-500/30 bg-violet-500/8 px-4 py-3 space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-violet-400">You are confirming</p>
                  <p className="text-sm font-extrabold text-white font-mono">{ps.psNumber}</p>
                  <p className="text-xs text-violet-200 leading-snug">{ps.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={cn(
                      "text-[9px] font-bold px-2 py-0.5 rounded-full border",
                      ps.category === "Software"
                        ? "border-blue-500/30 bg-blue-500/10 text-blue-300"
                        : "border-orange-500/30 bg-orange-500/10 text-orange-300"
                    )}>
                      {ps.category}
                    </span>
                    <span className="text-[9px] text-muted-foreground">{ps.organization}</span>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setPendingPs(null)}
                  className="flex-1 py-2.5 rounded-xl border border-border/50 text-xs font-bold text-muted-foreground hover:text-white hover:border-border/80 transition-all"
                >
                  Cancel — Go Back
                </button>
                <button
                  type="button"
                  disabled={savingPs}
                  onClick={async () => {
                    const ps = pendingPs;
                    setPendingPs(null);
                    await onSelectPs(ps);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-extrabold text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  <Lock className="size-3.5 shrink-0" />
                  Yes, Confirm & Lock
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── PS Change Request Panel (participant) ────────────────────────────────────
// Shown inside the locked PS banner when the team already has a confirmed PS.
// Lets any team member submit a change request with a reason + new PS choice.
function PsChangeRequestPanel({ myFinalTeam, isAicte, onRequestSent }) {
  const [open, setOpen]             = useState(false);
  const [reason, setReason]         = useState("");
  const [newPsSearch, setNewPsSearch] = useState("");
  const [selectedNewPs, setSelectedNewPs] = useState("");
  const [newCustomTitle, setNewCustomTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [requests, setRequests]     = useState(null); // null = not loaded yet
  const [loadingRequests, setLoadingRequests] = useState(false);

  const ministry     = myFinalTeam?.ministry ?? null;
  const currentPs    = myFinalTeam?.selected_ps_number ?? null;
  const currentCustom = myFinalTeam?.custom_ps_title ?? null;

  const pendingRequest = requests?.find((r) => r.status === "pending") ?? null;
  const latestRequest  = requests?.[0] ?? null;

  // Resolve PS options for new PS picker (same ministry filtering as MinistryProblemsView)
  const ministryProblems = useMemo(() => {
    if (!ministry || isAicte) return [];
    const resolvedOrgs = resolveMinistryOrgs(ministry);
    if (resolvedOrgs.size > 0) {
      return SIH2026_PROBLEMS.filter((p) => resolvedOrgs.has(p.organization));
    }
    const needle = ministry.trim().toLowerCase();
    return SIH2026_PROBLEMS.filter((p) => p.organization.toLowerCase() === needle);
  }, [ministry, isAicte]);

  const filteredNewPs = useMemo(() => {
    const q = newPsSearch.trim().toLowerCase();
    const list = ministry ? ministryProblems : SIH2026_PROBLEMS;
    if (!q) return list.slice(0, 30); // show first 30 unfiltered
    return list.filter((p) =>
      p.psNumber.toLowerCase().includes(q) || p.title.toLowerCase().includes(q)
    ).slice(0, 30);
  }, [newPsSearch, ministryProblems, ministry]);

  async function loadRequests() {
    setLoadingRequests(true);
    const { data } = await fetchMyPsChangeRequests();
    setRequests(data ?? []);
    setLoadingRequests(false);
  }

  function handleOpen() {
    setOpen(true);
    if (requests === null) loadRequests();
  }

  const canSubmit = reason.trim().length >= 10 &&
    (isAicte ? newCustomTitle.trim().length >= 10 : !!selectedNewPs) &&
    !pendingRequest;

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    const { error } = await submitPsChangeRequest({
      reason:     reason.trim(),
      new_ps:     isAicte ? undefined : (selectedNewPs || undefined),
      new_custom: isAicte ? newCustomTitle.trim() : undefined,
    });
    setSubmitting(false);
    if (error) {
      setSubmitError(error);
    } else {
      setReason("");
      setSelectedNewPs("");
      setNewCustomTitle("");
      setNewPsSearch("");
      await loadRequests();
      if (onRequestSent) onRequestSent();
    }
  }

  return (
    <div className="rounded-xl border border-[rgba(147,197,253,0.12)] bg-[#0a1226]/40 overflow-hidden">
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : handleOpen())}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="size-3.5 text-[#94a3b8] shrink-0" />
          <span className="text-xs font-bold text-[#94a3b8]">Request Problem Statement Change</span>
          {pendingRequest && (
            <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300">
              Pending review
            </span>
          )}
          {latestRequest?.status === "approved" && !pendingRequest && (
            <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
              ✓ Approved
            </span>
          )}
          {latestRequest?.status === "rejected" && !pendingRequest && (
            <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-300">
              Rejected
            </span>
          )}
        </div>
        <ChevronDown className={cn("size-3.5 text-[#94a3b8] transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t border-[rgba(147,197,253,0.08)] px-4 pb-4 pt-3 space-y-4">

          {/* Existing requests history */}
          {loadingRequests && (
            <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
              <RefreshCw className="size-3 animate-spin" /> Loading request history…
            </p>
          )}
          {requests && requests.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Request History</p>
              {requests.map((r) => (
                <div key={r.id} className={cn(
                  "rounded-xl border px-3 py-2.5 space-y-1.5 text-xs",
                  r.status === "pending"  ? "border-amber-500/25 bg-amber-500/5"   :
                  r.status === "approved" ? "border-emerald-500/25 bg-emerald-500/5" :
                                            "border-red-500/25 bg-red-500/5"
                )}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn(
                      "text-[9px] font-extrabold px-2 py-0.5 rounded-full border",
                      r.status === "pending"  ? "border-amber-500/30 bg-amber-500/10 text-amber-300"   :
                      r.status === "approved" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" :
                                                "border-red-500/30 bg-red-500/10 text-red-300"
                    )}>
                      {r.status === "pending" ? "⏳ Pending" : r.status === "approved" ? "✅ Approved" : "❌ Rejected"}
                    </span>
                    <span className="text-[9px] text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    <span className="font-semibold text-white/70">From:</span>{" "}
                    {r.current_ps ? <span className="font-mono text-violet-300">{r.current_ps}</span> : "Custom PS"}
                    {" → "}
                    <span className="font-semibold text-white/70">To:</span>{" "}
                    {r.new_ps ? <span className="font-mono text-emerald-300">{r.new_ps}</span> : "New Custom PS"}
                  </p>
                  <p className="text-[10px] text-muted-foreground line-clamp-2">
                    <span className="font-semibold text-white/70">Reason:</span> {r.reason}
                  </p>
                  {r.review_note && (
                    <p className="text-[10px] text-muted-foreground">
                      <span className="font-semibold text-white/70">SPOC note:</span> {r.review_note}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pending block message */}
          {pendingRequest && (
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/8 px-4 py-3">
              <p className="text-xs font-semibold text-amber-300">
                ⏳ You already have a pending change request. Wait for the SPOC to review it before submitting another.
              </p>
            </div>
          )}

          {/* New request form */}
          {!pendingRequest && (
            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">New Change Request</p>

              {/* Reason textarea */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Reason for change <span className="text-red-400">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Explain why your team needs to change the problem statement (min. 10 characters)…"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={1000}
                  className="w-full rounded-xl border border-border/50 bg-card/60 px-3 py-2 text-xs text-white placeholder:text-muted-foreground/40 focus:outline-none focus:border-amber-500/50 transition-all resize-none"
                />
                <p className={cn(
                  "text-[9px]",
                  reason.trim().length < 10 && reason.length > 0 ? "text-red-400" : "text-muted-foreground"
                )}>
                  {reason.trim().length}/1000 {reason.trim().length < 10 && reason.length > 0 && "(min. 10)"}
                </p>
              </div>

              {/* New PS picker */}
              {isAicte ? (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    New Problem Statement Title <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Enter your new problem statement title…"
                    value={newCustomTitle}
                    onChange={(e) => setNewCustomTitle(e.target.value)}
                    maxLength={500}
                    className="w-full rounded-xl border border-border/50 bg-card/60 px-3 py-2 text-xs text-white placeholder:text-muted-foreground/40 focus:outline-none focus:border-violet-500/50 transition-all resize-none"
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    New Problem Statement <span className="text-red-400">*</span>
                    {ministry && <span className="ml-1 normal-case text-[9px] text-muted-foreground/60">(filtered to your ministry)</span>}
                  </label>
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search PS number or title…"
                      value={newPsSearch}
                      onChange={(e) => setNewPsSearch(e.target.value)}
                      className="w-full rounded-xl border border-border/50 bg-card/60 pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-muted-foreground/40 focus:outline-none focus:border-violet-500/50 transition-all"
                    />
                  </div>
                  {/* PS list */}
                  <div className="max-h-40 overflow-y-auto rounded-xl border border-border/30 bg-card/20 space-y-0.5 p-1">
                    {filteredNewPs.length === 0 ? (
                      <p className="text-[10px] text-muted-foreground text-center py-3">No PS found</p>
                    ) : filteredNewPs.map((p) => {
                      const isActive = selectedNewPs === p.psNumber;
                      const isCurrent = currentPs === p.psNumber;
                      return (
                        <button
                          key={p.psNumber}
                          type="button"
                          disabled={isCurrent}
                          onClick={() => setSelectedNewPs(isActive ? "" : p.psNumber)}
                          className={cn(
                            "w-full text-left rounded-lg px-2.5 py-1.5 transition-all text-xs",
                            isCurrent  ? "opacity-40 cursor-not-allowed bg-transparent" :
                            isActive   ? "bg-violet-500/20 border border-violet-500/30" :
                                         "hover:bg-muted/20 border border-transparent"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] font-extrabold text-violet-300 shrink-0">{p.psNumber}</span>
                            {isCurrent && <span className="text-[9px] text-amber-400">(current)</span>}
                            {isActive  && <span className="text-[9px] text-emerald-400">✓ selected</span>}
                            <span className={cn(
                              "text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ml-auto",
                              p.category === "Software"
                                ? "border-blue-500/30 bg-blue-500/8 text-blue-300"
                                : "border-orange-500/30 bg-orange-500/8 text-orange-300"
                            )}>
                              {p.category === "Software" ? "SW" : "HW"}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{p.title}</p>
                        </button>
                      );
                    })}
                  </div>
                  {selectedNewPs && (
                    <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3 py-2">
                      <p className="text-[10px] text-emerald-400 font-bold">Selected: {selectedNewPs}</p>
                      <p className="text-[9px] text-muted-foreground line-clamp-1">
                        {SIH2026_PROBLEMS.find((p) => p.psNumber === selectedNewPs)?.title}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {submitError && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/8 px-3 py-2">
                  <p className="text-[10px] text-red-300">{submitError}</p>
                </div>
              )}

              <button
                type="button"
                disabled={!canSubmit || submitting}
                onClick={handleSubmit}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                {submitting ? <RefreshCw className="size-3.5 animate-spin" /> : <MessageSquare className="size-3.5" />}
                {submitting ? "Submitting…" : "Submit Change Request"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * ProblemStatementsSection
 *
 * Two sub-tabs: *  1. "All Problems" — full SIH2026ProblemsView (same as mentor/SPOC)
 *  2. "My Ministry"  — only shown when participant is in a final team with a ministry;
 *                      filters the dataset to that ministry
 *
 * Props:
 *   myFinalTeam  – the participant's final SPOC team object (or null)
 */
export function ProblemStatementsSection({ myFinalTeam, onFinalTeamUpdated }) {
  const ministry         = myFinalTeam?.ministry ?? null;
  const selectedPsNumber = myFinalTeam?.selected_ps_number ?? null;
  const customPsTitle    = myFinalTeam?.custom_ps_title ?? null;
  const hasMinistry      = Boolean(ministry);
  const isAicte          = isOpenInnovationMinistry(ministry);
  const [savingPs, setSavingPs]   = useState(false);
  const [psError, setPsError]     = useState(null);

  // Default to ministry tab if they have one, otherwise all-problems
  const [subTab, setSubTab] = useState(hasMinistry ? "ministry" : "all");
  const daysLeft = getDaysLeft();

  // Handler for regular (non-AICTE) PS selection
  const handleSelectPs = useCallback(async (psNumber) => {
    setSavingPs(true);
    setPsError(null);
    const { error } = await selectFinalTeamPs(psNumber);
    setSavingPs(false);
    if (error) {
      console.error("[selectFinalTeamPs]", error);
      setPsError(error);
    } else if (onFinalTeamUpdated) {
      onFinalTeamUpdated();
    }
  }, [onFinalTeamUpdated]);

  // Handler for AICTE open innovation custom PS submission
  const handleSubmitCustomPs = useCallback(async (customTitle) => {
    setSavingPs(true);
    setPsError(null);
    const { error } = await submitCustomPs(customTitle);
    setSavingPs(false);
    if (error) {
      console.error("[submitCustomPs]", error);
      setPsError(error);
    } else if (onFinalTeamUpdated) {
      onFinalTeamUpdated();
    }
  }, [onFinalTeamUpdated]);

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

      {/* Error banner — shown if PS confirmation fails */}
      {psError && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/8 px-4 py-3 flex items-start gap-2.5">
          <AlertTriangle className="size-4 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-red-300">Could not confirm problem statement</p>
            <p className="text-xs text-red-300/70 mt-0.5">
              {psError.includes("already confirmed") || psError.includes("locked")
                ? "Your team has already locked in a problem statement. Refresh the page to see the latest status."
                : psError}
            </p>
          </div>
          <button type="button" onClick={() => setPsError(null)} className="text-red-400 hover:text-red-200 shrink-0">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Sub-tab switcher */}
      <div className="flex items-center gap-1 bg-card/30 border border-border/40 rounded-2xl p-1">        <button
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
          {isAicte ? "Open Innovation" : "My Ministry"}
          {hasMinistry ? (
            <span className={cn(
              "text-[9px] font-extrabold px-1.5 py-0.5 rounded-full border max-w-[100px] truncate hidden sm:inline",
              isAicte
                ? "bg-amber-500/20 text-amber-300 border-amber-500/20"
                : "bg-emerald-500/20 text-emerald-300 border-emerald-500/20"
            )}>
              {isAicte ? "AICTE" : ministry}
            </span>
          ) : (
            <span className="text-[9px] text-muted-foreground/50 hidden sm:inline">Final team only</span>
          )}
        </button>
      </div>

      {/* Tab content */}
      {subTab === "all" && <SIH2026ProblemsView />}
      {subTab === "ministry" && hasMinistry && isAicte && (
        <OpenInnovationView
          ministry={ministry}
          lockedTitle={customPsTitle}
          onSubmit={handleSubmitCustomPs}
          submitting={savingPs}
          myFinalTeam={myFinalTeam}
          onRequestSent={onFinalTeamUpdated}
        />
      )}
      {subTab === "ministry" && hasMinistry && !isAicte && (
        <MinistryProblemsView
          ministry={ministry}
          selectedPsNumber={selectedPsNumber}
          onSelectPs={handleSelectPs}
          savingPs={savingPs}
          myFinalTeam={myFinalTeam}
          onRequestSent={onFinalTeamUpdated}
        />
      )}
    </div>
  );
}
