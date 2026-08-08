"use client";

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import * as data from "@/lib/data";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

import { Avatar } from "@/components/unlumen-ui/avatar";
import { Button } from "@/components/unlumen-ui/button";
import { CollegeBrand } from "@/components/college-brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Card } from "@/components/unlumen-ui/card";
import { GlowingBadge } from "@/components/unlumen-ui/glowing-badge";

const TIMELINE_FALLBACK = [
  { step: "01", date: "6 Aug 2026", label: "Portal opens", description: "Registration portal goes live. Create your account and fill in your profile.", status: "done" },
  { step: "02", date: "15 Aug 2026", label: "Registration deadline", description: "Last day to submit your registration form. No entries accepted after midnight.", status: "active" },
  { step: "03", date: "TBA", label: "Team formation", description: "Teams will be formed by your mentor based on skills and preferences. Date will be announced soon.", status: "upcoming" },
  { step: "04", date: "TBA", label: "Internal hackathon", description: "Present your solution to the evaluation panel. Top teams proceed to the national SIH round.", status: "upcoming" },
];

export default function DashboardPage() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [setup, setSetup] = useState(false);
  const [announcement, setAnnouncement] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'timeline' | 'profile' | 'notifications'>('dashboard');

  const refresh = useCallback(async () => {
    if (!profile) return;
    const [announcementsRes, timelineRes] = await Promise.all([
      data.fetchAnnouncements(),
      data.fetchTimelineEvents(),
    ]);

    setTimeline(timelineRes.data && timelineRes.data.length > 0 ? timelineRes.data : TIMELINE_FALLBACK);

    if (announcementsRes.data) {
      const active = announcementsRes.data.find((a: any) => a.active);
      setAnnouncement(active ?? null);
    }
  }, [profile]);

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
      if (p.role === "admin") {
        navigate("/admin", { replace: true });
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
      <main className="flex min-h-screen items-center justify-center bg-[#06090f]">
        <div className="flex flex-col items-center gap-3">
          <span className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-xs font-semibold text-muted-foreground animate-pulse">Loading dashboard...</p>
        </div>
      </main>
    );
  }

  if (setup) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-center">
        <div className="max-w-md rounded-2xl border border-warning/30 bg-card p-8 shadow-2xl">
          <h2 className="text-lg font-black text-warning">Supabase Not Configured</h2>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            Please add your Supabase credentials to <code className="font-mono">.env.local</code> in the frontend folder to connect to the database.
          </p>
        </div>
      </main>
    );
  }

  // Extracted Cards to reuse on Desktop and Mobile tabs
  const timelineCard = (
    <Card className="p-0 overflow-hidden">
      <div className="px-6 py-4 border-b border-border bg-muted/10">
        <h3 className="text-base font-bold">Key Dates & Progress</h3>
        <p className="text-xs text-muted-foreground">Live schedule announcements</p>
      </div>
      <div className="p-6">
        <ol className="relative border-l border-border flex flex-col gap-8 ml-2">
          {timeline.map((item, i) => {
            const isDone = item.status === "done";
            const isActive = item.status === "active";
            return (
              <li key={item.id || i} className="ml-6 relative">
                <span className={cn(
                  "absolute -left-10 z-10 flex items-center justify-center size-8 rounded-xl border-2 transition-all",
                  isDone
                    ? "border-success bg-success/15 text-success"
                    : isActive
                      ? "border-[#c9a227] bg-[#c9a227]/15 text-[#c9a227] shadow-[0_0_12px_rgba(201,162,39,0.3)]"
                      : "border-border bg-card text-muted-foreground"
                )}>
                  {isDone ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : isActive ? (
                    <span className="size-2 rounded-full bg-[#c9a227] animate-pulse" />
                  ) : (
                    <span className="text-[10px] font-bold">{item.step}</span>
                  )}
                </span>

                <div className={cn(
                  "rounded-xl border p-4 transition-all bg-card/40",
                  isActive ? "border-[#c9a227]/40 shadow-sm" : "border-border/60"
                )}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-muted-foreground uppercase">{item.date}</span>
                    {isActive && <GlowingBadge variant="warning" pulse>Active</GlowingBadge>}
                    {isDone && <GlowingBadge variant="success" pulse={false}>Completed</GlowingBadge>}
                  </div>
                  <h4 className="text-sm font-bold mt-1 text-foreground">{item.label}</h4>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.description}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </Card>
  );

  const profileCard = profile && (
    <Card className="p-0 overflow-hidden">
      <div className="px-6 py-4 border-b border-border bg-muted/10">
        <h3 className="text-base font-bold">Your Registered Profile</h3>
        <p className="text-xs text-muted-foreground">Verify your submitted information below</p>
      </div>
      <div className="p-6 flex flex-col gap-5 divide-y divide-border/60">
        <div className="flex items-center gap-4 pb-2">
          <Avatar name={profile.name} src={profile.avatar_url ?? undefined} className="size-16 text-lg ring-2 ring-primary" />
          <div>
            <h4 className="text-lg font-bold leading-tight">{profile.name}</h4>
            <p className="text-xs font-semibold text-primary">{profile.register_no || "No Register Number"}</p>
            <p className="text-xs text-muted-foreground">Role: Student</p>
          </div>
        </div>

        <div className="grid gap-4 pt-4 grid-cols-1 sm:grid-cols-2">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Department</span>
            <p className="text-sm font-semibold text-foreground mt-0.5">{profile.department || "—"}</p>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Year / Section</span>
            <p className="text-sm font-semibold text-foreground mt-0.5">
              {profile.year ? `Year ${profile.year}` : ""} {profile.section ? `· Sec ${profile.section}` : "—"}
            </p>
          </div>
        </div>

        <div className="grid gap-4 pt-4 grid-cols-1 sm:grid-cols-2">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Email Address</span>
            <p className="text-sm font-semibold text-foreground mt-0.5 truncate" title={profile.email ?? undefined}>{profile.email || "—"}</p>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Phone Number</span>
            <p className="text-sm font-semibold text-foreground mt-0.5">{profile.phone || "—"}</p>
          </div>
        </div>

        <div className="grid gap-4 pt-4 grid-cols-1 sm:grid-cols-2">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Project Type</span>
            <p className="text-sm font-semibold text-foreground mt-0.5">
              {profile.project_type === "Hardware" ? (
                <GlowingBadge variant="warning">Hardware</GlowingBadge>
              ) : profile.project_type === "Software" ? (
                <GlowingBadge variant="info">Software</GlowingBadge>
              ) : profile.project_type === "Hardware & Software" ? (
                <GlowingBadge variant="success">Hardware &amp; Software</GlowingBadge>
              ) : (
                "—"
              )}
            </p>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Gender</span>
            <p className="text-sm font-semibold text-foreground mt-0.5">{profile.gender || "—"}</p>
          </div>
        </div>

        {profile.project_title && (
          <div className="pt-4 flex flex-col gap-3">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Project Title</span>
              <p className="text-sm font-semibold text-foreground mt-0.5">{profile.project_title}</p>
            </div>
            {profile.project_description && (
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Description</span>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed whitespace-pre-wrap">{profile.project_description}</p>
              </div>
            )}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
              {profile.software_domain && (
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Software Domain</span>
                  <p className="text-xs font-semibold text-foreground mt-0.5">{profile.software_domain}</p>
                </div>
              )}
              {profile.hardware_domain && (
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Hardware Domain</span>
                  <p className="text-xs font-semibold text-foreground mt-0.5">{profile.hardware_domain}</p>
                </div>
              )}
            </div>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
              {profile.google_drive_ppt && (
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">PPT (Google Drive)</span>
                  <p className="text-xs font-semibold mt-0.5 truncate">
                    <a href={profile.google_drive_ppt} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                      View Slides ↗
                    </a>
                  </p>
                </div>
              )}
              {profile.youtube_link && (
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Video Demo (YouTube)</span>
                  <p className="text-xs font-semibold mt-0.5 truncate">
                    <a href={profile.youtube_link} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                      Watch Video ↗
                    </a>
                  </p>
                </div>
              )}
            </div>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
              {profile.github && (
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">GitHub Profile</span>
                  <p className="text-xs font-semibold mt-0.5 truncate">
                    <a href={profile.github} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                      View Profile ↗
                    </a>
                  </p>
                </div>
              )}
              {profile.github_repo && (
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">GitHub Repository</span>
                  <p className="text-xs font-semibold mt-0.5 truncate">
                    <a href={profile.github_repo} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                      View Repo ↗
                    </a>
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="pt-4">
          <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Technologies & Skills</span>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {profile.tech_stack && profile.tech_stack.length > 0 ? (
              profile.tech_stack.map((tech) => (
                <span key={tech} className="rounded bg-muted px-2.5 py-1 text-xs font-semibold text-foreground border border-border/40">
                  {tech}
                </span>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">None specified</span>
            )}
          </div>
        </div>

        <div className="pt-4">
          <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Languages Known</span>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {profile.languages && profile.languages.length > 0 ? (
              profile.languages.map((lang) => (
                <span key={lang} className="rounded bg-[#dba328]/10 px-2.5 py-1 text-xs font-semibold text-[#dba328] border border-[#dba328]/20">
                  {lang}
                </span>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">None specified</span>
            )}
          </div>
        </div>

        <div className="grid gap-4 pt-4 grid-cols-1 sm:grid-cols-2">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">GitHub Profile</span>
            <p className="text-sm font-semibold mt-0.5 truncate">
              {profile.github ? (
                <a href={profile.github.startsWith("http") ? profile.github : `https://github.com/${profile.github}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  {profile.github.replace(/https?:\/\/(www\.)?github\.com\//, "")}
                </a>
              ) : (
                "—"
              )}
            </p>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">LinkedIn Profile</span>
            <p className="text-sm font-semibold mt-0.5 truncate">
              {profile.linkedin ? (
                <a href={profile.linkedin.startsWith("http") ? profile.linkedin : `https://linkedin.com/in/${profile.linkedin}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  {profile.linkedin.replace(/https?:\/\/(www\.)?linkedin\.com\/in\//, "")}
                </a>
              ) : (
                "—"
              )}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );

  return (
    <main className="page-transition relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 pb-24 lg:pb-16">
      {/* Gold top accent bar */}
      <div className="fixed inset-x-0 top-0 z-50 h-[2px] bg-gradient-to-r from-transparent via-[#c9a227] to-transparent" />

      {/* Responsive Header */}
      <header className="sticky top-0 z-40 -mx-5 mb-6 border-b border-[rgba(201,162,39,0.15)] bg-background/85 px-5 backdrop-blur">
        <div className="flex h-[4.5rem] items-center justify-between gap-3">
          {/* Hamburger Icon - Mobile Only */}
          <div className="flex items-center lg:hidden">
            <button className="p-1 text-muted-foreground hover:text-[#e8c058]">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
          </div>

          <button onClick={() => navigate("/")} className="flex items-center">
            <CollegeBrand />
          </button>

          <div className="flex items-center gap-2">
            {profile && (
              <div className="flex items-center gap-2.5 rounded-lg border border-[rgba(201,162,39,0.18)] bg-card px-2.5 py-1 sm:px-3 sm:py-1.5 cursor-pointer" onClick={() => setActiveTab('profile')}>
                <Avatar
                  name={profile.name}
                  src={profile.avatar_url ?? undefined}
                  className="size-7 text-[10px] ring-1 ring-primary/30"
                />
                <div className="hidden sm:block leading-tight text-left">
                  <p className="text-xs font-semibold">{profile.name}</p>
                  <p className="text-[10px] text-muted-foreground">{profile.phone}</p>
                </div>
                {/* Down Chevron indicator in mockup */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="size-3.5 text-muted-foreground hidden sm:block">
                  <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                </svg>
              </div>
            )}
            
            {/* Desktop Only header controls */}
            <div className="hidden lg:flex items-center gap-2">
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
        </div>
      </header>

      {/* Desktop Column Layout (Screens >= 1024px) */}
      <div className="hidden lg:flex flex-col gap-6">
        {announcement && (
          <div className="rounded-xl border border-[#dba328]/35 bg-[#dba328]/10 px-5 py-4 backdrop-blur shadow flex items-start gap-3">
            <span className="size-5 shrink-0 flex items-center justify-center rounded-full bg-[#dba328]/25 text-[#dba328] mt-0.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              </svg>
            </span>
            <div className="flex-1">
              <h4 className="text-xs font-black uppercase tracking-wider text-[#dba328] mb-0.5">Admin Announcement</h4>
              <p className="text-sm font-medium text-foreground whitespace-pre-wrap">{announcement.content}</p>
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-12 items-start">
          {/* Left Column: Instructions and Profile Details */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <Card className="p-6 border-[#dba328]/20 bg-[#dba328]/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 -mt-6 -mr-6 size-24 rounded-full bg-[#dba328]/10 blur-xl pointer-events-none" />
              <h3 className="text-lg font-black text-foreground flex items-center gap-2">
                <span className="flex size-2 rounded-full bg-success animate-pulse" />
                Registration Completed!
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Thank you for applying. Your registration details have been securely recorded in the database.
              </p>
              <div className="mt-4 rounded-lg bg-card/60 border border-border/50 p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#dba328] mb-1.5">Next Steps</h4>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Teams will be formulated and announced by the college evaluation mentors directly based on departments, tech stacks, and project preferences. There is no action required from your side right now. Please keep checking this portal for live updates as the timeline progresses.
                </p>
              </div>
            </Card>

            {profileCard}
          </div>

          {/* Right Column: Key Dates / Timeline */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            {timelineCard}
          </div>
        </div>
      </div>

      {/* Mobile Tabbed Layout (Screens < 1024px) */}
      <div className="lg:hidden flex flex-col gap-5">
        {activeTab === 'dashboard' && (
          <>
            {/* Announcement Banner */}
            {announcement && (
              <div className="rounded-xl border border-[#dba328]/35 bg-[#dba328]/10 px-4 py-3.5 backdrop-blur shadow flex items-start gap-3">
                <span className="size-5 shrink-0 flex items-center justify-center rounded-full bg-[#dba328]/25 text-[#dba328] mt-0.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  </svg>
                </span>
                <div className="flex-1">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-[#dba328] mb-0.5">Admin Announcement</h4>
                  <p className="text-xs font-semibold text-foreground whitespace-pre-wrap">{announcement.content}</p>
                </div>
              </div>
            )}

            {/* Completed Status Card */}
            <Card className="p-5 border-[#dba328]/20 bg-[#dba328]/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 -mt-6 -mr-6 size-20 rounded-full bg-[#dba328]/10 blur-xl pointer-events-none" />
              <h3 className="text-base font-black text-foreground flex items-center gap-2">
                <span className="flex size-2.5 rounded-full bg-success" />
                Registration Completed!
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Thank you for applying. Your registration details have been securely recorded in the database.
              </p>
              <div className="mt-4 rounded-lg bg-card/60 border border-border/50 p-4">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#dba328] mb-1">Next Steps</h4>
                <p className="text-[10.5px] leading-relaxed text-muted-foreground">
                  Teams will be formulated and announced by the college evaluation mentors directly based on departments, tech stacks, and project preferences.
                </p>
              </div>
            </Card>

            {/* Profile Summary Mini Card */}
            {profile && (
              <Card className="p-4 border-border bg-card/50 hover:bg-card/75 transition-all cursor-pointer flex items-center justify-between" onClick={() => setActiveTab('profile')}>
                <div className="flex items-center gap-3">
                  <Avatar name={profile.name} src={profile.avatar_url ?? undefined} className="size-12 text-sm ring-1 ring-primary/30" />
                  <div className="text-left">
                    <h4 className="text-sm font-black leading-tight">{profile.name}</h4>
                    <p className="text-[10px] font-bold text-primary mt-0.5">{profile.register_no}</p>
                    <p className="text-[10px] text-muted-foreground">Role: Student</p>
                  </div>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="size-4 text-muted-foreground">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </Card>
            )}

            {/* Timeline Mini Card */}
            <Card className="p-4 border-border bg-card/50">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground">Key Dates & Progress</h4>
                <button type="button" onClick={() => setActiveTab('timeline')} className="text-[10px] font-bold text-primary flex items-center gap-1 hover:underline">
                  View all
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="size-3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {timeline.slice(0, 3).map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-[#081026]/40">
                    <div className="flex items-center gap-2.5">
                      <span className={cn(
                        "size-2 rounded-full",
                        item.status === 'done' ? "bg-success" : item.status === 'active' ? "bg-primary" : "bg-muted-foreground"
                      )} />
                      <span className="text-xs font-semibold">{item.label}</span>
                    </div>
                    <span className="text-[10px] font-bold text-muted-foreground">{item.date}</span>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}

        {activeTab === 'timeline' && (
          <div className="animate-page-enter">
            {timelineCard}
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="animate-page-enter">
            {profileCard}
          </div>
        )}

        {activeTab === 'notifications' && (
          <Card className="p-5 border-border">
            <h3 className="text-base font-bold mb-4">Announcements</h3>
            {announcement ? (
              <div className="rounded-xl border border-border bg-muted/20 p-4 text-left">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-primary uppercase">Active Announcement</span>
                  <span className="text-[10px] text-muted-foreground">Recent</span>
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap">{announcement.content}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No new announcements at this time.</p>
            )}
          </Card>
        )}
      </div>

      {/* Mobile Bottom Navigation Tab Bar */}
      <div className="fixed bottom-0 inset-x-0 z-40 border-t border-[rgba(201,162,39,0.18)] bg-card/95 backdrop-blur-md py-2 px-6 flex items-center justify-between lg:hidden shadow-[0_-8px_24px_rgba(0,0,0,0.4)]">
        <button
          type="button"
          onClick={() => setActiveTab('dashboard')}
          className={cn(
            "flex flex-col items-center justify-center gap-1 text-center transition-colors",
            activeTab === 'dashboard' ? "text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="size-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
          </svg>
          <span className="text-[10px] font-bold">Dashboard</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('timeline')}
          className={cn(
            "flex flex-col items-center justify-center gap-1 text-center transition-colors",
            activeTab === 'timeline' ? "text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="size-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z" />
          </svg>
          <span className="text-[10px] font-bold">Timeline</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={cn(
            "flex flex-col items-center justify-center gap-1 text-center transition-colors",
            activeTab === 'profile' ? "text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="size-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
          </svg>
          <span className="text-[10px] font-bold">Profile</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('notifications')}
          className={cn(
            "flex flex-col items-center justify-center gap-1 text-center transition-colors relative",
            activeTab === 'notifications' ? "text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="size-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0M3.124 7.5A8.969 8.969 0 0 1 5.292 3m13.416 0a8.969 8.969 0 0 1 2.168 4.5" />
          </svg>
          {announcement && <span className="absolute top-1.5 right-3 size-1.5 rounded-full bg-rose-500 animate-pulse" />}
          <span className="text-[10px] font-bold">Notifications</span>
        </button>

        <button
          type="button"
          onClick={logout}
          className="flex flex-col items-center justify-center gap-1 text-center text-muted-foreground hover:text-rose-400 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="size-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
          </svg>
          <span className="text-[10px] font-bold">Logout</span>
        </button>
      </div>
    </main>
  );
}
