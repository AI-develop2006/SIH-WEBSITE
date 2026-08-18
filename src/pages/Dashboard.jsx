"use client";

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Check,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  CalendarDays,
  User,
  Bell,
  LogOut,
  X,
} from "lucide-react";
import * as data from "@/lib/data";
import { cn, computeStats } from "@/lib/utils";

import { Avatar } from "@/components/unlumen-ui/avatar";
import { Button } from "@/components/unlumen-ui/button";
import { CollegeBrand } from "@/components/common/college-brand";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { Card } from "@/components/unlumen-ui/card";
import { FormattedAnnouncement } from "@/components/common/FormattedAnnouncement";
import { GlowingBadge } from "@/components/unlumen-ui/glowing-badge";
import { useToast } from "@/components/unlumen-ui/toast";
import { Input, Select } from "@/components/unlumen-ui/input";
import { DEPARTMENTS, YEARS } from "@/lib/constants";

function ensureHttp(url) {
  if (!url) return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

const TIMELINE_FALLBACK = [
  { step: "01", date: "6 Aug 2026", label: "Portal opens", description: "Registration portal goes live. Create your account and fill in your profile.", status: "done" },
  { step: "02", date: "15 Aug 2026", label: "Registration deadline", description: "Last day to submit your registration form. No entries accepted after midnight.", status: "active" },
  { step: "03", date: "TBA", label: "Team formation", description: "Teams will be formed by your mentor based on skills and preferences. Date will be announced soon.", status: "upcoming" },
  { step: "04", date: "TBA", label: "Internal hackathon", description: "Present your solution to the evaluation panel. Top teams proceed to the national SIH round.", status: "upcoming" },
];

export default function DashboardPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [profile, setProfile] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [setup, setSetup] = useState(false);
  const [announcement, setAnnouncement] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [updating, setUpdating] = useState(false);

  const startEdit = () => {
    if (!profile) return;
    setEditForm({
      phone: profile.phone ?? "",
      department: profile.department ?? "",
      year: profile.year ?? "",
      section: profile.section ?? "",
      gender: profile.gender ?? "",
      languages: profile.languages?.join(", ") ?? "",
      linkedin: profile.linkedin ?? "",
      resume_link: profile.resume_link ?? "",
      project_type: profile.project_type ?? "",
      project_title: profile.project_title ?? "",
      project_description: profile.project_description ?? "",
      software_domain: profile.software_domain ?? "",
      hardware_domain: profile.hardware_domain ?? "",
      github: profile.github ?? "",
      github_repo: profile.github_repo ?? "",
      youtube_link: profile.youtube_link ?? "",
      google_drive_ppt: profile.google_drive_ppt ?? "",
      sih_participant: profile.sih_participant ?? false,
      sih_num_participations: profile.sih_num_participations?.toString() ?? "",
      sih_participation_year: profile.sih_participation_year?.toString() ?? "",
      sih_problem_statement: profile.sih_problem_statement ?? "",
      sih_project_domain: profile.sih_project_domain ?? "",
      sih_project_role: profile.sih_project_role ?? "",
      sih_position_reached: profile.sih_position_reached ?? "",
      sih_nodal_center: profile.sih_nodal_center ?? "",
      sih_history: Array.isArray(profile.sih_history) ? profile.sih_history.map((entry) => ({
        year: entry.year?.toString() ?? "",
        problemStatement: entry.problem_statement ?? "",
        projectDomain: entry.project_domain ?? "",
        projectRole: entry.project_role ?? "",
        positionReached: entry.position_reached ?? "",
        nodalCenter: entry.nodal_center ?? "",
        certificateLink: entry.certificate_link ?? ""
      })) : [{ year: "", problemStatement: "", projectDomain: "", projectRole: "", positionReached: "", nodalCenter: "", certificateLink: "" }],
    });
    setIsEditing(true);
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    if (!profile) return;
    setUpdating(true);
    try {
      if (!editForm.phone.trim()) throw new Error("Phone number is required");
      if (!editForm.department) throw new Error("Select your department");
      if (!editForm.year) throw new Error("Select your year");
      if (!editForm.section.trim()) throw new Error("Section is required");
      if (!editForm.gender) throw new Error("Select your gender");
      if (!editForm.resume_link.trim()) throw new Error("Resume Link is required");

      if (editForm.sih_participant) {
        if (!editForm.sih_num_participations) throw new Error("Select SIH participations count");
        for (let i = 0; i < editForm.sih_history.length; i++) {
          const entry = editForm.sih_history[i];
          const label = `Participation #${i + 1}`;
          if (!entry.year) throw new Error(`Select the year of participation for ${label}`);
          if (!entry.problemStatement.trim()) throw new Error(`Enter the problem statement for ${label}`);
          if (!entry.projectDomain) throw new Error(`Select the project domain for ${label}`);
          if (!entry.projectRole.trim()) throw new Error(`Enter your role in that project for ${label}`);
          if (!entry.positionReached) throw new Error(`Select the position reached for ${label}`);
          const needsNodal = ["Shortlisted for SIH", "Finalist", "Runners", "Winners"].includes(entry.positionReached);
          if (needsNodal) {
            if (!entry.nodalCenter.trim()) throw new Error(`Enter the Nodal Center where ${label} was held`);
            if (!entry.certificateLink.trim() || !/^https?:\/\/[\w.-]/.test(entry.certificateLink.trim())) {
              throw new Error(`Enter a valid Public Drive link for your certificate for ${label}`);
            }
          }
        }
      }

      const payload = {
        phone: editForm.phone.trim(),
        department: editForm.department,
        year: editForm.year,
        section: editForm.section.trim(),
        gender: editForm.gender,
        languages: editForm.languages.split(",").map((l) => l.trim()).filter(Boolean),
        linkedin: ensureHttp(editForm.linkedin) || null,
        resume_link: ensureHttp(editForm.resume_link),
        project_type: editForm.project_type || null,
        project_title: editForm.project_title.trim() || null,
        project_description: editForm.project_description.trim() || null,
        software_domain: editForm.software_domain.trim() || null,
        hardware_domain: editForm.hardware_domain.trim() || null,
        github: ensureHttp(editForm.github) || null,
        github_repo: ensureHttp(editForm.github_repo) || null,
        youtube_link: ensureHttp(editForm.youtube_link) || null,
        google_drive_ppt: ensureHttp(editForm.google_drive_ppt) || null,
        sih_participant: editForm.sih_participant,
        sih_num_participations: editForm.sih_participant && editForm.sih_num_participations ? Number(editForm.sih_num_participations) : null,
        sih_participation_year: editForm.sih_participant && editForm.sih_history[0] ? Number(editForm.sih_history[0].year) : null,
        sih_problem_statement: editForm.sih_participant && editForm.sih_history[0] ? editForm.sih_history[0].problemStatement.trim() : null,
        sih_project_domain: editForm.sih_participant && editForm.sih_history[0] ? editForm.sih_history[0].projectDomain : null,
        sih_project_role: editForm.sih_participant && editForm.sih_history[0] ? editForm.sih_history[0].projectRole.trim() : null,
        sih_position_reached: editForm.sih_participant && editForm.sih_history[0] ? editForm.sih_history[0].positionReached : null,
        sih_nodal_center: (editForm.sih_participant && editForm.sih_history[0] && ["Shortlisted for SIH", "Finalist", "Runners", "Winners"].includes(editForm.sih_history[0].positionReached)) ? editForm.sih_history[0].nodalCenter.trim() : null,
        sih_history: editForm.sih_participant ? editForm.sih_history.map((entry) => ({
          year: entry.year,
          problem_statement: entry.problemStatement.trim(),
          project_domain: entry.projectDomain,
          project_role: entry.projectRole.trim(),
          position_reached: entry.positionReached,
          nodal_center: ["Shortlisted for SIH", "Finalist", "Runners", "Winners"].includes(entry.positionReached) ? entry.nodalCenter.trim() : null,
          certificate_link: ["Shortlisted for SIH", "Finalist", "Runners", "Winners"].includes(entry.positionReached) ? ensureHttp(entry.certificateLink) : null
        })) : [],
      };

      const { error } = await data.updateProfile(profile.id, payload);
      if (error) throw new Error(error);

      setProfile((prev) => ({ ...prev, ...payload }));
      setIsEditing(false);
      toast("success", "Profile updated successfully!");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setUpdating(false);
    }
  };

  const [myTeam, setMyTeam] = useState(null);

  const refresh = useCallback(async () => {
    if (!profile) return;
    const [announcementsRes, timelineRes, teamsRes] = await Promise.all([
      data.fetchAnnouncements(),
      data.fetchTimelineEvents(),
      data.fetchEnrichedTeams(),
    ]);

    setTimeline(timelineRes.data && timelineRes.data.length > 0 ? timelineRes.data : TIMELINE_FALLBACK);

    if (announcementsRes.data) {
      const active = announcementsRes.data.find((a) => a.active);
      setAnnouncement(active ?? null);
    }

    if (teamsRes.data) {
      const userTeam = teamsRes.data.find(
        (t) => t.team.leader_id === profile.id || t.members.some((m) => m.id === profile.id)
      );
      setMyTeam(userTeam ?? null);
    }
  }, [profile]);

  useEffect(() => {
    (async () => {
      try {
        const { data: p, error } = await data.getCurrentProfile();
        if (error || !p) {
          await data.logoutUser();
          navigate("/", { replace: true });
          return;
        }
        if (p.role === "mentor") {
          navigate("/mentor", { replace: true });
          return;
        }
        if (p.role === "admin") {
          navigate("/admin", { replace: true });
          return;
        }
        setProfile(p);
      } catch (err) {
        navigate("/", { replace: true });
      }
    })();
  }, [navigate]);

  useEffect(() => {
    if (profile) {
      setLoading(true);
      refresh().finally(() => setLoading(false));
    }
  }, [profile, refresh]);

  async function logout() {
    await data.logoutUser();
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
                    ? "border-success bg-[#061712] text-success"
                    : isActive
                      ? "border-[#c9a227] bg-[#1c1708] text-[#c9a227] shadow-[0_0_12px_rgba(201,162,39,0.3)]"
                      : "border-slate-800 bg-[#091122] text-muted-foreground"
                )}>
                  {isDone ? (
                    <Check className="size-3" strokeWidth={3} />
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
      <div className="px-6 py-4 border-b border-border bg-muted/10 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold">Your Registered Profile</h3>
          <p className="text-xs text-muted-foreground">Verify your submitted information below</p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="border-[#c9a227]/40 text-[#c9a227] hover:bg-[#c9a227]/10 px-3 py-1.5 text-xs font-bold"
          onClick={startEdit}
        >
          Edit Profile
        </Button>
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

        <div className="grid gap-4 pt-4 grid-cols-1 sm:grid-cols-3">
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
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Resume</span>
            <p className="text-sm font-semibold mt-0.5 truncate">
              {profile.resume_link ? (
                <a href={profile.resume_link} target="_blank" rel="noreferrer" className="text-[#dba328] hover:underline font-semibold">
                  View Resume ↗
                </a>
              ) : (
                "—"
              )}
            </p>
          </div>
        </div>

        {profile.sih_participant && (
          <div className="pt-4 mt-4 border-t border-border/40 text-left">
            <span className="text-[10px] uppercase font-black tracking-wider text-purple-400">SIH Participation History</span>
            <div className="mt-2">
              <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground font-semibold">Times Participated: </span>
              <span className="text-xs font-semibold mt-0.5 text-foreground">{profile.sih_num_participations} time(s)</span>
            </div>
            
            {Array.isArray(profile.sih_history) && profile.sih_history.length > 0 ? (
              <div className="flex flex-col gap-3 mt-3">
                {profile.sih_history.map((entry, index) => (
                  <div key={index} className="bg-muted/10 p-3 rounded-lg border border-border/20">
                    <span className="text-[9px] uppercase font-black tracking-wider text-purple-400 font-bold block mb-2">Participation #{index + 1}</span>
                    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                      <div>
                        <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground">Year</span>
                        <p className="text-xs font-semibold mt-0.5 text-foreground">{entry.year}</p>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground">Project Domain</span>
                        <p className="text-xs font-semibold mt-0.5 text-foreground">{entry.project_domain}</p>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground">Role in Project</span>
                        <p className="text-xs font-semibold mt-0.5 text-foreground">{entry.project_role}</p>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground">Position Reached</span>
                        <p className="text-xs font-semibold mt-0.5 text-foreground">{entry.position_reached}</p>
                      </div>
                    </div>
                    <div className="mt-2">
                      <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground">Problem Statement</span>
                      <p className="text-xs font-semibold text-foreground mt-0.5">{entry.problem_statement}</p>
                    </div>
                    {entry.nodal_center && (
                      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
                        <div>
                          <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground block">Nodal Center</span>
                          <p className="text-xs font-semibold text-foreground mt-0.5">{entry.nodal_center}</p>
                        </div>
                        {entry.certificate_link && (
                          <div>
                            <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground block">Certificate Link</span>
                            <a href={entry.certificate_link} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[#dba328] hover:underline mt-0.5 block">
                              View Certificate ↗
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3">
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 bg-muted/10 p-3 rounded-lg border border-border/20">
                  <div>
                    <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground font-semibold">Year of Participation</span>
                    <p className="text-xs font-semibold mt-0.5 text-foreground">{profile.sih_participation_year}</p>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground font-semibold">Project Domain</span>
                    <p className="text-xs font-semibold mt-0.5 text-foreground">{profile.sih_project_domain}</p>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground font-semibold">Role in Project</span>
                    <p className="text-xs font-semibold mt-0.5 text-foreground">{profile.sih_project_role}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  <div>
                    <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground font-semibold">Problem Statement</span>
                    <p className="text-xs font-semibold text-foreground">{profile.sih_problem_statement}</p>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground font-semibold">Position Reached</span>
                    <p className="text-xs font-semibold text-foreground">{profile.sih_position_reached}</p>
                  </div>
                  {profile.sih_nodal_center && (
                    <div>
                      <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground font-semibold">Nodal Center</span>
                      <p className="text-xs font-semibold text-foreground">{profile.sih_nodal_center}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
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
                  <p className="text-xs font-semibold truncate max-w-[120px]">{profile.name}</p>
                  <p className="text-[10px] text-muted-foreground">{profile.phone}</p>
                </div>
                <ChevronDown className="size-3.5 text-muted-foreground hidden sm:block" />
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
          <div className="rounded-2xl border border-[#dba328]/35 bg-[#dba328]/10 px-5 py-4 backdrop-blur shadow">
            <h4 className="text-xs font-black uppercase tracking-wider text-[#dba328] mb-2">Admin Announcement</h4>
            <FormattedAnnouncement content={announcement.content} />
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-12 items-start">
          {/* Left Column: Instructions and Profile Details */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            {myTeam ? (
              <StudentTeamCard myTeam={myTeam} currentUserId={profile?.id} />
            ) : (
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
                    Teams will be formulated and announced in this portal based on departments, tech stacks, and project preferences. There is no action required from your side right now. Please keep checking this portal for live updates as the timeline progresses.
                  </p>
                </div>
              </Card>
            )}

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
              <div className="rounded-2xl border border-[#dba328]/35 bg-[#dba328]/10 px-4 py-3.5 backdrop-blur shadow">
                <h4 className="text-[10px] font-black uppercase tracking-wider text-[#dba328] mb-2">Admin Announcement</h4>
                <FormattedAnnouncement content={announcement.content} />
              </div>
            )}

            {/* Team or Completed Status Card */}
            {myTeam ? (
              <StudentTeamCard myTeam={myTeam} currentUserId={profile?.id} />
            ) : (
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
                    Teams will be formulated and announced in this portal based on departments, tech stacks, and project preferences.
                  </p>
                </div>
              </Card>
            )}

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
                <ChevronRight className="size-4 text-muted-foreground" strokeWidth={2.5} />
              </Card>
            )}

            {/* Timeline Mini Card */}
            <Card className="p-4 border-border bg-card/50">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground">Key Dates & Progress</h4>
                <button type="button" onClick={() => setActiveTab('timeline')} className="text-[10px] font-bold text-primary flex items-center gap-1 hover:underline">
                  View all
                  <ChevronRight className="size-3" strokeWidth={2.5} />
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
          <LayoutDashboard className="size-5" strokeWidth={2} />
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
          <CalendarDays className="size-5" strokeWidth={2} />
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
          <User className="size-5" strokeWidth={2} />
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
          <Bell className="size-5" strokeWidth={2} />
          {announcement && <span className="absolute top-1.5 right-3 size-1.5 rounded-full bg-rose-500 animate-pulse" />}
          <span className="text-[10px] font-bold">Notifications</span>
        </button>

        <button
          type="button"
          onClick={logout}
          className="flex flex-col items-center justify-center gap-1 text-center text-muted-foreground hover:text-rose-400 transition-colors"
        >
          <LogOut className="size-5" strokeWidth={2} />
          <span className="text-[10px] font-bold">Logout</span>
        </button>
      </div>

      {/* Edit Profile Modal */}
      {isEditing && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-card border border-border/80 rounded-2xl shadow-2xl p-6 md:p-8 max-h-[90vh] overflow-y-auto animate-page-enter">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border/60 pb-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-foreground">Edit Profile Details</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Update your academic, project, and SIH history details</p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
              >
                <X className="size-5" strokeWidth={2.5} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={saveProfile} className="flex flex-col gap-6">
              {/* Section 1: Academic & Personal */}
              <div className="flex flex-col gap-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#dba328]">Academic &amp; Personal Info</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Phone Number"
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, "").slice(0, 10) }))}
                    maxLength={10}
                    required
                  />
                  <Select
                    label="Gender"
                    value={editForm.gender}
                    onChange={(e) => setEditForm((f) => ({ ...f, gender: e.target.value }))}
                    required
                  >
                    <option value="" disabled>Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </Select>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Select
                    label="Department"
                    value={editForm.department}
                    onChange={(e) => setEditForm((f) => ({ ...f, department: e.target.value }))}
                    required
                  >
                    <option value="" disabled>Select Department</option>
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </Select>
                  <Select
                    label="Year"
                    value={editForm.year}
                    onChange={(e) => setEditForm((f) => ({ ...f, year: e.target.value }))}
                    required
                  >
                    <option value="" disabled>Select Year</option>
                    {YEARS.map((yr) => (
                      <option key={yr} value={yr}>{yr}</option>
                    ))}
                  </Select>
                  <Input
                    label="Section"
                    value={editForm.section}
                    onChange={(e) => setEditForm((f) => ({ ...f, section: e.target.value.toUpperCase() }))}
                    required
                  />
                </div>
                <Input
                  label="Languages Known"
                  value={editForm.languages}
                  onChange={(e) => setEditForm((f) => ({ ...f, languages: e.target.value }))}
                  placeholder="e.g. C, Python, JavaScript (comma separated)"
                />
              </div>

              {/* Section 2: Profiles & Links */}
              <div className="flex flex-col gap-4 border-t border-border/40 pt-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#dba328]">Profiles &amp; Links</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="LinkedIn Profile"
                    value={editForm.linkedin}
                    onChange={(e) => setEditForm((f) => ({ ...f, linkedin: e.target.value }))}
                    placeholder="https://linkedin.com/in/username"
                  />
                  <Input
                    label="Resume Link"
                    value={editForm.resume_link}
                    onChange={(e) => setEditForm((f) => ({ ...f, resume_link: e.target.value }))}
                    required
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="GitHub Profile"
                    value={editForm.github}
                    onChange={(e) => setEditForm((f) => ({ ...f, github: e.target.value }))}
                    placeholder="https://github.com/username"
                  />
                  <Input
                    label="GitHub Repository Link"
                    value={editForm.github_repo}
                    onChange={(e) => setEditForm((f) => ({ ...f, github_repo: e.target.value }))}
                    placeholder="https://github.com/username/project"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="YouTube Link (Video Demo)"
                    value={editForm.youtube_link}
                    onChange={(e) => setEditForm((f) => ({ ...f, youtube_link: e.target.value }))}
                    placeholder="https://youtube.com/watch?v=..."
                  />
                  <Input
                    label="Google Drive PPT Link"
                    value={editForm.google_drive_ppt}
                    onChange={(e) => setEditForm((f) => ({ ...f, google_drive_ppt: e.target.value }))}
                    placeholder="https://drive.google.com/..."
                  />
                </div>
              </div>

              {/* Section 3: Project Info */}
              <div className="flex flex-col gap-4 border-t border-border/40 pt-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#dba328]">Project Information</h4>
                <Select
                  label="Project Type"
                  value={editForm.project_type}
                  onChange={(e) => setEditForm((f) => ({ ...f, project_type: e.target.value }))}
                >
                  <option value="">None Selected</option>
                  <option value="Software">Software</option>
                  <option value="Hardware">Hardware</option>
                  <option value="Hardware & Software">Hardware &amp; Software</option>
                </Select>
                <Input
                  label="Project Title"
                  value={editForm.project_title}
                  onChange={(e) => setEditForm((f) => ({ ...f, project_title: e.target.value }))}
                />
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Project Description</label>
                  <textarea
                    value={editForm.project_description}
                    onChange={(e) => setEditForm((f) => ({ ...f, project_description: e.target.value }))}
                    className="w-full min-h-[100px] rounded-lg border border-border bg-input px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-ring/50"
                  />
                </div>
              </div>

              {/* Section 4: SIH Questionnaire */}
              <div className="flex flex-col gap-4 border-t border-border/40 pt-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400">SIH Participation History</h4>
                <Select
                  label="Have you participated in SIH before?"
                  value={editForm.sih_participant ? "Yes" : "No"}
                  onChange={(e) => {
                    const isYes = e.target.value === "Yes";
                    setEditForm((f) => ({
                      ...f,
                      sih_participant: isYes,
                      sih_num_participations: isYes ? f.sih_num_participations || "1" : "",
                      sih_history: isYes ? (f.sih_history && f.sih_history.length > 0 ? f.sih_history : [{ year: "", problemStatement: "", projectDomain: "", projectRole: "", positionReached: "", nodalCenter: "", certificateLink: "" }]) : []
                    }));
                  }}
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </Select>
                {editForm.sih_participant && (
                  <div className="flex flex-col gap-6 animate-page-enter">
                    <Select
                      label="No. of times participated"
                      value={editForm.sih_num_participations}
                      onChange={(e) => {
                        const count = parseInt(e.target.value) || 1;
                        setEditForm((f) => {
                          const newHistory = Array.from({ length: count }, (_, i) => f.sih_history[i] || { year: "", projectDomain: "", problemStatement: "", projectRole: "", positionReached: "", nodalCenter: "", certificateLink: "" });
                          return {
                            ...f,
                            sih_num_participations: e.target.value,
                            sih_history: newHistory
                          };
                        });
                      }}
                    >
                      <option value="" disabled>Select</option>
                      <option value="1">1 time</option>
                      <option value="2">2 times</option>
                      <option value="3">3 times or more</option>
                    </Select>

                    {(editForm.sih_history || []).map((entry, index) => {
                      const setEntry = (key, val) => {
                        setEditForm((f) => {
                          const updated = [...f.sih_history];
                          updated[index] = { ...updated[index], [key]: val };
                          return { ...f, sih_history: updated };
                        });
                      };

                      return (
                        <div key={index} className="flex flex-col gap-4 border border-border/40 bg-card/10 backdrop-blur-sm rounded-xl p-4 relative">
                          <span className="text-[10px] font-black uppercase tracking-wider text-purple-400">
                            Participation #{index + 1}
                          </span>

                          <div className="grid gap-4 sm:grid-cols-2">
                            <Select
                              label="Year of Participation"
                              value={entry.year}
                              onChange={(e) => setEntry("year", e.target.value)}
                            >
                              <option value="" disabled>Select Year</option>
                              <option value="2025">2025</option>
                              <option value="2024">2024</option>
                              <option value="2023">2023</option>
                              <option value="2022">2022</option>
                              <option value="2020">2020</option>
                              <option value="2019">2019</option>
                              <option value="2018">2018</option>
                              <option value="2017">2017</option>
                            </Select>
                            <Select
                              label="Project Domain"
                              value={entry.projectDomain}
                              onChange={(e) => setEntry("projectDomain", e.target.value)}
                            >
                              <option value="" disabled>Select Domain</option>
                              <option value="Software">Software</option>
                              <option value="Hardware">Hardware</option>
                              <option value="Both">Both (Hardware & Software)</option>
                            </Select>
                          </div>

                          <Input
                            label="Problem Statement Chosen"
                            value={entry.problemStatement}
                            onChange={(e) => setEntry("problemStatement", e.target.value)}
                          />

                          <Input
                            label="Role in that Project"
                            value={entry.projectRole}
                            onChange={(e) => setEntry("projectRole", e.target.value)}
                          />

                          <Select
                            label="Position Reached"
                            value={entry.positionReached}
                            onChange={(e) => setEntry("positionReached", e.target.value)}
                          >
                            <option value="" disabled>Select Position</option>
                            <option value="Participated">Participated</option>
                            <option value="Shortlisted in Internal Hackathon">Shortlisted in Internal Hackathon</option>
                            <option value="Shortlisted for SIH">Shortlisted for SIH (Main Round)</option>
                            <option value="Finalist">Finalist</option>
                            <option value="Runners">Runners</option>
                            <option value="Winners">Winners</option>
                          </Select>

                          {["Shortlisted for SIH", "Finalist", "Runners", "Winners"].includes(entry.positionReached) && (
                            <div className="grid gap-4 sm:grid-cols-2">
                              <Input
                                label="Nodal Center Name"
                                value={entry.nodalCenter}
                                onChange={(e) => setEntry("nodalCenter", e.target.value)}
                                placeholder="e.g. IIT Kharagpur"
                              />
                              <Input
                                label="Public Drive Link for Certificate"
                                value={entry.certificateLink}
                                onChange={(e) => setEntry("certificateLink", e.target.value)}
                                placeholder="https://drive.google.com/..."
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-end gap-3 border-t border-border/60 pt-4 mt-2">
                <Button type="button" variant="ghost" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={updating}>
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

function StudentTeamCard({ myTeam, currentUserId }) {
  if (!myTeam) return null;

  const team = myTeam.team;
  const members = myTeam.members || [];
  const stats = computeStats(members);
  const isLeader = team.leader_id === currentUserId;

  return (
    <Card className="p-6 border border-[#c9a227]/30 bg-card/60 backdrop-blur-xl relative overflow-hidden space-y-5 shadow-xl">
      {/* Top Gold Accent Bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#c9a227] to-transparent" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex size-3 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]" />
            <h3 className="text-xl font-extrabold tracking-tight text-white">
              {team.name}
            </h3>
            {isLeader && (
              <span className="rounded-full border border-[#c9a227]/40 bg-[#c9a227]/15 px-2.5 py-0.5 text-[11px] font-bold text-[#e8c058]">
                ★ Team Leader
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1 font-medium">
            Assigned Hackathon Team · {members.length} Member{members.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Team Diversity Status Badge */}
        <div>
          {stats.valid ? (
            <GlowingBadge variant="success" className="px-3 py-1 text-xs font-bold">
              ✓ SIH DIVERSITY VALID
            </GlowingBadge>
          ) : (
            <GlowingBadge variant="warning" className="px-3 py-1 text-xs font-bold">
              ⚠️ DIVERSITY INCOMPLETE
            </GlowingBadge>
          )}
        </div>
      </div>

      {/* Diversity Stats Pills */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
        <div className="rounded-xl border border-border/40 bg-muted/20 p-2.5">
          <div className="text-[10px] uppercase font-bold text-muted-foreground">Members</div>
          <div className="text-sm font-extrabold text-white mt-0.5">{members.length} / 2</div>
        </div>
        <div className="rounded-xl border border-border/40 bg-muted/20 p-2.5">
          <div className="text-[10px] uppercase font-bold text-muted-foreground">Department</div>
          <div className={`text-sm font-extrabold mt-0.5 ${stats.sameDept ? "text-emerald-400" : "text-amber-400"}`}>
            {stats.sameDept ? "Same Dept" : "Mixed Depts"}
          </div>
        </div>
        <div className="rounded-xl border border-border/40 bg-muted/20 p-2.5">
          <div className="text-[10px] uppercase font-bold text-muted-foreground">Skillset & Domain</div>
          <div className={`text-sm font-extrabold mt-0.5 ${stats.differentSkills ? "text-emerald-400" : "text-amber-400"}`}>
            {stats.differentSkills ? "Diverse" : "Overlap"}
          </div>
        </div>
      </div>

      {/* Teammates Section */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[#c9a227]">
          Teammates & Details ({members.length})
        </h4>

        <div className="grid gap-3">
          {members.map((member) => {
            const isMe = member.id === currentUserId;
            const isMemberLeader = member.id === team.leader_id;

            return (
              <div
                key={member.id}
                className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border transition-all ${
                  isMe
                    ? "border-[#c9a227]/40 bg-[#c9a227]/10"
                    : "border-border/40 bg-card/40 hover:bg-card/70"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Avatar name={member.name} src={member.avatar_url ?? undefined} className="size-10 text-xs ring-1 ring-primary/30 shrink-0" />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white">{member.name}</span>
                      {isMe && (
                        <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                          YOU
                        </span>
                      )}
                      {isMemberLeader && (
                        <span className="rounded bg-[#c9a227]/20 px-1.5 py-0.5 text-[10px] font-bold text-[#e8c058]">
                          LEADER
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {member.register_no} · {member.department} {member.year ? `(${member.year} Yr)` : ""} · {member.gender}
                    </p>
                  </div>
                </div>

                {/* Contact & Tech Details */}
                <div className="mt-2 sm:mt-0 text-left sm:text-right text-xs space-y-0.5">
                  <p className="text-slate-300 font-mono text-[11px]">{member.email}</p>
                  {member.phone && (
                    <p className="text-muted-foreground text-[11px]">📞 {member.phone}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
