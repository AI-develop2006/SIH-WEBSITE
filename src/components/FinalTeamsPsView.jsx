"use client";

import { useMemo, useState } from "react";
import { Search, X, CheckCircle2, AlertTriangle, Download, Code2, Cpu, Sparkles, FileText, ShieldCheck } from "lucide-react";
import { cn, validateFinalTeam } from "@/lib/utils";
import { useSihPsMap } from "@/lib/sih2026Problems";

/**
 * FinalTeamsPsView
 *
 * Read-only table showing every SPOC final team alongside their confirmed
 * problem statement (or custom Open Innovation title for AICTE teams).
 *
 * Props:
 *   finalTeams            – array of spoc_final_teams rows (from SpocDashboard state)
 *   profileMap            – Map<profileId, profile> for resolving member count
 *   validityFilter        – "all" | "valid" | "draft"
 *   onValidityFilterChange– callback to update validity filter
 */
export function FinalTeamsPsView({
  finalTeams = [],
  profileMap = new Map(),
  validityFilter: propValidityFilter,
  onValidityFilterChange,
}) {
  const [search, setSearch]                   = useState("");
  const [ministryFilter, setMinistryFilter]   = useState("all");
  const [psFilter, setPsFilter]               = useState("all"); // "all"|"selected"|"open"|"none"
  const [catFilter, setCatFilter]             = useState("all"); // "all"|"Software"|"Hardware"
  const [localValidityFilter, setLocalValidityFilter] = useState("all");

  const validityFilter = propValidityFilter ?? localValidityFilter;
  const setValidityFilter = onValidityFilterChange ?? setLocalValidityFilter;

  // ── Pre-computed lookups ──────────────────────────────────────────────────
  const psMap = useSihPsMap();

  const allMinistries = useMemo(() => {
    const s = new Set(finalTeams.map((ft) => ft.ministry).filter(Boolean));
    return [...s].sort();
  }, [finalTeams]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const selected  = finalTeams.filter((ft) => ft.selected_ps_number).length;
    const open      = finalTeams.filter((ft) => !ft.selected_ps_number && ft.custom_ps_title).length;
    const none      = finalTeams.filter((ft) => !ft.selected_ps_number && !ft.custom_ps_title).length;
    const validCount = finalTeams.filter((ft) => {
      const members = (ft.member_ids || []).map((id) => profileMap.get(id)).filter(Boolean);
      return validateFinalTeam(members).length === 0;
    }).length;
    const draftCount = finalTeams.filter((ft) => {
      const members = (ft.member_ids || []).map((id) => profileMap.get(id)).filter(Boolean);
      return members.length < 6;
    }).length;
    const software  = finalTeams.filter((ft) => {
      const ps = ft.selected_ps_number ? psMap.get(ft.selected_ps_number) : null;
      return ps?.category === "Software";
    }).length;
    const hardware  = finalTeams.filter((ft) => {
      const ps = ft.selected_ps_number ? psMap.get(ft.selected_ps_number) : null;
      return ps?.category === "Hardware";
    }).length;
    return { total: finalTeams.length, selected, open, none, validCount, draftCount, software, hardware };
  }, [finalTeams, psMap, profileMap]);

  // ── Consider ONLY complete 6-member teams statistics ───────────────────────
  const completeTeamsStats = useMemo(() => {
    const completeTeams = finalTeams.filter(
      (ft) => Array.isArray(ft.member_ids) && ft.member_ids.length === 6
    );
    let boysCount = 0;
    let girlsCount = 0;
    let totalStudents = 0;

    completeTeams.forEach((ft) => {
      (ft.member_ids || []).forEach((id) => {
        totalStudents++;
        const p = profileMap.get(id);
        if (p) {
          if (p.gender === "Female") {
            girlsCount++;
          } else if (p.gender === "Male") {
            boysCount++;
          }
        }
      });
    });

    return {
      completeTeamsCount: completeTeams.length,
      boysCount,
      girlsCount,
      totalStudents,
    };
  }, [finalTeams, profileMap]);

  // ── Filtered rows ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return finalTeams.filter((ft) => {
      if (ministryFilter !== "all" && ft.ministry !== ministryFilter) return false;

      const members = (ft.member_ids || []).map((id) => profileMap.get(id)).filter(Boolean);
      const isDraft = members.length < 6;
      const isValid = validateFinalTeam(members).length === 0;

      if (validityFilter === "draft" && !isDraft) return false;
      if (validityFilter === "valid" && !isValid) return false;

      const hasSelected = !!ft.selected_ps_number;
      const hasOpen     = !ft.selected_ps_number && !!ft.custom_ps_title;
      const ps          = hasSelected ? psMap.get(ft.selected_ps_number) : null;

      if (psFilter === "selected" && !hasSelected) return false;
      if (psFilter === "open"     && !hasOpen)     return false;
      if (psFilter === "none"     && (hasSelected || hasOpen)) return false;

      if (catFilter !== "all") {
        if (!ps) return false;
        if (ps.category !== catFilter) return false;
      }

      if (needle) {
        const hay = [
          ft.name,
          ft.ministry ?? "",
          ft.selected_ps_number ?? "",
          ft.custom_ps_title ?? "",
          ps?.title ?? "",
        ].join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [finalTeams, search, ministryFilter, psFilter, catFilter, validityFilter, psMap, profileMap]);

  // ── CSV Export ─────────────────────────────────────────────────────────────
  function exportCsv() {
    const rows = [
      ["#", "Team Name", "Ministry", "Members", "Team Member Names", "PS Number", "Problem Statement Title", "Category", "Open Innovation Title"],
      ...filtered.map((ft, idx) => {
        const ps      = ft.selected_ps_number ? psMap.get(ft.selected_ps_number) : null;
        const members = (ft.member_ids || []).map((id) => profileMap.get(id)).filter(Boolean);
        return [
          idx + 1,
          ft.name,
          ft.ministry ?? "",
          (ft.member_ids || []).length,
          members.map((m) => m.name ?? "").join(" | "),
          ft.selected_ps_number ?? "",
          ps?.title ?? "",
          ps?.category ?? (ft.custom_ps_title ? "Open Innovation" : ""),
          ft.custom_ps_title ?? "",
        ];
      }),
    ];
    const csv = rows
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = "final-teams-ps.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-[rgba(147,197,253,0.12)] bg-[#0a1226]/60 px-5 py-4 space-y-1">
        <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
          <FileText className="size-4 text-[#c9a227]" />
          Final Teams — Problem Statement Overview
        </h2>
        <p className="text-[11px] text-[#94a3b8]">
          Every final team and the problem statement they have confirmed
        </p>
      </div>

      {/* ── Consider Only Complete Teams Banner ────────────────────────────── */}
      <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/40 via-[#0a1226]/80 to-blue-950/40 p-4 shadow-xl shadow-emerald-950/20 backdrop-blur-md relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold mb-1">
              <ShieldCheck className="size-3.5" />
              Consider Only Complete Teams (Database Data)
            </span>
            <h3 className="text-sm font-bold text-white">Complete 6-Member Teams Summary</h3>
            <p className="text-[11px] text-[#94a3b8]">Database records considering only complete 6-member teams</p>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center shrink-0">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5">
              <p className="text-[10px] text-emerald-300 uppercase font-semibold">Teams</p>
              <p className="text-base font-black text-white">{completeTeamsStats.completeTeamsCount}</p>
            </div>
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-1.5">
              <p className="text-[10px] text-blue-300 uppercase font-semibold">Boys</p>
              <p className="text-base font-black text-white">{completeTeamsStats.boysCount}</p>
            </div>
            <div className="rounded-xl border border-pink-500/20 bg-pink-500/10 px-3 py-1.5">
              <p className="text-[10px] text-pink-300 uppercase font-semibold">Girls</p>
              <p className="text-base font-black text-white">{completeTeamsStats.girlsCount}</p>
            </div>
            <div className="rounded-xl border border-violet-500/20 bg-violet-500/10 px-3 py-1.5">
              <p className="text-[10px] text-violet-300 uppercase font-semibold">Total</p>
              <p className="text-base font-black text-white">{completeTeamsStats.totalStudents}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stat pills ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {[
          { label: "Total Teams",       value: stats.total,    color: "text-white",         bg: "border-[rgba(147,197,253,0.10)] bg-[#0a1226]/60" },
          { label: "PS Confirmed",      value: stats.selected, color: "text-violet-300",    bg: "border-violet-500/20 bg-violet-500/5" },
          { label: "Open Innovation",   value: stats.open,     color: "text-amber-300",     bg: "border-amber-500/20 bg-amber-500/5" },
          { label: "No PS Yet",         value: stats.none,     color: "text-[#94a3b8]",     bg: "border-[rgba(147,197,253,0.10)] bg-[#0a1226]/40" },
          { label: "Software / HW",     value: `${stats.software} / ${stats.hardware}`, color: "text-blue-300", bg: "border-blue-500/20 bg-blue-500/5" },
        ].map((s) => (
          <div key={s.label} className={cn("rounded-2xl border p-3", s.bg)}>
            <p className={cn("text-xl font-black tabular-nums", s.color)}>{s.value}</p>
            <p className="text-[10px] text-[#94a3b8] font-semibold uppercase tracking-wide mt-0.5 leading-tight">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-[rgba(147,197,253,0.10)] bg-[#0a1226]/60 p-4 space-y-3">
        {/* Search + ministry */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[#94a3b8] pointer-events-none" />
            <input
              type="text"
              placeholder="Search team name, ministry, PS number, title…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-[rgba(147,197,253,0.14)] bg-[#050b18]/60 pl-9 pr-8 py-2 text-xs text-white outline-none placeholder:text-[#94a3b8]/50 focus:border-[#c9a227]/50 transition-all"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-white">
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <select
            value={ministryFilter}
            onChange={(e) => setMinistryFilter(e.target.value)}
            className="rounded-xl border border-[rgba(147,197,253,0.14)] bg-[#050b18]/60 px-3 py-2 text-xs text-white outline-none focus:border-[#c9a227]/50 transition-all cursor-pointer min-w-[180px]"
          >
            <option value="all">All Ministries</option>
            {allMinistries.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {/* Team Status chips */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8] shrink-0">Team Status:</span>
          {[
            { id: "all",   label: `All Finals (${stats.total})`,           cls: "bg-[#c9a227]/20 border-[#c9a227]/40 text-[#e8c058]" },
            { id: "valid", label: `Valid Finals (${stats.validCount})`,    cls: "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" },
            { id: "draft", label: `Incomplete Drafts (${stats.draftCount})`, cls: "bg-amber-500/20 border-amber-500/40 text-amber-300" },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setValidityFilter(f.id)}
              className={cn(
                "px-3 py-1 rounded-full text-[10px] font-bold border transition-all cursor-pointer",
                validityFilter === f.id
                  ? f.cls
                  : "bg-transparent border-[rgba(147,197,253,0.14)] text-[#94a3b8] hover:border-[rgba(147,197,253,0.3)] hover:text-white"
              )}
            >
              {f.label}
            </button>
          ))}

          <span className="text-[#94a3b8]/30 mx-1">|</span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8] shrink-0">PS Status:</span>
          {[
            { id: "all",      label: `All (${stats.total})`,             cls: "bg-[#c9a227]/20 border-[#c9a227]/40 text-[#e8c058]" },
            { id: "selected", label: `Confirmed (${stats.selected})`,    cls: "bg-violet-500/20 border-violet-500/40 text-violet-300" },
            { id: "open",     label: `Open Innovation (${stats.open})`,  cls: "bg-amber-500/20 border-amber-500/40 text-amber-300" },
            { id: "none",     label: `No PS Yet (${stats.none})`,        cls: "bg-slate-500/20 border-slate-500/40 text-slate-400" },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => { setPsFilter(f.id); setCatFilter("all"); }}
              className={cn(
                "px-3 py-1 rounded-full text-[10px] font-bold border transition-all cursor-pointer",
                psFilter === f.id
                  ? f.cls
                  : "bg-transparent border-[rgba(147,197,253,0.14)] text-[#94a3b8] hover:border-[rgba(147,197,253,0.3)] hover:text-white"
              )}
            >
              {f.label}
            </button>
          ))}

          <span className="text-[#94a3b8]/30 mx-1">|</span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8] shrink-0">Category:</span>
          {[
            { id: "all",      label: "All",      icon: null },
            { id: "Software", label: `SW (${stats.software})`, icon: <Code2 className="size-3 shrink-0" /> },
            { id: "Hardware", label: `HW (${stats.hardware})`, icon: <Cpu  className="size-3 shrink-0" /> },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setCatFilter(f.id)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border transition-all cursor-pointer",
                catFilter === f.id
                  ? f.id === "Software"
                    ? "bg-blue-500/20 border-blue-500/40 text-blue-300"
                    : f.id === "Hardware"
                    ? "bg-orange-500/20 border-orange-500/40 text-orange-300"
                    : "bg-[#c9a227]/20 border-[#c9a227]/40 text-[#e8c058]"
                  : "bg-transparent border-[rgba(147,197,253,0.14)] text-[#94a3b8] hover:border-[rgba(147,197,253,0.3)] hover:text-white"
              )}
            >
              {f.icon}
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Results header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-[#94a3b8]">
          Showing <span className="text-white font-bold">{filtered.length}</span> of {stats.total} teams
        </p>
        <button
          type="button"
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow"
        >
          <Download className="size-3.5" />
          Export CSV
        </button>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center rounded-2xl border border-[rgba(147,197,253,0.08)] bg-[#0a1226]/40">
          <FileText className="size-8 text-[#94a3b8]/40 mx-auto mb-3" />
          <p className="text-sm text-[#94a3b8]">No teams match the current filters.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-[rgba(147,197,253,0.10)] bg-[#0a1226]/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-[rgba(147,197,253,0.10)] bg-[#050b18]/60 text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">
                  <th className="px-4 py-3 w-8">#</th>
                  <th className="px-4 py-3 min-w-[120px]">Team Name</th>
                  <th className="px-4 py-3 min-w-[160px]">Ministry / Org</th>
                  <th className="px-4 py-3 text-center">Count</th>
                  <th className="px-4 py-3 min-w-[220px]">Team Members</th>
                  <th className="px-4 py-3 min-w-[110px]">PS Number</th>
                  <th className="px-4 py-3 min-w-[300px]">Problem Statement Title</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Theme</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((ft, idx) => {
                  const ps          = ft.selected_ps_number ? psMap.get(ft.selected_ps_number) : null;
                  const isOpen      = !ft.selected_ps_number && !!ft.custom_ps_title;
                  const hasPs       = !!ft.selected_ps_number;
                  const memberIds   = ft.member_ids || [];
                  const members     = memberIds.map((id) => profileMap.get(id)).filter(Boolean);
                  const memberCount = memberIds.length;
                  const isEven      = idx % 2 === 0;

                  return (
                    <tr
                      key={ft.id}
                      className={cn(
                        "border-b border-[rgba(147,197,253,0.06)] transition-colors align-top",
                        hasPs  ? "hover:bg-violet-500/5 bg-violet-500/3" :
                        isOpen ? "hover:bg-amber-500/5  bg-amber-500/3"  :
                        isEven ? "hover:bg-[rgba(147,197,253,0.03)] bg-transparent" :
                                 "hover:bg-[rgba(147,197,253,0.03)] bg-[#050b18]/20"
                      )}
                    >
                      {/* # */}
                      <td className="px-4 py-3 text-[#94a3b8] font-mono tabular-nums">{idx + 1}</td>

                      {/* Team name */}
                      <td className="px-4 py-3">
                        <span className="font-semibold text-white">{ft.name}</span>
                      </td>

                      {/* Ministry */}
                      <td className="px-4 py-3 max-w-[200px]">
                        {ft.ministry
                          ? <span className="text-[#94a3b8] line-clamp-2 leading-snug text-[11px]">{ft.ministry}</span>
                          : <span className="text-[#94a3b8]/30">—</span>}
                      </td>

                      {/* Member count */}
                      <td className="px-4 py-3 text-center tabular-nums">
                        <span className={cn(
                          "text-[11px] font-bold",
                          memberCount === 6 ? "text-emerald-400" : "text-amber-400"
                        )}>
                          {memberCount}/6
                        </span>
                      </td>

                      {/* Team Members — stacked list */}
                      <td className="px-4 py-3">
                        {members.length === 0 ? (
                          <span className="text-[10px] text-[#94a3b8]/40 italic">No members</span>
                        ) : (
                          <div className="space-y-1">
                            {members.map((m) => (
                              <div key={m.id} className="flex items-center gap-1.5">
                                {m.gender === "Female" && (
                                  <span className="text-[8px] font-bold px-1 rounded-full bg-pink-500/15 border border-pink-500/25 text-pink-300 shrink-0">F</span>
                                )}
                                <span className="text-[11px] font-semibold text-white leading-tight truncate">{m.name ?? "—"}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {hasPs ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold font-mono px-2 py-0.5 rounded-full border border-violet-500/40 bg-violet-500/15 text-violet-300">
                            <CheckCircle2 className="size-2.5 shrink-0" />
                            {ft.selected_ps_number}
                          </span>
                        ) : isOpen ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-300">
                            <Sparkles className="size-2.5 shrink-0" /> Open Innovation
                          </span>
                        ) : (
                          <span className="text-[10px] text-[#94a3b8]/40 font-semibold flex items-center gap-1">
                            <AlertTriangle className="size-3 text-amber-500/50" /> Not selected
                          </span>
                        )}
                      </td>

                      {/* Title */}
                      <td className="px-4 py-3 max-w-[360px]">
                        {hasPs && ps ? (
                          <span className="text-xs text-white leading-snug line-clamp-2">{ps.title}</span>
                        ) : isOpen ? (
                          <span className="text-xs text-amber-200/80 leading-snug line-clamp-2 italic">
                            {ft.custom_ps_title}
                          </span>
                        ) : (
                          <span className="text-[#94a3b8]/30">—</span>
                        )}
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {hasPs && ps ? (
                          ps.category === "Software" ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-300">
                              <Code2 className="size-2.5 shrink-0" /> SW
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-300">
                              <Cpu className="size-2.5 shrink-0" /> HW
                            </span>
                          )
                        ) : isOpen ? (
                          <span className="text-[10px] text-amber-400/60">—</span>
                        ) : null}
                      </td>

                      {/* Theme */}
                      <td className="px-4 py-3 max-w-[140px]">
                        {ps?.theme ? (
                          <span className="text-[10px] text-[#94a3b8] line-clamp-1">{ps.theme}</span>
                        ) : <span className="text-[#94a3b8]/30">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
