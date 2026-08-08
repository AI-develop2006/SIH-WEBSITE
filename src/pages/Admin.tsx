"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from "recharts";
import { supabase } from "@/lib/supabase/client";
import * as data from "@/lib/data";
import { downloadCsv, cn } from "@/lib/utils";
import { DEPARTMENTS, YEARS } from "@/lib/constants";
import type { EnrichedTeam, Problem, Profile, Theme } from "@/lib/types";
import { useToast } from "@/components/unlumen-ui/toast";
import { Button } from "@/components/unlumen-ui/button";
import { Card } from "@/components/unlumen-ui/card";
import { GlowingBadge } from "@/components/unlumen-ui/glowing-badge";
import { Avatar } from "@/components/unlumen-ui/avatar";
import { Input, Select } from "@/components/unlumen-ui/input";
import { CollegeBrand } from "@/components/college-brand";

// ─── Types ──────────────────────────────────────────────────────────────────

type Tab = "students" | "teams" | "analytics" | "problems";

// ─── Chart colour palette ────────────────────────────────────────────────────

const CHART_COLORS = [
  "#6366f1", "#22d3ee", "#f59e0b", "#34d399", "#f87171",
  "#a78bfa", "#fb923c", "#38bdf8", "#4ade80", "#e879f9",
  "#facc15", "#2dd4bf", "#f472b6", "#818cf8", "#60a5fa",
];

// ─── Registration Toggle Banner ──────────────────────────────────────────────

function RegistrationBanner({
  open,
  toggling,
  onToggle,
}: {
  open: boolean;
  toggling: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl border px-5 py-4 transition-all sm:flex-row sm:items-center sm:justify-between",
        open
          ? "border-success/40 bg-success/8"
          : "border-danger/40 bg-danger/8",
      )}
    >
      <div className="flex items-center gap-3">
        <span className={cn("size-2.5 rounded-full", open ? "bg-success animate-pulse" : "bg-danger")} />
        <div>
          <p className="text-sm font-bold">
            Registration portal is currently{" "}
            <span className={open ? "text-success" : "text-danger"}>
              {open ? "OPEN" : "CLOSED"}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            {open
              ? "Students can register and form teams."
              : "New registrations are blocked. Existing data is preserved."}
          </p>
        </div>
      </div>
      <Button
        variant={open ? "danger" : "outline"}
        loading={toggling}
        onClick={onToggle}
        className="shrink-0"
      >
        {open ? "Close registration" : "Reopen registration"}
      </Button>
    </div>
  );
}


// ─── Member Management Dialog ─────────────────────────────────────────────────

