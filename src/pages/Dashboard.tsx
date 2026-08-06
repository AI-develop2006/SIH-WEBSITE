"use client";

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import * as data from "@/lib/data";
import type { EnrichedTeam, Invite, Problem, Profile, Theme } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/unlumen-ui/toast";
import { Avatar } from "@/components/unlumen-ui/avatar";
import { Button } from "@/components/unlumen-ui/button";
import { CollegeBrand } from "@/components/college-brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { TeamsView } from "@/components/dashboard/teams-view";
import { MyTeamView } from "@/components/dashboard/my-team-view";
import { MembersView } from "@/components/dashboard/members-view";
import { InvitesView } from "@/components/dashboard/invites-view";

type Tab = "teams" | "my-team" | "members" | "invites";

const TABS: { id: Tab; label: string }[] = [
  { id: "teams", label: "Teams" },
  { id: "my-team", label: "My Team" },
  { id: "members", label: "Find Members" },
  { id: "invites", label: "Invites" },
];

export default function DashboardPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [tab, setTab] = useState<Tab>("teams");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [myTeam, setMyTeam] = useState<EnrichedTeam | null>(null);
  const [teams, setTeams] = useState<EnrichedTeam[]>([]);
  const [invites, setInvites] = useState<{ incoming: Invite[]; sent: Invite[] }>({ incoming: [], sent: [] });
  const [problems, setProblems] = useState<Problem[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [setup, setSetup] = useState(false);

  const refresh = useCallback(async () => {
    if (!profile) return;
    const [myTeamRes, teamsRes, invitesRes, problemsRes, themesRes] = await Promise.all([
      data.fetchMyTeam(profile.id),
      data.fetchEnrichedTeams(),
      data.fetchInvites(profile.id),
      data.fetchProblems(),
      data.fetchThemes(),
    ]);
    if (myTeamRes.error) toast("error", myTeamRes.error);
    if (teamsRes.error) toast("error", teamsRes.error);
    if (invitesRes.error) toast("error", invitesRes.error);
    if (problemsRes.error) toast("error", problemsRes.error);
    if (themesRes.error) toast("error", themesRes.error);

    setMyTeam(myTeamRes.data);
    setTeams(teamsRes.data ?? []);
    setInvites(invitesRes.data ?? { incoming: [], sent: [] });
    setProblems(problemsRes.data ?? []);
    setThemes(themesRes.data ?? []);
  }, [profile, toast]);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setSetup(true);
      setLoading(false);
      return;
    }
    supabase?.auth.getSession().then(async ({ data: s }) => {
      if (!s.session) {
        navigate("/", { replace: true });
        return;
      }
      const { data: p, error } = await data.getCurrentProfile();
      if (error || !p) {
        await supabase?.auth.signOut();
        navigate("/", { replace: true });
        return;
      }
      setProfile(p);
    });
  }, [navigate]);

  useEffect(() => {
    if (profile) {
      setLoading(true);
      refresh().finally(() => setLoading(false));
    }
  }, [profile, refresh]);

  async function logout() {
    await supabase?.auth.signOut();
    navigate("/", { replace: true });
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading your dashboard…</p>
        </div>
      </main>
    );
  }

  if (setup) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="glass max-w-md rounded-3xl p-8 text-center">
          <h1 className="mb-2 text-lg font-bold">Supabase not configured</h1>
          <p className="text-sm text-muted-foreground">
            Copy <code className="font-mono">.env.local.example</code> → <code className="font-mono">.env.local</code>,
            add your project URL + anon key, and run <code className="font-mono">supabase/schema.sql</code> in the SQL
            editor. Then restart the dev server.
          </p>
          <Button className="mt-5" onClick={() => navigate("/")}>
            Back to login
          </Button>
        </div>
      </main>
    );
  }

  const inviteCount = invites.incoming.filter((i) => i.kind === "invite").length +
    invites.incoming.filter((i) => i.kind === "request" && myTeam?.team.id === i.team_id).length;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 pb-16">
      <header className="sticky top-0 z-40 -mx-5 mb-6 border-b border-border bg-background/80 px-5 backdrop-blur">
        <div className="flex h-16 items-center justify-between gap-3">
          <button onClick={() => navigate("/")} className="flex items-center">
            <CollegeBrand />
          </button>

          <div className="flex items-center gap-2">
            {profile && (
              <div className="hidden items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-1.5 sm:flex">
                <Avatar name={profile.name} className="size-7 text-[10px]" />
                <div className="leading-tight">
                  <p className="text-xs font-semibold">{profile.name}</p>
                  <p className="text-[10px] text-muted-foreground">{profile.phone}</p>
                </div>
              </div>
            )}
            {profile?.role === "admin" && (
              <button
                onClick={() => navigate("/admin")}
                className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent transition-colors hover:bg-accent/20"
              >
                Admin
              </button>
            )}
            <ThemeToggle />
            <Button variant="outline" onClick={logout} className="px-3 py-2">
              Log out
            </Button>
          </div>
        </div>
      </header>

      <nav className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition-all",
              tab === t.id
                ? "bg-accent text-primary dark:bg-primary dark:text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
          >
            {t.label}
            {t.id === "invites" && inviteCount > 0 && (
              <span className="flex size-5 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white">
                {inviteCount}
              </span>
            )}
          </button>
        ))}
      </nav>

      {tab === "teams" && (
        <TeamsView
          teams={teams}
          myTeam={myTeam}
          pendingRequestTeamIds={invites.sent.filter((i) => i.kind === "request").map((i) => i.team_id)}
          refresh={refresh}
        />
      )}
      {tab === "my-team" && (
        <MyTeamView
          profile={profile!}
          myTeam={myTeam}
          problems={problems}
          themes={themes}
          joinRequests={invites.incoming.filter((i) => i.kind === "request" && myTeam?.team.id === i.team_id)}
          refresh={refresh}
        />
      )}
      {tab === "members" && (
        <MembersView profile={profile!} myTeam={myTeam} />
      )}
      {tab === "invites" && (
        <InvitesView
          myTeam={myTeam}
          teams={teams}
          invites={invites}
          refresh={refresh}
        />
      )}
    </main>
  );
}
