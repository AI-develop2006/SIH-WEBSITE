import { useMemo, useState } from "react";
import { MINISTRIES, MAX_MEMBERS_PER_MINISTRY_PER_DEPT } from "@/lib/constants";
import { cn } from "@/lib/utils";

const CAP = MAX_MEMBERS_PER_MINISTRY_PER_DEPT; // 6

export function MinistriesTab({ teams }) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all"); // "all" | "active" | "inactive"

  // ministryName → { teams: [], membersByDept: { dept: count } }
  const ministryData = useMemo(() => {
    const map = new Map();
    for (const m of MINISTRIES) {
      map.set(m, { teams: [], membersByDept: {} });
    }
    for (const t of teams) {
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
  }, [teams]);

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

  const assignedCount = useMemo(
    () => [...ministryData.values()].filter((v) => v.teams.length > 0).length,
    [ministryData]
  );
  const totalTeamsAssigned = useMemo(
    () => teams.filter((t) => t.team.ministry).length,
    [teams]
  );
  const totalMembersAssigned = useMemo(
    () => teams.filter((t) => t.team.ministry).reduce((s, t) => s + t.members.length, 0),
    [teams]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-border/40 bg-card/30 p-4 flex flex-col gap-3">
        <div className="flex flex-col gap-3">
          <div className="space-y-1">
            <h2 className="text-base font-extrabold text-white">Ministries & Organisations</h2>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>
                <span className="text-[#c9a227] font-bold">{assignedCount}</span> / {MINISTRIES.length} ministries active
              </span>
              <span>·</span>
              <span>
                <span className="text-white font-bold">{totalTeamsAssigned}</span> team{totalTeamsAssigned !== 1 ? "s" : ""} assigned
              </span>
              <span>·</span>
              <span>
                <span className="text-white font-bold">{totalMembersAssigned}</span> member{totalMembersAssigned !== 1 ? "s" : ""} placed
              </span>
            </div>
          </div>
          <input
            type="text"
            placeholder="Search ministry..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-border/50 bg-card/60 text-xs text-white px-3 py-2 focus:outline-none focus:border-[#c9a227] placeholder:text-muted-foreground"
          />
        </div>

        {/* Status Filter Buttons */}
        <div className="flex flex-wrap items-center gap-2 border-t border-border/20 pt-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Show:
          </span>
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
              )}>
                {f.count}
              </span>
            </button>
          ))}

          {/* Show current filter result count */}
          {(search.trim() || statusFilter !== "all") && (
            <span className="ml-auto text-[10px] text-muted-foreground">
              Showing <span className="text-white font-bold">{filtered.length}</span> of {MINISTRIES.length}
              {search.trim() && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="ml-2 text-danger hover:underline font-bold"
                >
                  ✕ clear search
                </button>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Ministry List */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="py-12 text-center rounded-2xl border border-border/20 bg-card/10">
            <p className="text-sm text-muted-foreground font-medium">
              {statusFilter === "active"
                ? "No active ministries yet. Assign teams to ministries in the Teams Builder tab."
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
            <div
              key={ministry}
              className={cn(
                "rounded-2xl border transition-all duration-200",
                hasTeams ? "border-[#c9a227]/30 bg-card/30" : "border-border/20 bg-card/10"
              )}
            >
              {/* Row header */}
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : ministry)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[10px] font-bold text-muted-foreground w-5 shrink-0">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <span className={cn("text-sm font-semibold truncate", hasTeams ? "text-white" : "text-muted-foreground/60")}>
                    {ministry}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                  {cappedDepts.length > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-300">
                      {cappedDepts.length} dept{cappedDepts.length > 1 ? "s" : ""} FULL
                    </span>
                  )}
                  {nearCapDepts.length > 0 && cappedDepts.length === 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300">
                      Near cap
                    </span>
                  )}
                  {hasTeams ? (
                    <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-[#c9a227]/15 border border-[#c9a227]/30 text-[#e8c058]">
                      {entry.teams.length} team{entry.teams.length !== 1 ? "s" : ""} · {totalMembers} member{totalMembers !== 1 ? "s" : ""}
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground/40 font-medium">Unassigned</span>
                  )}
                  <span className="text-muted-foreground/50 text-xs ml-1">{isOpen ? "▲" : "▼"}</span>
                </div>
              </button>

              {/* Expanded content */}
              {isOpen && (
                <div className="border-t border-border/20 px-4 pb-4 pt-3 space-y-4">
                  {!hasTeams ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">
                      No teams assigned yet. Open a team in the Teams Builder tab to assign a ministry.
                    </p>
                  ) : (
                    <>
                      {/* Per-dept capacity bars */}
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                          Dept Capacity (max {CAP} per dept)
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {Object.entries(entry.membersByDept)
                            .sort((a, b) => b[1] - a[1])
                            .map(([dept, count]) => {
                              const pct = Math.min((count / CAP) * 100, 100);
                              const isFull = count >= CAP;
                              const isNear = count === CAP - 1;
                              return (
                                <div key={dept} className="rounded-xl border border-border/30 bg-muted/10 p-2.5 space-y-1.5">
                                  <div className="flex justify-between items-center gap-1">
                                    <span className="text-[10px] font-bold text-white truncate">{dept}</span>
                                    <span className={cn("text-[10px] font-extrabold shrink-0", isFull ? "text-red-400" : isNear ? "text-amber-400" : "text-emerald-400")}>
                                      {count}/{CAP}
                                    </span>
                                  </div>
                                  <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
                                    <div
                                      className={cn("h-full rounded-full transition-all duration-500", isFull ? "bg-red-500" : isNear ? "bg-amber-400" : "bg-emerald-500")}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  {isFull && (
                                    <p className="text-[9px] text-red-400 font-bold">⚠ Max capacity reached</p>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      </div>

                      {/* Assigned teams */}
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                          Assigned Teams
                        </p>
                        <div className="space-y-2">
                          {entry.teams.map((t) => {
                            const category = t.team.category || (t.members.length === 1 ? "Solo" : "Pairs");
                            const isSolo = category === "Solo";
                            return (
                              <div key={t.team.id} className="rounded-xl border border-border/30 bg-card/30 p-3 space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-extrabold text-white">
                                    {t.team.team_code || t.team.name}
                                  </span>
                                  {t.team.team_code && t.team.name !== t.team.team_code && (
                                    <span className="text-[10px] text-muted-foreground font-mono">{t.team.name}</span>
                                  )}
                                  <span className={cn(
                                    "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                                    isSolo
                                      ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-300"
                                      : "bg-[#c9a227]/15 border-[#c9a227]/30 text-[#e8c058]"
                                  )}>
                                    {isSolo ? "👤 Solo" : "👥 Pairs"}
                                  </span>
                                  {t.team.approved && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                                      ✓ Approved
                                    </span>
                                  )}
                                </div>

                                {t.members.length === 0 ? (
                                  <p className="text-[11px] text-muted-foreground italic">No members yet</p>
                                ) : (
                                  <div className="space-y-1">
                                    {t.members.map((m) => (
                                      <div key={m.id} className="flex items-center justify-between text-[11px] py-1.5 px-2.5 rounded-lg bg-muted/10">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <span className="font-semibold text-white truncate">{m.name}</span>
                                          <span className="text-muted-foreground font-mono text-[10px] shrink-0">{m.register_no}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                                          <span className="text-[10px] bg-muted/20 border border-border/30 px-1.5 py-0.5 rounded text-muted-foreground">
                                            {m.department}
                                          </span>
                                          {m.assigned_skill && (
                                            <span className="text-[10px] bg-[#c9a227]/10 border border-[#c9a227]/30 px-1.5 py-0.5 rounded text-[#e8c058]">
                                              {m.assigned_skill}
                                            </span>
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
