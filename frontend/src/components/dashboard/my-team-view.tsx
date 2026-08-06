"use client";

import { useEffect, useState } from "react";
import type { EnrichedTeam, Invite, Problem, Profile, Theme } from "@/lib/types";
import * as data from "@/lib/data";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/components/unlumen-ui/toast";
import { Button } from "@/components/unlumen-ui/button";
import { Input, Select } from "@/components/unlumen-ui/input";
import { Card } from "@/components/unlumen-ui/card";
import { GlowingBadge } from "@/components/unlumen-ui/glowing-badge";
import { Avatar } from "@/components/unlumen-ui/avatar";
import { TeamCard } from "./team-card";

export function MyTeamView({
  profile,
  myTeam,
  problems,
  themes,
  joinRequests,
  refresh,
}: {
  profile: Profile;
  myTeam: EnrichedTeam | null;
  problems: Problem[];
  themes: Theme[];
  joinRequests: Invite[];
  refresh: () => Promise<void>;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [problemId, setProblemId] = useState("");
  const [themeId, setThemeId] = useState("");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [profilesMap, setProfilesMap] = useState<Map<string, Profile>>(new Map());

  useEffect(() => {
    data.fetchAllProfiles().then((res) => {
      if (res.data) setProfilesMap(new Map(res.data.map((p) => [p.id, p])));
    });
  }, [joinRequests.length]);

  const problemMap = new Map(problems.map((p) => [p.id, p]));
  const themeMap = new Map(themes.map((t) => [t.id, t]));
  const isLeader = myTeam?.team.leader_id === profile.id;

  async function createTeam(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    const res = await data.api.createTeam(name.trim(), problemId || undefined);
    if (res.error) {
      toast("error", res.error);
    } else {
      toast("success", `Team "${name.trim()}" created — you're the leader`);
      setName("");
      await refresh();
    }
    setCreating(false);
  }

  async function handleInvite(invite: Invite, accept: boolean) {
    setBusy(invite.id);
    const res = accept ? await data.api.acceptInvite(invite.id) : await data.api.rejectInvite(invite.id);
    if (res.error) {
      toast("error", res.error);
    } else {
      toast("success", accept ? "Member added" : "Request rejected");
      await refresh();
    }
    setBusy(null);
  }

  async function removeMember(memberId: string, name: string) {
    if (!myTeam) return;
    setBusy(memberId);
    const res = await data.api.removeMember(myTeam.team.id, memberId);
    if (res.error) {
      toast("error", res.error);
    } else {
      toast("success", `${name} removed`);
      await refresh();
    }
    setBusy(null);
  }

  async function leave() {
    if (!myTeam) return;
    const res = await data.api.leaveTeam(myTeam.team.id);
    if (res.error) {
      toast("error", res.error);
    } else {
      toast("success", isLeader ? "Team disbanded" : "You left the team");
      await refresh();
    }
  }

  if (!myTeam) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-bold">You&apos;re not in a team yet</h2>
          <p className="text-sm text-muted-foreground">
            Create one and become the leader — teammates will find you by your tech stack.
          </p>
        </div>
        <Card className="max-w-xl p-6">
          <form onSubmit={createTeam} className="flex flex-col gap-4">
            <Input
              label="Team name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. CodeSprint"
              required
            />
            <Select label="Problem statement (optional)" value={problemId} onChange={(e) => setProblemId(e.target.value)}>
              <option value="">No problem chosen yet</option>
              {problems.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </Select>
            <Select label="Theme (optional)" value={themeId} onChange={(e) => setThemeId(e.target.value)}>
              <option value="">No theme chosen yet</option>
              {themes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
            <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
              Team rules once filled: <strong>6 members max · ≥ 2 female · ≥ 2 departments</strong>. Rule violations are
              blocked automatically.
            </p>
            <Button type="submit" loading={creating}>
              Create team
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  const s = myTeam.stats;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">{myTeam.team.name}</h2>
          <p className="text-sm text-muted-foreground">
            {problemMap.get(myTeam.team.problem_id ?? "")?.title ?? "No problem chosen"} ·{" "}
            {themeMap.get(myTeam.team.theme_id ?? "")?.name ?? "No theme"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {s.valid ? (
            <GlowingBadge variant="success">Competition-ready</GlowingBadge>
          ) : (
            <GlowingBadge variant="warning">{s.reason}</GlowingBadge>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <TeamCard team={myTeam} />

        <Card className="p-5">
          <h3 className="mb-4 text-base font-bold">
            Members{" "}
            <span className="text-xs font-medium text-muted-foreground">
              ({s.memberCount}/6 · ♀ {s.girlCount} · {s.deptCount} depts)
            </span>
          </h3>
          <ul className="flex flex-col gap-2">
            {myTeam.members.map((m) => (
              <li key={m.id} className="glass flex items-center justify-between gap-3 rounded-xl px-3 py-2">
                <div className="flex items-center gap-2.5">
                  <Avatar name={m.name} src={m.avatar_url} />
                  <div className="leading-tight">
                    <p className="text-sm font-semibold">
                      {m.name}
                      {m.id === myTeam.team.leader_id && <span className="ml-1.5 text-xs text-ring">Leader</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {m.department ?? "—"} · {m.section ?? "—"} · {m.gender}
                    </p>
                  </div>
                </div>
                {isLeader && m.id !== profile.id && (
                  <Button
                    variant="danger"
                    className="px-2.5 py-1 text-xs"
                    loading={busy === m.id}
                    onClick={() => removeMember(m.id, m.name)}
                  >
                    Remove
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {isLeader && joinRequests.length > 0 && (
            <div className="mt-5">
              <h4 className="mb-2 text-sm font-bold text-muted-foreground">
                Join requests ({joinRequests.length})
              </h4>
              <ul className="flex flex-col gap-2">
                {joinRequests.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/40 px-3 py-2">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={profilesMap.get(inv.sender_id)?.name ?? "?"} src={profilesMap.get(inv.sender_id)?.avatar_url} className="size-8" />
                      <div>
                        <p className="text-sm font-medium">
                          {profilesMap.get(inv.sender_id)?.name ?? "Unknown member"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {profilesMap.get(inv.sender_id)?.department ?? "—"} ·{" "}
                          {formatDate(inv.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        className="px-2.5 py-1 text-xs"
                        loading={busy === inv.id}
                        onClick={() => handleInvite(inv, true)}
                      >
                        Accept
                      </Button>
                      <Button
                        variant="danger"
                        className="px-2.5 py-1 text-xs"
                        disabled={busy === inv.id}
                        onClick={() => handleInvite(inv, false)}
                      >
                        Reject
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>

      <div className="flex justify-end">
        <Button variant="danger" onClick={leave}>
          {isLeader ? "Disband team" : "Leave team"}
        </Button>
      </div>
    </div>
  );
}
