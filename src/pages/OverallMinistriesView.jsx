import { useMemo, useState, useCallback } from "react";
import { MINISTRIES, DEPARTMENTS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Card } from "@/components/unlumen-ui/card";
import { Button } from "@/components/unlumen-ui/button";
import { GlowingBadge } from "@/components/unlumen-ui/glowing-badge";
import { Avatar } from "@/components/unlumen-ui/avatar";
import * as data from "@/lib/data";
import { useToast } from "@/components/unlumen-ui/toast";

const CAP = 6; // max members per dept per ministry

function buildMinistryMap(teams) {
  const map = new Map();
  for (const t of teams) {
    const ministry = t.team?.ministry;
    if (!ministry) continue;
    if (!map.has(ministry)) map.set(ministry, new Map());
    const deptMap = map.get(ministry);
    for (const m of t.members || []) {
      const dept = m.department || "Unknown";
      if (!deptMap.has(dept)) deptMap.set(dept, []);
      deptMap.get(dept).push({ ...m, _teamId: t.team.id, _teamName: t.team.name, _teamCode: t.team.team_code });
    }
  }
  return map;
}

// Build a flat team list grouped by ministry
function buildTeamsByMinistry(teams) {
  const map = new Map();
  for (const t of teams) {
    const ministry = t.team?.ministry || "__unassigned__";
    if (!map.has(ministry)) map.set(ministry, []);
    map.get(ministry).push(t);
  }
  return map;
}

