"use client";

import { useState } from "react";
import type { EnrichedTeam } from "@/lib/types";
import * as data from "@/lib/data";
import { useToast } from "@/components/unlumen-ui/toast";
import { TeamCard } from "./team-card";

export function TeamsView({
  teams,
  myTeam,
  pendingRequestTeamIds,
  refresh,
}: {
  teams: EnrichedTeam[];
  myTeam: EnrichedTeam | null;
  pendingRequestTeamIds: string[];
  refresh: () => Promise<void>;
}) {
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function requestJoin(team: EnrichedTeam) {
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
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-xl font-bold">All teams</h2>
          <p className="text-sm text-muted-foreground">
            {teams.length} team{teams.length === 1 ? "" : "s"} formed so far
          </p>
        </div>
      </div>

      {teams.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
          No teams yet — be the first to create one.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {teams.map((team) => {
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
