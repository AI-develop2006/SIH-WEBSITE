"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Home,
  Users,
  UsersRound,
  FileText,
  CalendarDays,
  Megaphone,
  Settings,
  LayoutGrid,
  Menu,
  X,
} from "lucide-react";
import * as data from "@/lib/data";
import { downloadCsv } from "@/lib/utils";
import { DEPARTMENTS } from "@/lib/constants";
import { useToast } from "@/components/unlumen-ui/toast";
import { Button } from "@/components/unlumen-ui/button";
import { Card } from "@/components/unlumen-ui/card";
import { GlowingBadge } from "@/components/unlumen-ui/glowing-badge";
import { Avatar } from "@/components/unlumen-ui/avatar";
import { Input, Select } from "@/components/unlumen-ui/input";
import { CollegeBrand } from "@/components/common/college-brand";
import { cn } from "@/lib/utils";
import { OverallMinistriesView } from "./OverallMinistriesView";

export default function AdminPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [tab, setTab] = useState("students");
  const [profiles, setProfiles] = useState([]);
  const [teams, setTeams] = useState([]);
  const [problems, setProblems] = useState([]);
  const [themes, setThemes] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [regSettings, setRegSettings] = useState(null);
  const [savingRegSettings, setSavingRegSettings] = useState(false);
  const [tablesMissing, setTablesMissing] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [dept, setDept] = useState("");
  const [gender, setGender] = useState("");
  const [verified, setVerified] = useState("all");
  const [projType, setProjType] = useState("");

  const [deleting, setDeleting] = useState(null);

  const load = useCallback(async () => {
    const [profilesRes, teamsRes, problemsRes, themesRes, timelineRes, announcementsRes, regRes] = await Promise.all([
      data.fetchAllProfiles(),
      data.fetchEnrichedTeams(),
      data.fetchProblems(),
      data.fetchThemes(),
      data.fetchTimelineEvents(),
      data.fetchAnnouncements(),
      data.fetchRegistrationSettings(),
    ]);
    if (profilesRes.error) toast("error", profilesRes.error);
    if (teamsRes.error) toast("error", teamsRes.error);
    if (problemsRes.error) toast("error", problemsRes.error);
    if (themesRes.error) toast("error", themesRes.error);
    if (regRes.error) toast("error", regRes.error);

    // If relations are missing in Supabase, show database config message
    const isMissing = (err) => {
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
    if (regRes.data) setRegSettings(regRes.data);
  }, [toast]);

  const handleSaveRegSettings = async (updatedSettings) => {
    setSavingRegSettings(true);
    const res = await data.updateRegistrationSettings(updatedSettings);
    setSavingRegSettings(false);
    if (res.error) {
      toast("error", res.error);
    } else {
      toast("success", "Registration settings updated successfully!");
      setRegSettings(res.data);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const { data: me, error } = await data.getCurrentProfile();
        if (error || !me || me.role !== "admin") {
          setIsAuthenticated(false);
          return;
        }
        setIsAuthenticated(true);
        await load();
      } catch (err) {
        console.error("Auth check failed:", err);
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
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
        (p.languages || []).join(" "),
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

  async function toggleTeamApproval(teamId, currentApproved) {
    if (!currentApproved) {
      const targetTeam = teams.find((t) => t.team.id === teamId);
      if (targetTeam && targetTeam.members.length !== 6) {
        toast("error", "Cannot publish team: A team must have exactly 6 members to be published to the portal.");
        return;
      }
    }
    try {
      const res = await data.api.toggleTeamApproval(teamId, !currentApproved);
      if (res.error) throw new Error(res.error);
      toast("success", !currentApproved ? "Team published to portal!" : "Team hidden from portal.");
      await load();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to toggle approval");
    }
  }

  async function deleteTeam(teamObj) {
    const teamId = typeof teamObj === "object" ? teamObj?.team?.id : teamObj;
    const name = typeof teamObj === "object" ? teamObj?.team?.name : "this team";
    const memberCount = typeof teamObj === "object" ? (teamObj?.members?.length || 0) : 0;

    if (memberCount > 0) {
      toast("error", "You cannot delete a team with active members. Remove all members first before deleting.");
      return;
    }

    if (!window.confirm(`Are you sure you want to delete empty team ${name}?`)) return;
    try {
      setDeleting(teamId);
      const res = await data.api.deleteTeam(teamId);
      if (res.error) throw new Error(res.error);
      toast("success", `Empty team ${name} deleted successfully.`);
      await load();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to delete team");
    } finally {
      setDeleting(null);
    }
  }

  async function logout() {
    await data.logoutAdmin();
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
        languages: (s.languages || []).join(" | "),
        domain_interests: Array.isArray(s.domain_interests) ? s.domain_interests.join(" | ") : "",
        linkedin: s.linkedin ?? "",
        project_type: s.project_type ?? "",
        project_title: s.project_title ?? "",
        project_description: s.project_description ?? "",
        domain: s.domain ?? "",
        software_domain: s.software_domain ?? "",
        hardware_domain: s.hardware_domain ?? "",
        github: s.github ?? "",
        github_repo: s.github_repo ?? "",
        youtube_link: s.youtube_link ?? "",
        google_drive_ppt: s.google_drive_ppt ?? "",
        resume_link: s.resume_link ?? "",
        sih_participant: s.sih_participant ? "Yes" : "No",
        sih_num_participations: s.sih_num_participations ?? "",
        sih_participation_year: s.sih_participation_year ?? "",
        sih_problem_statement: s.sih_problem_statement ?? "",
        sih_project_domain: s.sih_project_domain ?? "",
        sih_project_role: s.sih_project_role ?? "",
        sih_position_reached: s.sih_position_reached ?? "",
        sih_nodal_center: s.sih_nodal_center ?? "",
        sih_history_full: Array.isArray(s.sih_history) && s.sih_history.length > 0
          ? s.sih_history.map((h, i) => 
              `[P#${i + 1}] Year: ${h.year}, Domain: ${h.project_domain}, PS: ${h.problem_statement}, Role: ${h.project_role}, Position: ${h.position_reached}${h.nodal_center ? `, Nodal: ${h.nodal_center}` : ""}${h.certificate_link ? `, Certificate: ${h.certificate_link}` : ""}`
            ).join(" | ")
          : s.sih_participant
            ? `Year: ${s.sih_participation_year}, Domain: ${s.sih_project_domain}, PS: ${s.sih_problem_statement}, Role: ${s.sih_project_role}, Position: ${s.sih_position_reached}${s.sih_nodal_center ? `, Nodal: ${s.sih_nodal_center}` : ""}`
            : "",
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
        { key: "domain_interests", label: "Domain Interests" },
        { key: "linkedin", label: "LinkedIn" },
        { key: "resume_link", label: "Resume Link" },
        { key: "project_type", label: "Project Type" },
        { key: "project_title", label: "Project Title" },
        { key: "project_description", label: "Project Description" },
        { key: "domain", label: "Domain" },
        { key: "software_domain", label: "Software Domain" },
        { key: "hardware_domain", label: "Hardware Domain" },
        { key: "github", label: "GitHub Profile URL" },
        { key: "github_repo", label: "GitHub Repo URL" },
        { key: "youtube_link", label: "YouTube Link" },
        { key: "google_drive_ppt", label: "Google Drive PPT" },
        { key: "sih_participant", label: "SIH Participant" },
        { key: "sih_num_participations", label: "SIH Participations" },
        { key: "sih_participation_year", label: "SIH Year" },
        { key: "sih_problem_statement", label: "SIH Problem Statement" },
        { key: "sih_project_domain", label: "SIH Project Domain" },
        { key: "sih_project_role", label: "SIH Project Role" },
        { key: "sih_position_reached", label: "SIH Position Reached" },
        { key: "sih_nodal_center", label: "SIH Nodal Center" },
        { key: "sih_history_full", label: "SIH Full History Details" },
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
    <main className="mx-auto flex flex-col min-h-screen w-full max-w-[1536px] px-4 sm:px-5 pb-24 md:pb-16">
      <header className="sticky top-0 z-40 -mx-4 sm:-mx-5 mb-6 border-b border-border bg-background/80 px-4 sm:px-5 backdrop-blur">
        <div className="flex h-14 sm:h-16 items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <CollegeBrand />
            <div className="leading-tight hidden sm:block">
              <p className="text-sm font-bold tracking-tight">Admin control</p>
              <p className="text-xs text-muted-foreground">SIH 2026 · registrations & teams</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate("/")} className="hidden sm:inline-flex text-xs px-3 py-1.5">
              View Site
            </Button>
            <Button variant="danger" onClick={logout} className="px-2.5 py-1.5 text-xs sm:px-3 sm:py-2">
              Log out
            </Button>
          </div>
        </div>

        {/* Desktop Tab Bar */}
        <div className="hidden md:flex flex-wrap gap-1 pb-3">
          {["students", "teams", "problems", "timeline", "announcements", "registration", "ministries"].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
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
                ? "Timeline"
                : t === "announcements"
                ? "Announcements"
                : t === "ministries"
                ? "Ministries"
                : "Registration"}
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

          {tab === "registration" && (
            <RegistrationControlSection
              settings={regSettings}
              onSave={handleSaveRegSettings}
              loading={savingRegSettings}
            />
          )}

          {tab === "ministries" && (
            <OverallMinistriesView teams={teams} />
          )}

          {tab === "students" && (
            <Card className="overflow-hidden p-0">
              <div className="flex flex-col gap-3 border-b border-border px-4 sm:px-5 py-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <h3 className="text-base font-bold text-nowrap">Student registrations</h3>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={exportStudents} className="text-xs px-3 py-1.5">
                      Export CSV
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search name, register no, email…"
                    className="w-full sm:w-56"
                  />
                  <Select value={dept} onChange={(e) => setDept(e.target.value)} className="w-full sm:w-44">
                    <option value="">All departments</option>
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </Select>
                  <Select value={gender} onChange={(e) => setGender(e.target.value)} className="w-full sm:w-32">
                    <option value="">All genders</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </Select>
                  <Select value={verified} onChange={(e) => setVerified(e.target.value)} className="w-full sm:w-36">
                    <option value="all">All statuses</option>
                    <option value="verified">Verified</option>
                    <option value="unverified">Unverified</option>
                  </Select>
                  <Select value={projType} onChange={(e) => setProjType(e.target.value)} className="w-full sm:w-40">
                    <option value="">All project types</option>
                    <option value="Hardware">Hardware</option>
                    <option value="Software">Software</option>
                    <option value="Hardware & Software">Hardware &amp; Software</option>
                  </Select>
                </div>
              </div>

              {/* Mobile card list */}
              <div className="md:hidden divide-y divide-border/60">
                {students.length === 0 && (
                  <p className="px-4 py-10 text-center text-sm text-muted-foreground">No registrations match your filters.</p>
                )}
                {students.map((s) => (
                  <div key={s.id} className="px-4 py-4 flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={s.name} className="size-10 text-xs shrink-0" />
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{s.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{s.email ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{s.phone ?? "—"}</p>
                      </div>
                      <div className="ml-auto shrink-0">
                        {s.verified ? (
                          <GlowingBadge variant="success" pulse={false}>Verified</GlowingBadge>
                        ) : (
                          <GlowingBadge variant="warning" pulse={false}>Pending</GlowingBadge>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span><span className="font-semibold text-foreground">Reg No: </span>{s.register_no ?? "—"}</span>
                      <span><span className="font-semibold text-foreground">Dept: </span>{s.department ?? "—"}</span>
                      <span><span className="font-semibold text-foreground">Year: </span>{s.year ? `Yr ${s.year}` : "—"}</span>
                      <span><span className="font-semibold text-foreground">Section: </span>{s.section ?? "—"}</span>
                      <span><span className="font-semibold text-foreground">Gender: </span>{s.gender ?? "—"}</span>
                      <span><span className="font-semibold text-foreground">Type: </span>{s.project_type ?? "—"}</span>
                    </div>
                    {s.project_title && (
                      <p className="text-xs text-muted-foreground truncate"><span className="font-semibold text-foreground">Project: </span>{s.project_title}</p>
                    )}
                    {(s.languages || []).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {s.languages.map((l) => (
                          <span key={l} className="rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">{l}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full min-w-[1000px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-5 py-3 font-semibold">Student</th>
                      <th className="px-5 py-3 font-semibold">Register No</th>
                      <th className="px-5 py-3 font-semibold">Dept · Year · Sec</th>
                      <th className="px-5 py-3 font-semibold">Gender</th>
                      <th className="px-5 py-3 font-semibold">Languages</th>
                      <th className="px-5 py-3 font-semibold">Domain Interest</th>
                      <th className="px-5 py-3 font-semibold">Project</th>
                      <th className="px-5 py-3 font-semibold">Registered At</th>
                      <th className="px-5 py-3 font-semibold">Status</th>
                      <th className="px-5 py-3 font-semibold">Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.length === 0 && (
                      <tr>
                        <td colSpan={10} className="px-5 py-10 text-center text-sm text-muted-foreground">
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
                            {(s.languages || []).length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                            {(s.languages || []).map((l) => (
                              <span
                                key={l}
                                className="rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                              >
                                {l}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex max-w-[220px] flex-wrap gap-1">
                            {(!s.domain_interests || s.domain_interests.length === 0) && (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                            {(s.domain_interests ?? []).map((di) => (
                              <span
                                key={di}
                                className="rounded border border-ring/30 bg-ring/10 px-1.5 py-0.5 text-[10px] text-ring/80"
                              >
                                {di}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">
                          <div className="leading-tight max-w-[240px]">
                            <p className="font-semibold text-xs text-foreground">{s.project_type ?? "—"}</p>
                            {s.project_title && (
                              <p className="text-[11px] text-muted-foreground truncate mt-0.5" title={s.project_title}>
                                {s.project_title}
                              </p>
                            )}
                            {s.project_description && (
                              <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed" title={s.project_description}>
                                {s.project_description}
                              </p>
                            )}
                            {s.software_domain && (
                              <p className="text-[9px] text-blue-400/80 truncate mt-0.5" title={s.software_domain}>
                                SW: {s.software_domain}
                              </p>
                            )}
                            {s.hardware_domain && (
                              <p className="text-[9px] text-amber-400/80 truncate" title={s.hardware_domain}>
                                HW: {s.hardware_domain}
                              </p>
                            )}
                            {s.sih_participant && (
                              <div className="mt-1.5 bg-purple-500/10 border border-purple-500/35 rounded px-2 py-0.5 text-[9px] text-purple-300">
                                <span className="font-bold">SIH History ({s.sih_num_participations}x): </span>
                                {Array.isArray(s.sih_history) && s.sih_history.length > 0 ? (
                                  <span className="font-medium text-purple-200">
                                    {s.sih_history.map((h) => `${h.year} (${h.project_domain})`).join(", ")}
                                  </span>
                                ) : (
                                  <span className="font-medium text-purple-200">{s.sih_participation_year}</span>
                                )}
                              </div>
                            )}
                            <div className="flex flex-wrap gap-2 mt-1.5">
                              {s.linkedin && (
                                <a href={s.linkedin} target="_blank" rel="noreferrer" className="text-[9px] text-blue-400 hover:underline">
                                  LinkedIn ↗
                                </a>
                              )}
                              {s.google_drive_ppt && (
                                <a href={s.google_drive_ppt} target="_blank" rel="noreferrer" className="text-[9px] text-[#dba328] hover:underline">
                                  PPT ↗
                                </a>
                              )}
                              {s.github && (
                                <a href={s.github} target="_blank" rel="noreferrer" className="text-[9px] text-[#dba328] hover:underline">
                                  Profile ↗
                                </a>
                              )}
                              {s.github_repo && (
                                <a href={s.github_repo} target="_blank" rel="noreferrer" className="text-[9px] text-[#dba328] hover:underline">
                                  Repo ↗
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
                        <td className="px-5 py-3 text-muted-foreground whitespace-nowrap text-xs">
                          {s.created_at
                            ? new Date(s.created_at).toLocaleString("en-IN", {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })
                            : "—"}
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
                          {s.role === "admin" ? (
                            <GlowingBadge variant="info" pulse={false}>
                              Admin
                            </GlowingBadge>
                          ) : (
                            <span className="text-xs font-semibold text-muted-foreground bg-muted/30 border border-border/40 px-2 py-0.5 rounded">
                              Student
                            </span>
                          )}
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

              {/* Mobile card list */}
              <div className="md:hidden divide-y divide-border/60">
                {teams.length === 0 && (
                  <p className="px-4 py-10 text-center text-sm text-muted-foreground">No teams formed yet.</p>
                )}
                {teams.map((t) => (
                  <div key={t.team.id} className="px-4 py-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm">{t.team.name}</p>
                        <p className="text-xs text-muted-foreground">Leader: {t.leader?.name ?? "—"}</p>
                      </div>
                      <div>
                        {t.stats.valid ? (
                          <GlowingBadge variant="success" pulse={false}>Valid</GlowingBadge>
                        ) : (
                          <GlowingBadge variant="warning" pulse={false} title={t.stats.reason}>Invalid</GlowingBadge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-2">
                        {t.members.slice(0, 4).map((m) => (
                          <Avatar key={m.id} name={m.name} className="size-7 text-[9px] ring-2 ring-background" />
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground">{t.members.length}/6 members</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span><span className="font-semibold text-foreground">Depts: </span>{t.stats.deptCount}</span>
                      <span><span className="font-semibold text-foreground">Female: </span>{t.stats.girlCount}</span>
                      {problemMap.get(t.team.problem_id ?? "") && (
                        <span className="col-span-2 truncate"><span className="font-semibold text-foreground">Problem: </span>{problemMap.get(t.team.problem_id ?? "")}</span>
                      )}
                    </div>
                    {t.members.length === 0 && (
                      <Button
                        variant="danger"
                        className="px-2.5 py-1 text-xs self-start"
                        loading={deleting === t.team.id}
                        onClick={() => deleteTeam(t)}
                      >
                        Delete Empty Team
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
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
                          {t.members.length === 0 ? (
                            <Button
                              variant="danger"
                              className="px-2.5 py-1 text-xs"
                              loading={deleting === t.team.id}
                              onClick={() => deleteTeam(t)}
                            >
                              Delete Empty Team
                            </Button>
                          ) : (
                            <span className="text-[11px] text-muted-foreground font-semibold" title="Remove members first to enable team deletion">
                              🔒 Has {t.members.length} Member{t.members.length > 1 ? "s" : ""}
                            </span>
                          )}
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
              <AlertTriangle className="size-9 text-warning animate-bounce" />
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

      {/* Mobile Bottom Tab Navigation */}
      <div className="fixed bottom-0 inset-x-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-md py-2 px-1 flex items-center justify-around md:hidden shadow-[0_-8px_24px_rgba(0,0,0,0.4)]">
        {[
          { key: "students", icon: "students", label: "Students" },
          { key: "teams", icon: "teams", label: "Teams" },
          { key: "problems", icon: "problems", label: "Problems" },
          { key: "timeline", icon: "timeline", label: "Timeline" },
          { key: "announcements", icon: "announce", label: "Announce" },
          { key: "registration", icon: "settings", label: "Settings" },
          { key: "ministries", icon: "ministries", label: "Ministry" },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 px-1 py-1 rounded-lg transition-colors min-w-0 flex-1",
              tab === item.key ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {item.icon === "students" && <svg className="size-4.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" /></svg>}
            {item.icon === "teams" && <svg className="size-4.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" /></svg>}
            {item.icon === "problems" && <svg className="size-4.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" /></svg>}
            {item.icon === "timeline" && <svg className="size-4.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>}
            {item.icon === "announce" && <svg className="size-4.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 1 1 0-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 0 1-1.44-4.282m3.102.069a18.03 18.03 0 0 1-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 0 1 8.835 2.535M10.34 6.66a23.847 23.847 0 0 1 8.835-2.535m0 0A23.74 23.74 0 0 1 18.795 3m.38 1.125a23.91 23.91 0 0 1 1.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 0 0 1.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 0 1 0 3.46" /></svg>}
            {item.icon === "settings" && <svg className="size-4.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.282c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>}
            {item.icon === "ministries" && <svg className="size-4.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75Z" /></svg>}
            <span className="text-[8px] font-bold">{item.label}</span>
          </button>
        ))}
      </div>
    </main>
  );
}

function ProblemsManager({
  problems,
  themes,
  onReload,
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [form, setForm] = useState({ id: "", title: "", category: "", description: "", themeId: "" });

  function reset() {
    setForm({ id: "", title: "", category: "", description: "", themeId: "" });
  }

  function startEdit(p) {
    setForm({
      id: p.id,
      title: p.title,
      category: p.category ?? "",
      description: p.description ?? "",
      themeId: p.theme_id ?? "",
    });
  }

  async function save(e) {
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

  async function remove(id, title) {
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

function StatCard({ label, value, accent }) {
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

function TimelineManager({ timeline, onReload }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [form, setForm] = useState({ id: "", step: "", date: "", label: "", description: "", status: "upcoming", sortOrder: 1 });

  function reset() {
    setForm({ id: "", step: "", date: "", label: "", description: "", status: "upcoming", sortOrder: timeline.length + 1 });
  }

  function startEdit(t) {
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

  async function save(e) {
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

  async function remove(id, label) {
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
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
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

function AnnouncementsManager({ announcements, onReload }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ id: "", content: "", active: true });

  function reset() {
    setForm({ id: "", content: "", active: true });
  }

  function startEdit(a) {
    setForm({
      id: a.id,
      content: a.content,
      active: a.active,
    });
  }

  async function save(e) {
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

  async function toggleActive(a) {
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

function AdminLoginForm({ onLoginSuccess }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setBusy(true);
    try {
      const res = await data.loginAdmin(email.trim(), password.trim());
      if (res.error) {
        throw new Error(res.error);
      }

      toast("success", `Welcome back, ${res.data.profile.name}!`);
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
            <div className="mt-4 lg:mt-0 flex justify-center">
              <a href="/" className="inline-flex">
                <CollegeBrand className="scale-[1.3] sm:scale-[1.75] origin-center" />
              </a>
            </div>

            <div className="mt-6 lg:mt-12 space-y-3 lg:space-y-4">
              {/* Gold accent label */}
              <p className="font-caveat text-2xl lg:text-3xl text-[#e8c058]">Welcome back</p>
              <h1 className="text-3xl lg:text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
                Sign In to Admin Control Center.
              </h1>
              <p className="hidden sm:block font-caveat text-xl text-[#8fa0c0]">— Authorized Personnel Only</p>
            </div>

            {/* Gold divider line */}
            <div className="mt-6 lg:mt-10 gold-bar w-24" />
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
                <Home className="size-4 shrink-0" />
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

              <form onSubmit={handleLogin} className="flex grow flex-col justify-between">
                <article className="divide-y divide-border grow flex flex-col">
                  <section className="py-8 grow flex flex-col justify-start">
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

function RegistrationControlSection({ settings, onSave, loading }) {
  const [manualStatus, setManualStatus] = useState(settings?.manual_status || "open");
  const [closingDate, setClosingDate] = useState(() => {
    if (!settings?.closing_date) return "";
    const d = new Date(settings.closing_date);
    if (isNaN(d.getTime())) return "";
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [closingMessage, setClosingMessage] = useState(
    settings?.closing_message || "Registration for SIH Internal Hackathon 2026 is currently closed."
  );

  useEffect(() => {
    if (settings) {
      setManualStatus(settings.manual_status || "open");
      if (settings.closing_date) {
        const d = new Date(settings.closing_date);
        if (!isNaN(d.getTime())) {
          setClosingDate(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
        } else {
          setClosingDate("");
        }
      } else {
        setClosingDate("");
      }
      setClosingMessage(settings.closing_message || "Registration for SIH Internal Hackathon 2026 is currently closed.");
    }
  }, [settings]);

  const handleFormSubmit = (e) => {
    e.preventDefault();
    const isoDate = closingDate ? new Date(closingDate).toISOString() : null;
    onSave({
      manual_status: manualStatus,
      closing_date: isoDate,
      closing_message: closingMessage.trim()
    });
  };

  const isOpen = settings?.is_open;
  const isExpired = settings?.is_expired;

  return (
    <Card className="p-6 space-y-6 max-w-3xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h2 className="text-xl font-bold text-foreground">Portal Registration Control</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Open or close registration manually, or set an automated closing date & time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase">Current Live Status:</span>
          {isOpen ? (
            <GlowingBadge variant="success" className="px-3 py-1 text-sm font-bold">
              REGISTRATION OPEN
            </GlowingBadge>
          ) : (
            <GlowingBadge variant="danger" className="px-3 py-1 text-sm font-bold">
              REGISTRATION CLOSED
            </GlowingBadge>
          )}
        </div>
      </div>

      <form onSubmit={handleFormSubmit} className="space-y-6">
        {/* Status indicator banner */}
        <div className={cn(
          "rounded-xl border p-4 text-sm",
          isOpen
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
            : "border-red-500/30 bg-red-500/10 text-red-300"
        )}>
          <div className="font-semibold text-base mb-1">
            {isOpen ? "✓ Registration is Currently Active" : "✕ Registration is Currently Closed"}
          </div>
          <p className="opacity-90">
            {manualStatus === "closed"
              ? "Registration has been manually CLOSED by Administrator."
              : isExpired
              ? `Registration automatically closed because the closing deadline (${new Date(settings?.closing_date).toLocaleString()}) has passed.`
              : closingDate
              ? `Registration is OPEN and will automatically close on ${new Date(closingDate).toLocaleString()}.`
              : "Registration is OPEN indefinitely until manually closed."}
          </p>
        </div>

        {/* 1. Manual Toggle */}
        <div className="space-y-2">
          <label className="text-sm font-bold text-foreground">1. Manual Status Override</label>
          <div className="grid grid-cols-2 gap-3 sm:max-w-md">
            <button
              type="button"
              onClick={() => setManualStatus("open")}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl border p-3 font-semibold transition-all text-sm",
                manualStatus === "open"
                  ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-400 ring-2 ring-emerald-500/30"
                  : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
              )}
            >
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              OPEN
            </button>
            <button
              type="button"
              onClick={() => setManualStatus("closed")}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl border p-3 font-semibold transition-all text-sm",
                manualStatus === "closed"
                  ? "border-red-500/60 bg-red-500/20 text-red-400 ring-2 ring-red-500/30"
                  : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
              )}
            >
              <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
              CLOSED
            </button>
          </div>
        </div>

        {/* 2. Automated Closing Date & Time */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-foreground">2. Scheduled Closing Date & Time (Optional)</label>
            {closingDate && (
              <button
                type="button"
                onClick={() => setClosingDate("")}
                className="text-xs font-semibold text-red-400 hover:underline"
              >
                Clear Deadline
              </button>
            )}
          </div>
          <input
            type="datetime-local"
            value={closingDate}
            onChange={(e) => setClosingDate(e.target.value)}
            className="w-full max-w-md rounded-xl border border-border bg-muted/30 px-3.5 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <p className="text-xs text-muted-foreground">
            If set, registration will automatically close when this date and time is reached.
          </p>
        </div>

        {/* 3. Popup Custom Message */}
        <div className="space-y-2">
          <label className="text-sm font-bold text-foreground">3. Popup Message (Shown when closed)</label>
          <textarea
            rows={3}
            value={closingMessage}
            onChange={(e) => setClosingMessage(e.target.value)}
            placeholder="Registration for SIH Internal Hackathon 2026 is currently closed."
            className="w-full rounded-xl border border-border bg-muted/30 p-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Submit */}
        <div className="pt-2">
          <Button type="submit" disabled={loading} className="px-6 py-2.5 font-bold">
            {loading ? "Saving Settings..." : "Save Registration Settings"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
