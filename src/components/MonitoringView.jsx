"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2, Search, X, UserX, RefreshCw, Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { DEPT_CODE } from "@/lib/constants";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getDeptCode(dept) {
  return DEPT_CODE[dept] ?? (dept ?? "?").replace(/\s+/g, "").toUpperCase().slice(0, 6);
}

function StatusPill({ active, label }) {
  return active ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 whitespace-nowrap">
      <CheckCircle2 className="size-2.5 shrink-0" />
      {label}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border border-[rgba(147,197,253,0.15)] bg-[rgba(147,197,253,0.04)] text-[#94a3b8] whitespace-nowrap">
      <UserX className="size-2.5 shrink-0" />
      {label}
    </span>
  );
}

function MiniTag({ text, color = "default" }) {
  const colors = {
    default: "border-[rgba(147,197,253,0.2)] bg-[rgba(147,197,253,0.06)] text-[#94a3b8]",
    gold:    "border-[#c9a227]/30 bg-[#c9a227]/8 text-[#e8c058]",
    blue:    "border-blue-500/30 bg-blue-500/8 text-blue-300",
    emerald: "border-emerald-500/30 bg-emerald-500/8 text-emerald-300",
  };
  return (
    <span className={cn("inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded border truncate max-w-[160px]", colors[color])}>
      {text}
    </span>
  );
}

function TH({ children, className = "" }) {
  return (
    <th className={cn(
      "px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-[#94a3b8] whitespace-nowrap",
      "border-b border-[rgba(147,197,253,0.10)] bg-[#0a1226]",
      className
    )}>
      {children}
    </th>
  );
}

function TD({ children, className = "" }) {
  return (
    <td className={cn("px-3 py-3 align-top border-b border-[rgba(147,197,253,0.06)]", className)}>
      {children}
    </td>
  );
}

/**
 * SPOC MonitoringView — structured participant status table
 *
 * Columns:
 *   # | Participant | Department | Year | Section | Gender
 *   | Pair Team | Ministry (Paired) | Pair Status
 *   | Final Team | Ministry (Final) | Final Status
 */
