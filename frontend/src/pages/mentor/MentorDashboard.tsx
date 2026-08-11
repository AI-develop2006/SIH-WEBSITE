"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase/client";
import * as data from "@/lib/data";
import type { EnrichedTeam, Problem, Profile } from "@/lib/types";
import { useToast } from "@/components/unlumen-ui/toast";
import { Button } from "@/components/unlumen-ui/button";
import { CollegeBrand } from "@/components/college-brand";
import { cn } from "@/lib/utils";

// Sub-components
import { OverviewTab } from "./components/OverviewTab";
import { RosterTab } from "./components/RosterTab";
import { TeamsTab } from "./components/TeamsTab";
import { ProblemsTab } from "./components/ProblemsTab";
import { CreateTeamModal } from "./components/CreateTeamModal";
import { AssignStudentModal } from "./components/AssignStudentModal";

type Tab = "home" | "students" | "teams" | "problems";

export default function MentorDashboardPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [tab, setTab] = useState<Tab>("home");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [teams, setTeams] = useState<EnrichedTeam[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Mentor Info
  const [mentorDomain, setMentorDomain] = useState<string>("Software");
  const [mentorDept, setMentorDept] = useState<string>("");
  const [mentorName, setMentorName] = useState<string>("");

  // Roster Filters
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("");
  const [gender, setGender] = useState("");
  const [projType, setProjType] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState("all");
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);

  // Focused Team (for card-click scrolling)
  const [focusedTeamId, setFocusedTeamId] = useState<string | null>(null);

  // Assign Student Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Profile | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [busyAssign, setBusyAssign] = useState(false);

  // Create Team Modal
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);

  // Reload action
  const [refreshCount, setRefreshCount] = useState(0);
  const [announcement, setAnnouncement] = useState<any>(null);

  const load = useCallback(async () => {
    const [profilesRes, teamsRes, problemsRes, announcementsRes] = await Promise.all([
      data.fetchAllProfiles(),
      data.fetchEnrichedTeams(),
      data.fetchProblems(),
      data.fetchAnnouncements(),
    ]);

    if (profilesRes.error) toast("error", profilesRes.error);
    if (teamsRes.error) toast("error", teamsRes.error);
    if (problemsRes.error) toast("error", problemsRes.error);

    setProfiles(profilesRes.data ?? []);
    setTeams(teamsRes.data ?? []);
    setProblems(problemsRes.data ?? []);

    if (announcementsRes.data) {
      const active = announcementsRes.data.find(
        (a: any) => a.active && (a.target === "mentor" || a.target === "all")
      );
      setAnnouncement(active ?? null);
    }
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
      if (!me || me.role !== "mentor") {
        toast("error", "Mentors only");
        navigate("/", { replace: true });
        return;
      }
      setMentorDomain(me.domain ?? "Software");
      setMentorDept(me.department ?? "");
      setMentorName(me.name ?? "Mentor");
      setIsAuthenticated(true);
      await load();
      setLoading(false);
    })();
  }, [navigate, toast, load, refreshCount]);

  const problemMap = useMemo(() => new Map(problems.map((p) => [p.id, p.title])), [problems]);

  // Set of students already in a team
  const studentsInTeams = useMemo(() => {
    const set = new Set<string>();
    teams.forEach((t) => {
      if (t.team.leader_id) set.add(t.team.leader_id);
      t.members.forEach((m) => set.add(m.id));
    });
    return set;
  }, [teams]);

  // Students list after filtering
  const students = useMemo(() => {
    const list = profiles.filter((p) => p.role === "student");
    const needle = q.trim().toLowerCase();

    return list.filter((p) => {
      const isAssigned = studentsInTeams.has(p.id);

      // Availability Filter
      if (availabilityFilter === "available" && isAssigned) return false;
      if (availabilityFilter === "assigned" && !isAssigned) return false;

      // Department Filter
      if (dept && p.department !== dept) return false;

      // Gender Filter
      if (gender && p.gender !== gender) return false;

      // Project Type Filter
      if (projType && p.project_type !== projType) return false;

      // Domain Interests checkbox Filter
      if (selectedDomains.length > 0) {
        const interests = p.domain_interests || [];
        const matches = selectedDomains.some((d) => interests.includes(d));
        if (!matches) return false;
      }

      // Keyword Search
      if (!needle) return true;
      const hay = [
        p.name,
        p.register_no,
        p.email,
        p.phone,
        p.project_title,
        p.project_description,
      ]
        .filter(Boolean)
        .map((s) => s!.toLowerCase());
      return hay.some((s) => s.includes(needle));
    });
  }, [profiles, q, dept, gender, projType, availabilityFilter, selectedDomains, studentsInTeams]);

  // Total unassigned student count
  const unassignedCount = useMemo(() => {
    const totalStudents = profiles.filter((p) => p.role === "student").length;
    return Math.max(0, totalStudents - studentsInTeams.size);
  }, [profiles, studentsInTeams]);

  async function handleAssignSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStudent) return;
    if (!selectedTeamId) {
      toast("error", "Please select a team.");
      return;
    }

    const targetTeam = teams.find((t) => t.team.id === selectedTeamId);
    if (targetTeam) {
      const isMaleStudent = selectedStudent.gender !== "Female";
      const totalMembers = targetTeam.members.length;
      const femaleCount = targetTeam.stats.girlCount;

      // Gender Blocker Check
      if (isMaleStudent && femaleCount === 0 && totalMembers >= 4) {
        toast(
          "error",
          `Rule Restriction: This team has ${totalMembers} male members and 0 female members. The remaining slots must be reserved for female students to meet the SIH diversity constraint.`
        );
        return;
      }

      // Department Blocker Check
      const depts = new Set(targetTeam.members.map((m) => m.department).filter(Boolean));
      if (totalMembers === 5 && depts.size === 1 && depts.has(selectedStudent.department)) {
        toast(
          "error",
          `Rule Restriction: All 5 existing members are from the "${selectedStudent.department}" department. The final member must be from a different department to meet the SIH inter-department constraint.`
        );
        return;
      }
    }

    setBusyAssign(true);
    try {
      const res = await data.api.addMemberDirectMentor(selectedTeamId, selectedStudent.id);
      if (res.error) throw new Error(res.error);
      if (res.data) {
        toast("info", `⚠️ Constraint Alert: ${res.data}`);
      } else {
        toast("success", `${selectedStudent.name} successfully added to team!`);
      }
      setShowAddModal(false);
      setSelectedStudent(null);
      setSelectedTeamId("");
      setRefreshCount((c) => c + 1);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Assignment failed");
    } finally {
      setBusyAssign(false);
    }
  }

  async function handleCreateTeamDirectSubmit() {
    setBusyAssign(true);
    const generatedName = `SIH2K26#${String(teams.length + 1).padStart(3, "0")}`;

    try {
      const res = await data.api.createEmptyTeamMentor(generatedName);
      if (res.error) throw new Error(res.error);

      setRefreshCount((c) => c + 1);
      toast("success", `Team ${generatedName} created successfully!`);

      setShowCreateTeamModal(false);
      setTab("teams");

      setTimeout(async () => {
        const updatedTeams = await data.fetchEnrichedTeams();
        if (updatedTeams.data) {
          const matchingTeam = updatedTeams.data.find((t) => t.team.name === generatedName);
          if (matchingTeam) {
            setFocusedTeamId(matchingTeam.team.id);
            const el = document.getElementById(`team-card-${matchingTeam.team.id}`);
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          }
        }
      }, 300);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to create team");
    } finally {
      setBusyAssign(false);
    }
  }

  async function removeMember(teamId: string, memberId: string, name: string) {
    if (!confirm(`Are you sure you want to remove ${name} from this team?`)) return;
    try {
      const res = await data.api.removeMemberDirectMentor(teamId, memberId);
      if (res.error) throw new Error(res.error);
      toast("success", `${name} removed successfully.`);
      setRefreshCount((c) => c + 1);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to remove member");
    }
  }

  async function deleteTeam(teamId: string, name: string) {
    if (
      !confirm(
        `Are you sure you want to delete ${name}? This will return all members to unassigned status.`
      )
    )
      return;
    try {
      const res = await data.api.deleteTeam(teamId);
      if (res.error) throw new Error(res.error);
      toast("success", "Team deleted successfully.");
      setRefreshCount((c) => c + 1);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to delete team");
    }
  }

  function handleTeamCardClick(teamId: string) {
    setFocusedTeamId(teamId);
    setTab("teams");
    setTimeout(() => {
      const el = document.getElementById(`team-card-${teamId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 150);
  }

  async function logout() {
    await supabase!.auth.signOut();
    navigate("/", { replace: true });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground bg-[#06090f]">
        Loading Mentor Workspace…
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <main className="mx-auto flex flex-col min-h-screen w-full max-w-[1536px] px-5 pb-16 bg-[#06090f] text-white">
      {/* Mentor Header */}
      <header className="sticky top-0 z-40 -mx-5 mb-6 border-b border-border bg-[#06090f]/80 px-5 backdrop-blur">
        <div className="flex h-16 items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CollegeBrand />
            <div className="leading-tight">
              <p className="text-sm font-bold tracking-tight">Mentor Portal — {mentorName}</p>
              <p className="text-xs text-muted-foreground">
                Domain: <span className="text-[#c9a227] font-semibold">{mentorDomain}</span> ·{" "}
                {mentorDept || "All Departments"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={logout} className="text-xs text-[#c9a227] hover:bg-[#c9a227]/10">
              Log out
            </Button>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="mb-6 flex flex-wrap gap-2 border-b border-border/40 pb-4">
        {([
          { key: "home", label: "Home Overview" },
          { key: "students", label: "Student Roster" },
          { key: "teams", label: "Teams Builder" },
          { key: "problems", label: "Problem Statements" },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-300 capitalize",
              tab === t.key
                ? "bg-[#c9a227] text-black font-bold shadow-lg shadow-[#c9a227]/20"
                : "text-muted-foreground hover:bg-muted/20 hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Active Announcement (if any) */}
      {announcement && (
        <div className="mb-6 rounded-2xl border border-[rgba(201,162,39,0.30)] bg-card/60 backdrop-blur-xl p-5 overflow-hidden shadow-[0_0_30px_rgba(201,162,39,0.08)] relative">
          <div className="absolute -right-10 -top-10 size-40 bg-[#c9a227]/5 rounded-full blur-3xl pointer-events-none" />
          <div className="flex items-start gap-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[rgba(201,162,39,0.12)] text-[#e8c058] shadow-[0_0_15px_rgba(201,162,39,0.2)] animate-pulse">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </span>
            <div>
              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-[#e8c058] bg-[#c9a227]/10 px-2 py-0.5 rounded-md border border-[#c9a227]/20">
                Latest Coordinator Announcement
              </span>
              <p className="mt-2 text-sm text-white/95 leading-relaxed font-semibold whitespace-pre-wrap font-sans">
                {announcement.content}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab Pages */}
      {tab === "home" && (
        <OverviewTab
          profiles={profiles}
          teams={teams}
          unassignedCount={unassignedCount}
          handleTeamCardClick={handleTeamCardClick}
          setShowCreateTeamModal={setShowCreateTeamModal}
        />
      )}

      {tab === "students" && (
        <RosterTab
          students={students}
          studentsInTeams={studentsInTeams}
          q={q}
          setQ={setQ}
          availabilityFilter={availabilityFilter}
          setAvailabilityFilter={setAvailabilityFilter}
          dept={dept}
          setDept={setDept}
          gender={gender}
          setGender={setGender}
          projType={projType}
          setProjType={setProjType}
          selectedDomains={selectedDomains}
          setSelectedDomains={setSelectedDomains}
          showFilterDrawer={showFilterDrawer}
          setShowFilterDrawer={setShowFilterDrawer}
          setSelectedStudent={setSelectedStudent}
          setShowAddModal={setShowAddModal}
          toast={toast}
        />
      )}

      {tab === "teams" && (
        <TeamsTab
          teams={teams}
          focusedTeamId={focusedTeamId}
          problemMap={problemMap}
          removeMember={removeMember}
          deleteTeam={deleteTeam}
        />
      )}

      {tab === "problems" && <ProblemsTab problems={problems} />}

      {/* Create Team Modal */}
      <CreateTeamModal
        showCreateTeamModal={showCreateTeamModal}
        setShowCreateTeamModal={setShowCreateTeamModal}
        teamsCount={teams.length}
        busyAssign={busyAssign}
        handleCreateTeamDirectSubmit={handleCreateTeamDirectSubmit}
      />

      {/* Assign Student Modal */}
      <AssignStudentModal
        showAddModal={showAddModal}
        setShowAddModal={setShowAddModal}
        selectedStudent={selectedStudent}
        setSelectedStudent={setSelectedStudent}
        teams={teams}
        selectedTeamId={selectedTeamId}
        setSelectedTeamId={setSelectedTeamId}
        busyAssign={busyAssign}
        handleAssignSubmit={handleAssignSubmit}
        setTab={setTab}
      />
    </main>
  );
}
