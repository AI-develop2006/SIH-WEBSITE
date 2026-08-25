"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Users,
  UsersRound,
  FileText,
  CalendarDays,
  Megaphone,
  Settings,
  Building2,
  CheckCircle2,
  Clock,
  ShieldCheck,
  LogOut,
  ExternalLink,
  Download,
  Trash2,
  PencilLine,
  Plus,
  UserPlus,
  UserMinus,
  ChevronDown,
  ChevronUp,
  Sliders,
  Activity,
} from "lucide-react";
import * as data from "@/lib/data";
import { downloadCsv, downloadXlsx, deptToAbbr } from "@/lib/utils";
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
import { MinistrySeatsView } from "./MinistrySeatsView";
import { MonitoringView } from "./MonitoringView";
import { MINISTRIES, OUTDATED_MINISTRIES } from "@/lib/constants";
import { OutdatedMinistryBadge } from "@/components/common/OutdatedMinistryBadge";
import { NewMinistryBadge } from "@/components/common/NewMinistryBadge";

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
  const [finalTeams, setFinalTeams] = useState([]);

  const [q, setQ] = useState("");
  const [dept, setDept] = useState("");
  const [gender, setGender] = useState("");
  const [verified, setVerified] = useState("all");
  const [projType, setProjType] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");

  const [deleting, setDeleting] = useState(null);

  const load = useCallback(async () => {
    const [profilesRes, teamsRes, problemsRes, themesRes, timelineRes, announcementsRes, regRes, finalTeamsRes] = await Promise.all([
      data.fetchAllProfiles(),
      data.fetchEnrichedTeams(),
      data.fetchProblems(),
      data.fetchThemes(),
      data.fetchTimelineEvents(),
      data.fetchAnnouncements(),
      data.fetchRegistrationSettings(),
      data.fetchFinalTeams(),
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
    setFinalTeams(finalTeamsRes.data ?? []);
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

  // ── SSE: auto-refresh teams when mentor makes changes ─────────────────────
  // Subscribes to pair_teams_updated events from the mentor backend.
  // Debounced 500 ms so rapid mentor edits don't flood the admin backend.
  useEffect(() => {
    if (!isAuthenticated) return;
    let debounceTimer = null;

    const cleanup = data.subscribeToPairTeamEvents(async () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        const teamsRes = await data.fetchEnrichedTeams();
        if (teamsRes.data) setTeams(teamsRes.data);
        // Also refresh final teams in case monitoring view is open
        const finalRes = await data.fetchFinalTeams();
        if (finalRes.data) setFinalTeams(finalRes.data);
      }, 500);
    });

    return () => {
      cleanup();
      clearTimeout(debounceTimer);
    };
  }, [isAuthenticated]);

  const students = useMemo(() => {
    const list = profiles.filter((p) => p.role === "student");
    const needle = q.trim().toLowerCase();
    return list.filter((p) => {
      if (dept && p.department !== dept) return false;
      if (gender && p.gender !== gender) return false;
      if (verified === "verified" && !p.verified) return false;
      if (verified === "unverified" && p.verified) return false;
      if (projType && p.project_type !== projType) return false;
      if (yearFilter && p.year !== yearFilter) return false;
      if (sectionFilter && (p.section ?? "").toUpperCase() !== sectionFilter.toUpperCase()) return false;
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
  }, [profiles, q, dept, gender, verified, projType, yearFilter, sectionFilter]);

  const problemMap = useMemo(() => new Map(problems.map((p) => [p.id, p.title])), [problems]);

  const totalStudents = useMemo(
    () => profiles.filter((p) => p.role === "student").length,
    [profiles]
  );

  // Check if any filter is active
  const isFiltered = !!(q.trim() || dept || gender || (verified !== "all") || projType || yearFilter || sectionFilter);

  // Filtered student ID set for fast lookup
  const filteredStudentIds = useMemo(
    () => new Set(students.map((s) => s.id)),
    [students]
  );

  // When filtered: only count teams that have at least one member in the filtered set
  const filteredTeams = useMemo(() => {
    if (!isFiltered) return teams;
    return teams.filter((t) => t.members.some((m) => filteredStudentIds.has(m.id)));
  }, [teams, isFiltered, filteredStudentIds]);

  const validTeams = filteredTeams.filter((t) => t.stats.valid).length;

  // Unassigned: filtered students who are not in any team
  const assignedInFilteredTeams = useMemo(() => {
    const ids = new Set();
    filteredTeams.forEach((t) => t.members.forEach((m) => ids.add(m.id)));
    return ids;
  }, [filteredTeams]);

  const unassigned = isFiltered
    ? students.filter((s) => !assignedInFilteredTeams.has(s.id)).length
    : Math.max(0, totalStudents - teams.reduce((n, t) => n + t.members.length, 0));

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

    const msg = memberCount > 0
      ? `Delete "${name}" and force-remove its ${memberCount} member${memberCount > 1 ? "s" : ""}? This cannot be undone.`
      : `Delete empty team "${name}"?`;

    if (!window.confirm(msg)) return;
    try {
      setDeleting(teamId);
      const res = await data.api.deleteTeam(teamId, memberCount > 0);
      if (res.error) throw new Error(res.error);
      toast("success", `Team "${name}" deleted.`);
      await load();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to delete team");
    } finally {
      setDeleting(null);
    }
  }

  async function toggleVerified(studentId, currentVerified, name) {
    try {
      const res = await data.api.toggleVerified(studentId, !currentVerified);
      if (res.error) throw new Error(res.error);
      toast("success", `${name} marked as ${!currentVerified ? "verified" : "unverified"}`);
      await load();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to update verification");
    }
  }

  async function deleteStudent(studentId, name) {
    if (!window.confirm(`Permanently delete profile for "${name}"? This also removes them from all teams and cannot be undone.`)) return;
    try {
      const res = await data.api.deleteProfile(studentId);
      if (res.error) throw new Error(res.error);
      toast("success", `Profile for "${name}" deleted.`);
      await load();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to delete profile");
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

  async function exportTeams() {
    // Generate stable random IDs per team for this export session
    // Format: DEPTCODE#XXX where XXX is a random 3-digit number (100-999)
    // Shuffle ensures no two teams in the same dept get the same number
    const deptCounters = {};

    // Pre-assign random numbers per dept (no repeats within same dept)
    const deptTeamMap = {};
    for (const t of teams) {
      const dept = t.team.created_by_dept
        || t.members.find((m) => m.department)?.department
        || "TEAM";
      if (!deptTeamMap[dept]) deptTeamMap[dept] = [];
      deptTeamMap[dept].push(t.team.id);
    }
    // For each dept, generate a shuffled pool of random 3-digit numbers
    const deptRandomIds = {};
    for (const [dept, ids] of Object.entries(deptTeamMap)) {
      const pool = Array.from({ length: 900 }, (_, i) => i + 100);
      // Fisher-Yates shuffle
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      ids.forEach((id, idx) => { deptRandomIds[id] = pool[idx]; });
    }

    await downloadXlsx(
      "sih-teams.xlsx",
      teams.map((t) => {
        const dept = t.team.created_by_dept
          || t.members.find((m) => m.department)?.department
          || "";

        // Dept code prefix (e.g. "AI&DS", "CSE")
        const deptCode = t.team.team_code
          ? t.team.team_code.replace(/#.*$/, "").replace(/-SOLO$/, "")
          : (dept.replace(/\s+/g, "").toUpperCase().slice(0, 8) || "TEAM");

        const isSolo = (t.team.category || "Pairs") === "Solo";
        const randomNum = String(deptRandomIds[t.team.id] ?? Math.floor(Math.random() * 900 + 100));
        const randomId = isSolo
          ? `${deptCode}-SOLO#${randomNum}`
          : `${deptCode}#${randomNum}`;

        // Team creation date/time
        const createdAt = t.team.created_at
          ? new Date(t.team.created_at).toLocaleString("en-IN", {
              day: "2-digit", month: "2-digit", year: "numeric",
              hour: "2-digit", minute: "2-digit", second: "2-digit",
              hour12: true,
            })
          : "";

        const memberNames = t.members.map((m) => m.name).join(", ");
        const femaleCount = t.members.filter((m) => m.gender === "Female").length;

        // Year and section — take from first member (same dept = same year/section typically)
        const year = t.members.find((m) => m.year)?.year ?? "";
        const section = t.members.find((m) => m.section)?.section ?? "";

        return {
          created_at: createdAt,
          team_id: randomId,
          team_name: t.team.name,
          members: memberNames,
          year,
          section,
          department: deptToAbbr(dept),
          ministry: t.team.ministry ?? "",
          female: femaleCount,
        };
      }),
      [
        { key: "created_at",  label: "Time and Date" },
        { key: "team_id",     label: "Team ID" },
        { key: "team_name",   label: "Team Name" },
        { key: "members",     label: "Team Members" },
        { key: "year",        label: "Year" },
        { key: "section",     label: "Section" },
        { key: "department",  label: "Department" },
        { key: "ministry",    label: "Ministry" },
        { key: "female",      label: "Female Members" },
      ]
    );
  }

  // Tab definitions with Lucide icons
  const TABS = [
    { key: "students",      label: "Students",      shortLabel: "Students",  icon: Users,       count: isFiltered ? students.length : totalStudents },
    { key: "teams",         label: "Teams",         shortLabel: "Teams",     icon: UsersRound,  count: teams.length },
    { key: "monitoring",    label: "Monitoring",    shortLabel: "Monitor",   icon: Activity },
    { key: "problems",      label: "Problems",      shortLabel: "Problems",  icon: FileText },
    { key: "timeline",      label: "Timeline",      shortLabel: "Timeline",  icon: CalendarDays },
    { key: "announcements", label: "Announcements", shortLabel: "Announce",  icon: Megaphone },
    { key: "registration",  label: "Registration",  shortLabel: "Reg",       icon: Settings },
    { key: "ministries",    label: "Ministries",    shortLabel: "Ministry",  icon: Building2 },
    { key: "seats",         label: "Seats",         shortLabel: "Seats",     icon: Sliders },
  ];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="size-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading admin panel…</p>
        </div>
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
    <main className="mx-auto flex flex-col min-h-screen w-full max-w-[1536px] px-4 sm:px-5 pb-24 md:pb-4">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 -mx-4 sm:-mx-5 border-b border-border bg-background px-4 sm:px-5">
        <div className="flex h-14 items-center justify-between gap-3">
          {/* Brand */}
          <div className="flex items-center gap-3 min-w-0">
            <CollegeBrand />
            <div className="hidden sm:block leading-tight">
              <p className="text-sm font-semibold text-foreground">Admin Panel</p>
              <p className="text-[11px] text-muted-foreground">SIH 2026 · SMVEC</p>
            </div>
          </div>

          {/* Header actions */}
          <div className="flex items-center gap-2">
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              <ExternalLink className="size-3.5" />
              View site
            </a>
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-danger hover:border-danger/50 transition-colors"
            >
              <LogOut className="size-3.5" />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        </div>

        {/* ── Desktop tab bar ── */}
        <div className="hidden md:flex items-end gap-0 -mb-px overflow-x-auto">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors",
                  isActive
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                <Icon className="size-3.5 shrink-0" />
                {t.label}
                {t.count !== undefined && (
                  <span className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-bold",
                    isActive ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                  )}>
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* ── Stat bar ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 py-4 border-b border-border">
        {[
          { label: "Students",   value: students.length,                    icon: Users,         color: "text-foreground" },
          { label: "Verified",   value: verifiedCount,                      icon: CheckCircle2,  color: "text-success" },
          { label: "Pending",    value: students.length - verifiedCount,    icon: Clock,         color: "text-warning" },
          { label: "Teams",      value: filteredTeams.length,               icon: UsersRound,    color: "text-primary" },
          { label: "Valid",      value: validTeams,                         icon: ShieldCheck,   color: "text-success" },
          { label: "Unassigned", value: unassigned,                         icon: AlertTriangle, color: "text-muted-foreground" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="flex flex-col gap-0.5 px-2 sm:px-3 py-2 rounded-lg bg-card border border-border">
              <div className="flex items-center gap-1 sm:gap-1.5 text-muted-foreground">
                <Icon className={cn("size-3 sm:size-3.5 shrink-0", s.color)} />
                <span className="text-[9px] sm:text-[10px] font-medium uppercase tracking-wide truncate">{s.label}</span>
              </div>
              <span className={cn("text-lg sm:text-xl font-bold tabular-nums", s.color)}>{s.value}</span>
            </div>
          );
        })}
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 py-4">

          {tab === "monitoring" && (
            <MonitoringView
              profiles={profiles}
              teams={teams}
              finalTeams={finalTeams}
              onRefresh={load}
              refreshing={loading}
            />
          )}

          {tab === "registration" && (
            <RegistrationControlSection
              settings={regSettings}
              onSave={handleSaveRegSettings}
              loading={savingRegSettings}
            />
          )}

          {tab === "ministries" && (
            <OverallMinistriesView teams={teams} onReload={load} />
          )}

          {tab === "seats" && (
            <MinistrySeatsView />
          )}

          {tab === "students" && (
            <Card className="overflow-hidden p-0">
              <div className="flex flex-col gap-3 border-b border-border px-4 sm:px-5 py-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-bold text-nowrap">Student registrations</h3>
                    {(q.trim() || dept || gender || verified !== "all" || projType || yearFilter || sectionFilter) ? (
                      <span className="text-xs text-muted-foreground">
                        Showing <span className="font-bold text-foreground">{students.length}</span> of{" "}
                        <span className="font-bold text-foreground">{totalStudents}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        <span className="font-bold text-foreground">{totalStudents}</span> total
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={exportStudents} className="text-xs px-3 py-1.5">
                      Export CSV
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search name, register no, email…"
                    className="rounded-xl border border-border bg-background/60 px-3.5 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-ring/70 w-48 grow"
                  />
                  <select value={dept} onChange={(e) => setDept(e.target.value)} className="rounded-xl border border-border bg-background/60 px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-ring/70 w-40">
                    <option value="">All departments</option>
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <select value={gender} onChange={(e) => setGender(e.target.value)} className="rounded-xl border border-border bg-background/60 px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-ring/70 w-28">
                    <option value="">All genders</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                  <select value={verified} onChange={(e) => setVerified(e.target.value)} className="rounded-xl border border-border bg-background/60 px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-ring/70 w-32">
                    <option value="all">All statuses</option>
                    <option value="verified">Verified</option>
                    <option value="unverified">Unverified</option>
                  </select>
                  <select value={projType} onChange={(e) => setProjType(e.target.value)} className="rounded-xl border border-border bg-background/60 px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-ring/70 w-36">
                    <option value="">All project types</option>
                    <option value="Hardware">Hardware</option>
                    <option value="Software">Software</option>
                    <option value="Hardware & Software">Both</option>
                  </select>
                  <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className="rounded-xl border border-border bg-background/60 px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-ring/70 w-24">
                    <option value="">All years</option>
                    <option value="I">Year I</option>
                    <option value="II">Year II</option>
                    <option value="III">Year III</option>
                    <option value="IV">Year IV</option>
                  </select>
                  <select value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)} className="rounded-xl border border-border bg-background/60 px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-ring/70 w-28">
                    <option value="">All sections</option>
                    {["A","B","C","D","E","F","G"].map((s) => (
                      <option key={s} value={s}>Section {s}</option>
                    ))}
                  </select>
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
                      <div className="flex items-center gap-2 flex-wrap">
                      <div className="ml-auto shrink-0">
                        {s.verified ? (
                          <GlowingBadge variant="success" pulse={false}>Verified</GlowingBadge>
                        ) : (
                          <GlowingBadge variant="warning" pulse={false}>Pending</GlowingBadge>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleVerified(s.id, s.verified, s.name)}
                        className={cn(
                          "text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-colors",
                          s.verified
                            ? "border-warning/40 bg-warning/10 text-warning hover:bg-warning/20"
                            : "border-success/40 bg-success/10 text-success hover:bg-success/20"
                        )}
                      >
                        {s.verified ? "Unverify" : "Verify"}
                      </button>
                      {s.role !== "admin" && (
                        <button
                          type="button"
                          onClick={() => deleteStudent(s.id, s.name)}
                          className="text-[10px] font-bold px-2.5 py-1 rounded-lg border border-danger/30 bg-danger/10 text-danger hover:bg-danger hover:text-white transition-colors"
                        >
                          Delete
                        </button>
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
                      <th className="px-5 py-3 font-semibold">Actions</th>
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
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => toggleVerified(s.id, s.verified, s.name)}
                              className={cn(
                                "text-[10px] font-bold px-2 py-1 rounded-lg border transition-colors",
                                s.verified
                                  ? "border-warning/40 bg-warning/10 text-warning hover:bg-warning/20"
                                  : "border-success/40 bg-success/10 text-success hover:bg-success/20"
                              )}
                            >
                              {s.verified ? "Unverify" : "Verify"}
                            </button>
                            {s.role !== "admin" && (
                              <button
                                type="button"
                                onClick={() => deleteStudent(s.id, s.name)}
                                className="text-[10px] font-bold px-2 py-1 rounded-lg border border-danger/30 bg-danger/10 text-danger hover:bg-danger hover:text-white transition-colors"
                              >
                                Delete
                              </button>
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
            <TeamsManager
              teams={teams}
              profiles={profiles}
              problems={problems}
              problemMap={problemMap}
              deleting={deleting}
              onDelete={deleteTeam}
              onReload={load}
              onExport={exportTeams}
              toast={toast}
            />
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

      {/* Mobile Bottom Tab Navigation — uses same TABS array with Lucide icons */}
      <div className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background md:hidden safe-bottom">
        {/* Scrollable tab bar — 7 tabs fit without compression on small screens */}
        <div className="flex items-stretch overflow-x-auto scrollbar-none">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex flex-none flex-col items-center justify-center gap-1 min-w-[60px] px-2 py-3 text-center transition-colors border-t-2 -mt-px",
                  isActive
                    ? "border-primary text-foreground bg-muted/40"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/20"
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className="text-[9px] font-medium leading-none whitespace-nowrap">{t.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>
    </main>
  );
}

function TeamsManager({ teams, profiles, problems, problemMap, deleting, onDelete, onReload, onExport, toast }) {
  const [expandedId, setExpandedId] = useState(null);
  const [busy, setBusy] = useState(null);
  const [backfilling, setBackfilling] = useState(false);
  const [teamDeptFilter, setTeamDeptFilter] = useState("");
  const [teamMinistryFilter, setTeamMinistryFilter] = useState("");
  const [teamSearch, setTeamSearch] = useState("");
  const [teamSectionFilter, setTeamSectionFilter] = useState("");
  const [teamApprovalFilter, setTeamApprovalFilter] = useState(""); // "" | "approved" | "pending"
  const [teamCategoryFilter, setTeamCategoryFilter] = useState(""); // "" | "Pairs" | "Solo"

  // Create team form
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("Pairs");
  const [creating, setCreating] = useState(false);

  const students = profiles.filter((p) => p.role === "student");

  async function handleCreate(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    const res = await data.api.createTeam({ name: newName.trim(), category: newCategory });
    setCreating(false);
    if (res.error) { toast("error", res.error); return; }
    toast("success", `Team "${newName.trim()}" created`);
    setNewName(""); setShowCreate(false);
    await onReload();
  }

  async function handleAddMember(teamId, memberId) {
    setBusy(`add-${teamId}-${memberId}`);
    const res = await data.api.addMember(teamId, memberId);
    setBusy(null);
    if (res.error) { toast("error", res.error); return; }
    toast("success", "Member added");
    await onReload();
  }

  async function handleRemoveMember(teamId, memberId, name) {
    if (!window.confirm(`Remove ${name} from this team?`)) return;
    setBusy(`rm-${teamId}-${memberId}`);
    const res = await data.api.removeMember(teamId, memberId);
    setBusy(null);
    if (res.error) { toast("error", res.error); return; }
    toast("success", `${name} removed`);
    await onReload();
  }

  async function handleToggleApproval(teamId, current, name) {
    setBusy(`approve-${teamId}`);
    const res = await data.api.toggleTeamApproval(teamId, !current);
    setBusy(null);
    if (res.error) { toast("error", res.error); return; }
    toast("success", !current ? `"${name}" published` : `"${name}" unpublished`);
    await onReload();
  }

  async function handleMinistryChange(teamId, ministry) {
    setBusy(`min-${teamId}`);
    const res = await data.api.assignMinistry(teamId, ministry || null);
    setBusy(null);
    if (res.error) { toast("error", res.error); return; }
    toast("success", "Ministry updated");
    await onReload();
  }

  async function handleSkillChange(teamId, memberId, skill) {
    const res = await data.api.assignSkill(teamId, memberId, skill || null);
    if (res.error) { toast("error", res.error); return; }
    toast("success", "Skill assigned");
    await onReload();
  }

  async function handleBackfillTeamCodes() {
    if (!window.confirm("This will assign department-based team IDs (e.g. AI&DS#001) to all teams that are missing one or have an old SIH… code. Continue?")) return;
    setBackfilling(true);
    try {
      const res = await data.api.backfillTeamCodes();
      if (res.error) throw new Error(res.error);
      const { updated, skipped, unresolvable } = res.data;
      toast("success", `Backfill complete: ${updated} teams updated, ${skipped} skipped (no dept).`);
      if (unresolvable?.length > 0) {
        console.warn("Teams with no resolvable dept:", unresolvable);
      }
      await onReload();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Backfill failed");
    } finally {
      setBackfilling(false);
    }
  }

  // Members already in any team
  const assignedIds = new Set(teams.flatMap((t) => t.members.map((m) => m.id)));

  // Filtered teams — case-insensitive dept match handles abbreviations like 'AI & DS'
  const allTeamDepts = useMemo(
    () => [...new Set(teams.map((t) => deptToAbbr(t.team.created_by_dept)).filter(Boolean))].sort(),
    [teams]
  );
  const allTeamMinistries = [...new Set(teams.map((t) => t.team.ministry).filter(Boolean))].sort();

  const displayTeams = teams.filter((t) => {
    if (teamDeptFilter) {
      if (deptToAbbr(t.team.created_by_dept ?? "") !== teamDeptFilter) return false;
    }
    if (teamMinistryFilter && t.team.ministry !== teamMinistryFilter) return false;
    if (teamCategoryFilter) {
      const cat = t.team.category || (t.members.length === 1 ? "Solo" : "Pairs");
      if (cat !== teamCategoryFilter) return false;
    }
    if (teamApprovalFilter === "approved" && !t.team.approved) return false;
    if (teamApprovalFilter === "pending" && t.team.approved) return false;
    if (teamSectionFilter) {
      const hasSection = t.members.some((m) => (m.section ?? "").toUpperCase() === teamSectionFilter.toUpperCase());
      if (!hasSection) return false;
    }
    if (teamSearch.trim()) {
      const needle = teamSearch.trim().toLowerCase();
      const haystack = [
        t.team.name, t.team.team_code, t.team.created_by_dept, t.team.ministry,
        ...t.members.map((m) => `${m.name} ${m.register_no ?? ""} ${m.section ?? ""}`),
      ].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });

  const allTeamSections = useMemo(
    () => [...new Set(teams.flatMap((t) => t.members.map((m) => m.section)).filter(Boolean))].sort(),
    [teams]
  );
  const hasTeamFilters = teamSearch || teamDeptFilter || teamMinistryFilter || teamSectionFilter || teamApprovalFilter || teamCategoryFilter;

  const MINISTRIES_LIST = MINISTRIES;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-foreground">Teams</h3>
          <span className="rounded border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {displayTeams.length === teams.length
              ? `${teams.length} total`
              : `${displayTeams.length} of ${teams.length}`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleBackfillTeamCodes}
            disabled={backfilling}
            className="inline-flex items-center gap-1.5 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
            title="Assign dept-based IDs to teams missing them"
          >
            {backfilling ? "Backfilling…" : "Fix Team IDs"}
          </button>
          <button
            type="button"
            onClick={onExport}
            className="inline-flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            <Download className="size-3.5" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded border border-primary/50 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            <Plus className="size-3.5" />
            New Team
          </button>
        </div>
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={teamSearch}
          onChange={(e) => setTeamSearch(e.target.value)}
          placeholder="Search name, ID, member…"
          className="rounded-xl border border-border bg-background/60 px-3.5 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-ring/70 w-44 grow"
        />
        <select
          value={teamDeptFilter}
          onChange={(e) => setTeamDeptFilter(e.target.value)}
          className="rounded-xl border border-border bg-background/60 px-3.5 py-2 text-sm text-foreground outline-none focus:border-ring/70 w-36"
        >
          <option value="">All depts</option>
          {allTeamDepts.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select
          value={teamMinistryFilter}
          onChange={(e) => setTeamMinistryFilter(e.target.value)}
          className="rounded-xl border border-border bg-background/60 px-3.5 py-2 text-sm text-foreground outline-none focus:border-ring/70 w-44"
        >
          <option value="">All ministries</option>
          {allTeamMinistries.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select
          value={teamSectionFilter}
          onChange={(e) => setTeamSectionFilter(e.target.value)}
          className="rounded-xl border border-border bg-background/60 px-3.5 py-2 text-sm text-foreground outline-none focus:border-ring/70 w-28"
        >
          <option value="">All sections</option>
          {allTeamSections.map((s) => (
            <option key={s} value={s}>Sec {s}</option>
          ))}
        </select>
        <select
          value={teamCategoryFilter}
          onChange={(e) => setTeamCategoryFilter(e.target.value)}
          className="rounded-xl border border-border bg-background/60 px-3.5 py-2 text-sm text-foreground outline-none focus:border-ring/70 w-28"
        >
          <option value="">Any type</option>
          <option value="Pairs">Pairs</option>
          <option value="Solo">Solo</option>
        </select>
        <select
          value={teamApprovalFilter}
          onChange={(e) => setTeamApprovalFilter(e.target.value)}
          className="rounded-xl border border-border bg-background/60 px-3.5 py-2 text-sm text-foreground outline-none focus:border-ring/70 w-32"
        >
          <option value="">All status</option>
          <option value="approved">Approved</option>
          <option value="pending">Pending</option>
        </select>
        {hasTeamFilters && (
          <button
            type="button"
            onClick={() => { setTeamSearch(""); setTeamDeptFilter(""); setTeamMinistryFilter(""); setTeamSectionFilter(""); setTeamApprovalFilter(""); setTeamCategoryFilter(""); }}
            className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-xl px-3 py-2 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Create team inline form */}
      {showCreate && (
        <Card className="p-4 border border-border">
          <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
              <label className="text-[11px] font-medium text-muted-foreground uppercase">Team Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. SIH2K26#001"
                required
                className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase">Category</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
              >
                <option value="Pairs">Pairs (2 members)</option>
                <option value="Solo">Solo (1 member)</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={creating}
              className="rounded border border-primary bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {creating ? "Creating…" : "Create"}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </form>
        </Card>
      )}

      {/* Teams list */}
      {teams.length === 0 && (
        <div className="rounded border border-border bg-card px-5 py-12 text-center text-sm text-muted-foreground">
          No teams yet. Create one above.
        </div>
      )}

      <div className="flex flex-col gap-2">
        {displayTeams.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">No teams match your filters.</p>
        )}
        {displayTeams.map((t) => {
          const isExpanded = expandedId === t.team.id;
          const isSolo = (t.team.category || "Pairs") === "Solo";
          const maxMembers = isSolo ? 1 : 2;
          const available = students.filter((s) => !assignedIds.has(s.id));

          return (
            <Card key={t.team.id} className="overflow-hidden border border-border">
              {/* Row header — always visible */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 py-3">
                {/* Expand toggle — takes most space */}
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : t.team.id)}
                  className="flex items-center gap-2 flex-1 min-w-0 text-left hover:text-foreground transition-colors"
                >
                  {isExpanded ? <ChevronUp className="size-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="size-4 shrink-0 text-muted-foreground" />}
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="font-semibold text-sm text-foreground truncate">
                      {t.team.team_code ?? t.team.name}
                    </span>
                    {t.team.team_code && t.team.name !== t.team.team_code && (
                      <span className="text-[11px] text-muted-foreground truncate hidden sm:block">{t.team.name}</span>
                    )}
                    <span className={cn("shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border",
                      isSolo ? "border-blue-500/40 bg-blue-500/10 text-blue-400" : "border-primary/40 bg-primary/10 text-primary")}>
                      {isSolo ? "Solo" : "Pairs"}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{t.members.length}/{maxMembers}</span>
                </button>

                {/* Action buttons row */}
                <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                  {t.stats.valid ? (
                    <span className="text-[10px] font-semibold rounded border border-success/40 bg-success/10 px-2 py-0.5 text-success">Valid</span>
                  ) : (
                    <span className="text-[10px] font-semibold rounded border border-warning/40 bg-warning/10 px-2 py-0.5 text-warning" title={t.stats.reason}>Invalid</span>
                  )}
                  {t.team.approved ? (
                    <span className="text-[10px] font-semibold rounded border border-success/40 bg-success/10 px-2 py-0.5 text-success">Published</span>
                  ) : (
                    <span className="text-[10px] font-semibold rounded border border-border px-2 py-0.5 text-muted-foreground">Draft</span>
                  )}
                  <button
                    type="button"
                    disabled={busy === `approve-${t.team.id}`}
                    onClick={() => handleToggleApproval(t.team.id, t.team.approved, t.team.name)}
                    className={cn(
                      "text-[10px] font-medium px-2.5 py-1 rounded border transition-colors disabled:opacity-50",
                      t.team.approved
                        ? "border-warning/40 bg-warning/10 text-warning hover:bg-warning/20"
                        : "border-success/40 bg-success/10 text-success hover:bg-success/20"
                    )}
                  >
                    {t.team.approved ? "Unpublish" : "Publish"}
                  </button>
                  <button
                    type="button"
                    disabled={deleting === t.team.id}
                    onClick={() => onDelete(t)}
                    className={cn(
                      "inline-flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded border transition-colors disabled:opacity-50",
                      t.members.length > 0
                        ? "border-danger/50 bg-danger/10 text-danger hover:bg-danger hover:text-white"
                        : "border-border text-muted-foreground hover:border-danger/50 hover:text-danger"
                    )}
                  >
                    <Trash2 className="size-3" />
                    {deleting === t.team.id ? "…" : t.members.length > 0 ? `Del (${t.members.length})` : "Delete"}
                  </button>
                </div>
              </div>

              {/* Expanded panel */}
              {isExpanded && (
                <div className="border-t border-border px-4 py-4 flex flex-col gap-4 bg-card/60">

                  {/* Ministry */}
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase w-20 shrink-0">Ministry</label>
                    <select
                      value={t.team.ministry || ""}
                      disabled={busy === `min-${t.team.id}`}
                      onChange={(e) => handleMinistryChange(t.team.id, e.target.value)}
                      className="flex-1 min-w-[200px] rounded border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none disabled:opacity-50"
                    >
                      <option value="">— No Ministry —</option>
                      {/* If team already has an outdated/non-standard ministry, show it as a legacy option */}
                      {t.team.ministry && (OUTDATED_MINISTRIES.has(t.team.ministry) || !MINISTRIES_LIST.includes(t.team.ministry)) && (
                        <option key={`legacy-${t.team.ministry}`} value={t.team.ministry}>
                          {OUTDATED_MINISTRIES.has(t.team.ministry) ? `⚠ ${t.team.ministry} (Outdated — reassign)` : t.team.ministry}
                        </option>
                      )}
                      {MINISTRIES_LIST.filter((m) => !OUTDATED_MINISTRIES.has(m)).map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <OutdatedMinistryBadge ministry={t.team.ministry} />
                    <NewMinistryBadge ministry={t.team.ministry} />
                  </div>

                  {/* Current members */}
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase mb-2">
                      Members ({t.members.length}/{maxMembers})
                    </p>
                    {t.members.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No members yet</p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {t.members.map((m) => (
                          <div key={m.id} className="flex flex-col sm:flex-row sm:items-center gap-2 rounded border border-border bg-background px-3 py-2">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Avatar name={m.name} className="size-6 text-[8px] shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-foreground truncate">{m.name}</p>
                                <p className="text-[10px] text-muted-foreground truncate">{m.register_no} · {m.department}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              {/* Skill selector */}
                              <select
                                defaultValue={m.assigned_skill || ""}
                                onChange={(e) => handleSkillChange(t.team.id, m.id, e.target.value)}
                                className="flex-1 min-w-[120px] text-[10px] rounded border border-border bg-card px-2 py-1 text-foreground focus:border-primary focus:outline-none"
                              >
                                <option value="">— Skill —</option>
                                {["Frontend Developer","Backend Developer","Full Stack Developer","AI/ML Engineer",
                                  "IoT & Hardware Engineer","Cloud/DevOps Engineer","UI/UX Designer","Cybersecurity",
                                  "Embedded Systems","Mobile App Developer","Data Analyst","Others"].map((s) => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                              {m.assigned_skill && (
                                <span className="text-[10px] font-semibold text-primary border border-primary/30 bg-primary/10 rounded px-2 py-0.5 shrink-0 truncate max-w-[120px]">
                                  {m.assigned_skill}
                                </span>
                              )}
                              <button
                                type="button"
                                disabled={busy === `rm-${t.team.id}-${m.id}`}
                                onClick={() => handleRemoveMember(t.team.id, m.id, m.name)}
                                className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded border border-danger/40 bg-danger/10 text-danger hover:bg-danger hover:text-white transition-colors disabled:opacity-50 shrink-0"
                              >
                                <UserMinus className="size-3" />
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Add member */}
                  {t.members.length < maxMembers && (
                    <div>
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase mb-2">Add Member</p>
                      {available.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">No unassigned students available</p>
                      ) : (
                        <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                          {available.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              disabled={busy === `add-${t.team.id}-${s.id}`}
                              onClick={() => handleAddMember(t.team.id, s.id)}
                              className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded border border-border bg-card text-foreground hover:border-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                            >
                              <UserPlus className="size-3 shrink-0" />
                              {s.name}
                              <span className="text-muted-foreground text-[9px]">{s.register_no}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
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
  const [showPw, setShowPw] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setBusy(true);
    try {
      const res = await data.loginAdmin(email.trim(), password.trim());
      if (res.error) throw new Error(res.error);
      toast("success", `Welcome back, ${res.data.profile.name}!`);
      onLoginSuccess();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">

        {/* Logo + title */}
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <CollegeBrand />
          <div>
            <h1 className="mt-2 text-xl font-semibold text-foreground">Admin Panel</h1>
            <p className="text-sm text-muted-foreground mt-1">SIH 2026 · SMVEC Internal Portal</p>
          </div>
        </div>

        {/* Login card */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground mb-4">Sign in to your account</h2>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="admin-email">
                Email address
              </label>
              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@smvec.ac.in"
                required
                autoComplete="username"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="admin-password">
                Password
              </label>
              <div className="relative">
                <input
                  id="admin-password"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? (
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="mt-1 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
            >
              {busy && <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <a href="/" className="hover:text-foreground transition-colors">← Back to main site</a>
        </p>
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