function MemberDialog({
  team,
  allProfiles,
  onClose,
  onReload,
}: {
  team: EnrichedTeam;
  allProfiles: Profile[];
  onClose: () => void;
  onReload: () => Promise<void>;
}) {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const unassignedMatches = useMemo(() => {
    const memberIds = new Set(team.members.map((m) => m.id));
    const needle = q.trim().toLowerCase();
    return allProfiles.filter((p) => {
      if (p.role !== "student") return false;
      if (memberIds.has(p.id)) return false;
      if (!needle) return true;
      return [p.name, p.register_no, p.department, p.email]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [allProfiles, team.members, q]);

  async function addMember(profile: Profile) {
    setBusy(profile.id);
    const res = await data.api.adminAddMember(team.team.id, profile.id);
    if (res.error) {
      toast("error", res.error);
    } else {
      toast("success", `${profile.name} added to ${team.team.name}`);
      await onReload();
    }
    setBusy(null);
  }

  async function removeMember(profile: Profile) {
    setBusy(profile.id);
    const res = await data.api.adminRemoveMember(team.team.id, profile.id);
    if (res.error) {
      toast("error", res.error);
    } else {
      toast("success", `${profile.name} removed from ${team.team.name}`);
      await onReload();
    }
    setBusy(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <Card className="flex w-full max-w-2xl flex-col gap-0 overflow-hidden p-0 max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-bold">Manage members — {team.team.name}</h2>
            <p className="text-xs text-muted-foreground">
              {team.members.length}/6 members · {team.stats.girlCount} female · {team.stats.deptCount} dept
              {team.stats.deptCount !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-5 overflow-y-auto p-5">
          {/* Current members */}
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Current members
            </h3>
            {team.members.length === 0 && (
              <p className="text-xs text-muted-foreground">No members yet.</p>
            )}
            <div className="flex flex-col gap-1.5">
              {team.members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2"
                >
                  <div className="flex items-center gap-2.5">
                    <Avatar name={m.name} src={m.avatar_url} className="size-7 text-[9px]" />
                    <div className="leading-tight">
                      <p className="text-sm font-semibold">{m.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.department ?? "—"} · {m.year ?? "—"} · {m.gender ?? "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.id === team.team.leader_id && (
                      <GlowingBadge variant="info" pulse={false}>Leader</GlowingBadge>
                    )}
                    {m.id !== team.team.leader_id && (
                      <Button
                        variant="danger"
                        className="px-2.5 py-1 text-xs"
                        loading={busy === m.id}
                        onClick={() => removeMember(m)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Add members */}
          {team.members.length < 6 && (
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Add student
              </h3>
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name, register no, department…"
                className="mb-3"
              />
              <div className="flex max-h-48 flex-col gap-1.5 overflow-y-auto">
                {unassignedMatches.length === 0 && (
                  <p className="text-xs text-muted-foreground">No students match.</p>
                )}
                {unassignedMatches.slice(0, 30).map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2"
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar name={p.name} className="size-7 text-[9px]" />
                      <div className="leading-tight">
                        <p className="text-sm font-semibold">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.register_no ?? "—"} · {p.department ?? "—"} · {p.gender ?? "—"}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      className="px-2.5 py-1 text-xs"
                      loading={busy === p.id}
                      onClick={() => addMember(p)}
                    >
                      Add
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}


// ─── Analytics Tab ────────────────────────────────────────────────────────────

function AnalyticsView({ profiles, teams }: { profiles: Profile[]; teams: EnrichedTeam[] }) {
  const students = profiles.filter((p) => p.role === "student");

  // By department
  const byDept = useMemo(() => {
    const counts: Record<string, number> = {};
    students.forEach((s) => {
      const d = s.department ?? "Unknown";
      counts[d] = (counts[d] ?? 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name: name.replace(/ (Engineering|and)/g, " ").trim(), count }))
      .sort((a, b) => b.count - a.count);
  }, [students]);

  // By year
  const byYear = useMemo(() => {
    const counts: Record<string, number> = { I: 0, II: 0, III: 0, IV: 0 };
    students.forEach((s) => { if (s.year) counts[s.year] = (counts[s.year] ?? 0) + 1; });
    return YEARS.map((y) => ({ name: `Year ${y}`, count: counts[y] ?? 0 }));
  }, [students]);

  // By project type
  const byProject = useMemo(() => {
    const counts: Record<string, number> = { Hardware: 0, Software: 0, Both: 0, "Not set": 0 };
    students.forEach((s) => {
      const k = s.project_type ?? "Not set";
      counts[k] = (counts[k] ?? 0) + 1;
    });
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));
  }, [students]);

  // By gender
  const byGender = useMemo(() => {
    const counts: Record<string, number> = { Male: 0, Female: 0, Other: 0 };
    students.forEach((s) => { const k = s.gender ?? "Other"; counts[k] = (counts[k] ?? 0) + 1; });
    return Object.entries(counts).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
  }, [students]);

  // Team validity
  const validCount = teams.filter((t) => t.stats.valid).length;
  const invalidCount = teams.length - validCount;

  const RADIAN = Math.PI / 180;
  const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: {
    cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number; percent: number;
  }) => {
    const r = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + r * Math.cos(-midAngle * RADIAN);
    const y = cy + r * Math.sin(-midAngle * RADIAN);
    return percent > 0.04 ? (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    ) : null;
  };

  return (
    <div className="flex flex-col gap-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniKpi label="Total students" value={students.length} color="text-primary" />
        <MiniKpi label="Female" value={students.filter((s) => s.gender === "Female").length} color="text-pink-400" />
        <MiniKpi label="Verified" value={students.filter((s) => s.verified).length} color="text-success" />
        <MiniKpi label="In a team" value={teams.reduce((n, t) => n + t.members.length, 0)} color="text-accent" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Dept bar chart */}
        <Card className="p-5">
          <p className="mb-4 text-sm font-bold">Registrations by department</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byDept} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
              <YAxis
                type="category"
                dataKey="name"
                width={130}
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              />
              <Tooltip
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                cursor={{ fill: "var(--muted)" }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {byDept.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Year bar chart */}
        <Card className="p-5">
          <p className="mb-4 text-sm font-bold">Registrations by year of study</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byYear} margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
              <YAxis tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
              <Tooltip
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                cursor={{ fill: "var(--muted)" }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {byYear.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Project type pie */}
        <Card className="p-5">
          <p className="mb-4 text-sm font-bold">Project type distribution</p>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={byProject}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                labelLine={false}
                label={renderLabel}
              >
                {byProject.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
              />
              <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        {/* Gender + team validity */}
        <div className="flex flex-col gap-6">
          <Card className="p-5">
            <p className="mb-4 text-sm font-bold">Gender breakdown</p>
            <ResponsiveContainer width="100%" height={120}>
              <PieChart>
                <Pie
                  data={byGender}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={50}
                  labelLine={false}
                  label={renderLabel}
                >
                  {byGender.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                />
                <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-5">
            <p className="mb-3 text-sm font-bold">Team compliance status</p>
            <div className="flex gap-4">
              <div className="flex flex-col items-center gap-1">
                <span className="text-3xl font-black text-success">{validCount}</span>
                <span className="text-xs text-muted-foreground">Valid teams</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-3xl font-black text-warning">{invalidCount}</span>
                <span className="text-xs text-muted-foreground">Incomplete teams</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-3xl font-black text-muted-foreground">{teams.length}</span>
                <span className="text-xs text-muted-foreground">Total teams</span>
              </div>
            </div>
            {teams.length > 0 && (
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-success transition-all"
                  style={{ width: `${(validCount / teams.length) * 100}%` }}
                />
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function MiniKpi({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-3xl font-black tabular-nums", color)}>{value}</p>
    </Card>
  );
}


// ─── Main AdminPage ───────────────────────────────────────────────────────────

export default function AdminPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [tab, setTab] = useState<Tab>("students");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [teams, setTeams] = useState<EnrichedTeam[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);

  // Registration toggle
  const [regOpen, setRegOpen] = useState(true);
  const [toggling, setToggling] = useState(false);

  // Filters
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("");
  const [gender, setGender] = useState("");
  const [verified, setVerified] = useState("all");

  // Action states
  const [promoting, setPromoting] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [autoAssigning, setAutoAssigning] = useState(false);

  // Member dialog
  const [memberDialogTeam, setMemberDialogTeam] = useState<EnrichedTeam | null>(null);

  const load = useCallback(async () => {
    const [profilesRes, teamsRes, problemsRes, themesRes, regOpenRes] = await Promise.all([
      data.fetchAllProfiles(),
      data.fetchEnrichedTeams(),
      data.fetchProblems(),
      data.fetchThemes(),
      data.getRegistrationOpen(),
    ]);
    if (profilesRes.error) toast("error", profilesRes.error);
    if (teamsRes.error) toast("error", teamsRes.error);
    if (problemsRes.error) toast("error", problemsRes.error);
    if (themesRes.error) toast("error", themesRes.error);
    setProfiles(profilesRes.data ?? []);
    setTeams(teamsRes.data ?? []);
    setProblems(problemsRes.data ?? []);
    setThemes(themesRes.data ?? []);
    setRegOpen(regOpenRes);
  }, [toast]);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase!.auth.getSession();
      if (!session) { navigate("/", { replace: true }); return; }
      const { data: me } = await data.getCurrentProfile();
      if (!me || me.role !== "admin") {
        toast("error", "Admins only");
        navigate("/dashboard", { replace: true });
        return;
      }
      await load();
      setLoading(false);
    })();
  }, [navigate, toast, load]);

  // ── Filtered students ──
  const students = useMemo(() => {
    const list = profiles.filter((p) => p.role === "student");
    const needle = q.trim().toLowerCase();
    return list.filter((p) => {
      if (dept && p.department !== dept) return false;
      if (gender && p.gender !== gender) return false;
      if (verified === "verified" && !p.verified) return false;
      if (verified === "unverified" && p.verified) return false;
      if (!needle) return true;
      return [p.name, p.register_no, p.email, p.phone, p.section, p.year, (p.languages ?? []).join(" ")]
        .filter(Boolean).join(" ").toLowerCase().includes(needle);
    });
  }, [profiles, q, dept, gender, verified]);

  const problemMap = useMemo(() => new Map(problems.map((p) => [p.id, p.title])), [problems]);

  const validTeams = teams.filter((t) => t.stats.valid).length;
  const assignedIds = useMemo(() => new Set(teams.flatMap((t) => t.members.map((m) => m.id))), [teams]);
  const unassigned = profiles.filter((p) => p.role === "student" && !assignedIds.has(p.id)).length;
  const verifiedCount = profiles.filter((p) => p.role === "student" && p.verified).length;

  // ── Actions ──
  async function toggleRegistration() {
    setToggling(true);
    const res = await data.setRegistrationOpen(!regOpen);
    if (res.error) {
      toast("error", res.error);
    } else {
      setRegOpen(!regOpen);
      toast("success", !regOpen ? "Registration reopened" : "Registration closed");
    }
    setToggling(false);
  }

  async function autoAssign() {
    if (!window.confirm(`Auto-assign ${unassigned} unassigned students into new teams of up to 6? This will create new teams.`)) return;
    setAutoAssigning(true);
    const res = await data.api.adminAutoAssign();
    if (res.error) {
      toast("error", res.error);
    } else {
      toast("success", "Auto-assignment complete — teams created");
      await load();
    }
    setAutoAssigning(false);
  }

  async function promote(phone: string, name: string) {
    setPromoting(phone);
    const res = await data.api.promoteAdmin(phone);
    if (res.error) toast("error", res.error);
    else { toast("success", `${name} is now an admin`); await load(); }
    setPromoting(null);
  }

  async function toggleVerify(p: Profile) {
    setVerifying(p.id);
    const res = await data.api.verifyStudent(p.id, !p.verified);
    if (res.error) toast("error", res.error);
    else { toast("success", p.verified ? `Verification removed for ${p.name}` : `${p.name} verified`); await load(); }
    setVerifying(null);
  }

  async function deleteTeam(t: EnrichedTeam) {
    if (!window.confirm(`Delete team "${t.team.name}"? This cannot be undone.`)) return;
    setDeleting(t.team.id);
    const res = await data.api.deleteTeam(t.team.id);
    if (res.error) toast("error", res.error);
    else { toast("success", `Team "${t.team.name}" deleted`); await load(); }
    setDeleting(null);
  }

  async function logout() {
    await supabase!.auth.signOut();
    navigate("/", { replace: true });
  }

  // ── Export helpers ──
  function exportStudents() {
    downloadCsv(
      "sih2026-students.csv",
      students.map((s) => ({
        name: s.name, register_no: s.register_no ?? "", email: s.email ?? "",
        phone: s.phone ?? "", department: s.department ?? "", year: s.year ?? "",
        section: s.section ?? "", gender: s.gender ?? "",
        languages: (s.languages ?? []).join(" | "), linkedin: s.linkedin ?? "",
        project_type: s.project_type ?? "", project_title: s.project_title ?? "",
        verified: s.verified ? "Yes" : "No", created_at: s.created_at,
      })),
      [
        { key: "name", label: "Name" }, { key: "register_no", label: "Register No" },
        { key: "email", label: "Email" }, { key: "phone", label: "Phone" },
        { key: "department", label: "Department" }, { key: "year", label: "Year" },
        { key: "section", label: "Section" }, { key: "gender", label: "Gender" },
        { key: "languages", label: "Languages" }, { key: "linkedin", label: "LinkedIn" },
        { key: "project_type", label: "Project Type" }, { key: "project_title", label: "Project Title" },
        { key: "verified", label: "Verified" }, { key: "created_at", label: "Registered On" },
      ]
    );
  }

  function exportTeams() {
    const rows = teams.flatMap((t) =>
      t.members.map((m) => ({
        team_name: t.team.name,
        leader: t.leader?.name ?? "",
        member_name: m.name,
        register_no: m.register_no ?? "",
        email: m.email ?? "",
        department: m.department ?? "",
        year: m.year ?? "",
        gender: m.gender ?? "",
        team_valid: t.stats.valid ? "Yes" : "No",
        compliance_issue: t.stats.reason ?? "",
        problem: problemMap.get(t.team.problem_id ?? "") ?? "",
      }))
    );
    downloadCsv(
      "sih2026-teams.csv",
      rows,
      [
        { key: "team_name", label: "Team Name" }, { key: "leader", label: "Leader" },
        { key: "member_name", label: "Member" }, { key: "register_no", label: "Register No" },
        { key: "email", label: "Email" }, { key: "department", label: "Department" },
        { key: "year", label: "Year" }, { key: "gender", label: "Gender" },
        { key: "team_valid", label: "Valid" }, { key: "compliance_issue", label: "Compliance Issue" },
        { key: "problem", label: "Problem Statement" },
      ]
    );
  }

  const TAB_LABELS: Record<Tab, string> = {
    students: `Students (${profiles.filter((p) => p.role === "student").length})`,
    teams: `Teams (${teams.length})`,
    analytics: "Analytics",
    problems: "Problems",
  };


  return (
    <>
      {memberDialogTeam && (
        <MemberDialog
          team={memberDialogTeam}
          allProfiles={profiles}
          onClose={() => setMemberDialogTeam(null)}
          onReload={async () => { await load(); }}
        />
      )}

      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 pb-16">
        {/* ── Header ── */}
        <header className="sticky top-0 z-40 -mx-5 mb-6 border-b border-border bg-background/80 px-5 backdrop-blur">
          <div className="flex h-16 items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CollegeBrand />
              <div className="leading-tight">
                <p className="text-sm font-bold tracking-tight">Admin control</p>
                <p className="text-xs text-muted-foreground">SIH 2026 · registrations &amp; teams</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => navigate("/dashboard")}>Dashboard</Button>
              <Button variant="danger" onClick={logout} className="px-3 py-2">Log out</Button>
            </div>
          </div>

          <div className="flex gap-1 pb-3">
            {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
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
                {TAB_LABELS[t]}
              </button>
            ))}
          </div>
        </header>

        {loading ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* ── Registration toggle banner (always visible) ── */}
            <RegistrationBanner open={regOpen} toggling={toggling} onToggle={toggleRegistration} />

            {/* ── Stat cards ── */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              <StatCard label="Students" value={profiles.filter((p) => p.role === "student").length} accent="ring" />
              <StatCard label="Verified" value={verifiedCount} accent="success" />
              <StatCard label="Pending" value={profiles.filter((p) => p.role === "student").length - verifiedCount} accent="warning" />
              <StatCard label="Teams" value={teams.length} accent="accent" />
              <StatCard label="Valid teams" value={validTeams} accent="success" />
              <StatCard label="Unassigned" value={unassigned} accent="warning" />
            </div>

            {/* ── Students tab ── */}
            {tab === "students" && (
              <Card className="overflow-hidden p-0">
                <div className="flex flex-col gap-3 border-b border-border px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                  <h3 className="text-base font-bold">Student registrations</h3>
                  <div className="flex flex-wrap gap-2">
                    <Input
                      value={q} onChange={(e) => setQ(e.target.value)}
                      placeholder="Search name, reg no, email…" className="w-full sm:w-56"
                    />
                    <Select value={dept} onChange={(e) => setDept(e.target.value)} className="w-full sm:w-48">
                      <option value="">All departments</option>
                      {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
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
                    <Button variant="outline" onClick={exportStudents}>Export CSV</Button>
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
                        <th className="px-5 py-3 font-semibold">Actions</th>
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
                              <Avatar name={s.name} src={s.avatar_url} className="size-8 text-[10px]" />
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
                            {s.year && <span className="text-xs text-muted-foreground/70"> · Yr {s.year}</span>}
                            {s.section && <span className="text-xs text-muted-foreground/70"> · Sec {s.section}</span>}
                          </td>
                          <td className="px-5 py-3 text-muted-foreground">{s.gender ?? "—"}</td>
                          <td className="px-5 py-3">
                            <div className="flex max-w-[180px] flex-wrap gap-1">
                              {(s.languages ?? []).length === 0
                                ? <span className="text-xs text-muted-foreground">—</span>
                                : (s.languages ?? []).map((l) => (
                                    <span key={l} className="rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">{l}</span>
                                  ))
                              }
                            </div>
                          </td>
                          <td className="px-5 py-3 text-muted-foreground">{s.project_type ?? "—"}</td>
                          <td className="px-5 py-3">
                            {s.verified
                              ? <GlowingBadge variant="success" pulse={false}>Verified</GlowingBadge>
                              : <GlowingBadge variant="warning" pulse={false}>Pending</GlowingBadge>}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Button variant="outline" className="px-2.5 py-1 text-xs" loading={verifying === s.id} onClick={() => toggleVerify(s)}>
                                {s.verified ? "Unverify" : "Verify"}
                              </Button>
                              {s.role === "admin"
                                ? <GlowingBadge variant="info" pulse={false}>Admin</GlowingBadge>
                                : <Button variant="outline" className="px-2.5 py-1 text-xs" loading={promoting === s.phone} onClick={() => promote(s.phone ?? "", s.name)}>Promote</Button>
                              }
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}


            {/* ── Teams tab ── */}
            {tab === "teams" && (
              <div className="flex flex-col gap-4">
                {/* Matchmaker panel */}
                <Card className="p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-sm font-bold">Auto-assign unassigned students</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {unassigned === 0
                          ? "All students are already in a team."
                          : `${unassigned} student${unassigned !== 1 ? "s" : ""} are not yet in any team. The algorithm clusters them into groups of up to 6, placing ≥2 females per team and mixing departments.`}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      loading={autoAssigning}
                      disabled={unassigned === 0}
                      onClick={autoAssign}
                      className="shrink-0"
                    >
                      ⚡ Run matchmaker
                    </Button>
                  </div>
                </Card>

                {/* Teams table */}
                <Card className="overflow-hidden p-0">
                  <div className="flex items-center justify-between border-b border-border px-5 py-4">
                    <h3 className="text-base font-bold">Teams</h3>
                    <Button variant="outline" onClick={exportTeams}>Export CSV</Button>
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
                              {t.stats.valid
                                ? <GlowingBadge variant="success" pulse={false}>Valid</GlowingBadge>
                                : <GlowingBadge variant="warning" pulse={false} title={t.stats.reason}>Invalid</GlowingBadge>}
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex gap-1.5">
                                <Button
                                  variant="outline"
                                  className="px-2.5 py-1 text-xs"
                                  onClick={() => setMemberDialogTeam(t)}
                                >
                                  Members
                                </Button>
                                <Button
                                  variant="danger"
                                  className="px-2.5 py-1 text-xs"
                                  loading={deleting === t.team.id}
                                  onClick={() => deleteTeam(t)}
                                >
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
            )}

            {/* ── Analytics tab ── */}
            {tab === "analytics" && <AnalyticsView profiles={profiles} teams={teams} />}

            {/* ── Problems tab ── */}
            {tab === "problems" && <ProblemsManager problems={problems} themes={themes} onReload={load} />}
          </div>
        )}
      </main>
    </>
  );
}


// ─── Problems manager (unchanged logic, kept inline) ─────────────────────────

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

  function reset() { setForm({ id: "", title: "", category: "", description: "", themeId: "" }); }
  function startEdit(p: Problem) {
    setForm({ id: p.id, title: p.title, category: p.category ?? "", description: p.description ?? "", themeId: p.theme_id ?? "" });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { toast("error", "Problem title is required"); return; }
    setSaving(true);
    const res = await data.api.upsertProblem({
      id: form.id || null, title: form.title,
      category: form.category || null, description: form.description || null, themeId: form.themeId || null,
    });
    if (res.error) toast("error", res.error);
    else { toast("success", form.id ? "Problem updated" : "Problem added"); reset(); await onReload(); }
    setSaving(false);
  }

  async function remove(id: string, title: string) {
    if (!window.confirm(`Delete problem "${title}"? Teams using it will lose their link.`)) return;
    setDeleting(id);
    const res = await data.api.deleteProblem(id);
    if (res.error) toast("error", res.error);
    else { toast("success", "Problem deleted"); await onReload(); }
    setDeleting(null);
  }

  const grouped = themes.map((th) => ({ theme: th, items: problems.filter((p) => p.theme_id === th.id) }));
  const unthemed = problems.filter((p) => !p.theme_id);

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-5">
        <h3 className="text-base font-bold">{form.id ? "Edit problem" : "Add problem"}</h3>
        <form onSubmit={save} className="mt-4 flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Problem statement title" required />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Category" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="e.g. ML / AI" />
              <Select label="Theme" value={form.themeId} onChange={(e) => setForm((f) => ({ ...f, themeId: e.target.value }))}>
                <option value="">No theme</option>
                {themes.map((th) => <option key={th.id} value={th.id}>{th.name}</option>)}
              </Select>
            </div>
          </div>
          <Input label="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Short description of the problem" />
          <div className="flex gap-2">
            <Button type="submit" loading={saving}>{form.id ? "Save changes" : "Add problem"}</Button>
            {form.id && <Button type="button" variant="ghost" onClick={reset}>Cancel</Button>}
          </div>
        </form>
      </Card>

      {grouped.map(({ theme, items }) => (
        <div key={theme.id}>
          <h4 className="mb-2 text-sm font-bold uppercase tracking-widest text-muted-foreground">{theme.name}</h4>
          <div className="flex flex-col gap-2">
            {items.length === 0 && (
              <p className="rounded-lg border border-dashed border-border px-4 py-3 text-xs text-muted-foreground">No problems in this theme yet.</p>
            )}
            {items.map((p) => (
              <ProblemRow key={p.id} problem={p} deleting={deleting === p.id} onEdit={() => startEdit(p)} onDelete={() => remove(p.id, p.title)} />
            ))}
          </div>
        </div>
      ))}

      <div>
        <h4 className="mb-2 text-sm font-bold uppercase tracking-widest text-muted-foreground">Other problems</h4>
        <div className="flex flex-col gap-2">
          {unthemed.length === 0 && (
            <p className="rounded-lg border border-dashed border-border px-4 py-3 text-xs text-muted-foreground">All problems are assigned to a theme.</p>
          )}
          {unthemed.map((p) => (
            <ProblemRow key={p.id} problem={p} deleting={deleting === p.id} onEdit={() => startEdit(p)} onDelete={() => remove(p.id, p.title)} />
          ))}
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        {problems.length} problem statement{problems.length === 1 ? "" : "s"} across {themes.length} theme{themes.length === 1 ? "" : "s"}
      </p>
    </div>
  );
}

function ProblemRow({ problem, deleting, onEdit, onDelete }: { problem: Problem; deleting: boolean; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{problem.title}</p>
        {problem.category && <span className="text-xs text-primary">{problem.category}</span>}
        {problem.description && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{problem.description}</p>}
      </div>
      <div className="flex shrink-0 gap-1.5">
        <Button variant="outline" className="px-2.5 py-1 text-xs" onClick={onEdit}>Edit</Button>
        <Button variant="danger" className="px-2.5 py-1 text-xs" loading={deleting} onClick={onDelete}>Delete</Button>
      </div>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  const color = ({
    ring: "text-primary border-primary/30 bg-primary/10",
    accent: "text-accent border-accent/30 bg-accent/10",
    success: "text-success border-success/30 bg-success/10",
    warning: "text-warning border-warning/30 bg-warning/10",
  } as Record<string, string>)[accent] ?? "";
  return (
    <Card className="p-5">
      <p className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${color}`}>{label}</p>
      <p className="mt-2 text-3xl font-black tabular-nums">{value}</p>
    </Card>
  );
}
