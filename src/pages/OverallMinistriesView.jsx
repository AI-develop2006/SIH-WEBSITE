import { useMemo, useState } from "react";
import { MINISTRIES, DEPARTMENTS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Card } from "@/components/unlumen-ui/card";

const CAP = 6; // max members per dept per ministry

/**
 * Computes ministry → dept → members breakdown from enriched teams data.
 * Returns Map<ministry, Map<dept, member[]>>
 */
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
      deptMap.get(dept).push(m);
    }
  }
  return map;
}

export function OverallMinistriesView({ teams }) {
  const [selectedMinistry, setSelectedMinistry] = useState("");
  const [selectedDepts, setSelectedDepts] = useState([]); // multi-select
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // "all" | "active" | "inactive"
  const [ministrySearch, setMinistrySearch] = useState("");

  // Full breakdown
  const ministryMap = useMemo(() => buildMinistryMap(teams), [teams]);

  // Quick stats for the ministry selector display
  const ministrySummary = useMemo(() => {
    return MINISTRIES.map((m) => {
      const deptMap = ministryMap.get(m) || new Map();
      const totalMembers = [...deptMap.values()].reduce((s, arr) => s + arr.length, 0);
      const deptCount = deptMap.size;
      return { ministry: m, totalMembers, deptCount, active: deptMap.size > 0 };
    });
  }, [ministryMap]);

  // Toggle a dept in the multi-select
  function toggleDept(dept) {
    setSelectedDepts((prev) =>
      prev.includes(dept) ? prev.filter((d) => d !== dept) : [...prev, dept]
    );
  }

  function clearFilters() {
    setSelectedDepts([]);
    setSearch("");
  }

  // Departments to display — filter by selected depts; if none selected show all present
  const activeDeptMap = useMemo(() => {
    if (!selectedMinistry) return new Map();
    return ministryMap.get(selectedMinistry) || new Map();
  }, [selectedMinistry, ministryMap]);

  const displayDepts = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return DEPARTMENTS.filter((dept) => {
      if (selectedDepts.length > 0 && !selectedDepts.includes(dept)) return false;
      if (needle && !dept.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [selectedDepts, search]);

  // Total members in selected ministry matching current dept filter
  const filteredTotal = useMemo(() => {
    if (!selectedMinistry) return 0;
    return displayDepts.reduce((sum, dept) => sum + (activeDeptMap.get(dept)?.length || 0), 0);
  }, [selectedMinistry, activeDeptMap, displayDepts]);

  const totalInMinistry = useMemo(() => {
    return [...activeDeptMap.values()].reduce((s, arr) => s + arr.length, 0);
  }, [activeDeptMap]);

  // Filtered ministry list for the left selector panel
  const filteredMinistrySummary = useMemo(() => {
    const needle = ministrySearch.trim().toLowerCase();
    return ministrySummary.filter((s) => {
      if (statusFilter === "active" && !s.active) return false;
      if (statusFilter === "inactive" && s.active) return false;
      if (needle && !s.ministry.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [ministrySummary, statusFilter, ministrySearch]);

  const activeCount = useMemo(() => ministrySummary.filter((s) => s.active).length, [ministrySummary]);
  const inactiveCount = MINISTRIES.length - activeCount;

  return (
    <div className="space-y-6">
      {/* Top summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 border border-border/40 bg-card/40">
          <p className="text-[10px] uppercase font-bold text-muted-foreground">Total Ministries</p>
          <p className="text-2xl font-extrabold text-white mt-1">{MINISTRIES.length}</p>
        </Card>
        <button
          type="button"
          onClick={() => setStatusFilter((s) => s === "active" ? "all" : "active")}
          className="text-left"
        >
          <Card className={cn(
            "p-4 border bg-card/40 transition-all",
            statusFilter === "active"
              ? "border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_16px_-4px_rgba(16,185,129,0.3)]"
              : "border-border/40 hover:border-emerald-500/30"
          )}>
            <p className="text-[10px] uppercase font-bold text-muted-foreground">Active Ministries</p>
            <p className={cn("text-2xl font-extrabold mt-1", statusFilter === "active" ? "text-emerald-400" : "text-primary")}>
              {activeCount}
            </p>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">
              {statusFilter === "active" ? "← showing only active" : "click to filter"}
            </p>
          </Card>
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter((s) => s === "inactive" ? "all" : "inactive")}
          className="text-left"
        >
          <Card className={cn(
            "p-4 border bg-card/40 transition-all",
            statusFilter === "inactive"
              ? "border-muted-foreground/50 bg-muted/10 shadow-sm"
              : "border-border/40 hover:border-muted-foreground/30"
          )}>
            <p className="text-[10px] uppercase font-bold text-muted-foreground">Inactive Ministries</p>
            <p className={cn("text-2xl font-extrabold mt-1", statusFilter === "inactive" ? "text-foreground" : "text-muted-foreground")}>
              {inactiveCount}
            </p>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">
              {statusFilter === "inactive" ? "← showing only inactive" : "click to filter"}
            </p>
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
        {/* Left — Ministry Selector */}
        <Card className="p-0 border border-border/40 bg-card/40 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-white">Select Ministry</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Click to explore department breakdown
                </p>
              </div>
              {filteredMinistrySummary.length !== MINISTRIES.length && (
                <button
                  type="button"
                  onClick={() => { setStatusFilter("all"); setMinistrySearch(""); }}
                  className="text-[10px] font-bold text-danger hover:underline shrink-0"
                >
                  ✕ Clear
                </button>
              )}
            </div>

            {/* Search input */}
            <input
              type="text"
              placeholder="Search ministry..."
              value={ministrySearch}
              onChange={(e) => setMinistrySearch(e.target.value)}
              className="w-full rounded-lg border border-border/40 bg-muted/20 text-[11px] text-white px-2.5 py-1.5 focus:outline-none focus:border-primary placeholder:text-muted-foreground"
            />

            {/* Active / Inactive filter tabs */}
            <div className="flex items-center gap-1.5">
              {[
                { id: "all",      label: "All",      count: MINISTRIES.length },
                { id: "active",   label: "Active",   count: activeCount },
                { id: "inactive", label: "Inactive", count: inactiveCount },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    setStatusFilter(f.id);
                    // clear selected ministry if it no longer matches the new filter
                    if (f.id !== "all") {
                      const summary = ministrySummary.find((s) => s.ministry === selectedMinistry);
                      if (summary) {
                        if (f.id === "active" && !summary.active) setSelectedMinistry("");
                        if (f.id === "inactive" && summary.active) setSelectedMinistry("");
                      }
                    }
                  }}
                  className={cn(
                    "flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex-1 justify-center",
                    statusFilter === f.id
                      ? f.id === "active"
                        ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300"
                        : f.id === "inactive"
                        ? "bg-muted/40 border border-border/60 text-muted-foreground"
                        : "bg-primary/20 border border-primary/40 text-primary"
                      : "bg-card/30 border border-border/30 text-muted-foreground hover:text-foreground hover:border-border/60"
                  )}
                >
                  {f.id === "active" && (
                    <span className="size-1.5 rounded-full bg-emerald-400 shrink-0" />
                  )}
                  {f.id === "inactive" && (
                    <span className="size-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                  )}
                  {f.label}
                  <span className={cn(
                    "text-[9px] font-extrabold px-1 py-0.5 rounded-full ml-0.5",
                    statusFilter === f.id
                      ? f.id === "active" ? "bg-emerald-500/20 text-emerald-300"
                        : f.id === "inactive" ? "bg-muted/30 text-muted-foreground"
                        : "bg-primary/20 text-primary"
                      : "bg-muted/20 text-muted-foreground"
                  )}>
                    {f.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-60 lg:max-h-[480px] overflow-y-auto">
            {filteredMinistrySummary.length === 0 && (
              <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                No ministries match your filter.
              </p>
            )}
            {filteredMinistrySummary.map(({ ministry: m, totalMembers, active }) => {
              const isSelected = selectedMinistry === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setSelectedMinistry(m);
                    setSelectedDepts([]);
                    setSearch("");
                  }}
                  className={cn(
                    "w-full text-left px-4 py-3 border-b border-border/20 last:border-0 transition-colors text-xs flex items-center justify-between gap-3",
                    isSelected
                      ? "bg-primary/10 text-primary font-bold"
                      : "hover:bg-muted/20 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn(
                      "size-1.5 rounded-full shrink-0",
                      active ? "bg-emerald-400" : "bg-muted-foreground/30"
                    )} />
                    <span className="truncate leading-relaxed">{m}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {active ? (
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">
                        {totalMembers}
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

        {/* Right — Department Breakdown */}
        <div className="space-y-4">
          {!selectedMinistry ? (
            <Card className="p-12 border border-border/40 bg-card/40 text-center">
              <p className="text-sm text-muted-foreground">
                Select a ministry from the left panel to view its department breakdown.
              </p>
            </Card>
          ) : (
            <>
              {/* Ministry Header */}
              <Card className="p-4 border border-border/40 bg-card/40 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-white leading-tight">{selectedMinistry}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {totalInMinistry} total member{totalInMinistry !== 1 ? "s" : ""} across{" "}
                      {activeDeptMap.size} department{activeDeptMap.size !== 1 ? "s" : ""}
                      {selectedDepts.length > 0 && (
                        <span className="text-primary font-semibold">
                          {" "}· showing {filteredTotal} from {selectedDepts.length} selected dept{selectedDepts.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </p>
                  </div>
                  {(selectedDepts.length > 0 || search) && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="text-[11px] text-danger hover:underline font-bold shrink-0"
                    >
                      ✕ Clear filters
                    </button>
                  )}
                </div>

                {/* Dept multi-select filter chips */}
                  <div className="flex flex-col gap-2 pt-1">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Filter by Department
                      </p>
                      <input
                        type="text"
                        placeholder="Search dept..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full sm:w-44 rounded-lg border border-border/40 bg-muted/20 text-[11px] text-white px-2.5 py-1.5 focus:outline-none focus:border-primary placeholder:text-muted-foreground"
                      />
                    </div>
                  <div className="flex flex-wrap gap-1.5">
                    {DEPARTMENTS.filter((d) => !search || d.toLowerCase().includes(search.toLowerCase())).map((dept) => {
                      const count = activeDeptMap.get(dept)?.length || 0;
                      const isActive = selectedDepts.includes(dept);
                      const isFull = count >= CAP;
                      return (
                        <button
                          key={dept}
                          type="button"
                          onClick={() => toggleDept(dept)}
                          className={cn(
                            "flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all cursor-pointer",
                            isActive
                              ? "bg-primary/20 border-primary/50 text-primary"
                              : count > 0
                              ? "bg-card/60 border-border/50 text-foreground hover:border-primary/40"
                              : "bg-muted/10 border-border/20 text-muted-foreground/50 hover:text-muted-foreground"
                          )}
                        >
                          <span className="truncate max-w-[180px]">{dept}</span>
                          {count > 0 && (
                            <span className={cn(
                              "text-[10px] font-extrabold px-1.5 py-0.5 rounded-full",
                              isFull
                                ? "bg-red-500/20 text-red-400"
                                : "bg-muted/30 text-muted-foreground"
                            )}>
                              {count}{isFull ? " FULL" : `/${CAP}`}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </Card>

              {/* Per-dept breakdown */}
              <Card className="overflow-hidden p-0 border border-border/40 bg-card/40">
                {/* Header row */}
                <div className="grid grid-cols-[1fr_64px_140px] border-b border-border/60 bg-muted/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-4 py-2.5">
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
                      <div
                        key={dept}
                        className={cn(
                          "px-4 py-3 flex flex-col gap-2",
                          isEmpty ? "opacity-40" : "hover:bg-muted/10"
                        )}
                      >
                        {/* Top row: dept name + count + capacity bar */}
                        <div className="grid grid-cols-[1fr_64px_140px] items-center gap-2">
                          <span className="font-semibold text-foreground text-xs">{dept}</span>

                          {/* Member count */}
                          <span className={cn(
                            "text-sm font-extrabold text-center",
                            isFull ? "text-red-400" : isNear ? "text-amber-400" : count > 0 ? "text-white" : "text-muted-foreground"
                          )}>
                            {count}
                          </span>

                          {/* Capacity bar */}
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 rounded-full bg-muted/30 overflow-hidden">
                                <div
                                  className={cn(
                                    "h-full rounded-full transition-all duration-500",
                                    isFull ? "bg-red-500" : isNear ? "bg-amber-400" : count > 0 ? "bg-primary" : "bg-transparent"
                                  )}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className={cn(
                                "text-[10px] font-bold w-8 text-right shrink-0",
                                isFull ? "text-red-400" : isNear ? "text-amber-400" : "text-muted-foreground"
                              )}>
                                {count}/{CAP}
                              </span>
                            </div>
                            {isFull && (
                              <span className="text-[10px] text-red-400 font-bold">FULL</span>
                            )}
                          </div>
                        </div>

                        {/* Members list — full width, wraps freely */}
                        {members.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {members.map((m) => (
                              <span
                                key={m.id}
                                title={`${m.name} · ${m.register_no} · ${m.gender}`}
                                className="inline-flex items-center gap-1.5 text-[11px] bg-muted/30 border border-border/30 px-2.5 py-1 rounded-lg text-foreground font-medium"
                              >
                                <span className={cn(
                                  "size-1.5 rounded-full shrink-0",
                                  m.gender === "Female" ? "bg-pink-400" : "bg-blue-400"
                                )} />
                                {m.name}
                                {m.register_no && (
                                  <span className="text-muted-foreground/60 font-mono text-[9px]">
                                    {m.register_no}
                                  </span>
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                        {members.length === 0 && (
                          <span className="text-[11px] text-muted-foreground/50 italic">No members assigned</span>
                        )}
                      </div>
                    );
                  })}
                  {displayDepts.length === 0 && (
                    <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                      No departments match your filter.
                    </div>
                  )}
                </div>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
