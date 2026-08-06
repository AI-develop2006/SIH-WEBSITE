"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase/client";
import * as data from "@/lib/data";
import { downloadCsv } from "@/lib/utils";
import { DEPARTMENTS } from "@/lib/constants";
import type { EnrichedTeam, Problem, Profile, Theme } from "@/lib/types";
import { useToast } from "@/components/unlumen-ui/toast";
import { Button } from "@/components/unlumen-ui/button";
import { Card } from "@/components/unlumen-ui/card";
import { GlowingBadge } from "@/components/unlumen-ui/glowing-badge";
import { Avatar } from "@/components/unlumen-ui/avatar";
import { Input, Select } from "@/components/unlumen-ui/input";
import { CollegeBrand } from "@/components/college-brand";
import { cn } from "@/lib/utils";

type Tab = "students" | "teams" | "problems";

export default function AdminPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [tab, setTab] = useState<Tab>("students");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [teams, setTeams] = useState<EnrichedTeam[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [dept, setDept] = useState("");
  const [gender, setGender] = useState("");
  const [verified, setVerified] = useState("all");

  const [promoting, setPromoting] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [profilesRes, teamsRes, problemsRes, themesRes] = await Promise.all([
      data.fetchAllProfiles(),
      data.fetchEnrichedTeams(),
      data.fetchProblems(),
      data.fetchThemes(),
    ]);
    if (profilesRes.error) toast("error", profilesRes.error);
    if (teamsRes.error) toast("error", teamsRes.error);
    if (problemsRes.error) toast("error", problemsRes.error);
    if (themesRes.error) toast("error", themesRes.error);
    setProfiles(profilesRes.data ?? []);
    setTeams(teamsRes.data ?? []);
    setProblems(problemsRes.data ?? []);
    setThemes(themesRes.data ?? []);
  }, [toast]);

  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase!.auth.getSession();
      if (!session) {
        navigate("/", { replace: true });
        return;
      }
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

  const students = useMemo(() => {
    const list = profiles.filter((p) => p.role === "student");
    const needle = q.trim().toLowerCase();
    return list.filter((p) => {
      if (dept && p.department !== dept) return false;
      if (gender && p.gender !== gender) return false;
      if (verified === "verified" && !p.verified) return false;
      if (verified === "unverified" && p.verified) return false;
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
  }, [profiles, q, dept, gender, verified]);

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
            <Button variant="outline" onClick={() => navigate("/dashboard")}>
              Dashboard
            </Button>
            <Button variant="danger" onClick={logout} className="px-3 py-2">
              Log out
            </Button>
          </div>
        </div>

        <div className="flex gap-1 pb-3">
          {(["students", "teams", "problems"] as Tab[]).map((t) => (
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
              {t === "students" ? `Students (${students.length})` : t === "teams" ? `Teams (${teams.length})` : "Problems"}
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Loading…</div>
      ) : (
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
                        <td className="px-5 py-3 text-muted-foreground">{s.project_type ?? "—"}</td>
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
        </div>
      )}
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