export function MonitoringView({ pairTeams = [], finalTeams = [], onRefresh, refreshing = false }) {
  const [q, setQ] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // ── Build all unique profiles from pairTeams ──────────────────────────────
  const allProfiles = useMemo(() => {
    const map = new Map();
    for (const t of pairTeams) {
      for (const m of t.members) {
        if (!map.has(m.id)) map.set(m.id, m);
      }
    }
    return [...map.values()];
  }, [pairTeams]);

  // ── Lookups ───────────────────────────────────────────────────────────────
  const pairedMemberIds = useMemo(() => {
    const set = new Set();
    for (const t of pairTeams) for (const m of t.members) set.add(m.id);
    return set;
  }, [pairTeams]);

  const finalMemberIds = useMemo(() => {
    const set = new Set();
    for (const ft of finalTeams) for (const id of ft.member_ids ?? []) set.add(id);
    return set;
  }, [finalTeams]);

  // memberId → pair team
  const pairedTeamMap = useMemo(() => {
    const map = new Map();
    for (const t of pairTeams) {
      for (const m of t.members) {
        if (!map.has(m.id)) map.set(m.id, t.team);
      }
    }
    return map;
  }, [pairTeams]);

  // memberId → final team
  const finalTeamMap = useMemo(() => {
    const map = new Map();
    for (const ft of finalTeams) {
      for (const id of ft.member_ids ?? []) {
        if (!map.has(id)) map.set(id, ft);
      }
    }
    return map;
  }, [finalTeams]);

  const departments = useMemo(
    () => [...new Set(allProfiles.map((p) => p.department).filter(Boolean))].sort(),
    [allProfiles]
  );

  const years = useMemo(
    () => [...new Set(allProfiles.map((p) => p.year).filter(Boolean))].sort(),
    [allProfiles]
  );

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total   = allProfiles.length;
    const paired  = allProfiles.filter((p) => pairedMemberIds.has(p.id)).length;
    const final   = allProfiles.filter((p) => finalMemberIds.has(p.id)).length;
    return { total, paired, unpaired: total - paired, final, notFinal: total - final };
  }, [allProfiles, pairedMemberIds, finalMemberIds]);

  // ── Filtered rows ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return allProfiles.filter((p) => {
      const isPaired = pairedMemberIds.has(p.id);
      const isFinal  = finalMemberIds.has(p.id);

      if (statusFilter === "paired"    && !isPaired) return false;
      if (statusFilter === "unpaired"  &&  isPaired) return false;
      if (statusFilter === "final"     && !isFinal)  return false;
      if (statusFilter === "not-final" &&  isFinal)  return false;
      if (deptFilter && p.department !== deptFilter) return false;
      if (yearFilter && p.year !== yearFilter) return false;
      if (!needle) return true;

      return [p.name, p.register_no, p.department, p.section, p.year]
        .filter(Boolean).join(" ").toLowerCase().includes(needle);
    });
  }, [allProfiles, q, deptFilter, yearFilter, statusFilter, pairedMemberIds, finalMemberIds]);

  return (
    <div className="space-y-5">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-[rgba(147,197,253,0.12)] bg-[#0a1226]/60 p-4">
        <div>
          <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
            <Activity className="size-4 text-[#c9a227]" />
            Participant Monitoring
          </h2>
          <p className="text-[11px] text-[#94a3b8] mt-0.5">
            Live status — pair team &amp; final team for all participants
          </p>
        </div>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-[rgba(147,197,253,0.14)] text-[#94a3b8] hover:text-white hover:border-[rgba(147,197,253,0.3)] transition-all disabled:opacity-50 self-start cursor-pointer"
          >
            <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        )}
      </div>

      {/* ── Stat pills ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {[
          { label: "Total",         value: stats.total,    filter: "all",       color: "text-white"          },
          { label: "In Pair Team",  value: stats.paired,   filter: "paired",    color: "text-emerald-300"    },
          { label: "No Pair Team",  value: stats.unpaired, filter: "unpaired",  color: "text-amber-400"      },
          { label: "In Final Team", value: stats.final,    filter: "final",     color: "text-[#c9a227]"      },
          { label: "Not in Final",  value: stats.notFinal, filter: "not-final", color: "text-[#94a3b8]"      },
        ].map((s) => (
          <button
            key={s.filter}
            type="button"
            onClick={() => setStatusFilter(statusFilter === s.filter ? "all" : s.filter)}
            className={cn(
              "rounded-2xl border p-3 text-left transition-all cursor-pointer bg-[#0a1226]/60",
              statusFilter === s.filter
                ? "border-[#c9a227]/40 ring-1 ring-[#c9a227]/20 scale-[1.02]"
                : "border-[rgba(147,197,253,0.10)] hover:border-[rgba(147,197,253,0.22)]"
            )}
          >
            <p className={cn("text-2xl font-black tabular-nums", s.color)}>{s.value}</p>
            <p className="text-[10px] text-[#94a3b8] font-semibold uppercase tracking-wide mt-0.5 leading-tight">{s.label}</p>
          </button>
        ))}
      </div>

      {/* ── Filters row ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[#94a3b8] pointer-events-none" />
          <input
            type="text"
            placeholder="Search name, register no, section…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-xl border border-[rgba(147,197,253,0.14)] bg-[#0a1226]/60 pl-9 pr-8 py-2 text-xs text-white outline-none placeholder:text-[#94a3b8]/50 focus:border-[#c9a227]/50 transition-all"
          />
          {q && (
            <button type="button" onClick={() => setQ("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-white">
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="rounded-xl border border-[rgba(147,197,253,0.14)] bg-[#0a1226]/60 px-3 py-2 text-xs text-white outline-none focus:border-[#c9a227]/50 transition-all cursor-pointer"
        >
          <option value="">All Departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>

        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="rounded-xl border border-[rgba(147,197,253,0.14)] bg-[#0a1226]/60 px-3 py-2 text-xs text-white outline-none focus:border-[#c9a227]/50 transition-all cursor-pointer"
        >
          <option value="">All Years</option>
          {years.map((y) => <option key={y} value={y}>Year {y}</option>)}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-[rgba(147,197,253,0.14)] bg-[#0a1226]/60 px-3 py-2 text-xs text-white outline-none focus:border-[#c9a227]/50 transition-all cursor-pointer"
        >
          <option value="">All Status</option>
          <option value="paired">In Pair Team</option>
          <option value="unpaired">No Pair Team</option>
          <option value="final">In Final Team</option>
          <option value="not-final">Not in Final Team</option>
        </select>

        {(q || deptFilter || yearFilter || statusFilter !== "all") && (
          <button
            type="button"
            onClick={() => { setQ(""); setDeptFilter(""); setYearFilter(""); setStatusFilter("all"); }}
            className="rounded-xl border border-[rgba(147,197,253,0.14)] bg-[#0a1226]/60 px-3 py-2 text-xs text-[#94a3b8] hover:text-white transition-all"
          >
            ✕ Clear
          </button>
        )}
      </div>

      {/* Count */}
      <p className="text-xs text-[#94a3b8]">
        Showing <span className="font-bold text-white">{filtered.length}</span> of {stats.total} participants
      </p>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-[rgba(147,197,253,0.12)] overflow-hidden">
        <div className="overflow-x-auto max-h-[65vh] overflow-y-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10">
              <tr>
                <TH className="w-8">#</TH>
                <TH>Participant</TH>
                <TH>Department</TH>
                <TH>Year</TH>
                <TH>Section</TH>
                <TH>Gender</TH>
                <TH>Pair Team</TH>
                <TH>Ministry (Paired)</TH>
                <TH>Pair Status</TH>
                <TH>Final Team</TH>
                <TH>Ministry (Final)</TH>
                <TH>Final Status</TH>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-16 text-center text-sm text-[#94a3b8] border-b border-[rgba(147,197,253,0.06)]">
                    No participants match the current filters.
                  </td>
                </tr>
              ) : (
                filtered.map((p, idx) => {
                  const isPaired   = pairedMemberIds.has(p.id);
                  const isFinal    = finalMemberIds.has(p.id);
                  const pairedTeam = pairedTeamMap.get(p.id);
                  const finalTeam  = finalTeamMap.get(p.id);

                  return (
                    <tr
                      key={p.id}
                      className={cn(
                        "transition-colors",
                        isFinal
                          ? "bg-[#c9a227]/4 hover:bg-[#c9a227]/8"
                          : isPaired
                          ? "bg-emerald-500/4 hover:bg-emerald-500/8"
                          : "hover:bg-[rgba(147,197,253,0.04)]"
                      )}
                    >
                      {/* # */}
                      <TD className="text-[10px] text-[#94a3b8] tabular-nums">{idx + 1}</TD>

                      {/* Participant */}
                      <TD>
                        <div className="flex items-center gap-2 min-w-[160px]">
                          <Avatar name={p.name} className="size-7 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-white truncate">{p.name}</p>
                            <p className="text-[10px] text-[#94a3b8] truncate">{p.register_no ?? p.email}</p>
                          </div>
                        </div>
                      </TD>

                      {/* Department */}
                      <TD>
                        <span className="text-xs text-white whitespace-nowrap">{p.department ?? "—"}</span>
                      </TD>

                      {/* Year */}
                      <TD>
                        <span className="text-xs text-white">{p.year ?? "—"}</span>
                      </TD>

                      {/* Section */}
                      <TD>
                        <span className="text-xs text-white">{p.section ?? "—"}</span>
                      </TD>

                      {/* Gender */}
                      <TD>
                        {p.gender === "Female" ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-pink-500/30 bg-pink-500/10 text-pink-300">F</span>
                        ) : p.gender === "Male" ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-300">M</span>
                        ) : (
                          <span className="text-[10px] text-[#94a3b8]">—</span>
                        )}
                      </TD>

                      {/* Pair Team code */}
                      <TD>
                        {pairedTeam
                          ? <MiniTag text={pairedTeam.team_code ?? pairedTeam.name} />
                          : <span className="text-[10px] text-[#94a3b8]">—</span>
                        }
                      </TD>

                      {/* Ministry (Paired) */}
                      <TD>
                        {pairedTeam?.ministry
                          ? <MiniTag text={pairedTeam.ministry} color="gold" />
                          : <span className="text-[10px] text-[#94a3b8]">Not assigned</span>
                        }
                      </TD>

                      {/* Pair Status */}
                      <TD>
                        <StatusPill active={isPaired} label={isPaired ? "In Pair Team" : "No Pair Team"} />
                      </TD>

                      {/* Final Team name */}
                      <TD>
                        {finalTeam
                          ? <MiniTag text={finalTeam.name} color="blue" />
                          : <span className="text-[10px] text-[#94a3b8]">—</span>
                        }
                      </TD>

                      {/* Ministry (Final) */}
                      <TD>
                        {finalTeam?.ministry
                          ? <MiniTag text={finalTeam.ministry} color="emerald" />
                          : <span className="text-[10px] text-[#94a3b8]">—</span>
                        }
                      </TD>

                      {/* Final Status */}
                      <TD>
                        <StatusPill active={isFinal} label={isFinal ? "In Final Team" : "Not in Final"} />
                      </TD>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