export function OverallMinistriesView({ teams, onReload }) {
  const toast = useToast();

  const [selectedMinistry, setSelectedMinistry] = useState("");
  const [selectedDepts, setSelectedDepts] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [ministrySearch, setMinistrySearch] = useState("");
  const [busyId, setBusyId] = useState(null); // tracks loading per item

  // ── Derived data ──────────────────────────────────────────────────────────
  const ministryMap = useMemo(() => buildMinistryMap(teams), [teams]);
  const teamsByMinistry = useMemo(() => buildTeamsByMinistry(teams), [teams]);

  const ministrySummary = useMemo(() => {
    return MINISTRIES.map((m) => {
      const deptMap = ministryMap.get(m) || new Map();
      const totalMembers = [...deptMap.values()].reduce((s, arr) => s + arr.length, 0);
      return { ministry: m, totalMembers, deptCount: deptMap.size, active: deptMap.size > 0 };
    });
  }, [ministryMap]);

  const activeCount = useMemo(() => ministrySummary.filter((s) => s.active).length, [ministrySummary]);
  const inactiveCount = MINISTRIES.length - activeCount;

  const filteredMinistrySummary = useMemo(() => {
    const needle = ministrySearch.trim().toLowerCase();
    return ministrySummary.filter((s) => {
      if (statusFilter === "active" && !s.active) return false;
      if (statusFilter === "inactive" && s.active) return false;
      if (needle && !s.ministry.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [ministrySummary, statusFilter, ministrySearch]);

  const activeDeptMap = useMemo(() => {
    if (!selectedMinistry) return new Map();
    return ministryMap.get(selectedMinistry) || new Map();
  }, [selectedMinistry, ministryMap]);

  const selectedMinistryTeams = useMemo(() => {
    if (!selectedMinistry) return [];
    return (teamsByMinistry.get(selectedMinistry) || []);
  }, [selectedMinistry, teamsByMinistry]);

  const displayDepts = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return DEPARTMENTS.filter((dept) => {
      if (selectedDepts.length > 0 && !selectedDepts.includes(dept)) return false;
      if (needle && !dept.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [selectedDepts, search]);

  const totalInMinistry = useMemo(() =>
    [...activeDeptMap.values()].reduce((s, arr) => s + arr.length, 0),
  [activeDeptMap]);

  const filteredTotal = useMemo(() => {
    if (!selectedMinistry) return 0;
    return displayDepts.reduce((sum, dept) => sum + (activeDeptMap.get(dept)?.length || 0), 0);
  }, [selectedMinistry, activeDeptMap, displayDepts]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function toggleDept(dept) {
    setSelectedDepts((prev) =>
      prev.includes(dept) ? prev.filter((d) => d !== dept) : [...prev, dept]
    );
  }

  function clearFilters() {
    setSelectedDepts([]);
    setSearch("");
  }

  // Remove a single member from a team
  const handleRemoveMember = useCallback(async (teamId, memberId, memberName, teamName) => {
    if (!window.confirm(`Remove ${memberName} from team "${teamName}"?`)) return;
    setBusyId(`member-${memberId}`);
    try {
      const res = await data.api.removeMember(teamId, memberId);
      if (res.error) throw new Error(res.error);
      toast("success", `${memberName} removed from ${teamName}`);
      await onReload();
    } catch (err) {
      toast("error", err.message);
    } finally {
      setBusyId(null);
    }
  }, [toast, onReload]);

  // Delete an entire team (force = removes members too)
  const handleDeleteTeam = useCallback(async (teamId, teamName, memberCount) => {
    const msg = memberCount > 0
      ? `Delete "${teamName}" and remove its ${memberCount} member${memberCount > 1 ? "s" : ""}? This cannot be undone.`
      : `Delete empty team "${teamName}"?`;
    if (!window.confirm(msg)) return;
    setBusyId(`team-${teamId}`);
    try {
      const res = await data.api.deleteTeam(teamId, memberCount > 0);
      if (res.error) throw new Error(res.error);
      toast("success", `Team "${teamName}" deleted`);
      if (selectedMinistryTeams.length === 1) setSelectedMinistry("");
      await onReload();
    } catch (err) {
      toast("error", err.message);
    } finally {
      setBusyId(null);
    }
  }, [toast, onReload, selectedMinistryTeams]);

  // Reassign ministry on a team
  const handleReassignMinistry = useCallback(async (teamId, teamName, newMinistry) => {
    setBusyId(`ministry-${teamId}`);
    try {
      const res = await data.api.assignMinistry(teamId, newMinistry || null);
      if (res.error) throw new Error(res.error);
      toast("success", newMinistry ? `"${teamName}" → ${newMinistry}` : `Ministry cleared for "${teamName}"`);
      await onReload();
    } catch (err) {
      toast("error", err.message);
    } finally {
      setBusyId(null);
    }
  }, [toast, onReload]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Top summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 border border-border/40 bg-card/40">
          <p className="text-[10px] uppercase font-bold text-muted-foreground">Total Ministries</p>
          <p className="text-2xl font-extrabold text-white mt-1">{MINISTRIES.length}</p>
        </Card>
        <button type="button" onClick={() => setStatusFilter((s) => s === "active" ? "all" : "active")} className="text-left">
          <Card className={cn("p-4 border bg-card/40 transition-all h-full",
            statusFilter === "active" ? "border-emerald-500/50 bg-emerald-500/10" : "border-border/40 hover:border-emerald-500/30")}>
            <p className="text-[10px] uppercase font-bold text-muted-foreground">Active Ministries</p>
            <p className={cn("text-2xl font-extrabold mt-1", statusFilter === "active" ? "text-emerald-400" : "text-primary")}>{activeCount}</p>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">{statusFilter === "active" ? "← active only" : "click to filter"}</p>
          </Card>
        </button>
        <button type="button" onClick={() => setStatusFilter((s) => s === "inactive" ? "all" : "inactive")} className="text-left">
          <Card className={cn("p-4 border bg-card/40 transition-all h-full",
            statusFilter === "inactive" ? "border-muted-foreground/50 bg-muted/10" : "border-border/40 hover:border-muted-foreground/30")}>
            <p className="text-[10px] uppercase font-bold text-muted-foreground">Inactive Ministries</p>
            <p className={cn("text-2xl font-extrabold mt-1", statusFilter === "inactive" ? "text-foreground" : "text-muted-foreground")}>{inactiveCount}</p>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">{statusFilter === "inactive" ? "← inactive only" : "click to filter"}</p>
          </Card>
        </button>
        <Card className="p-4 border border-border/40 bg-card/40">
          <p className="text-[10px] uppercase font-bold text-muted-foreground">Members Placed</p>
          <p className="text-2xl font-extrabold text-white mt-1">
            {teams.filter((t) => t.team?.ministry).reduce((s, t) => s + t.members.length, 0)}
          </p>
        </Card>
      </div>

      <div className="grid lg:grid-cols-[320px_1fr] gap-4 items-start">
        {/* ── Left: Ministry Selector ────────────────────────────────────── */}
        <Card className="p-0 border border-border/40 bg-card/40 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-white">Select Ministry</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">Click to manage teams & members</p>
              </div>
              {(statusFilter !== "all" || ministrySearch) && (
                <button type="button" onClick={() => { setStatusFilter("all"); setMinistrySearch(""); }}
                  className="text-[10px] font-bold text-danger hover:underline shrink-0">✕ Clear</button>
              )}
            </div>
            <input type="text" placeholder="Search ministry..." value={ministrySearch}
              onChange={(e) => setMinistrySearch(e.target.value)}
              className="w-full rounded-lg border border-border/40 bg-muted/20 text-[11px] text-white px-2.5 py-1.5 focus:outline-none focus:border-primary placeholder:text-muted-foreground" />
            <div className="flex items-center gap-1.5">
              {[
                { id: "all", label: "All", count: MINISTRIES.length },
                { id: "active", label: "Active", count: activeCount },
                { id: "inactive", label: "Inactive", count: inactiveCount },
              ].map((f) => (
                <button key={f.id} type="button"
                  onClick={() => {
                    setStatusFilter(f.id);
                    if (f.id !== "all") {
                      const s = ministrySummary.find((s) => s.ministry === selectedMinistry);
                      if (s) {
                        if (f.id === "active" && !s.active) setSelectedMinistry("");
                        if (f.id === "inactive" && s.active) setSelectedMinistry("");
                      }
                    }
                  }}
                  className={cn(
                    "flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex-1 justify-center",
                    statusFilter === f.id
                      ? f.id === "active" ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300"
                        : f.id === "inactive" ? "bg-muted/40 border border-border/60 text-muted-foreground"
                        : "bg-primary/20 border border-primary/40 text-primary"
                      : "bg-card/30 border border-border/30 text-muted-foreground hover:text-foreground hover:border-border/60"
                  )}>
                  {f.id === "active" && <span className="size-1.5 rounded-full bg-emerald-400 shrink-0" />}
                  {f.id === "inactive" && <span className="size-1.5 rounded-full bg-muted-foreground/40 shrink-0" />}
                  {f.label}
                  <span className={cn("text-[9px] font-extrabold px-1 py-0.5 rounded-full ml-0.5",
                    statusFilter === f.id
                      ? f.id === "active" ? "bg-emerald-500/20 text-emerald-300"
                        : f.id === "inactive" ? "bg-muted/30 text-muted-foreground"
                        : "bg-primary/20 text-primary"
                      : "bg-muted/20 text-muted-foreground")}>
                    {f.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="max-h-60 lg:max-h-[480px] overflow-y-auto">
            {filteredMinistrySummary.length === 0 && (
              <p className="px-4 py-8 text-center text-xs text-muted-foreground">No ministries match your filter.</p>
            )}
            {filteredMinistrySummary.map(({ ministry: m, totalMembers, active }) => {
              const isSelected = selectedMinistry === m;
              const teamsHere = teamsByMinistry.get(m)?.length ?? 0;
              return (
                <button key={m} type="button"
                  onClick={() => { setSelectedMinistry(m); setSelectedDepts([]); setSearch(""); }}
                  className={cn(
                    "w-full text-left px-4 py-3 border-b border-border/20 last:border-0 transition-colors text-xs flex items-center justify-between gap-3",
                    isSelected ? "bg-primary/10 text-primary font-bold" : "hover:bg-muted/20 text-muted-foreground hover:text-foreground"
                  )}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn("size-1.5 rounded-full shrink-0", active ? "bg-emerald-400" : "bg-muted-foreground/30")} />
                    <span className="truncate leading-relaxed">{m}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {active ? (
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">
                        {teamsHere}t · {totalMembers}m
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/40">—</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* ── Right: Ministry Detail ─────────────────────────────────────── */}
        <div className="space-y-4">
          {!selectedMinistry ? (
            <Card className="p-12 border border-border/40 bg-card/40 text-center">
              <p className="text-sm text-muted-foreground">Select a ministry from the left to manage its teams and members.</p>
            </Card>
          ) : (
            <>
              {/* Ministry header */}
              <Card className="p-4 border border-border/40 bg-card/40 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-white leading-tight">{selectedMinistry}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedMinistryTeams.length} team{selectedMinistryTeams.length !== 1 ? "s" : ""} ·{" "}
                      {totalInMinistry} member{totalInMinistry !== 1 ? "s" : ""}
                      {selectedDepts.length > 0 && (
                        <span className="text-primary font-semibold">
                          {" "}· showing {filteredTotal} from {selectedDepts.length} selected dept{selectedDepts.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </p>
                  </div>
                  {(selectedDepts.length > 0 || search) && (
                    <button type="button" onClick={clearFilters}
                      className="text-[11px] text-danger hover:underline font-bold shrink-0">✕ Clear filters</button>
                  )}
                </div>

                {/* Dept filter chips */}
                <div className="flex flex-col gap-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Filter by Department</p>
                    <input type="text" placeholder="Search dept..." value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full sm:w-44 rounded-lg border border-border/40 bg-muted/20 text-[11px] text-white px-2.5 py-1.5 focus:outline-none focus:border-primary placeholder:text-muted-foreground" />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {DEPARTMENTS.filter((d) => !search || d.toLowerCase().includes(search.toLowerCase())).map((dept) => {
                      const count = activeDeptMap.get(dept)?.length || 0;
                      const isActive = selectedDepts.includes(dept);
                      const isFull = count >= CAP;
                      return (
                        <button key={dept} type="button" onClick={() => toggleDept(dept)}
                          className={cn(
                            "flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all cursor-pointer",
                            isActive ? "bg-primary/20 border-primary/50 text-primary"
                              : count > 0 ? "bg-card/60 border-border/50 text-foreground hover:border-primary/40"
                              : "bg-muted/10 border-border/20 text-muted-foreground/50 hover:text-muted-foreground"
                          )}>
                          <span className="truncate max-w-[180px]">{dept}</span>
                          {count > 0 && (
                            <span className={cn("text-[10px] font-extrabold px-1.5 py-0.5 rounded-full",
                              isFull ? "bg-red-500/20 text-red-400" : "bg-muted/30 text-muted-foreground")}>
                              {count}{isFull ? " FULL" : `/${CAP}`}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </Card>

              {/* Per-dept breakdown with member actions */}
              <Card className="overflow-hidden p-0 border border-border/40 bg-card/40">
                {/* Header — hidden on mobile, shown on sm+ */}
                <div className="hidden sm:grid sm:grid-cols-[1fr_56px_130px] border-b border-border/60 bg-muted/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-4 py-2.5">
                  <span>Department</span>
                  <span className="text-center">Members</span>
                  <span className="text-center">Capacity</span>
                </div>
                <div className="divide-y divide-border/30">
                  {displayDepts.map((dept) => {
                    const members = activeDeptMap.get(dept) || [];
                    const count = members.length;
                    const pct = Math.min((count / CAP) * 100, 100);
                    const isFull = count >= CAP;
                    const isNear = count === CAP - 1;
                    const isEmpty = count === 0;
                    return (
                      <div key={dept} className={cn("px-4 py-3 flex flex-col gap-2", isEmpty ? "opacity-40" : "")}>
                        {/* Mobile: stacked layout. sm+: 3-col grid */}
                        <div className="flex flex-col sm:grid sm:grid-cols-[1fr_56px_130px] sm:items-center gap-1.5 sm:gap-2">
                          <span className="font-semibold text-foreground text-xs">{dept}</span>
                          <div className="flex items-center gap-2 sm:contents">
                            <span className={cn("text-sm font-extrabold sm:text-center tabular-nums",
                              isFull ? "text-red-400" : isNear ? "text-amber-400" : count > 0 ? "text-white" : "text-muted-foreground")}>
                              {count}
                            </span>
                            <div className="flex flex-1 flex-col gap-0.5">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 rounded-full bg-muted/30 overflow-hidden">
                                  <div className={cn("h-full rounded-full transition-all duration-500",
                                    isFull ? "bg-red-500" : isNear ? "bg-amber-400" : count > 0 ? "bg-primary" : "bg-transparent")}
                                    style={{ width: `${pct}%` }} />
                                </div>
                                <span className={cn("text-[10px] font-bold w-8 text-right shrink-0",
                                  isFull ? "text-red-400" : isNear ? "text-amber-400" : "text-muted-foreground")}>
                                  {count}/{CAP}
                                </span>
                              </div>
                              {isFull && <span className="text-[10px] text-red-400 font-bold">FULL</span>}
                            </div>
                          </div>
                        </div>

                        {/* Member badges with remove button */}
                        {members.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-0.5">
                            {members.map((m) => (
                              <div key={m.id}
                                className="flex items-center gap-1.5 text-[11px] bg-muted/30 border border-border/30 pl-2.5 pr-1 py-0.5 rounded-lg">
                                <span className={cn("size-1.5 rounded-full shrink-0",
                                  m.gender === "Female" ? "bg-pink-400" : "bg-blue-400")} />
                                <span className="font-medium text-foreground">{m.name}</span>
                                {m.register_no && (
                                  <span className="text-muted-foreground/60 font-mono text-[9px]">{m.register_no}</span>
                                )}
                                <span className="text-[9px] text-muted-foreground/50">· {m._teamCode || m._teamName}</span>
                                <button type="button"
                                  disabled={busyId === `member-${m.id}`}
                                  onClick={() => handleRemoveMember(m._teamId, m.id, m.name, m._teamName)}
                                  className="ml-1 flex size-4 items-center justify-center rounded-full bg-red-500/15 text-red-400 hover:bg-red-500 hover:text-white transition-colors cursor-pointer disabled:opacity-50 text-[9px] font-bold"
                                  title={`Remove ${m.name} from team`}>
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        {isEmpty && (
                          <span className="text-[11px] text-muted-foreground/50 italic">No members assigned</span>
                        )}
                      </div>
                    );
                  })}
                  {displayDepts.length === 0 && (
                    <div className="px-4 py-8 text-center text-xs text-muted-foreground">No departments match your filter.</div>
                  )}
                </div>
              </Card>

              {/* Teams list with full admin controls */}
              <Card className="p-0 border border-border/40 bg-card/40 overflow-hidden">
                <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white">Teams under this Ministry</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Reassign ministry, remove members, or delete entire teams
                    </p>
                  </div>
                  <span className="text-xs font-bold text-muted-foreground bg-muted/30 px-2.5 py-1 rounded-lg">
                    {selectedMinistryTeams.length} team{selectedMinistryTeams.length !== 1 ? "s" : ""}
                  </span>
                </div>

                <div className="divide-y divide-border/30">
                  {selectedMinistryTeams.length === 0 && (
                    <p className="px-4 py-8 text-center text-xs text-muted-foreground italic">No teams assigned to this ministry.</p>
                  )}
                  {selectedMinistryTeams.map((t) => {
                    const team = t.team;
                    const members = t.members || [];
                    const category = team.category || (members.length === 1 ? "Solo" : "Pairs");
                    const isSolo = category === "Solo";
                    const isTeamBusy = busyId === `team-${team.id}` || busyId === `ministry-${team.id}`;

                    return (
                      <div key={team.id} className="px-4 py-4 flex flex-col gap-3">
                        {/* Team header row */}
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-wrap items-center gap-2 min-w-0">
                            <span className="text-sm font-extrabold text-white truncate">{team.team_code || team.name}</span>
                            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0",
                              isSolo ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-300"
                                : "bg-[#c9a227]/15 border-[#c9a227]/30 text-[#e8c058]")}>
                              {isSolo ? "Solo" : "Pairs"}
                            </span>
                            {team.approved && <GlowingBadge variant="success" pulse={false}>Approved</GlowingBadge>}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {members.length} member{members.length !== 1 ? "s" : ""}
                            {team.name !== team.team_code && ` · ${team.name}`}
                          </p>

                          {/* Reassign ministry + Delete — stacked on mobile */}
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            <select
                              value={team.ministry || ""}
                              disabled={isTeamBusy}
                              onChange={(e) => handleReassignMinistry(team.id, team.name, e.target.value)}
                              className="flex-1 rounded-lg border border-border/50 bg-card/60 text-[11px] text-white px-2.5 py-2 focus:outline-none focus:border-primary cursor-pointer disabled:opacity-50"
                              title="Reassign ministry"
                            >
                              <option value="">— No Ministry —</option>
                              {MINISTRIES.map((m) => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </select>

                            <Button
                              type="button"
                              loading={isTeamBusy}
                              onClick={() => handleDeleteTeam(team.id, team.name, members.length)}
                              className={cn(
                                "text-xs px-3 py-1.5 font-bold border shrink-0",
                                members.length > 0
                                  ? "bg-red-600 text-white hover:bg-red-700 border-red-600"
                                  : "bg-red-500/15 border-red-500/40 text-red-300 hover:bg-red-500 hover:text-white"
                              )}
                            >
                              {members.length > 0 ? "Force Delete" : "Delete"}
                            </Button>
                          </div>
                        </div>

                        {/* Member list with remove buttons */}
                        {members.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {members.map((m) => (
                              <div key={m.id}
                                className="flex items-center gap-1.5 bg-muted/20 border border-border/30 pl-2.5 pr-1 py-1 rounded-xl text-xs">
                                <Avatar name={m.name} className="size-5 text-[8px] shrink-0" />
                                <div className="leading-tight">
                                  <p className="font-semibold text-white">{m.name}</p>
                                  <p className="text-[9px] text-muted-foreground">{m.department} · {m.register_no}</p>
                                </div>
                                <button type="button"
                                  disabled={busyId === `member-${m.id}`}
                                  onClick={() => handleRemoveMember(team.id, m.id, m.name, team.name)}
                                  className="ml-1.5 flex size-5 items-center justify-center rounded-full bg-red-500/15 text-red-400 hover:bg-red-500 hover:text-white transition-colors cursor-pointer disabled:opacity-50 text-[10px] font-bold shrink-0"
                                  title={`Remove ${m.name}`}>
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
