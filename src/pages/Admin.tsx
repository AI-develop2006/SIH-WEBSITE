"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase/client";
import * as data from "@/lib/data";
import { downloadCsv, cn } from "@/lib/utils";
import { DEPARTMENTS } from "@/lib/constants";
import type { EnrichedTeam, Problem, Profile, Theme } from "@/lib/types";
import { useToast } from "@/components/unlumen-ui/toast";
import { Button } from "@/components/unlumen-ui/button";
import { Card } from "@/components/unlumen-ui/card";
import { GlowingBadge } from "@/components/unlumen-ui/glowing-badge";
import { Avatar } from "@/components/unlumen-ui/avatar";
import { Input, Select } from "@/components/unlumen-ui/input";
import { CollegeBrand } from "@/components/college-brand";

type Tab = "students" | "teams" | "analytics" | "problems";

// ── Tiny bar-chart component (no external dep) ───────────────────────────────
function BarChart({ rows, color = "#c9a227" }: {
  rows: { label: string; value: number }[];
  color?: string;
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-3 text-xs">
          <span className="w-44 shrink-0 truncate text-right text-muted-foreground" title={r.label}>
            {r.label}
          </span>
          <div className="h-5 flex-1 overflow-hidden rounded-md bg-muted/40">
            <div
              className="h-full rounded-md transition-all duration-500"
              style={{ width: `${(r.value / max) * 100}%`, background: color }}
            />
          </div>
          <span className="w-6 shrink-0 tabular-nums font-semibold text-foreground">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent = "ring" }: {
  label: string; value: number | string; sub?: string; accent?: string;
}) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`text-3xl font-black tabular-nums text-${accent}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </Card>
  );
}

// ── Member management dialog ──────────────────────────────────────────────────
function MemberDialog({
  team, unassigned, onClose, onReload,
}: {
  team: EnrichedTeam;
  unassigned: Profile[];
  onClose: () => void;
  onReload: () => Promise<void>;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filtered = unassigned.filter((p) =>
    `${p.name} ${p.register_no} ${p.department}`.toLowerCase().includes(search.toLowerCase())
  );

  async function add(p: Profile) {
    setBusy(p.id);
    const res = await data.adminAddMember(team.team.id, p.id);
    if (res.error) toast("error", res.error);
    else { toast("success", `${p.name} added to ${team.team.name}`); await onReload(); }
    setBusy(null);
  }

  async function remove(p: Profile) {
    if (!window.confirm(`Remove ${p.name} from ${team.team.name}?`)) return;
    setBusy(p.id);
    const res = await data.adminRemoveMember(team.team.id, p.id);
    if (res.error) toast("error", res.error);
    else { toast("success", `${p.name} removed`); await onReload(); }
    setBusy(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        {/* header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-lg font-bold">{team.team.name}</h2>
            <p className="text-xs text-muted-foreground">
              {team.members.length}/6 members · {team.stats.girlCount} female · {team.stats.deptCount} depts
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden divide-x divide-border">
          {/* current members */}
          <div className="flex w-1/2 flex-col overflow-hidden">
            <p className="border-b border-border px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">Current members</p>
            <div className="flex-1 overflow-y-auto">
              {team.members.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-2.5 last:border-0 hover:bg-muted/20">
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar name={m.name} className="size-7 text-[9px] shrink-0" />
                    <div className="min-w-0 leading-tight">
                      <p className="truncate text-sm font-semibold">{m.name}
                        {m.id === team.team.leader_id && <span className="ml-1 text-[10px] text-ring">Leader</span>}
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground">{m.department ?? "—"} · {m.gender}</p>
                    </div>
                  </div>
                  <Button variant="danger" className="shrink-0 px-2 py-1 text-xs"
                    loading={busy === m.id} onClick={() => remove(m)}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* add members */}
          <div className="flex w-1/2 flex-col overflow-hidden">
            <div className="border-b border-border px-4 py-2.5">
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Add student</p>
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, reg no…"
                className="w-full rounded-lg border border-border bg-background/60 px-3 py-1.5 text-sm outline-none focus:border-ring/60" />
            </div>
            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 && (
                <p className="px-4 py-6 text-center text-xs text-muted-foreground">No unassigned students match.</p>
              )}
              {filtered.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-2.5 last:border-0 hover:bg-muted/20">
                  <div className="min-w-0 leading-tight">
                    <p className="truncate text-sm font-semibold">{p.name}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{p.register_no} · {p.department ?? "—"} · {p.gender}</p>
                  </div>
                  <Button variant="outline" className="shrink-0 px-2 py-1 text-xs"
                    loading={busy === p.id} onClick={() => add(p)}>
                    Add
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main AdminPage ────────────────────────────────────────────────────────────
export default function AdminPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [tab, setTab] = useState<Tab>("students");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [teams, setTeams] = useState<EnrichedTeam[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [portalOpen, setPortalOpen] = useState(true);
  const [loading, setLoading] = useState(true);

  // Filters
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("");
  const [gender, setGender] = useState("");
  const [verified, setVerified] = useState("all");

  // Busy flags
  const [promoting, setPromoting] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [matching, setMatching] = useState(false);
  const [togglingPortal, setTogglingPortal] = useState(false);

  // Member management dialog
  const [dialogTeam, setDialogTeam] = useState<EnrichedTeam | null>(null);
  const [unassigned, setUnassigned] = useState<Profile[]>([]);

  const load = useCallback(async () => {
    const [profilesRes, teamsRes, problemsRes, themesRes, portalRes] = await Promise.all([
      data.fetchAllProfiles(),
      data.fetchEnrichedTeams(),
      data.fetchProblems(),
      data.fetchThemes(),
      data.getPortalState(),
    ]);
    if (profilesRes.error) toast("error", profilesRes.error);
    if (teamsRes.error) toast("error", teamsRes.error);
    setProfiles(profilesRes.data ?? []);
    setTeams(teamsRes.data ?? []);
    setProblems(problemsRes.data ?? []);
    setThemes(themesRes.data ?? []);
    setPortalOpen(portalRes.data ?? true);
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

  // recompute unassigned whenever teams/profiles change
  useEffect(() => {
    const assignedIds = new Set(teams.flatMap((t) => t.members.map((m) => m.id)));
    setUnassigned(profiles.filter((p) => p.role === "student" && !assignedIds.has(p.id)));
  }, [teams, profiles]);

  const students = useMemo(() => {
    const list = profiles.filter((p) => p.role === "student");
    const needle = q.trim().toLowerCase();
    return list.filter((p) => {
      if (dept && p.department !== dept) return false;
      if (gender && p.gender !== gender) return false;
      if (verified === "verified" && !p.verified) return false;
      if (verified === "unverified" && p.verified) return false;
      if (!needle) return true;
      return [p.name, p.register_no, p.email, p.phone, p.section, p.year]
        .filter(Boolean).join(" ").toLowerCase().includes(needle);
    });
  }, [profiles, q, dept, gender, verified]);

  const problemMap = useMemo(() => new Map(problems.map((p) => [p.id, p.title])), [problems]);
  const validTeams = teams.filter((t) => t.stats.valid).length;
  const verifiedCount = students.filter((s) => s.verified).length;

  // ── Analytics data ─────────────────────────────────────────────────────────
  const byDept = useMemo(() => {
    const map = new Map<string, number>();
    students.forEach((s) => {
      const k = s.department ?? "Unknown";
      map.set(k, (map.get(k) ?? 0) + 1);
    });
    return [...map.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [students]);

  const byYear = useMemo(() => {
    const map = new Map<string, number>();
    ["I", "II", "III", "IV"].forEach((y) => map.set(y, 0));
    students.forEach((s) => { const k = s.year ?? "Unknown"; map.set(k, (map.get(k) ?? 0) + 1); });
    return [...map.entries()].map(([label, value]) => ({ label, value }));
  }, [students]);

  const byProject = useMemo(() => {
    const map = new Map<string, number>([["Hardware", 0], ["Software", 0], ["Both", 0], ["Unknown", 0]]);
    students.forEach((s) => { const k = s.project_type ?? "Unknown"; map.set(k, (map.get(k) ?? 0) + 1); });
    return [...map.entries()].map(([label, value]) => ({ label, value })).filter((r) => r.value > 0);
  }, [students]);

  const byGender = useMemo(() => {
    let m = 0, f = 0;
    students.forEach((s) => { if (s.gender === "Female") f++; else m++; });
    return [{ label: "Male", value: m }, { label: "Female", value: f }];
  }, [students]);

  // ── Actions ────────────────────────────────────────────────────────────────
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
    else { toast("success", p.verified ? `Verification removed` : `${p.name} verified`); await load(); }
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

  async function runMatchmaker() {
    if (!window.confirm(`Auto-assign all ${unassigned.length} unassigned students into teams?\nThis cannot be undone.`)) return;
    setMatching(true);
    const res = await data.autoAssignTeams();
    if (res.error) toast("error", res.error);
    else { toast("success", `Created ${res.data} new team${res.data === 1 ? "" : "s"}`); await load(); }
    setMatching(false);
  }

  async function togglePortal() {
    setTogglingPortal(true);
    const res = await data.setPortalState(!portalOpen);
    if (res.error) toast("error", res.error);
    else { setPortalOpen((v) => !v); toast("success", !portalOpen ? "Registration reopened" : "Registration closed"); }
    setTogglingPortal(false);
  }

  function exportStudents() {
    downloadCsv("sih2026-students.csv",
      students.map((s) => ({
        name: s.name, register_no: s.register_no ?? "", email: s.email ?? "",
        phone: s.phone ?? "", department: s.department ?? "", year: s.year ?? "",
        section: s.section ?? "", gender: s.gender ?? "",
        languages: s.languages.join(" | "), linkedin: s.linkedin ?? "",
        project_type: s.project_type ?? "", project_title: s.project_title ?? "",
        domain: s.domain ?? "", verified: s.verified ? "Yes" : "No",
        created_at: s.created_at,
      })),
      [
        { key: "name", label: "Name" }, { key: "register_no", label: "Register No" },
        { key: "email", label: "Email" }, { key: "phone", label: "Phone" },
        { key: "department", label: "Department" }, { key: "year", label: "Year" },
        { key: "section", label: "Section" }, { key: "gender", label: "Gender" },
        { key: "languages", label: "Languages" }, { key: "linkedin", label: "LinkedIn" },
        { key: "project_type", label: "Project Type" }, { key: "project_title", label: "Project Title" },
        { key: "domain", label: "Domain" }, { key: "verified", label: "Verified" },
        { key: "created_at", label: "Registered On" },
      ]
    );
  }

  function exportTeams() {
    downloadCsv("sih2026-teams.csv",
      teams.map((t) => ({
        name: t.team.name, leader: t.leader?.name ?? "",
        members: t.members.map((m) => m.name).join(" | "),
        member_nos: t.members.map((m) => m.register_no ?? "").join(" | "),
        member_count: t.stats.memberCount, departments: t.stats.deptCount,
        female: t.stats.girlCount, valid: t.stats.valid ? "Yes" : "No",
        reason: t.stats.reason ?? "",
        problem: problemMap.get(t.team.problem_id ?? "") ?? "",
      })),
      [
        { key: "name", label: "Team Name" }, { key: "leader", label: "Leader" },
        { key: "members", label: "Members" }, { key: "member_nos", label: "Register Numbers" },
        { key: "member_count", label: "Count" }, { key: "departments", label: "Depts" },
        { key: "female", label: "Female" }, { key: "valid", label: "Valid" },
        { key: "reason", label: "Reason" }, { key: "problem", label: "Problem Statement" },
      ]
    );
  }

  async function logout() {
    await supabase!.auth.signOut();
    navigate("/", { replace: true });
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: "students", label: `Students (${students.length})` },
    { id: "teams",    label: `Teams (${teams.length})` },
    { id: "analytics", label: "Analytics" },
    { id: "problems", label: "Problems" },
  ];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 pb-16">
      {dialogTeam && (
        <MemberDialog
          team={dialogTeam}
          unassigned={unassigned}
          onClose={() => setDialogTeam(null)}
          onReload={async () => { await load(); }}
        />
      )}

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 -mx-5 mb-6 border-b border-border bg-background/90 px-5 backdrop-blur">
        <div className="flex h-16 items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CollegeBrand />
            <div className="hidden leading-tight sm:block">
              <p className="text-sm font-bold tracking-tight">Admin Panel</p>
              <p className="text-xs text-muted-foreground">SIH 2026 · control centre</p>
            </div>
          </div>

          {/* Portal toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={togglePortal}
              disabled={togglingPortal}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-bold transition-all",
                portalOpen
                  ? "border-success/40 bg-success/10 text-success hover:bg-success/20"
                  : "border-danger/40 bg-danger/10 text-danger hover:bg-danger/20"
              )}
            >
              <span className={cn("size-2 rounded-full", portalOpen ? "bg-success animate-pulse" : "bg-danger")} />
              {togglingPortal ? "Updating…" : portalOpen ? "Registration OPEN" : "Registration CLOSED"}
            </button>
            <Button variant="outline" onClick={() => navigate("/dashboard")} className="hidden sm:inline-flex">Dashboard</Button>
            <Button variant="danger" onClick={logout} className="px-3 py-2">Log out</Button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 pb-3">
          {TABS.map((t) => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className={cn("rounded-lg px-4 py-1.5 text-sm font-semibold transition-all",
                tab === t.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}>
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <span className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="flex flex-col gap-6">

          {/* ── Stat cards ── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Students" value={students.length} accent="ring" />
            <StatCard label="Verified" value={verifiedCount} accent="success" />
            <StatCard label="Pending" value={students.length - verifiedCount} accent="warning" />
            <StatCard label="Teams" value={teams.length} accent="accent" />
            <StatCard label="Valid teams" value={validTeams} accent="success" />
            <StatCard label="Unassigned" value={unassigned.length} accent="warning" sub="not in any team" />
          </div>

          {/* ── Students tab ── */}
          {tab === "students" && (
            <Card className="overflow-hidden p-0">
              <div className="flex flex-col gap-3 border-b border-border px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                <h3 className="text-base font-bold">Student registrations</h3>
                <div className="flex flex-wrap gap-2">
                  <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name / reg no / email…" className="w-56" />
                  <Select value={dept} onChange={(e) => setDept(e.target.value)} className="w-48">
                    <option value="">All departments</option>
                    {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </Select>
                  <Select value={gender} onChange={(e) => setGender(e.target.value)} className="w-32">
                    <option value="">All genders</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </Select>
                  <Select value={verified} onChange={(e) => setVerified(e.target.value)} className="w-36">
                    <option value="all">All statuses</option>
                    <option value="verified">Verified</option>
                    <option value="unverified">Unverified</option>
                  </Select>
                  <Button variant="outline" onClick={exportStudents}>⬇ Export CSV</Button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                      {["Student", "Register No", "Dept · Yr · Sec", "Gender", "Languages", "Project", "Status", "Actions"].map((h) => (
                        <th key={h} className="px-5 py-3 font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {students.length === 0 && (
                      <tr><td colSpan={8} className="px-5 py-10 text-center text-sm text-muted-foreground">No registrations match.</td></tr>
                    )}
                    {students.map((s) => (
                      <tr key={s.id} className="border-b border-border/60 last:border-0 hover:bg-muted/20">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={s.name} className="size-8 shrink-0 text-[10px]" />
                            <div className="leading-tight">
                              <p className="font-semibold">{s.name}</p>
                              <p className="text-xs text-muted-foreground">{s.email ?? "—"}</p>
                              <p className="text-xs text-muted-foreground">{s.phone ?? "—"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{s.register_no ?? "—"}</td>
                        <td className="px-5 py-3 text-xs text-muted-foreground">
                          <p className="max-w-[160px] truncate">{s.department ?? "—"}</p>
                          <p className="text-muted-foreground/70">Yr {s.year ?? "—"} · Sec {s.section ?? "—"}</p>
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">{s.gender ?? "—"}</td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap gap-1">
                            {s.languages.length === 0 ? <span className="text-xs text-muted-foreground">—</span>
                              : s.languages.map((l) => (
                                <span key={l} className="rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">{l}</span>
                              ))}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <p className="text-xs text-muted-foreground">{s.project_type ?? "—"}</p>
                          {s.project_title && <p className="max-w-[140px] truncate text-[10px] text-muted-foreground/70">{s.project_title}</p>}
                        </td>
                        <td className="px-5 py-3">
                          {s.verified
                            ? <GlowingBadge variant="success" pulse={false}>Verified</GlowingBadge>
                            : <GlowingBadge variant="warning" pulse={false}>Pending</GlowingBadge>}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            <Button variant="outline" className="px-2.5 py-1 text-xs" loading={verifying === s.id} onClick={() => toggleVerify(s)}>
                              {s.verified ? "Unverify" : "Verify"}
                            </Button>
                            {s.role === "admin"
                              ? <GlowingBadge variant="info" pulse={false}>Admin</GlowingBadge>
                              : <Button variant="outline" className="px-2.5 py-1 text-xs" loading={promoting === s.phone} onClick={() => promote(s.phone ?? "", s.name)}>Promote</Button>}
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
              <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between border-2 border-primary/20 bg-primary/5">
                <div>
                  <p className="font-bold text-primary">Mentor Auto-Matchmaker</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    <span className="font-semibold text-warning">{unassigned.length} students</span> are not in any team.
                    Auto-assign them into balanced groups of up to 6 (≥ 2 female, ≥ 2 departments).
                  </p>
                </div>
                <Button
                  onClick={runMatchmaker}
                  loading={matching}
                  disabled={unassigned.length === 0}
                  className="shrink-0 bg-primary/90 hover:bg-primary text-primary-foreground"
                >
                  ⚡ Auto-assign teams
                </Button>
              </Card>

              <Card className="overflow-hidden p-0">
                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                  <h3 className="text-base font-bold">All teams</h3>
                  <Button variant="outline" onClick={exportTeams}>⬇ Export CSV</Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                        {["Team", "Members", "Depts", "Female", "Problem", "Status", "Actions"].map((h) => (
                          <th key={h} className="px-5 py-3 font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {teams.length === 0 && (
                        <tr><td colSpan={7} className="px-5 py-10 text-center text-sm text-muted-foreground">No teams yet.</td></tr>
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
                                {t.members.slice(0, 5).map((m) => (
                                  <Avatar key={m.id} name={m.name} className="size-7 text-[9px] ring-2 ring-background" />
                                ))}
                              </div>
                              <span className="text-xs text-muted-foreground">{t.members.length}/6</span>
                            </div>
                          </td>
                          <td className="px-5 py-3 tabular-nums text-muted-foreground">{t.stats.deptCount}</td>
                          <td className="px-5 py-3 tabular-nums text-muted-foreground">{t.stats.girlCount}</td>
                          <td className="max-w-[200px] px-5 py-3 text-xs text-muted-foreground truncate">
                            {problemMap.get(t.team.problem_id ?? "") ?? "—"}
                          </td>
                          <td className="px-5 py-3">
                            {t.stats.valid
                              ? <GlowingBadge variant="success" pulse={false}>Valid</GlowingBadge>
                              : <GlowingBadge variant="warning" pulse={false} title={t.stats.reason}>Invalid</GlowingBadge>}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex gap-1.5">
                              <Button variant="outline" className="px-2.5 py-1 text-xs"
                                onClick={() => setDialogTeam(t)}>
                                Manage
                              </Button>
                              <Button variant="danger" className="px-2.5 py-1 text-xs"
                                loading={deleting === t.team.id} onClick={() => deleteTeam(t)}>
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
          {tab === "analytics" && (
            <div className="grid gap-5 md:grid-cols-2">
              <Card className="p-5">
                <h3 className="mb-4 text-base font-bold">Registrations by Department</h3>
                <BarChart rows={byDept} color="#c9a227" />
              </Card>
              <Card className="p-5">
                <h3 className="mb-4 text-base font-bold">Registrations by Year</h3>
                <BarChart rows={byYear} color="#6d7bdd" />
              </Card>
              <Card className="p-5">
                <h3 className="mb-4 text-base font-bold">Project Type Distribution</h3>
                <BarChart rows={byProject} color="#34d399" />
              </Card>
              <Card className="p-5">
                <h3 className="mb-4 text-base font-bold">Gender Distribution</h3>
                <BarChart rows={byGender} color="#f472b6" />
                <div className="mt-5 grid grid-cols-2 gap-3">
                  {byGender.map((r) => (
                    <div key={r.label} className="rounded-xl border border-border bg-muted/30 p-3 text-center">
                      <p className="text-2xl font-black tabular-nums">{r.value}</p>
                      <p className="text-xs text-muted-foreground">{r.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {students.length ? Math.round((r.value / students.length) * 100) : 0}%
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {tab === "problems" && (
            <ProblemsManager problems={problems} themes={themes} onReload={load} />
          )}
        </div>
      )}
    </main>
  );
}

// ── Problems manager (unchanged logic, re-included) ───────────────────────────
function ProblemsManager({ problems, themes, onReload }: {
  problems: Problem[]; themes: Theme[]; onReload: () => Promise<void>;
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
      category: form.category || null, description: form.description || null,
      themeId: form.themeId || null,
    });
    if (res.error) toast("error", res.error);
    else { toast("success", form.id ? "Problem updated" : "Problem added"); reset(); await onReload(); }
    setSaving(false);
  }

  async function remove(id: string, title: string) {
    if (!window.confirm(`Delete problem "${title}"?`)) return;
    setDeleting(id);
    const res = await data.api.deleteProblem(id);
    if (res.error) toast("error", res.error);
    else { toast("success", "Problem deleted"); await onReload(); }
    setDeleting(null);
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_400px]">
      <Card className="overflow-hidden p-0">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-base font-bold">Problem statements ({problems.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                {["Title", "Category", "Description", "Actions"].map((h) => (
                  <th key={h} className="px-5 py-3 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {problems.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-10 text-center text-sm text-muted-foreground">No problem statements yet.</td></tr>
              )}
              {problems.map((p) => (
                <tr key={p.id} className="border-b border-border/60 last:border-0 hover:bg-muted/20">
                  <td className="max-w-[220px] px-5 py-3 font-semibold">{p.title}</td>
                  <td className="px-5 py-3 text-muted-foreground">{p.category ?? "—"}</td>
                  <td className="max-w-[300px] px-5 py-3 text-xs text-muted-foreground">
                    <p className="line-clamp-2">{p.description ?? "—"}</p>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1.5">
                      <Button variant="outline" className="px-2.5 py-1 text-xs" onClick={() => startEdit(p)}>Edit</Button>
                      <Button variant="danger" className="px-2.5 py-1 text-xs" loading={deleting === p.id} onClick={() => remove(p.id, p.title)}>Delete</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="h-fit p-5">
        <h3 className="mb-4 text-base font-bold">{form.id ? "Edit problem" : "Add problem"}</h3>
        <form onSubmit={save} className="flex flex-col gap-3">
          <Input label="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Problem title" required />
          <Input label="Category" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="e.g. Health, Agriculture…" />
          <label className="block w-full">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</span>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Brief description…" rows={4}
              className="w-full resize-none rounded-xl border border-border bg-background/60 px-3.5 py-2.5 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/70 focus:border-ring/70" />
          </label>
          {themes.length > 0 && (
            <Select label="Theme" value={form.themeId} onChange={(e) => setForm((f) => ({ ...f, themeId: e.target.value }))}>
              <option value="">No theme</option>
              {themes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          )}
          <div className="flex gap-2 pt-1">
            <Button type="submit" loading={saving} className="flex-1">{form.id ? "Update" : "Add problem"}</Button>
            {form.id && <Button type="button" variant="ghost" onClick={reset}>Cancel</Button>}
          </div>
        </form>
      </Card>
    </div>
  );
}
