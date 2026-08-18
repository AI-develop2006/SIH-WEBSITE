"use client";

import { useEffect, useState } from "react";
import * as data from "@/lib/data";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/components/unlumen-ui/toast";
import { Button } from "@/components/unlumen-ui/button";
import { Card } from "@/components/unlumen-ui/card";
import { Avatar } from "@/components/unlumen-ui/avatar";

export function InvitesView({
  myTeam,
  teams = [],
  invites = { incoming: [], sent: [] },
  refresh,
}) {
  const toast = useToast();
  const [busyId, setBusyId] = useState(null);
  const [profilesMap, setProfilesMap] = useState(new Map());

  useEffect(() => {
    data.fetchAllProfiles().then((res) => {
      if (res.data) setProfilesMap(new Map(res.data.map((p) => [p.id, p])));
    });
  }, []);

  const teamMap = new Map(teams.map((t) => [t.team.id, t]));
  const nameOf = (id) => profilesMap.get(id)?.name ?? "Unknown";

  const incomingInvites = invites.incoming.filter((i) => i.kind === "invite");
  const incomingRequests = invites.incoming.filter(
    (i) => i.kind === "request" && myTeam?.team.id === i.team_id
  );

  async function respond(invite, accept) {
    setBusyId(invite.id);
    const res = accept ? await data.api.acceptInvite(invite.id) : await data.api.rejectInvite(invite.id);
    if (res.error) {
      toast("error", res.error);
    } else {
      toast("success", accept ? "Done — you're in the team" : "Rejected");
      await refresh();
    }
    setBusyId(null);
  }

  const empty = incomingInvites.length + incomingRequests.length + invites.sent.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold">Invites</h2>
        <p className="text-sm text-muted-foreground">Team invitations and join requests.</p>
      </div>

      {empty && (
        <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
          No invites yet — browse teams to request a spot, or find members to invite.
        </div>
      )}

      {incomingInvites.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Invitations for you
          </h3>
          {incomingInvites.map((inv) => {
            const team = teamMap.get(inv.team_id);
            return (
              <Card key={inv.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <Avatar name={team?.team.name ?? "?"} className="size-10 rounded-xl text-[10px]" />
                  <div>
                    <p className="text-sm font-bold">{team?.team.name ?? "Unknown team"}</p>
                    <p className="text-xs text-muted-foreground">
                      invited by {nameOf(inv.sender_id)} · {formatDate(inv.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    className="px-3 py-1.5 text-xs"
                    loading={busyId === inv.id}
                    onClick={() => respond(inv, true)}
                  >
                    Accept
                  </Button>
                  <Button
                    variant="danger"
                    className="px-3 py-1.5 text-xs"
                    disabled={busyId === inv.id}
                    onClick={() => respond(inv, false)}
                  >
                    Reject
                  </Button>
                </div>
              </Card>
            );
          })}
        </section>
      )}

      {incomingRequests.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Join requests for your team
          </h3>
          {incomingRequests.map((inv) => {
            const requester = profilesMap.get(inv.sender_id);
            return (
              <Card key={inv.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <Avatar name={requester?.name ?? "?"} />
                  <div>
                    <p className="text-sm font-bold">{requester?.name ?? "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">
                      {requester?.department ?? "—"} · {requester?.gender ?? "—"} ·{" "}
                      {formatDate(inv.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    className="px-3 py-1.5 text-xs"
                    loading={busyId === inv.id}
                    onClick={() => respond(inv, true)}
                  >
                    Accept
                  </Button>
                  <Button
                    variant="danger"
                    className="px-3 py-1.5 text-xs"
                    disabled={busyId === inv.id}
                    onClick={() => respond(inv, false)}
                  >
                    Reject
                  </Button>
                </div>
              </Card>
            );
          })}
        </section>
      )}

      {invites.sent.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Sent</h3>
          {invites.sent.map((inv) => {
            const team = teamMap.get(inv.team_id);
            const other = inv.kind === "request" ? "requested to join" : `invited ${nameOf(inv.invitee_id)} to`;
            return (
              <Card key={inv.id} className="flex items-center justify-between gap-3 p-4">
                <p className="text-sm text-muted-foreground">
                  You {other} <strong className="text-foreground">{team?.team.name ?? "a team"}</strong> ·{" "}
                  {formatDate(inv.created_at)}
                </p>
                <span className="rounded-full border border-warning/40 bg-warning/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-warning">
                  Pending
                </span>
              </Card>
            );
          })}
        </section>
      )}
    </div>
  );
}
