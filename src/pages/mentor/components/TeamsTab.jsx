import { useState, useMemo, memo } from "react";
import { Button } from "@/components/unlumen-ui/button";
import {
  Users, User, LayoutGrid, Building2, Download, AlertTriangle, Lock, Plus, ChevronUp, ChevronDown,
} from "lucide-react";
import { cn, computeStats, isSameDepartment, normalizeDepartment } from "@/lib/utils";
import { MINISTRIES, MAX_MEMBERS_PER_MINISTRY_PER_DEPT } from "@/lib/constants";
import { StudentDetailModal } from "./StudentDetailModal";
import { TeamDetailsModal } from "./TeamDetailsModal";
import { TeamFormationRules } from "./TeamFormationRules";

const CAP = MAX_MEMBERS_PER_MINISTRY_PER_DEPT;

// ─── Ministry Panel (inline within Teams Builder) ────────────────────────────
function MinistriesPanel({ teams, mentorDept }) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");

  // Only teams belonging to this mentor's dept
  const deptTeams = useMemo(
    () => teams.filter((t) => {
      if (!mentorDept) return true;
      // Prefer the explicit created_by_dept field
      if (t.team.created_by_dept) return isSameDepartment(t.team.created_by_dept, mentorDept);
      // Legacy teams: infer from member departments
      if (t.members.length > 0) {
        return t.members.every((m) => !m.department || isSameDepartment(m.department, mentorDept));
      }
      // Empty legacy team with no dept info — show to nobody except if no mentorDept
      return false;
    }),
    [teams, mentorDept]
  );

  const ministryData = useMemo(() => {
    const map = new Map();
    for (const m of MINISTRIES) map.set(m, { teams: [], membersByDept: {} });
    for (const t of deptTeams) {
      const ministry = t.team.ministry;
      if (!ministry) continue;
      if (!map.has(ministry)) map.set(ministry, { teams: [], membersByDept: {} });
      const entry = map.get(ministry);
      entry.teams.push(t);
      for (const m of t.members) {
        const dept = m.department || "Unknown";
        entry.membersByDept[dept] = (entry.membersByDept[dept] || 0) + 1;
      }
    }
    return map;
  }, [deptTeams]);

  const assignedCount = useMemo(
    () => [...ministryData.values()].filter((v) => v.teams.length > 0).length,
    [ministryData]
  );
  const totalTeamsAssigned = useMemo(() => deptTeams.filter((t) => t.team.ministry).length, [deptTeams]);
  const totalMembersAssigned = useMemo(
    () => deptTeams.filter((t) => t.team.ministry).reduce((s, t) => s + t.members.length, 0),
    [deptTeams]
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return MINISTRIES.filter((m) => {
      if (needle && !m.toLowerCase().includes(needle)) return false;
      const entry = ministryData.get(m);
      const hasTeams = entry && entry.teams.length > 0;
      if (statusFilter === "active" && !hasTeams) return false;
      if (statusFilter === "inactive" && hasTeams) return false;
      return true;
    });
  }, [search, statusFilter, ministryData]);

  return (
    <div className="space-y-4 mt-2">
      {/* Header */}
      <div className="rounded-2xl border border-border/40 bg-card/30 p-4 space-y-3">
        <div className="space-y-1">
          <h3 className="text-sm font-extrabold text-white">Ministries — {mentorDept || "Your Department"}</h3>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span><span className="text-[#c9a227] font-bold">{assignedCount}</span> / {MINISTRIES.length} ministries active</span>
            <span>·</span>
            <span><span className="text-white font-bold">{totalTeamsAssigned}</span> teams assigned</span>
            <span>·</span>
            <span><span className="text-white font-bold">{totalMembersAssigned}</span> members placed</span>
          </div>
        </div>
        <input
          type="text"
          placeholder="Search ministry..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-border/50 bg-card/60 text-xs text-white px-3 py-2 focus:outline-none focus:border-[#c9a227] placeholder:text-muted-foreground"
        />
        <div className="flex flex-wrap items-center gap-2 border-t border-border/20 pt-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Show:</span>
          {[
            { id: "all", label: "All", count: MINISTRIES.length },
            { id: "active", label: "Active", count: assignedCount },
            { id: "inactive", label: "Inactive", count: MINISTRIES.length - assignedCount },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                statusFilter === f.id
                  ? f.id === "active"
                    ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300"
                    : f.id === "inactive"
                    ? "bg-muted/30 border border-border/60 text-muted-foreground"
                    : "bg-[#c9a227] text-black border border-[#c9a227]"
                  : "bg-card/30 border border-border/30 text-muted-foreground hover:text-white hover:border-border/60"
              )}
            >
              {f.id === "active" && <span className="size-1.5 rounded-full bg-emerald-400 shrink-0" />}
              {f.id === "inactive" && <span className="size-1.5 rounded-full bg-muted-foreground/40 shrink-0" />}
              {f.label}
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full font-extrabold",
                statusFilter === f.id
                  ? f.id === "active" ? "bg-emerald-500/20 text-emerald-300" : f.id === "inactive" ? "bg-muted/30 text-muted-foreground" : "bg-black/20 text-black"
                  : "bg-muted/20 text-muted-foreground"
              )}>{f.count}</span>
            </button>
          ))}
          {(search.trim() || statusFilter !== "all") && (
            <span className="ml-auto text-[10px] text-muted-foreground">
              Showing <span className="text-white font-bold">{filtered.length}</span> of {MINISTRIES.length}
              {search.trim() && (
                <button type="button" onClick={() => setSearch("")} className="ml-2 text-danger hover:underline font-bold flex items-center gap-1 inline-flex"><X className="size-3" /> clear</button>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Ministry List */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="py-10 text-center rounded-2xl border border-border/20 bg-card/10">
            <p className="text-sm text-muted-foreground font-medium">
              {statusFilter === "active"
                ? "No active ministries yet. Assign teams in the Teams tab above."
                : statusFilter === "inactive"
                ? "All ministries have at least one team assigned."
                : "No ministries match your search."}
            </p>
          </div>
        )}
        {filtered.map((ministry, idx) => {
          const entry = ministryData.get(ministry) || { teams: [], membersByDept: {} };
          const hasTeams = entry.teams.length > 0;
          const isOpen = expanded === ministry;
          const totalMembers = entry.teams.reduce((s, t) => s + t.members.length, 0);
          const cappedDepts = Object.entries(entry.membersByDept).filter(([, c]) => c >= CAP);
          const nearCapDepts = Object.entries(entry.membersByDept).filter(([, c]) => c === CAP - 1);

          return (
            <div key={ministry} className={cn(
              "rounded-2xl border transition-all duration-200",
              hasTeams ? "border-[#c9a227]/30 bg-card/30" : "border-border/20 bg-card/10"
            )}>
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : ministry)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[10px] font-bold text-muted-foreground w-5 shrink-0">{String(idx + 1).padStart(2, "0")}</span>
                  <span className={cn("text-sm font-semibold truncate", hasTeams ? "text-white" : "text-muted-foreground/60")}>{ministry}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                  {cappedDepts.length > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-300">
                      {cappedDepts.length} dept{cappedDepts.length > 1 ? "s" : ""} FULL
                    </span>
                  )}
                  {nearCapDepts.length > 0 && cappedDepts.length === 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300">Near cap</span>
                  )}
                  {hasTeams ? (
                    <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-[#c9a227]/15 border border-[#c9a227]/30 text-[#e8c058]">
                      {entry.teams.length} team{entry.teams.length !== 1 ? "s" : ""} · {totalMembers} member{totalMembers !== 1 ? "s" : ""}
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground/40 font-medium">Unassigned</span>
                  )}
                  <span className="text-muted-foreground/50 text-xs ml-1">{isOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}</span>
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-border/20 px-4 pb-4 pt-3 space-y-4">
                  {!hasTeams ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">
                      No teams assigned yet. Open a team card and assign a ministry to it.
                    </p>
                  ) : (
                    <>
                      {/* Dept capacity bars */}
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Dept Capacity (max {CAP} per dept)</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {Object.entries(entry.membersByDept).sort((a, b) => b[1] - a[1]).map(([dept, count]) => {
                            const pct = Math.min((count / CAP) * 100, 100);
                            const isFull = count >= CAP;
                            const isNear = count === CAP - 1;
                            return (
                              <div key={dept} className="rounded-xl border border-border/30 bg-muted/10 p-2.5 space-y-1.5">
                                <div className="flex justify-between items-center gap-1">
                                  <span className="text-[10px] font-bold text-white truncate">{dept}</span>
                                  <span className={cn("text-[10px] font-extrabold shrink-0", isFull ? "text-red-400" : isNear ? "text-amber-400" : "text-emerald-400")}>{count}/{CAP}</span>
                                </div>
                                <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
                                  <div className={cn("h-full rounded-full transition-all duration-500", isFull ? "bg-red-500" : isNear ? "bg-amber-400" : "bg-emerald-500")} style={{ width: `${pct}%` }} />
                                </div>
                                {isFull && <p className="text-[9px] text-red-400 font-bold">⚠ Max capacity reached</p>}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Teams list */}
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Assigned Teams</p>
                        <div className="space-y-2">
                          {entry.teams.map((t) => {
                            const category = t.team.category || (t.members.length === 1 ? "Solo" : "Pairs");
                            const isSolo = category === "Solo";
                            return (
                              <div key={t.team.id} className="rounded-xl border border-border/30 bg-card/30 p-3 space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-extrabold text-white">{t.team.team_code || t.team.name}</span>
                                  {t.team.team_code && t.team.name !== t.team.team_code && (
                                    <span className="text-[10px] text-muted-foreground font-mono">{t.team.name}</span>
                                  )}
                                  <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", isSolo ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-300" : "bg-[#c9a227]/15 border-[#c9a227]/30 text-[#e8c058]")}>
                                    {isSolo ? <><User className="size-3 shrink-0 inline-block mr-0.5" />Solo</> : <><Users className="size-3 shrink-0 inline-block mr-0.5" />Pairs</>}
                                  </span>
                                  {t.team.approved && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">Approved</span>
                                  )}
                                </div>
                                {t.members.length === 0 ? (
                                  <p className="text-[11px] text-muted-foreground italic">No members yet</p>
                                ) : (
                                  <div className="space-y-1">
                                    {t.members.map((m) => (
                                      <div key={m.id} className="flex flex-col xs:flex-row xs:items-center justify-between gap-1 text-[11px] py-1.5 px-2.5 rounded-lg bg-muted/10">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <span className="font-semibold text-white truncate">{m.name}</span>
                                          <span className="text-muted-foreground font-mono text-[10px] shrink-0">{m.register_no}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="text-[10px] bg-muted/20 border border-border/30 px-1.5 py-0.5 rounded text-muted-foreground truncate max-w-[140px]">{m.department}</span>
                                          {m.assigned_skill && (
                                            <span className="text-[10px] bg-[#c9a227]/10 border border-[#c9a227]/30 px-1.5 py-0.5 rounded text-[#e8c058] truncate max-w-[120px]">{m.assigned_skill}</span>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main TeamsTab ────────────────────────────────────────────────────────────
export const TeamsTab = memo(function TeamsTab({
  teams,
  mentorDept,
  focusedTeamId,
  problemMap,
  removeMember,
  deleteTeam,
  renameTeam,
  setShowCreateTeamModal,
  onAddMemberClick,
  assignMemberSkill,
  assignTeamMinistry,
}) {
  const [detailStudent, setDetailStudent] = useState(null);
  const [selectedTeamOverlay, setSelectedTeamOverlay] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [subTab, setSubTab] = useState("teams"); // "teams" | "ministries"

  // Keep selectedTeamOverlay in sync when teams array updates
  const activeOverlayData = selectedTeamOverlay
    ? teams.find((t) => t.team.id === selectedTeamOverlay.team.id) ?? null
    : null;

  // Only show teams from this mentor's own department in Teams Builder
  const myTeams = useMemo(() => {
    return teams.filter((t) => {
      if (!mentorDept) return true;
      // Prefer the explicit created_by_dept field
      if (t.team.created_by_dept) return isSameDepartment(t.team.created_by_dept, mentorDept);
      // Legacy teams: infer from member departments
      if (t.members.length > 0) {
        return t.members.every((m) => !m.department || isSameDepartment(m.department, mentorDept));
      }
      // Empty legacy team with no dept recorded — hide it
      return false;
    });
  }, [teams, mentorDept]);

  const displayTeams = useMemo(() => {
    return myTeams.filter((t) => {
      if (categoryFilter === "All") return true;
      const cat = t.team.category || (t.members.length === 1 ? "Solo" : "Pairs");
      return cat === categoryFilter;
    });
  }, [myTeams, categoryFilter]);

  // ── Export teams as CSV (one row per team, members in single cells) ─────────
  function exportTeamsCSV() {
    const deptLabel = mentorDept ? mentorDept.replace(/\s+/g, "_") : "Department";
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `Teams_${deptLabel}_${timestamp}.csv`;

    // One column per member slot (max 2 for Pairs, 1 for Solo)
    const headers = [
      "Team ID",
      "Team Name",
      "Category",
      "Ministry",
      "Status",
      "Members",           // e.g. "PRANISH A S, NEMALAN L B"
      "Register Numbers",  // e.g. "25UIT013, 25UCS135"
      "Department",
      "Year(s)",           // e.g. "III" or "III, II"
      "Section(s)",        // e.g. "A, B"
      "Gender(s)",         // e.g. "Male, Female"
      "Assigned Skills",   // e.g. "Frontend, Backend"
      "Member Count",
    ];

    // Wraps a value in quotes if it contains commas, quotes or newlines
    const escape = (v) => {
      const s = String(v ?? "");
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const rows = myTeams.map((t) => {
      const category = t.team.category || (t.members.length === 1 ? "Solo" : "Pairs");
      const memberNames    = t.members.map((m) => m.name ?? "").join(", ");
      const registerNos    = t.members.map((m) => m.register_no ?? "").join(", ");
      const years          = t.members.map((m) => m.year ?? "").join(", ");
      const sections       = t.members.map((m) => m.section ?? "").join(", ");
      const genders        = t.members.map((m) => m.gender ?? "").join(", ");
      const skills         = t.members.map((m) => m.assigned_skill ?? "").join(", ");
      // Department is always the same for both (same-dept rule), so just use the first
      const dept           = t.members[0]?.department ?? (t.team.created_by_dept ?? "");

      return [
        t.team.team_code ?? t.team.id,
        t.team.name ?? "",
        category,
        t.team.ministry ?? "",
        t.team.approved ? "Approved" : "Pending Review",
        memberNames,
        registerNos,
        dept,
        years,
        sections,
        genders,
        skills,
        t.members.length,
      ];
    });

    const csv = [headers, ...rows].map((r) => r.map(escape).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }); // BOM for Excel
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <TeamFormationRules compact={true} />

      {/* Sub-tab switcher */}
      <div className="flex items-center gap-2 bg-card/30 border border-border/40 rounded-2xl p-1.5">
        {[
          { id: "teams", label: "Teams", icon: <LayoutGrid className="size-3.5 shrink-0" />, desc: "Build & manage" },
          { id: "ministries", label: "Ministries", icon: <Building2 className="size-3.5 shrink-0" />, desc: "View by ministry" },
        ].map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSubTab(s.id)}
            className={cn(
              "flex-1 flex flex-col items-center py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer",
              subTab === s.id
                ? "bg-[#c9a227] text-black shadow"
                : "text-muted-foreground hover:text-white hover:bg-muted/20"
            )}
          >
            <span className="flex items-center gap-1.5">{s.icon}{s.label}</span>
            <span className={cn("text-[9px] font-normal mt-0.5", subTab === s.id ? "text-black/70" : "text-muted-foreground/60")}>{s.desc}</span>
          </button>
        ))}
      </div>

      {/* ── Teams sub-tab ── */}
      {subTab === "teams" && (
        <>
          {/* Category Filter + Create */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card/40 p-3 rounded-2xl border border-border/40">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Category:</span>
              {[
                { id: "All", label: "All Teams" },
                { id: "Pairs", label: <><Users className="size-3 shrink-0 inline-block mr-1" />Pairs</> },
                { id: "Solo", label: <><User className="size-3 shrink-0 inline-block mr-1" />Solo</> },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryFilter(cat.id)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-extrabold rounded-xl transition-all cursor-pointer",
                    categoryFilter === cat.id
                      ? "bg-[#c9a227] text-black shadow-md scale-[1.02]"
                      : "text-muted-foreground hover:text-white hover:bg-muted/20"
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between sm:justify-end gap-3">
              <span className="text-xs text-muted-foreground font-semibold">
                <span className="text-white font-bold">{displayTeams.length}</span> team{displayTeams.length !== 1 ? "s" : ""}
                {mentorDept && <span className="text-muted-foreground"> · {mentorDept}</span>}
              </span>
              {myTeams.length > 0 && (
                <button
                  type="button"
                  onClick={exportTeamsCSV}
                  className="flex items-center gap-1.5 border border-border/50 text-muted-foreground font-bold text-xs px-3 py-1.5 rounded-xl hover:border-[#c9a227]/50 hover:text-[#c9a227] transition cursor-pointer"
                  title="Export your department's teams as CSV"
                >
                  <Download className="size-3.5 shrink-0" /> Export CSV
                </button>
              )}
              {setShowCreateTeamModal && (
                <button
                  type="button"
                  onClick={() => setShowCreateTeamModal(true)}
                  className="bg-[#c9a227] text-black font-bold text-xs px-3.5 py-1.5 rounded-xl hover:bg-[#e8c058] transition shadow cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="size-3.5 shrink-0" /> Create Team
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {displayTeams.length === 0 && (
              <div className="col-span-full py-12 text-center text-sm text-muted-foreground">
                {mentorDept
                  ? `No ${categoryFilter === "All" ? "" : categoryFilter + " "}teams created for ${mentorDept} yet. Click "+ Create Team" to get started.`
                  : `No teams match your filter.`}
              </div>
            )}
            {displayTeams.map((t) => {
              const isFocused = t.team.id === focusedTeamId;
              const category = t.team.category || (t.members.length === 1 ? "Solo" : "Pairs");
              const stats = computeStats(t.members, category);
              return (
                <div
                  key={t.team.id}
                  id={`team-card-${t.team.id}`}
                  onClick={() => setSelectedTeamOverlay(t)}
                  className={cn(
                    "rounded-3xl border p-5 flex flex-col justify-between transition-all duration-300 relative bg-card/20 cursor-pointer hover:border-[#c9a227]/70 hover:shadow-lg hover:shadow-[#c9a227]/5 group",
                    isFocused
                      ? "border-[#c9a227] shadow-[0_0_20px_rgba(201,162,39,0.15)] ring-1 ring-[#c9a227]"
                      : "border-border/40"
                  )}
                >
                  {isFocused && (
                    <span className="absolute -top-2.5 left-6 bg-[#c9a227] text-black text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full shadow select-none">
                      Currently Selected
                    </span>
                  )}

                  <div>
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <h3 className="text-base font-extrabold text-foreground leading-tight group-hover:text-[#c9a227] transition-colors">
                          {t.team.team_code ?? "SIH2K26#—"}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs text-muted-foreground font-medium truncate">{t.team.name}</p>
                          <span className={cn(
                            "text-[10px] font-extrabold px-2 py-0.5 rounded-full border shrink-0",
                            category === "Solo"
                              ? "bg-indigo-500/15 border-indigo-500/40 text-indigo-300"
                              : "bg-[#c9a227]/15 border-[#c9a227]/40 text-[#e8c058]"
                          )}>
                          {category === "Solo" ? <><User className="size-3 shrink-0 inline-block mr-0.5" />Solo</> : <><Users className="size-3 shrink-0 inline-block mr-0.5" />Pairs</>}
                          </span>
                        </div>
                      </div>
                      {t.team.approved ? (
                        <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">Approved</span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-300">Pending Review</span>
                      )}
                    </div>

                    <p className="text-xs text-[#dba328] font-bold mt-2">
                      Problem: {t.team.problem_id ? problemMap.get(t.team.problem_id) : "General Idea"}
                    </p>

                    <div className="mt-4 border-t border-border/20 pt-4 space-y-2">
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        <span>Members ({t.members.length}/{stats.targetCount})</span>
                        <span className="text-[#c9a227] group-hover:underline">Click card to manage ↗</span>
                      </div>
                      {t.members.length === 0 ? (
                        <div className="py-4 px-3 rounded-xl border border-dashed border-border/40 text-center bg-muted/5 my-2">
                          <p className="text-xs text-muted-foreground font-medium mb-2">No members added yet</p>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); if (onAddMemberClick) onAddMemberClick(t.team.id); }}
                            className="bg-[#c9a227] text-black text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-[#e8c058] transition shadow cursor-pointer flex items-center gap-1"
                          >
                            <Plus className="size-3.5 shrink-0" /> Add Member from Roster
                          </button>
                        </div>
                      ) : (
                        <ul className="space-y-1.5">
                          {t.members.map((m) => (
                            <li
                              key={m.id}
                              onClick={(e) => { e.stopPropagation(); setDetailStudent(m); }}
                              className="flex items-center justify-between text-xs hover:bg-muted/15 p-1.5 rounded-lg cursor-pointer group/item transition-colors"
                            >
                              <span className="text-muted-foreground font-medium group-hover/item:text-[#c9a227] transition-colors">{m.name}</span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] text-muted-foreground font-semibold bg-muted/20 px-1.5 py-0.5 rounded">{m.department}</span>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); removeMember(t.team.id, m.id, m.name); }}
                                  className="text-xs font-bold px-2.5 py-1 rounded-lg bg-red-500/15 border border-red-500/40 text-red-400 hover:bg-red-500 hover:text-white transition-colors cursor-pointer"
                                  title="Remove member"
                                >
                                  Delete
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}

                      {t.members.length < stats.targetCount && t.members.length > 0 && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); if (onAddMemberClick) onAddMemberClick(t.team.id); }}
                          className="w-full text-center mt-2.5 py-1.5 bg-[#c9a227]/10 hover:bg-[#c9a227]/20 border border-[#c9a227]/30 text-[#e8c058] text-[11px] font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1"
                        >
                          <Plus className="size-3.5 shrink-0" /> Add 2nd Member from Roster
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 border-t border-border/10 pt-4 flex flex-col gap-2">
                    {!stats.valid && stats.reason && (
                      <div className="text-[10px] text-danger bg-danger/5 border border-danger/20 px-2.5 py-1.5 rounded-lg font-medium leading-normal flex items-center gap-1">
                        <AlertTriangle className="size-3.5 shrink-0" /> {stats.reason}
                      </div>
                    )}
                    {t.members.length === 0 ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={(e) => { e.stopPropagation(); deleteTeam(t.team.id, t.team.name, t.members.length); }}
                        className="w-full text-danger border-danger/35 hover:bg-danger hover:text-white hover:border-danger text-xs font-semibold py-1.5 rounded-xl mt-1"
                      >
                        Delete Empty Team
                      </Button>
                    ) : (
                      <div className="flex items-center justify-center gap-1.5 py-1.5 text-[11px] text-muted-foreground bg-muted/10 rounded-xl border border-border/20">
                        <Lock className="size-3 shrink-0" />
                        <span>Remove all members to enable team deletion</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Ministries sub-tab ── */}
      {subTab === "ministries" && (
        <MinistriesPanel teams={teams} mentorDept={mentorDept} />
      )}

      {/* Large Team Details Overlay */}
      <TeamDetailsModal
        teamData={activeOverlayData}
        onClose={() => setSelectedTeamOverlay(null)}
        problemMap={problemMap}
        removeMember={removeMember}
        deleteTeam={deleteTeam}
        renameTeam={renameTeam}
        onViewProfile={(st) => setDetailStudent(st)}
        assignMemberSkill={assignMemberSkill}
        assignTeamMinistry={assignTeamMinistry}
        readOnly={false}
      />

      {/* Student Full Detail Profile Modal */}
      <StudentDetailModal
        student={detailStudent}
        onClose={() => setDetailStudent(null)}
        isAssigned={true}
      />
    </div>
  );
});