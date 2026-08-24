"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as data from "@/lib/data";
import { useToast } from "@/components/unlumen-ui/toast";
import { Button } from "@/components/unlumen-ui/button";
import { CollegeBrand } from "@/components/common/college-brand";
import { cn, computeStats, isSameDepartment } from "@/lib/utils";
import { DEPT_CODE } from "@/lib/constants";

// Sub-components
import { FormattedAnnouncement } from "@/components/common/FormattedAnnouncement";
import { OverviewTab } from "./components/OverviewTab";
import { RosterTab } from "./components/RosterTab";
import { TeamsTab } from "./components/TeamsTab";
import { ProblemsTab } from "./components/ProblemsTab";
import { PairedTeamsOverallTab } from "./components/PairedTeamsOverallTab";
import { CreateTeamModal } from "./components/CreateTeamModal";
import { AssignStudentModal } from "./components/AssignStudentModal";
import { EditProfileModal } from "./components/EditProfileModal";

export default function MentorDashboardPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [tab, setTab] = useState("home");
  const [profiles, setProfiles] = useState([]);
  const [teams, setTeams] = useState([]);
  const [problems, setProblems] = useState([]);
  const [ministrySeats, setMinistrySeats] = useState({});
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Mentor Info
  const [mentorDomain, setMentorDomain] = useState("Software");
  const [mentorDept, setMentorDept] = useState("");
  const [mentorName, setMentorName] = useState("");

  // Roster Filters
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("");
  const [gender, setGender] = useState("");
  const [projType, setProjType] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState("all");
  const [selectedDomains, setSelectedDomains] = useState([]);
  const [yearFilter, setYearFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);

  // Focused Team (for card-click scrolling)
  const [focusedTeamId, setFocusedTeamId] = useState(null);

  // Assign Student Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [busyAssign, setBusyAssign] = useState(false);

  // Edit Profile Modal
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
    phone: "",
    domain: "Software",
    department: "",
  });

  // ── Ministry seat cap state ─────────────────────────────────────────────────
  // seatAlerts: [{ ministry, cap, usage, prevCap }] — ministries where the admin
  //   recently raised this mentor's dept cap; shown as notification badges.
  const [seatAlerts, setSeatAlerts] = useState([]);
  const prevSeatsRef = useRef({});

  // Create Team Modal
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);

  // Reload action
  const [refreshCount, setRefreshCount] = useState(0);
  const [announcement, setAnnouncement] = useState(null);

  // ─── Data Loading ────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    const [profilesRes, teamsRes, problemsRes, announcementsRes, seatsRes] = await Promise.all([
      data.fetchAllProfiles(),
      data.fetchEnrichedTeams(),
      data.fetchProblems(),
      data.fetchAnnouncements(),
      data.fetchMinistrySeats(),
    ]);

    if (profilesRes.error) toast("error", profilesRes.error);
    if (teamsRes.error) toast("error", teamsRes.error);
    if (problemsRes.error) toast("error", problemsRes.error);

    setProfiles(profilesRes.data ?? []);
    const rawTeams = teamsRes.data ?? [];
    setTeams(
      rawTeams.map((t) => ({
        ...t,
        stats: computeStats(
          t.members,
          t.team?.category || (t.members.length === 1 ? "Solo" : "Pairs")
        ),
      }))
    );
    setProblems(problemsRes.data ?? []);
    setMinistrySeats(seatsRes.data ?? {});

    if (announcementsRes.data) {
      const active = announcementsRes.data.find(
        (a) => a.active && (a.target === "mentor" || a.target === "all")
      );
      setAnnouncement(active ?? null);
    }
  }, [toast]);

  // Lightweight refresh — only re-fetches teams
  const refreshTeams = useCallback(async () => {
    const { data: rawTeams, error } = await data.fetchEnrichedTeams();
    if (error) return;
    setTeams(
      (rawTeams ?? []).map((t) => ({
        ...t,
        stats: computeStats(
          t.members,
          t.team?.category || (t.members.length === 1 ? "Solo" : "Pairs")
        ),
      }))
    );
  }, []);

  // Initial auth + full load
  useEffect(() => {
    (async () => {
      try {
        const { data: me, error } = await data.getCurrentProfile();
        if (error || !me || me.role !== "mentor") {
          toast("error", "Mentors only");
          navigate("/", { replace: true });
          return;
        }
        setMentorDomain(me.domain ?? "Software");
        setMentorDept(me.department ?? "");
        setMentorName(me.name ?? "Mentor");

        const isDummyEmail =
          me.email &&
          me.email.includes("@smvec.ac.in") &&
          me.email.replace("@smvec.ac.in", "").trim() === (me.phone || "").trim();
        setProfileForm({
          name: me.name ?? "",
          email: isDummyEmail ? "" : (me.email ?? ""),
          phone: me.phone ?? "",
          domain: me.domain ?? "Software",
          department: me.department ?? "",
        });

        setIsAuthenticated(true);
        await loadData();
      } catch (err) {
        setIsAuthenticated(false);
        navigate("/", { replace: true });
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate, toast, loadData]);

  // Background sync — teams only
  useEffect(() => {
    if (refreshCount === 0) return;
    refreshTeams();
  }, [refreshCount, refreshTeams]);

  // ── Ministry seat polling: detect changes and alert mentor ───────────────────
  // Polls every 20s. If a cap for this mentor's dept was RAISED, shows a toast
  // and adds it to seatAlerts so the OverviewTab can display it prominently.
  useEffect(() => {
    if (!mentorDept) return; // wait until dept is known

    async function checkSeats(isFirstRun = false) {
      const { data: seats } = await data.fetchMinistrySeats();
      if (!seats) return;

      const prev = prevSeatsRef.current;
      const DEFAULT_CAP = 6;

      if (!isFirstRun) {
        // Find ministries where the cap for this dept was raised
        const raised = [];
        const allKeys = new Set([...Object.keys(prev), ...Object.keys(seats)]);
        for (const key of allKeys) {
          if (!key.endsWith(`|||${mentorDept}`)) continue;
          const prevCap = prev[key] ?? DEFAULT_CAP;
          const newCap  = seats[key] ?? DEFAULT_CAP;
          if (newCap > prevCap) {
            const ministry = key.split("|||")[0];
            raised.push({ ministry, cap: newCap, prevCap });
          }
        }

        if (raised.length > 0) {
          // Toast notification for each raised ministry
          raised.forEach(({ ministry, cap, prevCap }) => {
            toast(
              "success",
              `🎉 Seats increased for "${ministry}" — ${mentorDept} now has ${cap} slots (was ${prevCap}). You can add more students!`
            );
          });

          // Also fetch current usage for those ministries and add to seatAlerts
          const { data: deptData } = await data.fetchMinistrySeatsForDept(mentorDept);
          const usageMap = {};
          for (const row of deptData ?? []) usageMap[row.ministry] = row;

          setSeatAlerts((prev) => {
            const next = [...prev];
            for (const r of raised) {
              const usage = usageMap[r.ministry]?.usage ?? 0;
              const existing = next.findIndex((a) => a.ministry === r.ministry);
              const entry = { ministry: r.ministry, cap: r.cap, usage, prevCap: r.prevCap };
              if (existing >= 0) next[existing] = entry;
              else next.push(entry);
            }
            return next;
          });
        }
      }

      prevSeatsRef.current = seats;
      setMinistrySeats(seats);
    }

    // Run once immediately on mount (isFirstRun=true so no alerts)
    checkSeats(true);

    // Then poll every 20s
    const interval = setInterval(() => checkSeats(false), 20_000);
    return () => clearInterval(interval);
  }, [mentorDept, toast]);

  // ─── Derived State ───────────────────────────────────────────────────────────

  const problemMap = useMemo(
    () => new Map(problems.map((p) => [p.id, p.title])),
    [problems]
  );

  const studentsInTeams = useMemo(() => {
    const set = new Set();
    teams.forEach((t) => {
      if (t.team.leader_id) set.add(t.team.leader_id);
      (t.members || []).forEach((m) => set.add(m.id));
    });
    return set;
  }, [teams]);

  const students = useMemo(() => {
    const list = profiles.filter((p) => p.role === "student");
    const needle = q.trim().toLowerCase();
    return list.filter((p) => {
      const isAssigned = studentsInTeams.has(p.id);
      if (availabilityFilter === "available" && isAssigned) return false;
      if (availabilityFilter === "assigned" && !isAssigned) return false;
      if (dept && p.department !== dept) return false;
      if (gender && p.gender !== gender) return false;
      if (projType && p.project_type !== projType) return false;
      if (yearFilter && p.year !== yearFilter) return false;
      if (sectionFilter && (p.section ?? "").toUpperCase() !== sectionFilter.toUpperCase()) return false;
      if (selectedDomains.length > 0) {
        const interests = p.domain_interests || [];
        if (!selectedDomains.some((d) => interests.includes(d))) return false;
      }
      if (!needle) return true;
      const hay = [p.name, p.register_no, p.email, p.phone, p.project_title, p.project_description]
        .filter(Boolean)
        .map((s) => s.toLowerCase());
      return hay.some((s) => s.includes(needle));
    });
  }, [profiles, q, dept, gender, projType, yearFilter, sectionFilter, availabilityFilter, selectedDomains, studentsInTeams]);

  const totalStudents = useMemo(
    () => profiles.filter((p) => p.role === "student").length,
    [profiles]
  );

  const unassignedCount = useMemo(() => {
    return Math.max(0, totalStudents - studentsInTeams.size);
  }, [totalStudents, studentsInTeams]);

  const availableStudents = useMemo(
    () => profiles.filter((p) => p.role === "student" && !studentsInTeams.has(p.id)),
    [profiles, studentsInTeams]
  );

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const handleAssignSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!selectedStudent) return;
    if (!selectedTeamId) {
      toast("error", "Please select a team.");
      return;
    }

    if (
      mentorDept &&
      selectedStudent.department &&
      !isSameDepartment(selectedStudent.department, mentorDept)
    ) {
      toast(
        "error",
        `Department mismatch: You can only assign students from your department (${mentorDept}). ${selectedStudent.name} belongs to ${selectedStudent.department}.`
      );
      return;
    }

    const targetTeam = teams.find((t) => t.team.id === selectedTeamId);
    if (targetTeam) {
      const isSolo =
        (targetTeam.team.category ||
          (targetTeam.members.length === 1 ? "Solo" : "Pairs")) === "Solo";
      const maxMembers = isSolo ? 1 : 2;

      if (targetTeam.members.length >= maxMembers) {
        toast(
          "error",
          isSolo
            ? "Solo entries can only have 1 member."
            : "Team size limit reached: A team can have a maximum of 2 members."
        );
        return;
      }
      if (!isSolo && targetTeam.members.length === 1) {
        const existingMember = targetTeam.members[0];
        if (
          existingMember.department &&
          selectedStudent.department &&
          !isSameDepartment(existingMember.department, selectedStudent.department)
        ) {
          toast("error", "Department mismatch: Both team members must be from the same department.");
          return;
        }
      }
    }

    setBusyAssign(true);
    try {
      const res = await data.api.addMemberDirectMentor(selectedTeamId, selectedStudent.id);
      if (res.error) throw new Error(res.error);

      setTeams((prev) =>
        prev.map((t) => {
          if (t.team.id !== selectedTeamId) return t;
          const updatedMembers = [...t.members, selectedStudent];
          const category = t.team.category || (updatedMembers.length === 1 ? "Solo" : "Pairs");
          return {
            ...t,
            team: { ...t.team, leader_id: t.team.leader_id ?? selectedStudent.id },
            members: updatedMembers,
            stats: computeStats(updatedMembers, category),
          };
        })
      );

      toast("success", `Assigned ${selectedStudent.name} successfully!`);
      setShowAddModal(false);
      setSelectedStudent(null);
      setSelectedTeamId("");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Assignment failed");
      setRefreshCount((c) => c + 1);
    } finally {
      setBusyAssign(false);
    }
  }, [selectedStudent, selectedTeamId, mentorDept, teams, toast]);

  const handleCreateTeamDirectSubmit = useCallback(async (customName, category = "Pairs") => {
    const finalName = customName?.trim();
    if (!finalName) {
      toast("error", "Team name is required. Please enter a name for your team.");
      return;
    }

    setBusyAssign(true);

    try {
      const res = await data.api.createEmptyTeamMentor(finalName, category, mentorDept || null);
      if (res.error) throw new Error(res.error);

      if (res.data) {
        setTeams((prev) => [
          ...prev,
          { team: res.data, leader: null, members: [], stats: computeStats([], category) },
        ]);
      }

      setShowCreateTeamModal(false);
      setTab("teams");
      toast(
        "success",
        `${category === "Solo" ? "Solo Entry" : "Team"} "${finalName}" created successfully! Now explore student profiles in Roster tab to assign a member.`
      );
      setRefreshCount((c) => c + 1);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to create entry/team");
    } finally {
      setBusyAssign(false);
    }
  }, [mentorDept, toast]);

  const assignMemberSkill = useCallback(async (teamId, memberId, skill) => {
    const prevSkill =
      teams.find((t) => t.team.id === teamId)?.members.find((m) => m.id === memberId)
        ?.assigned_skill ?? null;

    setTeams((prev) =>
      prev.map((t) =>
        t.team.id !== teamId
          ? t
          : { ...t, members: t.members.map((m) => (m.id === memberId ? { ...m, assigned_skill: skill || null } : m)) }
      )
    );

    const res = await data.api.assignMemberSkill(teamId, memberId, skill);
    if (res.error) {
      setTeams((prev) =>
        prev.map((t) =>
          t.team.id !== teamId
            ? t
            : { ...t, members: t.members.map((m) => (m.id === memberId ? { ...m, assigned_skill: prevSkill } : m)) }
        )
      );
      toast("error", res.error);
    }
  }, [teams, toast]);

  const assignTeamMinistry = useCallback(async (teamId, ministry) => {
    const prevMinistry = teams.find((t) => t.team.id === teamId)?.team.ministry ?? null;

    setTeams((prev) =>
      prev.map((t) =>
        t.team.id !== teamId ? t : { ...t, team: { ...t.team, ministry: ministry || null } }
      )
    );

    const res = await data.api.assignTeamMinistry(teamId, ministry);
    if (res.error) {
      setTeams((prev) =>
        prev.map((t) =>
          t.team.id !== teamId ? t : { ...t, team: { ...t.team, ministry: prevMinistry } }
        )
      );
      toast("error", res.error);
    }
  }, [teams, toast]);

  const renameTeam = useCallback(async (teamId, newName) => {
    const prevName = teams.find((t) => t.team.id === teamId)?.team.name ?? "";
    setTeams((prev) =>
      prev.map((t) =>
        t.team.id !== teamId ? t : { ...t, team: { ...t.team, name: newName } }
      )
    );
    const res = await data.api.renameTeam(teamId, newName);
    if (res.error) {
      setTeams((prev) =>
        prev.map((t) =>
          t.team.id !== teamId ? t : { ...t, team: { ...t.team, name: prevName } }
        )
      );
      toast("error", res.error);
    }
  }, [teams, toast]);

  const removeMember = useCallback(async (teamId, memberId, name) => {
    if (!confirm(`Are you sure you want to remove ${name} from this team?`)) return;
    try {
      const res = await data.api.removeMemberDirectMentor(teamId, memberId);
      if (res.error) throw new Error(res.error);

      setTeams((prev) =>
        prev.map((t) => {
          if (t.team.id !== teamId) return t;
          const updatedMembers = t.members.filter((m) => m.id !== memberId);
          const category = t.team.category || (updatedMembers.length === 1 ? "Solo" : "Pairs");
          const newLeaderId =
            t.team.leader_id === memberId ? (updatedMembers[0]?.id ?? null) : t.team.leader_id;
          return {
            ...t,
            team: { ...t.team, leader_id: newLeaderId },
            members: updatedMembers,
            stats: computeStats(updatedMembers, category),
          };
        })
      );

      toast("success", `${name} removed successfully.`);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to remove member");
      setRefreshCount((c) => c + 1);
    }
  }, [toast]);

  const deleteTeam = useCallback(async (teamId, name, memberCount = 0) => {
    if (memberCount > 0) {
      toast("error", "You cannot delete a team with active members. Please remove all members first.");
      return;
    }
    if (!confirm(`Are you sure you want to delete empty team ${name}?`)) return;
    try {
      const res = await data.api.deleteTeam(teamId);
      if (res.error) throw new Error(res.error);
      setTeams((prev) => prev.filter((t) => t.team.id !== teamId));
      toast("success", `Empty team ${name} deleted successfully.`);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to delete team");
      setRefreshCount((c) => c + 1);
    }
  }, [toast]);

  const handleProfileSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!profileForm.name.trim()) {
      toast("error", "Name is required");
      return;
    }
    setBusyAssign(true);
    try {
      const { data: me } = await data.getCurrentProfile();
      if (!me) throw new Error("Could not retrieve current profile");

      let targetEmail = profileForm.email.trim();
      if (!targetEmail) targetEmail = `${profileForm.phone.trim()}@smvec.ac.in`;

      const payload = {
        name: profileForm.name.trim(),
        email: targetEmail,
        domain: profileForm.domain,
        department: profileForm.department || null,
        phone: profileForm.phone.trim(),
      };

      const { error } = await data.updateProfile(me.id, payload);
      if (error) throw new Error(error);

      setMentorName(payload.name);
      setMentorDomain(payload.domain);
      setMentorDept(payload.department ?? "");
      toast("success", "Profile updated successfully!");
      setShowProfileModal(false);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setBusyAssign(false);
    }
  }, [profileForm, toast]);

  const handleTeamCardClick = useCallback((teamId) => {
    setFocusedTeamId(teamId);
    setTab("teams");
    setTimeout(() => {
      document.getElementById(`team-card-${teamId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
  }, []);

  const logout = useCallback(async () => {
    await data.logoutUser();
    navigate("/", { replace: true });
  }, [navigate]);

  // ─── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground bg-[#06090f]">
        Loading Mentor Workspace…
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const TABS = [
    { key: "home", label: "Home Overview", shortLabel: "Home" },
    { key: "students", label: "Student Roster", shortLabel: "Roster" },
    { key: "teams", label: "Teams Builder", shortLabel: "Teams" },
    { key: "paired-overall", label: "Paired Teams Overall", shortLabel: "All Teams" },
    { key: "problems", label: "Problem Statements", shortLabel: "Problems" },
  ];

  return (
    <main className="mx-auto flex flex-col min-h-screen w-full max-w-[1536px] px-4 sm:px-5 pb-24 md:pb-16 bg-[#06090f] text-white">
      {/* Mentor Header */}
      <header className="sticky top-0 z-40 -mx-4 sm:-mx-5 mb-6 border-b border-border bg-[#06090f]/80 px-4 sm:px-5 backdrop-blur">
        <div className="flex h-14 sm:h-16 items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <CollegeBrand />
            <div className="leading-tight hidden sm:block min-w-0">
              <p className="text-sm font-bold tracking-tight truncate">Mentor Portal — {mentorName}</p>
              <p className="text-xs text-muted-foreground">
                Domain: <span className="text-[#c9a227] font-semibold">{mentorDomain}</span> ·{" "}
                {mentorDept || "All Departments"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button
              variant="ghost"
              onClick={() => setShowProfileModal(true)}
              className="text-xs text-[#c9a227] hover:bg-[#c9a227]/10 px-2.5 py-1.5 sm:px-3"
            >
              <span className="hidden sm:inline">Edit Profile</span>
              <span className="sm:hidden">Profile</span>
            </Button>
            <Button
              variant="ghost"
              onClick={logout}
              className="text-xs text-[#c9a227] hover:bg-[#c9a227]/10 px-2.5 py-1.5 sm:px-3"
            >
              <span className="hidden sm:inline">Log out</span>
              <span className="sm:hidden">Logout</span>
            </Button>
          </div>
        </div>

        {/* Desktop Tab Navigation — inside header */}
        <div className="hidden md:flex flex-wrap gap-1 pb-3">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-300",
                tab === t.key
                  ? "bg-[#c9a227] text-black font-bold shadow-lg shadow-[#c9a227]/20"
                  : "text-muted-foreground hover:bg-muted/20 hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {/* Mobile mentor name strip */}
      <div className="mb-4 sm:hidden flex items-center gap-2 text-xs text-muted-foreground px-0.5">
        <span className="font-bold text-white">{mentorName}</span>
        <span>·</span>
        <span className="text-[#c9a227] font-semibold">{mentorDomain}</span>
        {mentorDept && <><span>·</span><span>{mentorDept}</span></>}
      </div>

      {/* Active Announcement */}
      {announcement && (
        <div className="mb-6 rounded-2xl border border-[rgba(201,162,39,0.30)] bg-card/60 p-4 overflow-hidden relative">
          <div>
            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-[#e8c058] bg-[#c9a227]/10 px-2 py-0.5 rounded-md border border-[#c9a227]/20 mb-2">
              Latest Announcement
            </span>
            <div className="max-h-40 overflow-y-auto">
              <FormattedAnnouncement content={announcement.content} />
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
          seatAlerts={seatAlerts}
          mentorDept={mentorDept}
          onDismissAlert={(ministry) =>
            setSeatAlerts((prev) => prev.filter((a) => a.ministry !== ministry))
          }
        />
      )}

      {tab === "students" && (
        <RosterTab
          students={students}
          totalStudents={totalStudents}
          studentsInTeams={studentsInTeams}
          teams={teams}
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
          yearFilter={yearFilter}
          setYearFilter={setYearFilter}
          sectionFilter={sectionFilter}
          setSectionFilter={setSectionFilter}
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
          mentorDept={mentorDept}
          focusedTeamId={focusedTeamId}
          problemMap={problemMap}
          ministrySeats={ministrySeats}
          removeMember={removeMember}
          deleteTeam={deleteTeam}
          renameTeam={renameTeam}
          setShowCreateTeamModal={setShowCreateTeamModal}
          assignMemberSkill={assignMemberSkill}
          assignTeamMinistry={assignTeamMinistry}
          onAddMemberClick={(teamId) => {
            setSelectedTeamId(teamId);
            setTab("students");
            toast("info", "Select an available student from the Roster below to add to this team.");
          }}
        />
      )}

      {tab === "paired-overall" && (
        <PairedTeamsOverallTab
          teams={teams}
          mentorDept={mentorDept}
          problemMap={problemMap}
          ministrySeats={ministrySeats}
        />
      )}

      {tab === "problems" && <ProblemsTab problems={problems} />}

      {/* Mobile Bottom Tab Navigation */}
      <div className="fixed bottom-0 inset-x-0 z-40 border-t border-[rgba(201,162,39,0.18)] bg-[#06090f]/95 backdrop-blur-md py-2 px-2 flex items-center justify-around md:hidden shadow-[0_-8px_24px_rgba(0,0,0,0.4)]">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-xl transition-colors min-w-0",
              tab === t.key ? "text-[#c9a227]" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.key === "home" && <svg className="size-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m3 12 2-2m0 0 7-7 7 7M5 10v10a1 1 0 0 0 1 1h3m10-11 2 2m-2-2v10a1 1 0 0 1-1 1h-3m-6 0a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1m-6 0h6" /></svg>}
            {t.key === "students" && <svg className="size-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" /></svg>}
            {t.key === "teams" && <svg className="size-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" /></svg>}
            {t.key === "paired-overall" && <svg className="size-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" /></svg>}
            {t.key === "problems" && <svg className="size-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" /></svg>}
            <span className="text-[9px] font-bold truncate max-w-[52px] text-center">{t.shortLabel}</span>
          </button>
        ))}
      </div>

      {/* Create Team Modal */}
      <CreateTeamModal
        showCreateTeamModal={showCreateTeamModal}
        setShowCreateTeamModal={setShowCreateTeamModal}
        teamsCount={teams.length}
        busyAssign={busyAssign}
        availableStudentsCount={availableStudents.length}
        deptCode={mentorDept
          ? (Object.entries(DEPT_CODE).find(([full]) => full.toLowerCase() === mentorDept.toLowerCase())?.[1]
              ?? mentorDept.replace(/\s+/g, "").toUpperCase().slice(0, 8))
          : "TEAM"}
        deptTeamCount={teams.filter((t) => {
          if (!mentorDept) return true;
          if (t.team.created_by_dept) return isSameDepartment(t.team.created_by_dept, mentorDept);
          return t.members.every((m) => !m.department || isSameDepartment(m.department, mentorDept));
        }).length}
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
        mentorDept={mentorDept}
      />

      {/* Edit Profile Modal */}
      <EditProfileModal
        showProfileModal={showProfileModal}
        setShowProfileModal={setShowProfileModal}
        profileForm={profileForm}
        setProfileForm={setProfileForm}
        busyAssign={busyAssign}
        handleProfileSubmit={handleProfileSubmit}
      />
    </main>
  );
}
