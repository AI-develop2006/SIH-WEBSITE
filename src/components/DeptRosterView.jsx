"use client";

import { useMemo, useState } from "react";
import { Download, Users, CheckCircle2, UserX, Filter, X, Cpu, Code2, Search, Sparkles, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEPT_CODE } from "@/lib/constants";
import { SIH2026_PROBLEMS } from "@/lib/sih2026Problems";

/**
 * DeptRosterView — Team-based final teams roster
 *
 * Each row = one final team.
 * Members listed vertically inside the row.
 * Columns: # | Team Name | Members | Department(s) | Year(s) | Section(s) | Ministry | Problem Statement | Category
 *
 * Filters: Ministry, PS Category, PS Status
 * Stats:  counts by team (Software / Hardware / Open Innovation / No PS Yet)
 * Export: CSV (team-centric)
 */

function deptLabel(dept) {
  return DEPT_CODE[dept] ?? (dept ?? "Unknown").slice(0, 20);
}

export function DeptRosterView({ allProfiles = [], pairTeams = [], finalTeams = [] }) {

  // ── Pre-compute PS lookup ───────────────────────────────────────────────
  const psMap = useMemo(
    () => new Map(SIH2026_PROBLEMS.map((p) => [p.psNumber, p])),
    []
  );

  // ── Profile lookup ──────────────────────────────────────────────────────
  const profileById = useMemo(
    () => new Map(allProfiles.map((p) => [p.id, p])),
    [allProfiles]
  );

  // ── Enrich final teams with resolved members and PS info ────────────────
  const enriched = useMemo(() => finalTeams.map((ft) => {
    const members  = (ft.member_ids || []).map((id) => profileById.get(id)).filter(Boolean);
    let psNumber   = "";
    let psTitle    = "";
    let psCategory = "";
    let psStatus   = "none"; // "software" | "hardware" | "open" | "none"

    if (ft.selected_ps_number) {
      const ps   = psMap.get(ft.selected_ps_number);
      psNumber   = ft.selected_ps_number;
      psTitle    = ps?.title    ?? "";
      psCategory = ps?.category ?? "";
      psStatus   = psCategory === "Software" ? "software" : "hardware";
    } else if (ft.custom_ps_title) {
      psNumber   = "Open Innovation";
      psTitle    = ft.custom_ps_title;
      psCategory = "Open Innovation";
      psStatus   = "open";
    }

    return { ft, members, psNumber, psTitle, psCategory, psStatus };
  }), [finalTeams, profileById, psMap]);

  // ── Filter state ────────────────────────────────────────────────────────
  const [ministryFilter, setMinistryFilter] = useState("all");
  const [psFilter, setPsFilter]             = useState("");   // "" | "software" | "hardware" | "open" | "none"
  const [search, setSearch]                 = useState("");

  // Unique ministries
  const ministries = useMemo(() => {
    const s = new Set(finalTeams.map((ft) => ft.ministry).filter(Boolean));
    return [...s].sort();
  }, [finalTeams]);

  // ── Filtered rows ───────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return enriched.filter(({ ft, members, psNumber, psTitle, psStatus }) => {
      if (ministryFilter !== "all" && ft.ministry !== ministryFilter) return false;
      if (psFilter && psStatus !== psFilter) return false;
      if (needle) {
        const hay = [
          ft.name,
          ft.ministry ?? "",
          psNumber,
          psTitle,
          ...members.map((m) => `${m.name ?? ""} ${m.register_no ?? ""}`),
        ].join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [enriched, ministryFilter, psFilter, search]);

  // ── Team-based counts ───────────────────────────────────────────────────
  const counts = useMemo(() => ({
    total:    enriched.length,
    software: enriched.filter((e) => e.psStatus === "software").length,
    hardware: enriched.filter((e) => e.psStatus === "hardware").length,
    open:     enriched.filter((e) => e.psStatus === "open").length,
    none:     enriched.filter((e) => e.psStatus === "none").length,
  }), [enriched]);

  // ── CSV Export ──────────────────────────────────────────────────────────
  function exportCsv() {
    const rows = [
      ["#", "Team Name", "Member Name", "Register No", "Gender", "Department", "Year", "Section", "Ministry", "PS Number", "PS Title", "Category"],
    ];

    filtered.forEach(({ ft, members, psNumber, psTitle, psCategory }, idx) => {
      if (members.length === 0) {
        rows.push([idx + 1, ft.name, "(no members)", "", "", "", "", "", ft.ministry ?? "", psNumber || "Pending", psTitle || "", psCategory || "Pending"]);
      } else {
        members.forEach((m, mIdx) => {
          rows.push([
            mIdx === 0 ? idx + 1 : "",   // # only on first member row
            mIdx === 0 ? ft.name : "",    // team name only on first member row
            m.name        ?? "",
            m.register_no ?? "",
            m.gender      ?? "",
            m.department  ?? "",
            m.year        ?? "",
            m.section     ?? "",
            mIdx === 0 ? (ft.ministry ?? "") : "",
            mIdx === 0 ? (psNumber || "Pending") : "",
            mIdx === 0 ? (psTitle  || "")        : "",
            mIdx === 0 ? (psCategory || "Pending") : "",
          ]);
        });
      }
      rows.push(["", "", "", "", "", "", "", "", "", "", "", ""]); // blank separator
    });

    const csv = rows
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `final-teams-roster${ministryFilter !== "all" ? `_${ministryFilter.slice(0, 20)}` : ""}${psFilter ? `_${psFilter}` : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const hasFilters = ministryFilter !== "all" || psFilter || search;

  return (
    <div className="space-y-5">

      {/* ── Stat pills (team-based) ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { id: "software", label: "Software PS",     value: counts.software, color: "text-blue-300",    bg: "border-blue-500/20 bg-blue-500/5",    icon: <Code2 className="size-3.5 text-blue-400" /> },
          { id: "hardware", label: "Hardware PS",     value: counts.hardware, color: "text-orange-300",  bg: "border-orange-500/20 bg-orange-500/5", icon: <Cpu  className="size-3.5 text-orange-400" /> },
          { id: "open",     label: "Open Innovation", value: counts.open,     color: "text-amber-300",   bg: "border-amber-500/20 bg-amber-500/5",   icon: <span className="text-sm">✨</span> },
          { id: "none",     label: "No PS Yet",       value: counts.none,     color: "text-[#94a3b8]",   bg: "border-[rgba(147,197,253,0.10)] bg-[#0a1226]/40", icon: null },
        ].map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setPsFilter(psFilter === s.id ? "" : s.id)}
            className={cn(
              "rounded-2xl border p-3 text-left transition-all cursor-pointer",
              s.bg,
              psFilter === s.id && "ring-2 ring-[#c9a227]/30 scale-[1.02]"
            )}
          >
            <div className="flex items-center gap-1.5 mb-1">{s.icon}<span className="text-[10px] font-bold uppercase tracking-wide text-[#94a3b8]">{s.label}</span></div>
            <p className={cn("text-2xl font-black tabular-nums", s.color)}>{s.value}</p>
            <p className="text-[9px] text-[#94a3b8]/60 mt-0.5">
              {counts.total > 0 ? `${Math.round((s.value / counts.total) * 100)}% of ${counts.total} teams` : "—"}
            </p>
          </button>
        ))}
      </div>

      {/* ── Filter bar ──────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-[rgba(147,197,253,0.12)] bg-[#0a1226]/60 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Filter className="size-3.5 text-[#c9a227]" />
          <span className="text-xs font-bold uppercase tracking-wider text-[#94a3b8]">Filters</span>
          <span className="text-[10px] text-[#94a3b8]/50 ml-1">— {filtered.length} of {counts.total} teams</span>
          {hasFilters && (
            <button
              type="button"
              onClick={() => { setMinistryFilter("all"); setPsFilter(""); setSearch(""); }}
              className="ml-auto flex items-center gap-1 text-[10px] text-[#94a3b8] hover:text-white transition-colors"
            >
              <X className="size-3" /> Clear all
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[#94a3b8] pointer-events-none" />
            <input
              type="text"
              placeholder="Search team name, member, PS number…"
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

          {/* Ministry */}
          <select
            value={ministryFilter}
            onChange={(e) => setMinistryFilter(e.target.value)}
            className="rounded-xl border border-[rgba(147,197,253,0.14)] bg-[#050b18]/60 px-3 py-2 text-xs text-white outline-none focus:border-[#c9a227]/50 transition-all cursor-pointer min-w-[180px]"
          >
            <option value="all">All Ministries</option>
            {ministries.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {/* PS status chips */}
        <div className="flex flex-wrap gap-2">
          {[
            { id: "",         label: `All Teams (${counts.total})`,         cls: "bg-[#c9a227]/20 border-[#c9a227]/40 text-[#e8c058]" },
            { id: "software", label: `Software (${counts.software})`,       cls: "bg-blue-500/20 border-blue-500/40 text-blue-300"    },
            { id: "hardware", label: `Hardware (${counts.hardware})`,       cls: "bg-orange-500/20 border-orange-500/40 text-orange-300" },
            { id: "open",     label: `Open Innovation (${counts.open})`,    cls: "bg-amber-500/20 border-amber-500/40 text-amber-300"  },
            { id: "none",     label: `No PS Yet (${counts.none})`,          cls: "bg-slate-500/20 border-slate-500/40 text-slate-400"  },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setPsFilter(f.id)}
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
        </div>
      </div>

      {/* ── Results header ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-[#94a3b8]">
          Showing <span className="text-white font-bold">{filtered.length}</span> team{filtered.length !== 1 ? "s" : ""}
          {ministryFilter !== "all" && <span className="ml-1 text-[#c9a227] font-semibold">in {ministryFilter.slice(0, 30)}</span>}
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

      {/* ── Table ────────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center rounded-2xl border border-[rgba(147,197,253,0.08)] bg-[#0a1226]/40">
          <Users className="size-8 text-[#94a3b8]/40 mx-auto mb-3" />
          <p className="text-sm text-[#94a3b8]">No teams match the current filters.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-[rgba(147,197,253,0.10)] bg-[#0a1226]/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-[rgba(147,197,253,0.10)] bg-[#050b18]/60 text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">
                  <th className="px-4 py-3 w-8">#</th>
                  <th className="px-4 py-3 min-w-[140px]">Team Name</th>
                  <th className="px-4 py-3 min-w-[320px]">Team Members · Dept · Year · Section</th>
                  <th className="px-4 py-3 min-w-[160px]">Ministry</th>
                  <th className="px-4 py-3 min-w-[280px]">Problem Statement</th>
                  <th className="px-4 py-3">Category</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ ft, members, psNumber, psTitle, psCategory, psStatus }, idx) => {
                  const isEven = idx % 2 === 0;

                  return (
                    <tr
                      key={ft.id}
                      className={cn(
                        "border-b border-[rgba(147,197,253,0.06)] transition-colors hover:bg-[rgba(147,197,253,0.04)] align-top",
                        isEven ? "bg-transparent" : "bg-[#050b18]/20"
                      )}
                    >
                      {/* # */}
                      <td className="px-4 py-3 text-[#94a3b8] font-mono tabular-nums">{idx + 1}</td>

                      {/* Team Name */}
                      <td className="px-4 py-3">
                        <p className="font-extrabold text-white text-[11px] leading-tight">{ft.name}</p>
                        <p className="text-[9px] text-[#94a3b8] mt-0.5">{members.length}/6 members</p>
                      </td>

                      {/* Members — each with their own dept / year / section inline */}
                      <td className="px-4 py-3">
                        <div className="space-y-2">
                          {members.length === 0 ? (
                            <span className="text-[10px] text-[#94a3b8]/40 italic">No members</span>
                          ) : members.map((m) => (
                            <div key={m.id} className="space-y-0.5">
                              {/* Name row */}
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[11px] font-semibold text-white leading-tight">{m.name ?? "—"}</span>
                                {m.gender === "Female" && (
                                  <span className="text-[8px] font-bold px-1 py-0 rounded-full bg-pink-500/15 border border-pink-500/25 text-pink-300">F</span>
                                )}
                                <span className="text-[9px] font-mono text-[#94a3b8]/70">{m.register_no ?? ""}</span>
                              </div>
                              {/* Dept · Year · Section */}
                              <p className="text-[9px] text-[#94a3b8] leading-tight pl-0.5">
                                <span className="text-[#94a3b8]/80">{deptLabel(m.department ?? "") || "—"}</span>
                                {m.year    && <span className="before:content-['·'] before:mx-1 before:text-[#94a3b8]/40">Yr {m.year}</span>}
                                {m.section && <span className="before:content-['·'] before:mx-1 before:text-[#94a3b8]/40">Sec {(m.section ?? "").toUpperCase()}</span>}
                              </p>
                            </div>
                          ))}
                        </div>
                      </td>

                      {/* Ministry */}
                      <td className="px-4 py-3 max-w-[180px]">
                        {ft.ministry
                          ? <span className="text-[10px] text-[#94a3b8] leading-snug line-clamp-2">{ft.ministry}</span>
                          : <span className="text-[#94a3b8]/30 text-[10px]">—</span>}
                      </td>

                      {/* Problem Statement */}
                      <td className="px-4 py-3 max-w-[300px]">
                        {psStatus === "none" ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-amber-500/40 bg-amber-500/15 text-amber-300">
                            <AlertTriangle className="size-2.5 shrink-0" /> ⏳ Pending
                          </span>
                        ) : psStatus === "open" ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300">
                              ✨ Open Innovation
                            </span>
                            <p className="text-[10px] text-white leading-snug line-clamp-2">{psTitle}</p>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="text-[11px] font-extrabold font-mono text-violet-300">{psNumber}</span>
                            <p className="text-[10px] text-[#94a3b8] leading-snug line-clamp-2">{psTitle}</p>
                          </div>
                        )}
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {psStatus === "software" ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-300">
                            <Code2 className="size-2.5 shrink-0" /> SW
                          </span>
                        ) : psStatus === "hardware" ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-300">
                            <Cpu className="size-2.5 shrink-0" /> HW
                          </span>
                        ) : psStatus === "open" ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300">
                            ✨ Open
                          </span>
                        ) : (
                          <span className="text-[10px] text-[#94a3b8]/40">—</span>
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
    </div>
  );
}
