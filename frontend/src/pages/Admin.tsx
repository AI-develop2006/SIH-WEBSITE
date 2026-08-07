"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase/client";
import * as data from "@/lib/data";
import { downloadCsv } from "@/lib/utils";
import { DEPARTMENTS } from "@/lib/constants";
import type { EnrichedTeam, Problem, Profile, Theme, TimelineEvent, Announcement } from "@/lib/types";
import { useToast } from "@/components/unlumen-ui/toast";
import { Button } from "@/components/unlumen-ui/button";
import { Card } from "@/components/unlumen-ui/card";
import { GlowingBadge } from "@/components/unlumen-ui/glowing-badge";
import { Avatar } from "@/components/unlumen-ui/avatar";
import { Input, Select } from "@/components/unlumen-ui/input";
import { CollegeBrand } from "@/components/college-brand";
import { cn } from "@/lib/utils";

type Tab = "students" | "teams" | "problems" | "timeline" | "announcements";

export default function AdminPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [tab, setTab] = useState<Tab>("students");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [teams, setTeams] = useState<EnrichedTeam[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [tablesMissing, setTablesMissing] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [dept, setDept] = useState("");
  const [gender, setGender] = useState("");
  const [verified, setVerified] = useState("all");
  const [projType, setProjType] = useState("");

  const [promoting, setPromoting] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [profilesRes, teamsRes, problemsRes, themesRes, timelineRes, announcementsRes] = await Promise.all([
      data.fetchAllProfiles(),
      data.fetchEnrichedTeams(),
      data.fetchProblems(),
      data.fetchThemes(),
      data.fetchTimelineEvents(),
      data.fetchAnnouncements(),
    ]);
    if (profilesRes.error) toast("error", profilesRes.error);
    if (teamsRes.error) toast("error", teamsRes.error);
    if (problemsRes.error) toast("error", problemsRes.error);
    if (themesRes.error) toast("error", themesRes.error);

    // If relations are missing in Supabase, show database config message
    const isMissing = (err: string | null) => {
      if (!err) return false;
      const lower = err.toLowerCase();
      return (
        lower.includes("does not exist") ||
        lower.includes("could not find the table") ||
        lower.includes("schema cache")
      );
    };

    if (isMissing(timelineRes.error) || isMissing(announcementsRes.error)) {
      setTablesMissing(true);
    } else {
      if (timelineRes.error) toast("error", timelineRes.error);
      if (announcementsRes.error) toast("error", announcementsRes.error);
      setTablesMissing(false);
    }

    setProfiles(profilesRes.data ?? []);
    setTeams(teamsRes.data ?? []);
    setProblems(problemsRes.data ?? []);
    setThemes(themesRes.data ?? []);
    setTimeline(timelineRes.data ?? []);
    setAnnouncements(announcementsRes.data ?? []);
  }, [toast]);

  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase!.auth.getSession();
      if (!session) {
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }
      const { data: me } = await data.getCurrentProfile();
      if (!me || me.role !== "admin") {
        toast("error", "Admins only");
        navigate("/dashboard", { replace: true });
        return;
      }
      setIsAuthenticated(true);
      await load();
      setLoading(false);
    })();
  }, [navigate, toast, load]);

  const students = useMemo(() => {
    const list = profiles.filter((p) => p.role === "student");
    const needle = q.trim().toLowerCase();
    return list.filter((p) => {
      if (dept && p.department !== dept) return false;
      if (gender && p.gender !== gender) return false;
      if (verified === "verified" && !p.verified) return false;
      if (verified === "unverified" && p.verified) return false;
      if (projType && p.project_type !== projType) return false;
      if (!needle) return true;
      const hay = [
        p.name,
        p.register_no,
        p.email,
        p.phone,
        p.section,
        p.year,
        p.languages.join(" "),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [profiles, q, dept, gender, verified, projType]);

  const problemMap = useMemo(() => new Map(problems.map((p) => [p.id, p.title])), [problems]);

  const validTeams = teams.filter((t) => t.stats.valid).length;
  const unassigned = students.length - teams.reduce((n, t) => n + t.members.length, 0);
  const verifiedCount = students.filter((s) => s.verified).length;

  async function promote(phone: string, name: string) {
    setPromoting(phone);
    const res = await data.api.promoteAdmin(phone);
    if (res.error) {
      toast("error", res.error);
    } else {
      toast("success", `${name} is now an admin`);
      await load();
    }
    setPromoting(null);
  }

  async function toggleVerify(p: Profile) {
    setVerifying(p.id);
    const res = await data.api.verifyStudent(p.id, !p.verified);
    if (res.error) {
      toast("error", res.error);
    } else {
      toast("success", p.verified ? `Verification removed for ${p.name}` : `${p.name} verified`);
      await load();
    }
    setVerifying(null);
  }

  async function deleteTeam(t: EnrichedTeam) {
    if (!window.confirm(`Delete team "${t.team.name}"? This cannot be undone.`)) return;
    setDeleting(t.team.id);
    const res = await data.api.deleteTeam(t.team.id);
    if (res.error) {
      toast("error", res.error);
    } else {
      toast("success", `Team "${t.team.name}" deleted`);
      await load();
    }
    setDeleting(null);
  }

  async function logout() {
    await supabase!.auth.signOut();
    setIsAuthenticated(false);
    navigate("/", { replace: true });
  }

  function exportStudents() {
    downloadCsv(
      "sih-students.csv",
      students.map((s) => ({
        name: s.name,
        register_no: s.register_no ?? "",
        email: s.email ?? "",
        phone: s.phone ?? "",
        department: s.department ?? "",
        year: s.year ?? "",
        section: s.section ?? "",
        gender: s.gender ?? "",
        languages: s.languages.join(" | "),
        linkedin: s.linkedin ?? "",
        project_type: s.project_type ?? "",
        project_title: s.project_title ?? "",
        project_description: s.project_description ?? "",
        domain: s.domain ?? "",
        software_domain: s.software_domain ?? "",
        hardware_domain: s.hardware_domain ?? "",
        github: s.github ?? "",
        youtube_link: s.youtube_link ?? "",
        google_drive_ppt: s.google_drive_ppt ?? "",
        verified: s.verified ? "Yes" : "No",
        created_at: s.created_at,
      })),
      [
        { key: "name", label: "Name" },
        { key: "register_no", label: "Register No" },
        { key: "email", label: "Email" },
        { key: "phone", label: "Phone" },
        { key: "department", label: "Department" },
        { key: "year", label: "Year" },
        { key: "section", label: "Section" },
        { key: "gender", label: "Gender" },
        { key: "languages", label: "Languages" },
        { key: "linkedin", label: "LinkedIn" },
        { key: "project_type", label: "Project Type" },
        { key: "project_title", label: "Project Title" },
        { key: "project_description", label: "Project Description" },
        { key: "domain", label: "Domain" },
        { key: "software_domain", label: "Software Domain" },
        { key: "hardware_domain", label: "Hardware Domain" },
        { key: "github", label: "GitHub URL" },
        { key: "youtube_link", label: "YouTube Link" },
        { key: "google_drive_ppt", label: "Google Drive PPT" },
        { key: "verified", label: "Verified" },
        { key: "created_at", label: "Registered On" },
      ]
    );
  }

  function exportTeams() {
    downloadCsv(
      "sih-teams.csv",
      teams.map((t) => ({
        name: t.team.name,
        leader: t.leader?.name ?? "",
        members: t.members.map((m) => m.name).join(" | "),
        member_count: t.stats.memberCount,
        departments: t.stats.deptCount,
        female: t.stats.girlCount,
        valid: t.stats.valid ? "Yes" : "No",
        reason: t.stats.reason ?? "",
        problem: problemMap.get(t.team.problem_id ?? "") ?? "",
      })),
      [
        { key: "name", label: "Team Name" },
        { key: "leader", label: "Leader" },
        { key: "members", label: "Members" },
        { key: "member_count", label: "Member Count" },
        { key: "departments", label: "Departments" },
        { key: "female", label: "Female Members" },
        { key: "valid", label: "Valid" },
        { key: "reason", label: "Reason" },
        { key: "problem", label: "Problem Statement" },
      ]
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground bg-transparent">
        Loading…
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <AdminLoginForm
        onLoginSuccess={() => {
          setIsAuthenticated(true);
          load();
        }}
      />
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 pb-16">
      <header className="sticky top-0 z-40 -mx-5 mb-6 border-b border-border bg-background/80 px-5 backdrop-blur">
        <div className="flex h-16 items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CollegeBrand />
            <div className="leading-tight">
              <p className="text-sm font-bold tracking-tight">Admin control</p>
              <p className="text-xs text-muted-foreground">SIH 2026 · registrations & teams</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate("/")}>
              View Site
            </Button>
            <Button variant="danger" onClick={logout} className="px-3 py-2">
              Log out
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 pb-3">
          {(["students", "teams", "problems", "timeline", "announcements"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "rounded-lg px-4 py-1.5 text-sm font-semibold transition-all",
                tab === t
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              {t === "students"
                ? `Students (${students.length})`
                : t === "teams"
                ? `Teams (${teams.length})`
                : t === "problems"
                ? "Problems"
                : t === "timeline"
                ? "Timeline Dates"
                : "Announcements"}
            </button>
          ))}
        </div>
      </header>

      <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Students" value={students.length} accent="ring" />
            <StatCard label="Verified" value={verifiedCount} accent="success" />
            <StatCard label="Pending" value={students.length - verifiedCount} accent="warning" />
            <StatCard label="Teams" value={teams.length} accent="accent" />
            <StatCard label="Valid teams" value={validTeams} accent="success" />
            <StatCard label="Unassigned" value={unassigned} accent="warning" />
          </div>

          {tab === "students" && (
            <Card className="overflow-hidden p-0">
              <div className="flex flex-col gap-3 border-b border-border px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                <h3 className="text-base font-bold">Student registrations</h3>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search name, register no, email…"
                    className="w-full sm:w-56"
                  />
                  <Select value={dept} onChange={(e) => setDept(e.target.value)} className="w-full sm:w-48">
                    <option value="">All departments</option>
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </Select>
                  <Select value={gender} onChange={(e) => setGender(e.target.value)} className="w-full sm:w-36">
                    <option value="">All genders</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </Select>
                  <Select value={verified} onChange={(e) => setVerified(e.target.value)} className="w-full sm:w-40">
                    <option value="all">All statuses</option>
                    <option value="verified">Verified</option>
                    <option value="unverified">Unverified</option>
                  </Select>
                  <Select value={projType} onChange={(e) => setProjType(e.target.value)} className="w-full sm:w-40">
                    <option value="">All project types</option>
                    <option value="Hardware">Hardware</option>
                    <option value="Software">Software</option>
                    <option value="Both">Both</option>
                  </Select>
                  <Button variant="outline" onClick={exportStudents}>
                    Export CSV
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-5 py-3 font-semibold">Student</th>
                      <th className="px-5 py-3 font-semibold">Register No</th>
                      <th className="px-5 py-3 font-semibold">Dept · Year · Sec</th>
                      <th className="px-5 py-3 font-semibold">Gender</th>
                      <th className="px-5 py-3 font-semibold">Languages</th>
                      <th className="px-5 py-3 font-semibold">Project</th>
                      <th className="px-5 py-3 font-semibold">Status</th>
                      <th className="px-5 py-3 font-semibold">Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-5 py-10 text-center text-sm text-muted-foreground">
                          No registrations match your filters.
                        </td>
                      </tr>
                    )}
                    {students.map((s) => (
                      <tr key={s.id} className="border-b border-border/60 last:border-0 hover:bg-muted/20">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={s.name} className="size-8 text-[10px]" />
                            <div className="leading-tight">
                              <p className="font-semibold">{s.name}</p>
                              <p className="text-xs text-muted-foreground">{s.email ?? "—"}</p>
                              <p className="text-xs text-muted-foreground">{s.phone ?? "—"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{s.register_no ?? "—"}</td>
                        <td className="px-5 py-3 text-muted-foreground">
                          {s.department ?? "—"}
                          {s.year && (
                            <span className="text-xs text-muted-foreground/70">
                              {" "}
                              · Yr {s.year}
                            </span>
                          )}
                          {s.section && <span className="text-xs text-muted-foreground/70"> · Sec {s.section}</span>}
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">{s.gender ?? "—"}</td>
                        <td className="px-5 py-3">
                          <div className="flex max-w-[180px] flex-wrap gap-1">
                            {s.languages.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                            {s.languages.map((l) => (
                              <span
                                key={l}
                                className="rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                              >
                                {l}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">
                          <div className="leading-tight max-w-[220px]">
                            <p className="font-semibold text-xs text-foreground">{s.project_type ?? "—"}</p>
                            {s.project_title && (
                              <p className="text-[11px] text-muted-foreground truncate mt-0.5" title={s.project_title}>
                                {s.project_title}
                              </p>
                            )}
                            {s.domain && (
                              <p className="text-[9px] text-muted-foreground/80 truncate" title={s.domain}>
                                {s.domain}
                              </p>
                            )}
                            <div className="flex gap-2 mt-1">
                              {s.google_drive_ppt && (
                                <a href={s.google_drive_ppt} target="_blank" rel="noreferrer" className="text-[9px] text-[#dba328] hover:underline">
                                  PPT ↗
                                </a>
                              )}
                              {s.github && (
                                <a href={s.github} target="_blank" rel="noreferrer" className="text-[9px] text-[#dba328] hover:underline">
                                  Repo/Profile ↗
                                </a>
                              )}
                              {s.youtube_link && (
                                <a href={s.youtube_link} target="_blank" rel="noreferrer" className="text-[9px] text-[#dba328] hover:underline">
                                  Video ↗
                                </a>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          {s.verified ? (
                            <GlowingBadge variant="success" pulse={false}>
                              Verified
                            </GlowingBadge>
                          ) : (
                            <GlowingBadge variant="warning" pulse={false}>
                              Pending
                            </GlowingBadge>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Button
                              variant="outline"
                              className="px-2.5 py-1 text-xs"
                              loading={verifying === s.id}
                              onClick={() => toggleVerify(s)}
                            >
                              {s.verified ? "Unverify" : "Verify"}
                            </Button>
                            {s.role === "admin" ? (
                              <GlowingBadge variant="info" pulse={false}>
                                Admin
                              </GlowingBadge>
                            ) : (
                              <Button
                                variant="outline"
                                className="px-2.5 py-1 text-xs"
                                loading={promoting === s.phone}
                                onClick={() => promote(s.phone ?? "", s.name)}
                              >
                                Promote
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {tab === "teams" && (
            <Card className="overflow-hidden p-0">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <h3 className="text-base font-bold">Teams</h3>
                <Button variant="outline" onClick={exportTeams}>
                  Export CSV
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-5 py-3 font-semibold">Team</th>
                      <th className="px-5 py-3 font-semibold">Members</th>
                      <th className="px-5 py-3 font-semibold">Depts</th>
                      <th className="px-5 py-3 font-semibold">Female</th>
                      <th className="px-5 py-3 font-semibold">Problem</th>
                      <th className="px-5 py-3 font-semibold">Status</th>
                      <th className="px-5 py-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teams.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-5 py-10 text-center text-sm text-muted-foreground">
                          No teams formed yet.
                        </td>
                      </tr>
                    )}
                    {teams.map((t) => (
                      <tr key={t.team.id} className="border-b border-border/60 last:border-0 hover:bg-muted/20">
                        <td className="px-5 py-3">
                          <p className="font-semibold">{t.team.name}</p>
                          <p className="text-xs text-muted-foreground">Leader · {t.leader?.name ?? "—"}</p>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex -space-x-2">
                              {t.members.slice(0, 4).map((m) => (
                                <Avatar key={m.id} name={m.name} className="size-7 text-[9px] ring-2 ring-background" />
                              ))}
                            </div>
                            <span className="text-xs text-muted-foreground">{t.members.length}/6</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 tabular-nums text-muted-foreground">{t.stats.deptCount}</td>
                        <td className="px-5 py-3 tabular-nums text-muted-foreground">{t.stats.girlCount}</td>
                        <td className="max-w-[220px] px-5 py-3 text-xs text-muted-foreground">
                          {problemMap.get(t.team.problem_id ?? "") ?? "—"}
                        </td>
                        <td className="px-5 py-3">
                          {t.stats.valid ? (
                            <GlowingBadge variant="success" pulse={false}>
                              Valid
                            </GlowingBadge>
                          ) : (
                            <GlowingBadge variant="warning" pulse={false} title={t.stats.reason}>
                              Invalid
                            </GlowingBadge>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <Button
                            variant="danger"
                            className="px-2.5 py-1 text-xs"
                            loading={deleting === t.team.id}
                            onClick={() => deleteTeam(t)}
                          >
                            Delete
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {tab === "problems" && <ProblemsManager problems={problems} themes={themes} onReload={load} />}

          {tablesMissing && (tab === "timeline" || tab === "announcements") && (
            <Card className="p-6 border-warning/30 bg-warning/5 text-center flex flex-col items-center gap-3">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-warning animate-bounce">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <h3 className="text-base font-bold text-warning">Supabase Tables Missing</h3>
              <p className="text-xs text-muted-foreground max-w-sm">
                The database tables <code className="font-mono">timeline_events</code> and <code className="font-mono">announcements</code> are not created in your Supabase project yet. Click below to copy the SQL setup code to paste it into your Supabase Dashboard SQL Editor:
              </p>
              <Button
                variant="outline"
                className="text-xs border-warning/30 text-warning hover:bg-warning/10"
                onClick={() => {
                  const sql = `-- ---------- SQL Migration Code ----------\n\n` +
                    `create table if not exists public.timeline_events (\n` +
                    `  id uuid primary key default gen_random_uuid(),\n` +
                    `  step text not null,\n` +
                    `  date text not null,\n` +
                    `  label text not null,\n` +
                    `  description text not null,\n` +
                    `  status text not null check (status in ('done', 'active', 'upcoming')),\n` +
                    `  sort_order int not null default 0,\n` +
                    `  created_at timestamptz not null default now()\n` +
                    `);\n\n` +
                    `create table if not exists public.announcements (\n` +
                    `  id uuid primary key default gen_random_uuid(),\n` +
                    `  content text not null,\n` +
                    `  active boolean not null default true,\n` +
                    `  created_at timestamptz not null default now()\n` +
                    `);\n\n` +
                    `alter table public.timeline_events enable row level security;\n` +
                    `alter table public.announcements enable row level security;\n\n` +
                    `create policy "Allow public select for timeline" on public.timeline_events for select using (true);\n` +
                    `create policy "Allow all for admin users on timeline" on public.timeline_events for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));\n\n` +
                    `create policy "Allow public select for announcements" on public.announcements for select using (true);\n` +
                    `create policy "Allow all for admin users on announcements" on public.announcements for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));\n\n` +
                    `insert into public.timeline_events (step, date, label, description, status, sort_order) values\n` +
                    `  ('01', '6 Aug 2026', 'Portal opens', 'Registration portal goes live. Create your account and fill in your profile.', 'done', 1),\n` +
                    `  ('02', '15 Aug 2026', 'Registration deadline', 'Last day to submit your registration form. No entries accepted after midnight.', 'active', 2),\n` +
                    `  ('03', 'TBA', 'Team formation', 'Teams will be formed by your mentor based on skills and preferences. Date will be announced soon.', 'upcoming', 3),\n` +
                    `  ('04', 'TBA', 'Internal hackathon', 'Present your solution to the evaluation panel. Top teams proceed to the national SIH round.', 'upcoming', 4)\n` +
                    `on conflict do nothing;\n\n` +
                    `insert into public.announcements (content, active) values ('Welcome to the SIH 2026 Team Builder portal! Register now and start forming your dream team.', true) on conflict do nothing;`;
                  navigator.clipboard.writeText(sql);
                  toast("success", "SQL code copied to clipboard!");
                }}
              >
                Copy SQL Script
              </Button>
            </Card>
          )}

          {!tablesMissing && tab === "timeline" && (
            <TimelineManager timeline={timeline} onReload={load} />
          )}

          {!tablesMissing && tab === "announcements" && (
            <AnnouncementsManager announcements={announcements} onReload={load} />
          )}
        </div>
    </main>
  );
}

function ProblemsManager({
  problems,
  themes,
  onReload,
}: {
  problems: Problem[];
  themes: Theme[];
  onReload: () => Promise<void>;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [form, setForm] = useState({ id: "", title: "", category: "", description: "", themeId: "" });

  function reset() {
    setForm({ id: "", title: "", category: "", description: "", themeId: "" });
  }

  function startEdit(p: Problem) {
    setForm({
      id: p.id,
      title: p.title,
      category: p.category ?? "",
      description: p.description ?? "",
      themeId: p.theme_id ?? "",
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      toast("error", "Problem title is required");
      return;
    }
    setSaving(true);
    const res = await data.api.upsertProblem({
      id: form.id || null,
      title: form.title,
      category: form.category || null,
      description: form.description || null,
      themeId: form.themeId || null,
    });
    if (res.error) {
      toast("error", res.error);
    } else {
      toast("success", form.id ? "Problem updated" : "Problem added");
      reset();
      await onReload();
    }
    setSaving(false);
  }

  async function remove(id: string, title: string) {
    if (!window.confirm(`Delete problem "${title}"? Teams using it will lose their link.`)) return;
    setDeleting(id);
    const res = await data.api.deleteProblem(id);
    if (res.error) {
      toast("error", res.error);
    } else {
      toast("success", "Problem deleted");
      await onReload();
    }
    setDeleting(null);
  }

  const grouped = themes.map((th) => ({
    theme: th,
    items: problems.filter((p) => p.theme_id === th.id),
  }));
  const unthemed = problems.filter((p) => !p.theme_id);

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-5">
        <h3 className="text-base font-bold">{form.id ? "Edit problem" : "Add problem"}</h3>
        <form onSubmit={save} className="mt-4 flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Problem statement title"
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Category"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="e.g. ML / AI"
              />
              <Select
                label="Theme"
                value={form.themeId}
                onChange={(e) => setForm((f) => ({ ...f, themeId: e.target.value }))}
              >
                <option value="">No theme</option>
                {themes.map((th) => (
                  <option key={th.id} value={th.id}>
                    {th.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <Input
            label="Description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Short description of the problem"
          />
          <div className="flex gap-2">
            <Button type="submit" loading={saving}>
              {form.id ? "Save changes" : "Add problem"}
            </Button>
            {form.id && (
              <Button type="button" variant="ghost" onClick={reset}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </Card>

      {grouped.map(({ theme, items }) => (
        <div key={theme.id}>
          <h4 className="mb-2 text-sm font-bold uppercase tracking-widest text-muted-foreground">{theme.name}</h4>
          <div className="flex flex-col gap-2">
            {items.length === 0 && (
              <p className="rounded-lg border border-dashed border-border px-4 py-3 text-xs text-muted-foreground">
                No problems in this theme yet.
              </p>
            )}
            {items.map((p) => (
              <ProblemRow
                key={p.id}
                problem={p}
                deleting={deleting === p.id}
                onEdit={() => startEdit(p)}
                onDelete={() => remove(p.id, p.title)}
              />
            ))}
          </div>
        </div>
      ))}

      <div>
        <h4 className="mb-2 text-sm font-bold uppercase tracking-widest text-muted-foreground">Other problems</h4>
        <div className="flex flex-col gap-2">
          {unthemed.length === 0 && (
            <p className="rounded-lg border border-dashed border-border px-4 py-3 text-xs text-muted-foreground">
              All problems are assigned to a theme.
            </p>
          )}
          {unthemed.map((p) => (
            <ProblemRow
              key={p.id}
              problem={p}
              deleting={deleting === p.id}
              onEdit={() => startEdit(p)}
              onDelete={() => remove(p.id, p.title)}
            />
          ))}
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        {problems.length} problem statement{problems.length === 1 ? "" : "s"} across {themes.length} theme
        {themes.length === 1 ? "" : "s"}
      </p>
    </div>
  );
}

function ProblemRow({
  problem,
  deleting,
  onEdit,
  onDelete,
}: {
  problem: Problem;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{problem.title}</p>
        {problem.category && <span className="text-xs text-primary">{problem.category}</span>}
        {problem.description && (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{problem.description}</p>
        )}
      </div>
      <div className="flex shrink-0 gap-1.5">
        <Button variant="outline" className="px-2.5 py-1 text-xs" onClick={onEdit}>
          Edit
        </Button>
        <Button variant="danger" className="px-2.5 py-1 text-xs" loading={deleting} onClick={onDelete}>
          Delete
        </Button>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  const color = {
    ring: "text-primary border-primary/30 bg-primary/10",
    accent: "text-accent border-accent/30 bg-accent/10",
    success: "text-success border-success/30 bg-success/10",
    warning: "text-warning border-warning/30 bg-warning/10",
  }[accent];

  return (
    <Card className="p-5">
      <p className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${color}`}>
        {label}
      </p>
      <p className="mt-2 text-3xl font-black tabular-nums">{value}</p>
    </Card>
  );
}

function TimelineManager({ timeline, onReload }: { timeline: TimelineEvent[]; onReload: () => Promise<void> }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [form, setForm] = useState({ id: "", step: "", date: "", label: "", description: "", status: "upcoming" as "done" | "active" | "upcoming", sortOrder: 1 });

  function reset() {
    setForm({ id: "", step: "", date: "", label: "", description: "", status: "upcoming", sortOrder: timeline.length + 1 });
  }

  function startEdit(t: TimelineEvent) {
    setForm({
      id: t.id,
      step: t.step,
      date: t.date,
      label: t.label,
      description: t.description,
      status: t.status,
      sortOrder: t.sort_order,
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.step || !form.label || !form.date) {
      toast("error", "Step, Date and Label are required");
      return;
    }
    setSaving(true);
    const res = await data.upsertTimelineEvent({
      id: form.id || undefined,
      step: form.step,
      date: form.date,
      label: form.label,
      description: form.description,
      status: form.status,
      sort_order: form.sortOrder,
    });
    if (res.error) {
      toast("error", res.error);
    } else {
      toast("success", form.id ? "Timeline step updated" : "Timeline step added");
      reset();
      await onReload();
    }
    setSaving(false);
  }

  async function remove(id: string, label: string) {
    if (!window.confirm(`Delete timeline step "${label}"?`)) return;
    setDeleting(id);
    const res = await data.deleteTimelineEvent(id);
    if (res.error) {
      toast("error", res.error);
    } else {
      toast("success", "Timeline step deleted");
      await onReload();
    }
    setDeleting(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-5">
        <h3 className="text-base font-bold">{form.id ? "Edit Timeline Step" : "Add Timeline Step"}</h3>
        <form onSubmit={save} className="mt-4 flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="Step ID (e.g. 01)"
              value={form.step}
              onChange={(e) => setForm((f) => ({ ...f, step: e.target.value }))}
              placeholder="e.g. 01"
              required
            />
            <Input
              label="Date / Period"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              placeholder="e.g. 15 Aug 2026 or TBA"
              required
            />
            <Input
              label="Sort Order"
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm((f) => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
              placeholder="1"
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Label (Title)"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="e.g. Internal hackathon"
              required
            />
            <Select
              label="Status"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as any }))}
            >
              <option value="done">Done (Completed)</option>
              <option value="active">Active (Current)</option>
              <option value="upcoming">Upcoming (Future)</option>
            </Select>
          </div>
          <Input
            label="Description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Short details explaining this step..."
          />
          <div className="flex gap-2">
            <Button type="submit" loading={saving}>
              {form.id ? "Save Step" : "Add Step"}
            </Button>
            {form.id && (
              <Button type="button" variant="ghost" onClick={reset}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-base font-bold">Timeline Steps</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground bg-muted/20">
                <th className="px-5 py-3 font-semibold w-16">Order</th>
                <th className="px-5 py-3 font-semibold w-16">Step</th>
                <th className="px-5 py-3 font-semibold">Label</th>
                <th className="px-5 py-3 font-semibold">Date</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {timeline.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">
                    No timeline steps configured.
                  </td>
                </tr>
              )}
              {timeline.map((t) => (
                <tr key={t.id} className="border-b border-border/60 last:border-0 hover:bg-muted/20">
                  <td className="px-5 py-3 font-mono text-muted-foreground">{t.sort_order}</td>
                  <td className="px-5 py-3 font-mono font-bold text-primary">{t.step}</td>
                  <td className="px-5 py-3">
                    <p className="font-semibold">{t.label}</p>
                    <p className="text-xs text-muted-foreground">{t.description}</p>
                  </td>
                  <td className="px-5 py-3 font-semibold text-muted-foreground">{t.date}</td>
                  <td className="px-5 py-3">
                    {t.status === "done" && <GlowingBadge variant="success" pulse={false}>Done</GlowingBadge>}
                    {t.status === "active" && <GlowingBadge variant="warning" pulse>Active</GlowingBadge>}
                    {t.status === "upcoming" && <GlowingBadge variant="info" pulse={false}>Upcoming</GlowingBadge>}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button variant="outline" className="px-2 py-1 text-xs" onClick={() => startEdit(t)}>
                        Edit
                      </Button>
                      <Button variant="danger" className="px-2 py-1 text-xs" loading={deleting === t.id} onClick={() => remove(t.id, t.label)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function AnnouncementsManager({ announcements, onReload }: { announcements: Announcement[]; onReload: () => Promise<void> }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ id: "", content: "", active: true });

  function reset() {
    setForm({ id: "", content: "", active: true });
  }

  function startEdit(a: Announcement) {
    setForm({
      id: a.id,
      content: a.content,
      active: a.active,
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.content.trim()) {
      toast("error", "Announcement content is required");
      return;
    }
    setSaving(true);
    const res = await data.upsertAnnouncement({
      id: form.id || undefined,
      content: form.content.trim(),
      active: form.active,
    });
    if (res.error) {
      toast("error", res.error);
    } else {
      toast("success", form.id ? "Announcement updated" : "Announcement posted");
      reset();
      await onReload();
    }
    setSaving(false);
  }

  async function toggleActive(a: Announcement) {
    const res = await data.upsertAnnouncement({
      id: a.id,
      content: a.content,
      active: !a.active,
    });
    if (res.error) {
      toast("error", res.error);
    } else {
      toast("success", `Announcement set to ${!a.active ? "Active" : "Inactive"}`);
      await onReload();
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-5">
        <h3 className="text-base font-bold">{form.id ? "Edit System Announcement" : "Create System Announcement"}</h3>
        <form onSubmit={save} className="mt-4 flex flex-col gap-4">
          <div>
            <span className="mb-1.5 block text-sm font-medium text-foreground">Message Content</span>
            <textarea
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              placeholder="e.g. Attention Students: Team verification is now open. Make sure to complete your profile!"
              className="w-full min-h-[100px] rounded-lg border border-border bg-input px-3.5 py-2.5 text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:border-ring/50 focus:shadow-[0_0_12px_-4px_rgba(201,162,39,0.3)]"
              required
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="active"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              className="accent-[#dba328]"
            />
            <label htmlFor="active" className="text-sm font-medium text-foreground cursor-pointer select-none">
              Make this announcement active immediately (display it to students)
            </label>
          </div>
          <div className="flex gap-2">
            <Button type="submit" loading={saving}>
              {form.id ? "Save Message" : "Post Message"}
            </Button>
            {form.id && (
              <Button type="button" variant="ghost" onClick={reset}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-base font-bold">Announcement History</h3>
        </div>
        <div className="divide-y divide-border">
          {announcements.length === 0 && (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              No announcements posted yet.
            </p>
          )}
          {announcements.map((a) => (
            <div key={a.id} className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-muted/10 transition-colors">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs text-muted-foreground">
                    {new Date(a.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {a.active ? (
                    <GlowingBadge variant="success" pulse>Active</GlowingBadge>
                  ) : (
                    <GlowingBadge variant="warning" pulse={false}>Inactive</GlowingBadge>
                  )}
                </div>
                <p className="text-sm font-medium text-foreground leading-relaxed whitespace-pre-wrap">{a.content}</p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <Button variant="outline" className="px-2.5 py-1 text-xs" onClick={() => toggleActive(a)}>
                  {a.active ? "Deactivate" : "Activate"}
                </Button>
                <Button variant="outline" className="px-2.5 py-1 text-xs" onClick={() => startEdit(a)}>
                  Edit
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function AdminLoginForm({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setBusy(true);
    try {
      // 1. Attempt login in Supabase
      const { error: signInError } = await supabase!.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (signInError) {
        // 2. If it fails and credentials match smvecsihadmin2026@gmail.com and password sih2026, auto-register
        if (email.trim() === "smvecsihadmin2026@gmail.com" && password.trim() === "sih2026") {
          toast("info", "Admin account not found. Creating credentials in database...");
          const { data: signUpData, error: signUpError } = await supabase!.auth.signUp({
            email: email.trim(),
            password: password.trim(),
            options: {
              data: {
                name: "Admin Manager",
                role: "admin",
                gender: "Other",
                phone: "admin-phone-2026",
              },
            },
          });

          if (signUpError) throw new Error(signUpError.message);

          if (signUpData.user) {
            await data.ensureProfile(signUpData.user.id, {
              name: "Admin Manager",
              email: email.trim(),
              role: "admin",
              gender: "Other",
              phone: "admin-phone-2026",
            });
          }

          if (signUpData.session) {
            toast("success", "Admin account created and logged in!");
            onLoginSuccess();
          } else {
            toast("success", "Admin account registered! Check inbox to confirm (or check Supabase settings).");
          }
          return;
        } else {
          throw new Error(signInError.message);
        }
      }

      // 3. Login succeeded, check if user is admin
      const { data: profile, error: profileError } = await data.getCurrentProfile();
      if (profileError || !profile) {
        throw new Error(profileError ?? "Profile data not found");
      }

      if (profile.role !== "admin") {
        await supabase!.auth.signOut();
        throw new Error("Access denied. Admin role required.");
      }

      toast("success", `Welcome back, ${profile.name}!`);
      onLoginSuccess();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-transition flex min-h-screen flex-col overflow-hidden">
      {/* SMVEC gold top accent bar */}
      <div className="h-1 w-full bg-gradient-to-r from-transparent via-[#c9a227] to-transparent" />

      <div className="grow flex flex-col lg:flex-row">
        {/* Left panel — Glass styled midnight panel */}
        <div className="relative w-full overflow-hidden lg:fixed lg:inset-y-0 lg:w-1/2 lg:rounded-r-[3rem] border-r border-[rgba(147,197,253,0.08)] bg-card/60 backdrop-blur-xl">

          {/* Gold top border on rounded right edge */}
          <div className="absolute inset-y-0 right-0 hidden w-[2px] lg:block"
            style={{ background: "linear-gradient(to bottom, transparent, #c9a227 30%, #c9a227 70%, transparent)" }} />

          {/* Subtle grid decoration inside left panel */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="bg-grid absolute inset-0 opacity-40" />
          </div>

          <div className="relative h-full lg:h-screen w-full max-w-xl mx-auto flex flex-col justify-start px-5 py-6 sm:px-6 lg:justify-center lg:py-20">
            {/* Logo */}
            <div className="mt-8 flex justify-center lg:mt-0">
              <a href="/" className="inline-flex">
                <CollegeBrand className="scale-[1.5] sm:scale-[1.75] origin-center" />
              </a>
            </div>

            <div className="mt-14 space-y-4 lg:mt-12">
              {/* Gold accent label */}
              <p className="font-caveat text-3xl text-[#e8c058]">Welcome back</p>
              <h1 className="text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
                Sign In to Admin Control Center.
              </h1>
              <p className="block font-caveat text-xl text-[#8fa0c0]">— Authorized Personnel Only</p>
            </div>

            {/* Gold divider line */}
            <div className="mt-10 gold-bar w-24" />
          </div>
        </div>

        {/* Right panel */}
        <main className="flex w-full flex-col bg-transparent lg:ml-auto lg:w-1/2">
          <div className="grow w-full max-w-xl mx-auto px-5 py-12 sm:px-6 lg:pt-20 lg:pb-24">
            {/* Home nav */}
            <div className="mb-8 flex items-center gap-3">
              <a
                href="/"
                className="inline-flex items-center gap-2 rounded-xl border border-[rgba(201,162,39,0.20)] bg-[rgba(201,162,39,0.05)] px-3.5 py-2 text-sm font-medium text-[#8fa0c0] transition-colors hover:border-[rgba(201,162,39,0.45)] hover:bg-[rgba(201,162,39,0.10)] hover:text-[#e8c058]"
                title="Back to home"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4 shrink-0">
                  <path fillRule="evenodd" d="M9.293 2.293a1 1 0 0 1 1.414 0l7 7A1 1 0 0 1 17 11h-1v6a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6H3a1 1 0 0 1-.707-1.707l7-7Z" clipRule="evenodd" />
                </svg>
                Home
              </a>
            </div>

            {/* Auth content block mimicking AuthCard structure */}
            <div className="flex min-h-[50vh] flex-col">
              <div className="mb-8">
                <p className="font-caveat text-2xl text-[#dba328]">Smart India Hackathon 2026</p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Admin Portal Access</h1>
                <p className="mt-1 text-sm text-muted-foreground font-semibold">
                  Verify your admin credentials to access the coordinator panel.
                </p>
              </div>

              <form onSubmit={handleLogin} className="flex grow flex-col">
                <article className="divide-y divide-border">
                  <section className="py-8">
                    <div className="mb-5 flex items-baseline justify-between gap-3">
                      <h2 className="text-lg font-semibold tracking-tight">Credentials</h2>
                      <span className="text-[11px] font-semibold uppercase tracking-widest text-[#dba328]">
                        Required <span className="text-danger">*</span>
                      </span>
                    </div>

                    <div className="flex flex-col gap-4">
                      <Input
                        label="Email Address"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="admin@smvec.ac.in"
                        required
                        autoComplete="username"
                      />
                      <Input
                        label="Password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        autoComplete="current-password"
                      />
                    </div>
                  </section>
                </article>

                <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
                  <Button type="button" variant="ghost" onClick={() => navigate("/")} className="text-slate-400 hover:text-white">
                    ← Back
                  </Button>
                  <Button type="submit" loading={busy} className="bg-[#c9a227] text-[#06090f] hover:bg-[#e8c058] font-bold border-0">
                    Sign In
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
