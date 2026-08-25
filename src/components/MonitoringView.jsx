"use client";

import { useMemo, useState } from "react";
import {
  Users, CheckCircle2, Search, X,
  UserX, RefreshCw, Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { DEPT_CODE } from "@/lib/constants";

function getDeptCode(dept) {
  return DEPT_CODE[dept] ?? (dept ?? "?").replace(/\s+/g, "").toUpperCase().slice(0, 6);
}

function StatusBadge({ active, activeLabel, inactiveLabel, activeColor = "emerald", inactiveColor = "slate" }) {
  return active ? (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border border-${activeColor}-500/35 bg-${activeColor}-500/12 text-${activeColor}-300`}>
      <CheckCircle2 className="size-3 shrink-0" />
      {activeLabel}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border border-[rgba(147,197,253,0.15)] bg-[rgba(147,197,253,0.04)] text-[#94a3b8]">
      <UserX className="size-3 shrink-0" />
      {inactiveLabel}
    </span>
  );
}

/**
 * SPOC MonitoringView
 *
 * Displays all student profiles with two live status tags:
 *   • Paired Team  — participant is in a mentor pair-team
 *   • Final Team   — participant is in a SPOC final team
 *
 * Participants in a final team are always in a paired team too.
 */
export function MonitoringView({ pairTeams = [], finalTeams = [], onRefresh, refreshing = false }) {
  const [q, setQ] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Build all unique member profiles from pair teams ─────────────────────────
  const allProfiles = useMemo(() => {
    const map = new Map();
    for (const t of pairTeams) {
      for (const m of t.members) {
        if (!map.has(m.id)) map.set(m.id, m);
      }
    }
    return [...map.values()];
  }, [pairTeams]);

  // Paired member ids
  const pairedMemberIds = useMemo(() => {
    const set = new Set();
    for (const t of pairTeams) {
      for (const m of t.members) set.add(m.id);
    }
    return set;
  }, [pairTeams]);

  // Final member ids
  const finalMemberIds = useMemo(() => {
    const set = new Set();
    for (const ft of finalTeams) {
      for (const id of ft.member_ids ?? []) set.add(id);
    }
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

  const stats = useMemo(() => {
    const total   = allProfiles.length;
    const paired  = allProfiles.filter((p) => pairedMemberIds.has(p.id)).length;
    const final   = allProfiles.filter((p) => finalMemberIds.has(p.id)).length;
    return { total, paired, unpaired: total - paired, final, notFinal: total - final };
  }, [allProfiles, pairedMemberIds, finalMemberIds]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return allProfiles.filter((p) => {
      const isPaired = pairedMemberIds.has(p.id);
      const isFinal  = finalMemberIds.has(p.id);

      if (statusFilter === "paired"     && !isPaired) return false;
      if (statusFilter === "unpaired"   &&  isPaired) return false;
      if (statusFilter === "final"      && !isFinal)  return false;
      if (statusFilter === "not-final"  &&  isFinal)  return false;
      if (deptFilter && p.department !== deptFilter)  return false;
      if (!needle) return true;

      return [p.name, p.register_no, p.department, p.section, p.year]
        .filter(Boolean).join(" ").toLowerCase().includes(needle);
    });
  }, [allProfiles, q, deptFilter, statusFilter, pairedMemberIds, finalMemberIds]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-[rgba(147,197,253,0.12)] bg-[#0a1226]/60 p-4">
        <div>
          <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
            <Activity className="size-4 text-[#c9a227]" />
            Participant Monitoring
          </h2>
          <p className="text-[11px] text-[#94a3b8] mt-0.5">
            Live status — paired team &amp; final team membership for all participants
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

      {/* Stat pills — clickable filters */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {[
          { label: "Total Participants",  value: stats.total,     filter: "all",       color: "text-white",          border: "border-[rgba(147,197,253,0.15)]",   bg: "bg-[rgba(147,197,253,0.04)]"  },
          { label: "In Pair Team",        value: stats.paired,    filter: "paired",    color: "text-emerald-300",    border: "border-emerald-500/25",             bg: "bg-emerald-500/8"              },
          { label: "No Pair Team",        value: stats.unpaired,  filter: "unpaired",  color: "text-amber-400",      border: "border-amber-500/25",               bg: "bg-amber-500/8"                },
          { label: "In Final Team",       value: stats.final,     filter: "final",     color: "text-[#c9a227]",      border: "border-[#c9a227]/25",               bg: "bg-[#c9a227]/8"                },
          { label: "Not in Final",        value: stats.notFinal,  filter: "not-final", color: "text-[#94a3b8]",      border: "border-[rgba(147,197,253,0.10)]",   bg: "bg-[rgba(147,197,253,0.03)]"  },
        ].map((s) => (
          <button
            key={s.filter}
            type="button"
            onClick={() => setStatusFilter(statusFilter === s.filter ? "all" : s.filter)}
            className={cn(
              "rounded-2xl border p-3 text-left transition-all cursor-pointer",
              s.bg, s.border,
              statusFilter === s.filter && "ring-1 ring-[#c9a227]/40 scale-[1.02]"
            )}
          >
            <p className={cn("text-2xl font-black tabular-nums", s.color)}>{s.value}</p>
            <p className="text-[10px] text-[#94a3b8] font-semibold uppercase tracking-wide mt-0.5 leading-tight">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
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
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-[rgba(147,197,253,0.14)] bg-[#0a1226]/60 px-3 py-2 text-xs text-white outline-none focus:border-[#c9a227]/50 transition-all cursor-pointer"
        >
          <option value="all">All Status</option>
          <option value="paired">In Pair Team</option>
          <option value="unpaired">No Pair Team</option>
          <option value="final">In Final Team</option>
          <option value="not-final">Not in Final Team</option>
        </select>
      </div>

      {/* Count + clear */}
      <p className="text-xs text-[#94a3b8]">
        Showing <span className="font-bold text-white">{filtered.length}</span> of {stats.total} participants
        {(q || deptFilter || statusFilter !== "all") && (
          <button
            type="button"
            onClick={() => { setQ(""); setDeptFilter(""); setStatusFilter("all"); }}
            className="ml-2 text-[#c9a227] hover:underline"
          >
            Clear filters
          </button>
        )}
      </p>

      {/* Table */}
      <div className="rounded-2xl border border-[rgba(147,197,253,0.12)] overflow-hidden">
        {/* Desktop header */}
        <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-3 px-4 py-2.5 bg-[#0a1226] border-b border-[rgba(147,197,253,0.10)]">
          {["Participant", "Dept / Section", "Year", "Gender", "Pair Team", "Final Team"].map((h) => (
            <span key={h} className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">{h}</span>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-[#94a3b8]">
            No participants match the current filters.
          </div>
        ) : (
          <div className="divide-y divide-[rgba(147,197,253,0.08)] max-h-[60vh] overflow-y-auto">
            {filtered.map((p) => {
              const isPaired = pairedMemberIds.has(p.id);
              const isFinal  = finalMemberIds.has(p.id);
              const pairedTeam = pairedTeamMap.get(p.id);
              const finalTeam  = finalTeamMap.get(p.id);

              return (
                <div
                  key={p.id}
                  className={cn(
                    "grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-x-3 gap-y-1.5 px-4 py-3 transition-colors",
                    isFinal
                      ? "bg-[#c9a227]/4 hover:bg-[#c9a227]/8"
                      : isPaired
                      ? "bg-emerald-500/4 hover:bg-emerald-500/8"
                      : "hover:bg-[rgba(147,197,253,0.04)]"
                  )}
                >
                  {/* Name */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar name={p.name} className="size-7 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{p.name}</p>
                      <p className="text-[10px] text-[#94a3b8] truncate">{p.register_no ?? p.email}</p>
                    </div>
                  </div>

                  {/* Dept / Section */}
                  <div className="flex items-center">
                    <p className="text-[11px] text-[#94a3b8] truncate">
                      {getDeptCode(p.department)}
                      {p.section ? ` · ${p.section}` : ""}
                    </p>
                  </div>

                  {/* Year */}
                  <div className="flex items-center">
                    <p className="text-[11px] text-[#94a3b8]">{p.year ?? "—"}</p>
                  </div>

                  {/* Gender */}
                  <div className="flex items-center">
                    {p.gender === "Female" ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-pink-500/30 bg-pink-500/10 text-pink-300">F</span>
                    ) : p.gender === "Male" ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-300">M</span>
                    ) : (
                      <span className="text-[10px] text-[#94a3b8]">—</span>
                    )}
                  </div>

                  {/* Pair Team */}
                  <div className="flex flex-col gap-0.5 justify-center">
                    <StatusBadge
                      active={isPaired}
                      activeLabel="In Pair Team"
                      inactiveLabel="No Pair Team"
                    />
                    {isPaired && pairedTeam && (
                      <p className="text-[9px] text-[#94a3b8] pl-0.5 truncate">
                        {pairedTeam.team_code ?? pairedTeam.name}
                        {pairedTeam.ministry ? ` · ${pairedTeam.ministry}` : ""}
                      </p>
                    )}
                  </div>

                  {/* Final Team */}
                  <div className="flex flex-col gap-0.5 justify-center">
                    <StatusBadge
                      active={isFinal}
                      activeLabel="In Final Team"
                      inactiveLabel="Not in Final"
                    />
                    {isFinal && finalTeam && (
                      <p className="text-[9px] text-[#94a3b8] pl-0.5 truncate">
                        {finalTeam.name}
                        {finalTeam.ministry ? ` · ${finalTeam.ministry}` : ""}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
