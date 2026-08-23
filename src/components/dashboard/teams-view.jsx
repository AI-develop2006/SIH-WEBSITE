"use client";

import { useMemo, useState } from "react";
import * as data from "@/lib/data";
import { useToast } from "@/components/unlumen-ui/toast";
import { TeamCard } from "./team-card";
import { cn } from "@/lib/utils";
import { Search, X } from "lucide-react";

export function TeamsView({
  teams = [],
  myTeam,
  pendingRequestTeamIds = [],
  refresh,
}) {
  const toast = useToast();
  const [busyId, setBusyId] = useState(null);

  // ── Filters ──────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [ministryFilter, setMinistryFilter] = useState("");

  // Derived filter options from live teams
  const availableDepts = useMemo(
    () => [...new Set(teams.flatMap((t) => t.members.map((m) => m.department)).filter(Boolean))].sort(),
    [teams]
  );
  const availableSections = useMemo(
    () => [...new Set(teams.flatMap((t) => t.members.map((m) => m.section)).filter(Boolean))].sort(),
    [teams]
  );
  const availableMinistries = useMemo(
    () => [...new Set(teams.map((t) => t.team.ministry).filter(Boolean))].sort(),
    [teams]
  );

  const filteredTeams = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return teams.filter((t) => {
      if (deptFilter && !t.members.some((m) => m.department === deptFilter)) return false;
      if (sectionFilter && !t.members.some((m) => (m.section ?? "").toUpperCase() === sectionFilter.toUpperCase())) return false;
      if (ministryFilter && t.team.ministry !== ministryFilter) return false;
      if (needle) {
        const hay = [
          t.team.name, t.team.team_code, t.team.ministry,
          ...t.members.map((m) => `${m.name} ${m.register_no ?? ""}`),
        ].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [teams, search, deptFilter, sectionFilter, ministryFilter]);

  const hasFilters = search || deptFilter || sectionFilter || ministryFilter;

  function clearFilters() {
    setSearch(""); setDeptFilter(""); setSectionFilter(""); setMinistryFilter("");
  }

  async function requestJoin(team) {
    setBusyId(team.team.id);
    const res = await data.api.requestToJoin(team.team.id);
    if (res.error) {
      toast("error", res.error);
    } else {
      toast("success", "Join request sent to the team leader");
      await refresh();
    }
    setBusyId(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold">All teams</h2>
          <p className="text-sm text-muted-foreground">
            {filteredTeams.length !== teams.length
              ? <>{filteredTeams.length} of {teams.length} team{teams.length === 1 ? "" : "s"}</>
              : <>{teams.length} team{teams.length === 1 ? "" : "s"} formed so far</>
            }
          </p>
        </div>
        {hasFilters && (
          <button type="button" onClick={clearFilters} className="text-xs text-red-400 hover:underline font-semibold">
            ✕ Clear filters
          </button>
        )}
      </div>

      {/* Search + Filters */}
      {teams.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {/* Text search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search team, member name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-border/50 bg-card/60 pl-9 pr-8 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-ring/70 transition-all"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="size-3.5" />
              </button>
            )}
          </div>
          {/* Department */}
          {availableDepts.length > 0 && (
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="rounded-xl border border-border/50 bg-card/60 px-3 py-2 text-sm text-foreground focus:outline-none focus:border-ring/70 transition-all cursor-pointer"
            >
              <option value="">All Depts</option>
              {availableDepts.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
          {/* Section */}
          {availableSections.length > 0 && (
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="rounded-xl border border-border/50 bg-card/60 px-3 py-2 text-sm text-foreground focus:outline-none focus:border-ring/70 transition-all w-28 cursor-pointer"
            >
              <option value="">All Sections</option>
              {availableSections.map((s) => <option key={s} value={s}>Section {s}</option>)}
            </select>
          )}
          {/* Ministry */}
          {availableMinistries.length > 0 && (
            <select
              value={ministryFilter}
              onChange={(e) => setMinistryFilter(e.target.value)}
              className="rounded-xl border border-border/50 bg-card/60 px-3 py-2 text-sm text-foreground focus:outline-none focus:border-ring/70 transition-all max-w-[200px] cursor-pointer"
            >
              <option value="">All Ministries</option>
              {availableMinistries.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          )}
        </div>
      )}

      {filteredTeams.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
          {hasFilters ? "No teams match your filters." : "No teams yet — be the first to create one."}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredTeams.map((team) => {
            const inMyTeam = myTeam?.team.id === team.team.id;
            const requested = pendingRequestTeamIds.includes(team.team.id);
            return (
              <TeamCard
                key={team.team.id}
                team={team}
                busy={busyId === team.team.id}
                disabled={inMyTeam || requested}
                actionLabel={inMyTeam ? "You're in this team" : requested ? "Request sent" : "Request to join"}
                onAction={() => requestJoin(team)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
