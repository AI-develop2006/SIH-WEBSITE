"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import * as data from "@/lib/data";
import { uploadToCloudinary } from "@/lib/cloudinary";
import type { Profile } from "@/lib/types";
import { useToast } from "@/components/unlumen-ui/toast";
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
  const toast = useToast();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [setup, setSetup] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [announcement, setAnnouncement] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  return (
    <main className="page-transition relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 pb-16">
      {/* Gold top accent bar */}
      <div className="fixed inset-x-0 top-0 z-50 h-[2px] bg-gradient-to-r from-transparent via-[#c9a227] to-transparent" />

      <header className="sticky top-0 z-40 -mx-5 mb-6 border-b border-[rgba(201,162,39,0.15)] bg-background/85 px-5 backdrop-blur">
        <div className="flex h-[4.5rem] items-center justify-between gap-3">
          <button onClick={() => navigate("/")} className="flex items-center">
            <CollegeBrand />
          </button>

          <div className="flex items-center gap-2">
            {profile && (
              <div className="hidden items-center gap-2.5 rounded-lg border border-[rgba(201,162,39,0.18)] bg-card px-3 py-1.5 sm:flex">
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
                    src={profile.avatar_url ?? undefined}
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

      {announcement && (
        <div className="mb-6 rounded-xl border border-[#dba328]/35 bg-[#dba328]/10 px-5 py-4 backdrop-blur shadow flex items-start gap-3">
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

      {/* ── Waiting Room Column Layout ── */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left Column: Instructions and Profile Details */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <Card className="p-6 border-[#dba328]/20 bg-[#dba328]/5 relative overflow-hidden">
            {/* Holographic background glow */}
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

          {profile && (
            <Card className="p-0 overflow-hidden">
              <div className="px-6 py-4 border-b border-border bg-muted/10">
                <h3 className="text-base font-bold">Your Registered Profile</h3>
                <p className="text-xs text-muted-foreground">Verify your submitted information below</p>
              </div>
              <div className="p-6 flex flex-col gap-5 divide-y divide-border/60">
                {/* Header Profile Info */}
                <div className="flex items-center gap-4 pb-2">
                  <Avatar name={profile.name} src={profile.avatar_url ?? undefined} className="size-16 text-lg ring-2 ring-primary" />
                  <div>
                    <h4 className="text-lg font-bold leading-tight">{profile.name}</h4>
                    <p className="text-xs font-semibold text-primary">{profile.register_no || "No Register Number"}</p>
                    <p className="text-xs text-muted-foreground">Role: Student</p>
                  </div>
                </div>

                {/* Academic details */}
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

                {/* Contact details */}
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

                {/* Coding Profiles & Project Preferences */}
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

                {/* Tech stack */}
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

                {/* Languages */}
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

                {/* Social links */}
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
          )}
        </div>

        {/* Right Column: Key Dates / Timeline */}
        <div className="lg:col-span-5 flex flex-col gap-6">
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
                      {/* Node Icon indicator */}
                      <span className={[
                        "absolute -left-10 z-10 flex items-center justify-center size-8 rounded-xl border-2 transition-all",
                        isDone
                          ? "border-success bg-success/15 text-success"
                          : isActive
                            ? "border-[#c9a227] bg-[#c9a227]/15 text-[#c9a227] shadow-[0_0_12px_rgba(201,162,39,0.3)]"
                            : "border-border bg-card text-muted-foreground"
                      ].join(" ")}>
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

                      {/* Content Card details */}
                      <div className={[
                        "rounded-xl border p-4 transition-all bg-card/40",
                        isActive ? "border-[#c9a227]/40 shadow-sm" : "border-border/60"
                      ].join(" ")}>
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
        </div>
      </div>
    </main>
  );
}
