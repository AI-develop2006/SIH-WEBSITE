"use client";

import { useMemo, useState } from "react";
import {
  Users, CheckCircle2, Search, X, UserX, RefreshCw, Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/unlumen-ui/avatar";

// ── Helpers ──────────────────────────────────────────────────────────────────

function StatusPill({ active, label }) {
  return active ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 whitespace-nowrap">
      <CheckCircle2 className="size-2.5 shrink-0" />
      {label}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border border-border/40 bg-muted/20 text-muted-foreground whitespace-nowrap">
      <UserX className="size-2.5 shrink-0" />
      {label}
    </span>
  );
}

function MiniTag({ text, color = "default" }) {
  const colors = {
    default: "border-border/30 bg-muted/20 text-muted-foreground",
    gold:    "border-amber-500/30 bg-amber-500/8 text-amber-300",
    blue:    "border-blue-500/30 bg-blue-500/8 text-blue-300",
    emerald: "border-emerald-500/30 bg-emerald-500/8 text-emerald-300",
  };
  return (
    <span className={cn("inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded border truncate max-w-[160px]", colors[color])}>
      {text}
    </span>
  );
}

// ─── Column header ────────────────────────────────────────────────────────────
function TH({ children, className = "" }) {
  return (
    <th className={cn("px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap border-b border-border bg-muted/30", className)}>
      {children}
    </th>
  );
}

// ─── Table cell ───────────────────────────────────────────────────────────────
function TD({ children, className = "" }) {
  return (
    <td className={cn("px-3 py-3 align-top border-b border-border/40", className)}>
      {children}
    </td>
  );
}

/**
 * MonitoringView — Admin structured participant status table
 *
 * Columns (in order):
 *   # | Participant | Department | Year | Section | Gender
 *   | Pair Team | Ministry (Paired) | Pair Status
 *   | Final Team | Ministry (Final) | Final Status
 */
