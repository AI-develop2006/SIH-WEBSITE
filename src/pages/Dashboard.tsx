"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import * as data from "@/lib/data";
import { uploadToCloudinary } from "@/lib/cloudinary";
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
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    setAvatarUploading(true);
    const { url, error: uploadError } = await uploadToCloudinary(file);
    if (uploadError || !url) {
      toast("error", uploadError ?? "Upload failed");
      setAvatarUploading(false);
      return;
    }

    const { error: saveError } = await data.updateAvatarUrl(profile.id, url);
    if (saveError) {
      toast("error", saveError);
    } else {
      setProfile((prev) => prev ? { ...prev, avatar_url: url } : prev);
      toast("success", "Profile photo updated");
    }
    setAvatarUploading(false);
    // reset so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function logout() {
    await supabase?.auth.signOut();
    navigate("/", { replace: true });
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#06090f]">
        <div className="flex flex-col items-center gap-3">
          <span className="size-8 animate-spin rounded-full border-2 border-[#c9a227] border-t-transparent" />
          <p className="text-sm text-[#8fa0c0]">Loading your dashboard…</p>
        </div>
      </main>
    );
  }

  if (setup) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#06090f] p-6">
        <div className="max-w-md rounded-3xl border border-[rgba(201,162,39,0.18)] bg-[#0d1220] p-8 text-center">
          <h1 className="mb-2 text-lg font-bold text-[#e8c058]">Supabase not configured</h1>
          <p className="text-sm text-muted-foreground">
            Copy <code className="font-mono">. env.local.example</code> → <code className="font-mono">.env.local</code>,
            add your project URL + anon key, and run <code className="font-mono">supabase/schema.sql</code> in the SQL
            editor. Then restart the dev server.
          </p>
          <Button className="mt-5 bg-[#c9a227] text-[#06090f] hover:bg-[#e8c058] border-0 font-bold" onClick={() => navigate("/")}>
            Back to login
          </Button>
        </div>
      </main>
    );
  }

  const inviteCount = invites.incoming.filter((i) => i.kind === "invite").length +
    invites.incoming.filter((i) => i.kind === "request" && myTeam?.team.id === i.team_id).length;

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 pb-16">
      {/* SMVEC navy + gold orb backdrops */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        {/* Base navy gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#060c1a] via-[#06090f] to-[#060c1a]" />
        {/* Gold glow top-left */}
        <div className="absolute -top-32 left-1/4 h-[480px] w-[480px] rounded-full bg-[#c9a227]/08 blur-[130px]" />
        {/* Navy mass bottom-right */}
        <div className="absolute bottom-0 right-1/4 h-[400px] w-[400px] rounded-full bg-[#0b1631]/80 blur-[110px]" />
        {/* Subtle gold centre */}
        <div className="absolute top-1/2 left-1/2 h-[320px] w-[320px] -translate-x-1/2 rounded-full bg-[#c9a227]/05 blur-[100px]" />
        {/* Gold-tinted grid */}
        <div className="bg-grid absolute inset-0" />
      </div>

      {/* Gold top accent bar */}
      <div className="fixed inset-x-0 top-0 z-50 h-[2px] bg-gradient-to-r from-transparent via-[#c9a227] to-transparent" />

      <header className="sticky top-0 z-40 -mx-5 mb-6 border-b border-[rgba(201,162,39,0.15)] bg-[#06090f]/85 px-5 backdrop-blur">
        <div className="flex h-[4.5rem] items-center justify-between gap-3">
          <button onClick={() => navigate("/")} className="flex items-center">
            <CollegeBrand />
          </button>

          <div className="flex items-center gap-2">
            {profile && (
              <div className="hidden items-center gap-2.5 rounded-lg border border-[rgba(201,162,39,0.18)] bg-[#0d1220] px-3 py-1.5 sm:flex">
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
                {/* Clickable avatar with upload overlay */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarUploading}
                  className="group relative shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a227]"
                  title="Change profile photo"
                >
                  <Avatar
                    name={profile.name}
                    src={profile.avatar_url}
                    className="size-7 text-[10px]"
                  />
                  {/* Hover overlay */}
                  <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 group-disabled:opacity-100">
                    {avatarUploading ? (
                      <span className="size-3 animate-spin rounded-full border border-white border-t-transparent" />
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="size-3 text-white">
                        <path d="M8 1a.75.75 0 0 1 .75.75v5.5h5.5a.75.75 0 0 1 0 1.5h-5.5v5.5a.75.75 0 0 1-1.5 0v-5.5H1.75a.75.75 0 0 1 0-1.5h5.5v-5.5A.75.75 0 0 1 8 1Z" />
                      </svg>
                    )}
                  </span>
                </button>
                <div className="leading-tight">
                  <p className="text-xs font-semibold">{profile.name}</p>
                  <p className="text-[10px] text-muted-foreground">{profile.phone}</p>
                </div>
              </div>
            )}
            {profile?.role === "admin" && (
              <button
                onClick={() => navigate("/admin")}
                className="rounded-lg border border-[rgba(201,162,39,0.35)] bg-[rgba(201,162,39,0.10)] px-3 py-2 text-xs font-semibold text-[#c9a227] transition-colors hover:bg-[rgba(201,162,39,0.20)]"
              >
                Admin
              </button>
            )}
            <ThemeToggle />
            <Button variant="outline" onClick={logout} className="border-[rgba(201,162,39,0.25)] text-[#8fa0c0] hover:border-[rgba(201,162,39,0.50)] hover:text-[#e8c058] px-3 py-2">
              Log out
            </Button>
          </div>
        </div>
      </header>

      <nav className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-[rgba(201,162,39,0.15)] bg-[#0d1220] p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition-all",
              tab === t.id
                ? "bg-[#c9a227] text-[#06090f] shadow-sm"
                : "text-muted-foreground hover:bg-[rgba(201,162,39,0.08)] hover:text-[#e8c058]"
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