export function MonitoringView({ profiles = [], teams = [], finalTeams = [], onRefresh, refreshing = false }) {
  const [q, setQ] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // ── Lookups ─────────────────────────────────────────────────────────────────
  const pairedMemberIds = useMemo(() => {
    const set = new Set();
    for (const t of teams) {
      for (const m of t.members) set.add(m.id);
      if (t.team.leader_id) set.add(t.team.leader_id);
    }
    return set;
  }, [teams]);

  const finalMemberIds = useMemo(() => {
    const set = new Set();
    for (const ft of finalTeams) {
      for (const id of ft.member_ids ?? []) set.add(id);
    }
    return set;
  }, [finalTeams]);

  // memberId → paired team object
  const pairedTeamMap = useMemo(() => {
    const map = new Map();
    for (const t of teams) {
      for (const m of t.members) {
        if (!map.has(m.id)) map.set(m.id, t.team);
      }
    }
    return map;
  }, [teams]);

  // memberId → final team object
  const finalTeamMap = useMemo(() => {
    const map = new Map();
    for (const ft of finalTeams) {
      for (const id of ft.member_ids ?? []) {
        if (!map.has(id)) map.set(id, ft);
      }
    }
    return map;
  }, [finalTeams]);

  // ── Derived data ─────────────────────────────────────────────────────────────
  const students = useMemo(() => profiles.filter((p) => p.role === "student"), [profiles]);

  const departments = useMemo(
    () => [...new Set(students.map((s) => s.department).filter(Boolean))].sort(),
    [students]
  );

  const years = useMemo(
    () => [...new Set(students.map((s) => s.year).filter(Boolean))].sort(),
    [students]
  );

  // ── Stats ────────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total   = students.length;
    const paired  = students.filter((s) => pairedMemberIds.has(s.id)).length;
    const final   = students.filter((s) => finalMemberIds.has(s.id)).length;
    return { total, paired, unpaired: total - paired, final, notFinal: total - final };
  }, [students, pairedMemberIds, finalMemberIds]);

  // ── Filtered rows ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return students.filter((s) => {
      const isPaired = pairedMemberIds.has(s.id);
      const isFinal  = finalMemberIds.has(s.id);

      if (statusFilter === "paired"    && !isPaired) return false;
      if (statusFilter === "unpaired"  &&  isPaired) return false;
      if (statusFilter === "final"     && !isFinal)  return false;
      if (statusFilter === "not-final" &&  isFinal)  return false;
      if (deptFilter && s.department !== deptFilter) return false;
      if (yearFilter && s.year !== yearFilter) return false;
      if (!needle) return true;

      return [s.name, s.register_no, s.email, s.department, s.section, s.year]
        .filter(Boolean).join(" ").toLowerCase().includes(needle);
    });
  }, [students, q, deptFilter, yearFilter, statusFilter, pairedMemberIds, finalMemberIds]);

  return (
    <div className="space-y-4">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold flex items-center gap-2">
            <Activity className="size-4 text-primary" />
            Participant Monitoring
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Live status — pair team &amp; final team membership for all registered participants
          </p>
        </div>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50 self-start"
          >
            <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        )}
      </div>

      {/* ── Stat pills ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {[
          { label: "Total",         value: stats.total,    filter: "all",       color: "text-foreground"         },
          { label: "In Pair Team",  value: stats.paired,   filter: "paired",    color: "text-emerald-400"        },
          { label: "No Pair Team",  value: stats.unpaired, filter: "unpaired",  color: "text-amber-400"          },
          { label: "In Final Team", value: stats.final,    filter: "final",     color: "text-blue-400"           },
          { label: "Not in Final",  value: stats.notFinal, filter: "not-final", color: "text-muted-foreground"   },
        ].map((s) => (
          <button
            key={s.filter}
            type="button"
            onClick={() => setStatusFilter(statusFilter === s.filter ? "all" : s.filter)}
            className={cn(
              "rounded-xl border px-3 py-2.5 text-left transition-all cursor-pointer bg-card hover:border-foreground/20",
              statusFilter === s.filter ? "border-primary/50 ring-1 ring-primary/30" : "border-border"
            )}
          >
            <p className={cn("text-xl font-black tabular-nums", s.color)}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mt-0.5">{s.label}</p>
          </button>
        ))}
      </div>

      {/* ── Filters row ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search name, register no, section…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-xl border border-border bg-card pl-9 pr-8 py-2 text-xs text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary/50 transition-all"
          />
          {q && (
            <button type="button" onClick={() => setQ("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Department */}
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground outline-none focus:border-primary/50 transition-all cursor-pointer"
        >
          <option value="">All Departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>

        {/* Year */}
        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground outline-none focus:border-primary/50 transition-all cursor-pointer"
        >
          <option value="">All Years</option>
          {years.map((y) => <option key={y} value={y}>Year {y}</option>)}
        </select>

        {/* Status */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground outline-none focus:border-primary/50 transition-all cursor-pointer"
        >
          <option value="all">All Status</option>
          <option value="paired">In Pair Team</option>
          <option value="unpaired">No Pair Team</option>
          <option value="final">In Final Team</option>
          <option value="not-final">Not in Final Team</option>
        </select>

        {/* Clear */}
        {(q || deptFilter || yearFilter || statusFilter !== "all") && (
          <button
            type="button"
            onClick={() => { setQ(""); setDeptFilter(""); setYearFilter(""); setStatusFilter("all"); }}
            className="rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
          >
            ✕ Clear
          </button>
        )}
      </div>

      {/* Count */}
      <p className="text-xs text-muted-foreground">
        Showing <span className="font-bold text-foreground">{filtered.length}</span> of {stats.total} participants
      </p>

      {/* ── Table ────────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border overflow-hidden">
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
                  <td colSpan={12} className="py-16 text-center text-sm text-muted-foreground border-b border-border/40">
                    No participants match the current filters.
                  </td>
                </tr>
              ) : (
                filtered.map((s, idx) => {
                  const isPaired   = pairedMemberIds.has(s.id);
                  const isFinal    = finalMemberIds.has(s.id);
                  const pairedTeam = pairedTeamMap.get(s.id);
                  const finalTeam  = finalTeamMap.get(s.id);

                  return (
                    <tr
                      key={s.id}
                      className={cn(
                        "transition-colors",
                        isFinal
                          ? "bg-blue-500/4 hover:bg-blue-500/8"
                          : isPaired
                          ? "bg-emerald-500/4 hover:bg-emerald-500/8"
                          : "hover:bg-muted/10"
                      )}
                    >
                      {/* # */}
                      <TD className="text-[10px] text-muted-foreground tabular-nums">{idx + 1}</TD>

                      {/* Participant */}
                      <TD>
                        <div className="flex items-center gap-2 min-w-[160px]">
                          <Avatar name={s.name} className="size-7 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-foreground truncate">{s.name}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{s.register_no ?? s.email}</p>
                          </div>
                        </div>
                      </TD>

                      {/* Department */}
                      <TD>
                        <span className="text-xs text-foreground whitespace-nowrap">{s.department ?? "—"}</span>
                      </TD>

                      {/* Year */}
                      <TD>
                        <span className="text-xs text-foreground">{s.year ?? "—"}</span>
                      </TD>

                      {/* Section */}
                      <TD>
                        <span className="text-xs text-foreground">{s.section ?? "—"}</span>
                      </TD>

                      {/* Gender */}
                      <TD>
                        {s.gender === "Female" ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-pink-500/30 bg-pink-500/10 text-pink-300">F</span>
                        ) : s.gender === "Male" ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-300">M</span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                      </TD>

                      {/* Pair Team code */}
                      <TD>
                        {pairedTeam
                          ? <MiniTag text={pairedTeam.team_code ?? pairedTeam.name} color="default" />
                          : <span className="text-[10px] text-muted-foreground">—</span>
                        }
                      </TD>

                      {/* Ministry (Paired) */}
                      <TD>
                        {pairedTeam?.ministry
                          ? <MiniTag text={pairedTeam.ministry} color="gold" />
                          : <span className="text-[10px] text-muted-foreground">Not assigned</span>
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
                          : <span className="text-[10px] text-muted-foreground">—</span>
                        }
                      </TD>

                      {/* Ministry (Final) */}
                      <TD>
                        {finalTeam?.ministry
                          ? <MiniTag text={finalTeam.ministry} color="emerald" />
                          : <span className="text-[10px] text-muted-foreground">—</span>
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
