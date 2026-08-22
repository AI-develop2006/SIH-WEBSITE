import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Shield, LogOut, Users, Building2, CheckCircle2, AlertTriangle,
  ChevronDown, ChevronUp, Plus, X, Download, Search, RefreshCw, Sparkles,
} from "lucide-react";
import {
  getCurrentProfile, logoutSpoc, fetchEnrichedTeams,
  fetchFinalTeams, saveFinalTeam, updateFinalTeam, deleteFinalTeam,
} from "@/lib/data";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { cn, validateFinalTeam, downloadXlsx } from "@/lib/utils";
import { MINISTRIES, SPOC_TEAM_SIZE, SPOC_MIN_FEMALE, DEPT_CODE, OUTDATED_MINISTRIES, NEW_MINISTRIES, ACTIVE_MINISTRIES_COUNT } from "@/lib/constants";
import { TeamBuilderModal } from "@/components/TeamBuilderModal";
import { OutdatedMinistryBadge } from "@/components/OutdatedMinistryBadge";
import { NewMinistryBadge } from "@/components/NewMinistryBadge";

// ─── Helpers ────────────────────────────────────────────────────────────────

function getDeptCode(dept) {
  return DEPT_CODE[dept] ?? (dept ?? "?").replace(/\s+/g, "").toUpperCase().slice(0, 6);
}

function genderBadge(gender) {
  if (gender === "Female") return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-pink-500/15 border border-pink-500/30 text-pink-300">F</span>;
  if (gender === "Male") return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300">M</span>;
  return null;
}

// ─── Mini member chip ────────────────────────────────────────────────────────
function MemberChip({ member, onRemove }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-[rgba(147,197,253,0.14)] bg-[#0a1226] px-3 py-2 group">
      <Avatar name={member.name} className="size-7" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-white truncate leading-tight">{member.name}</p>
        <p className="text-[10px] text-[#94a3b8] truncate">
          {getDeptCode(member.department)}
          {member.assigned_skill ? ` · ${member.assigned_skill}` : ""}
        </p>
      </div>
      {genderBadge(member.gender)}
      {onRemove && (
        <button
          type="button"
          onClick={() => onRemove(member.id)}
          className="shrink-0 text-[#94a3b8] hover:text-red-400 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
          aria-label="Remove"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

// ─── Validation summary bar ──────────────────────────────────────────────────
function ValidationBar({ members }) {
  const errors = validateFinalTeam(members);
  const femaleCount = members.filter((m) => m.gender === "Female").length;
  const depts = [...new Set(members.map((m) => m.department).filter(Boolean))];

  const checks = [
    { label: `${members.length}/6 members`, ok: members.length === SPOC_TEAM_SIZE },
    { label: `${depts.length} dept${depts.length !== 1 ? "s" : ""}`, ok: depts.length >= 2 },
    { label: `${femaleCount}/${SPOC_MIN_FEMALE}F`, ok: femaleCount >= SPOC_MIN_FEMALE },
    { label: "Unique skills", ok: errors.every((e) => !e.includes("skill")) },
  ];

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {checks.map((c) => (
        <span
          key={c.label}
          className={cn(
            "inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border",
            c.ok
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-amber-500/10 border-amber-500/30 text-amber-400"
          )}
        >
          {c.ok ? <CheckCircle2 className="size-3 shrink-0" /> : <AlertTriangle className="size-3 shrink-0" />}
          {c.label}
        </span>
      ))}
    </div>
  );
}

// ─── Ministry accordion row ──────────────────────────────────────────────────
function MinistryRow({ ministry, pairTeams, finalTeams, onBuildTeam, onEditTeam, onDeleteTeam, profileMap }) {
  const [open, setOpen] = useState(false);
  const isOutdated = OUTDATED_MINISTRIES.has(ministry);

  const finalsForMinistry = finalTeams.filter((ft) => ft.ministry === ministry);
  const totalPairMembers = pairTeams.reduce((s, t) => s + t.members.length, 0);

  return (
    <div className={cn(
      "rounded-2xl border transition-all duration-200",
      isOutdated
        ? "border-amber-500/20 bg-amber-500/5 opacity-70"
        : pairTeams.length > 0
          ? "border-[rgba(201,162,39,0.25)] bg-[#0a1226]/60"
          : "border-[rgba(147,197,253,0.08)] bg-[#050b18]/40"
    )}>
      {/* Header */}
      <button
        type="button"
        onClick={() => !isOutdated && pairTeams.length > 0 && setOpen((o) => !o)}
        className={cn(
          "w-full flex items-center justify-between gap-3 px-5 py-4 text-left transition-colors",
          isOutdated ? "cursor-not-allowed" : pairTeams.length > 0 ? "cursor-pointer hover:bg-[rgba(201,162,39,0.04)]" : "cursor-default"
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Building2 className={cn("size-4 shrink-0", pairTeams.length > 0 ? "text-[#c9a227]" : "text-[#94a3b8]/40")} />
          <span className={cn("text-sm font-semibold truncate", pairTeams.length > 0 ? "text-white" : "text-[#94a3b8]/50")}>
            {ministry}
          </span>
          <OutdatedMinistryBadge ministry={ministry} inline />
          <NewMinistryBadge ministry={ministry} inline />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {finalsForMinistry.length > 0 && (
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
              {finalsForMinistry.length} final team{finalsForMinistry.length !== 1 ? "s" : ""}
            </span>
          )}
          {pairTeams.length > 0 ? (
            <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-[#c9a227]/15 border border-[#c9a227]/30 text-[#e8c058]">
              {pairTeams.length} pair team{pairTeams.length !== 1 ? "s" : ""} · {totalPairMembers} member{totalPairMembers !== 1 ? "s" : ""}
            </span>
          ) : (
            <span className="text-[10px] text-[#94a3b8]/40 font-medium">No teams</span>
          )}
          {pairTeams.length > 0 && (
            open ? <ChevronUp className="size-4 text-[#94a3b8]" /> : <ChevronDown className="size-4 text-[#94a3b8]" />
          )}
        </div>
      </button>

      {/* Outdated ministry — collapsed notice (never expand) */}
      {isOutdated && pairTeams.length > 0 && (
        <div className="border-t border-amber-500/15 px-5 py-3 flex items-center gap-2 text-[11px] text-amber-400/70">
          <AlertTriangle className="size-3.5 shrink-0" />
          <span>{pairTeams.length} pair team{pairTeams.length !== 1 ? "s" : ""} assigned — ministry is outdated, no further action allowed.</span>
        </div>
      )}

      {/* Expanded body — only for non-outdated ministries */}
      {open && !isOutdated && pairTeams.length > 0 && (
        <div className="border-t border-[rgba(147,197,253,0.08)] px-5 pb-5 pt-4 space-y-5">

          {/* Pair teams from mentor phase */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8] mb-3">
              Available Pair Teams ({pairTeams.length})
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {pairTeams.map((t) => (
                <div key={t.team.id} className="rounded-xl border border-[rgba(147,197,253,0.12)] bg-[#050b18]/60 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-[#e8c058] truncate">
                      {t.team.team_code || t.team.name}
                    </span>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[rgba(147,197,253,0.08)] border border-[rgba(147,197,253,0.14)] text-[#94a3b8]">
                      {t.team.category || "Pairs"}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {t.members.length === 0 ? (
                      <p className="text-[10px] text-[#94a3b8]/60 italic">No members</p>
                    ) : (
                      t.members.map((m) => (
                        <div key={m.id} className="flex items-center gap-2">
                          <Avatar name={m.name} className="size-5" />
                          <span className="text-[11px] text-[#e8ecf7] truncate flex-1">{m.name}</span>
                          {genderBadge(m.gender)}
                          {m.assigned_skill && (
                            <span className="text-[9px] text-[#94a3b8] shrink-0">{m.assigned_skill}</span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Final teams for this ministry */}
          {finalsForMinistry.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8] mb-3">
                Final Teams Formed ({finalsForMinistry.length})
              </p>
              <div className="space-y-3">
                {finalsForMinistry.map((ft) => {
                  const members = (ft.member_ids || []).map((id) => profileMap.get(id)).filter(Boolean);
                  const errors = validateFinalTeam(members);
                  const isValid = errors.length === 0;
                  return (
                    <div key={ft.id} className={cn(
                      "rounded-2xl border p-4 space-y-3",
                      isValid ? "border-emerald-500/25 bg-emerald-500/5" : "border-amber-500/20 bg-amber-500/5"
                    )}>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          {isValid
                            ? <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                            : <AlertTriangle className="size-4 text-amber-400 shrink-0" />
                          }
                          <span className="text-sm font-extrabold text-white">{ft.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            onClick={() => onEditTeam(ft)}
                            className="text-[11px] px-3 py-1.5 text-[#c9a227] hover:bg-[#c9a227]/10"
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => onDeleteTeam(ft.id, ft.name)}
                            className="text-[11px] px-3 py-1.5 text-red-400 hover:bg-red-500/10"
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                      <ValidationBar members={members} />
                      <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3 mt-2">
                        {members.map((m) => (
                          <MemberChip key={m.id} member={m} />
                        ))}
                      </div>
                      {!isValid && (
                        <div className="space-y-1">
                          {errors.map((e) => (
                            <p key={e} className="text-[10px] text-amber-400 flex items-center gap-1">
                              <AlertTriangle className="size-3 shrink-0" />{e}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Build new final team button — disabled for outdated ministries */}
          {isOutdated ? (
            <div className="flex items-center gap-2 w-full rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5 text-xs text-amber-400/80">
              <AlertTriangle className="size-3.5 shrink-0" />
              <span>This ministry is outdated — no new final teams can be created. Reassign pair teams to an active ministry first.</span>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={() => onBuildTeam(ministry, pairTeams)}
              className="w-full border-[#c9a227]/30 text-[#c9a227] hover:bg-[#c9a227]/8 text-xs py-2.5"
            >
              <Plus className="size-3.5" />
              Build Final Team from this Ministry
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────
export default function SpocDashboard() {
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [spocName, setSpocName] = useState("SPOC");
  const [pairTeams, setPairTeams] = useState([]);
  const [finalTeams, setFinalTeams] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active"); // "active" | "all" | "outdated"

  // Team builder modal state
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderMinistry, setBuilderMinistry] = useState(null);
  const [builderSourceTeams, setBuilderSourceTeams] = useState([]);
  const [editingFinalTeam, setEditingFinalTeam] = useState(null);

  // ── Load data ──────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    const [profileRes, teamsRes, finalRes] = await Promise.all([
      getCurrentProfile(),
      fetchEnrichedTeams(),
      fetchFinalTeams(),
    ]);

    if (profileRes.error || !profileRes.data) {
      navigate("/", { replace: true });
      return;
    }
    if (profileRes.data.role !== "spoc") {
      toast("error", "Access denied — SPOC role required");
      navigate("/", { replace: true });
      return;
    }

    setSpocName(profileRes.data.name ?? "SPOC");
    setPairTeams(teamsRes.data ?? []);
    setFinalTeams(finalRes.data ?? []);
  }, [navigate, toast]);

  useEffect(() => {
    (async () => {
      await loadAll();
      setLoading(false);
    })();
  }, [loadAll]);

  // ── Derived state ──────────────────────────────────────────────────────────

  // Map from profile id → profile (for rendering final team members by id)
  const profileMap = useMemo(() => {
    const map = new Map();
    pairTeams.forEach((t) => t.members.forEach((m) => map.set(m.id, m)));
    return map;
  }, [pairTeams]);

  // Group pair-teams by ministry
  const byMinistry = useMemo(() => {
    const map = new Map();
    MINISTRIES.forEach((m) => map.set(m, []));
    pairTeams.forEach((t) => {
      if (t.team.ministry) {
        if (!map.has(t.team.ministry)) map.set(t.team.ministry, []);
        map.get(t.team.ministry).push(t);
      }
    });
    return map;
  }, [pairTeams]);

  // Stats
  const stats = useMemo(() => {
    const activeMinistries = [...byMinistry.entries()].filter(([, ts]) => ts.length > 0).length;
    const validFinals = finalTeams.filter((ft) => {
      const members = (ft.member_ids || []).map((id) => profileMap.get(id)).filter(Boolean);
      return validateFinalTeam(members).length === 0;
    }).length;
    return { activeMinistries, finalCount: finalTeams.length, validFinals };
  }, [byMinistry, finalTeams, profileMap]);

  // Filtered ministries — now handled by displayedMinistries below

  const displayedMinistries = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return MINISTRIES.filter((m) => {
      const teams = byMinistry.get(m) ?? [];
      const hasTeams = teams.length > 0;
      if (statusFilter === "active" && !hasTeams) return false;
      if (statusFilter === "outdated" && !OUTDATED_MINISTRIES.has(m)) return false;
      if (statusFilter === "new" && !NEW_MINISTRIES.has(m)) return false;
      if (needle && !m.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [byMinistry, search, statusFilter]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function openBuilder(ministry, sourceTeams, existingFinalTeam = null) {
    setBuilderMinistry(ministry);
    setBuilderSourceTeams(sourceTeams);
    setEditingFinalTeam(existingFinalTeam);
    setBuilderOpen(true);
  }

  async function handleSaveFinalTeam({ name, ministry, member_ids }) {
    if (editingFinalTeam) {
      const res = await updateFinalTeam(editingFinalTeam.id, { name, ministry, member_ids });
      if (res.error) { toast("error", res.error); return; }
      setFinalTeams((prev) => prev.map((ft) => ft.id === editingFinalTeam.id ? { ...ft, name, ministry, member_ids } : ft));
      toast("success", `Final team "${name}" updated!`);
    } else {
      const res = await saveFinalTeam({ name, ministry, member_ids });
      if (res.error) { toast("error", res.error); return; }
      if (res.data) setFinalTeams((prev) => [...prev, res.data]);
      toast("success", `Final team "${name}" saved!`);
    }
    setBuilderOpen(false);
    setEditingFinalTeam(null);
  }

  async function handleDeleteFinalTeam(id, name) {
    if (!confirm(`Delete final team "${name}"?`)) return;
    const res = await deleteFinalTeam(id);
    if (res.error) { toast("error", res.error); return; }
    setFinalTeams((prev) => prev.filter((ft) => ft.id !== id));
    toast("success", `Team "${name}" deleted.`);
  }

  async function exportFinalTeams() {
    const rows = finalTeams.flatMap((ft) => {
      const members = (ft.member_ids || []).map((id) => profileMap.get(id)).filter(Boolean);
      return members.map((m, i) => ({
        team_name: ft.name,
        ministry: ft.ministry ?? "",
        member_no: i + 1,
        name: m.name,
        register_no: m.register_no ?? "",
        gender: m.gender ?? "",
        department: m.department ?? "",
        year: m.year ?? "",
        section: m.section ?? "",
        skill: m.assigned_skill ?? "",
        valid: validateFinalTeam(members).length === 0 ? "Yes" : "No",
      }));
    });

    await downloadXlsx("spoc-final-teams.xlsx", rows, [
      { key: "team_name",   label: "Final Team Name" },
      { key: "ministry",    label: "Ministry" },
      { key: "member_no",   label: "#" },
      { key: "name",        label: "Student Name" },
      { key: "register_no", label: "Register No" },
      { key: "gender",      label: "Gender" },
      { key: "department",  label: "Department" },
      { key: "year",        label: "Year" },
      { key: "section",     label: "Section" },
      { key: "skill",       label: "Assigned Skill" },
      { key: "valid",       label: "Valid" },
    ]);
  }

  async function logout() {
    await logoutSpoc();
    navigate("/", { replace: true });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050b18]">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-2 border-[#c9a227] border-t-transparent" />
          <p className="text-sm text-[#94a3b8]">Loading SPOC Portal…</p>
        </div>
      </div>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-[1400px] px-4 sm:px-6 pb-20 bg-[#050b18] text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 -mx-4 sm:-mx-6 mb-6 border-b border-[rgba(147,197,253,0.10)] bg-[#050b18]/90 px-4 sm:px-6 backdrop-blur">
        <div className="flex h-14 items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-[#c9a227]/30 bg-[#c9a227]/10">
              <Shield className="size-4 text-[#c9a227]" strokeWidth={2} />
            </div>
            <div className="hidden sm:block min-w-0">
              <p className="text-sm font-extrabold text-white truncate">SPOC Portal — {spocName}</p>
              <p className="text-[10px] text-[#94a3b8]">SIH 2026 · Final Team Formation</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => loadAll()} className="gap-1.5 text-xs px-3 py-1.5 text-[#94a3b8]">
              <RefreshCw className="size-3.5" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            {finalTeams.length > 0 && (
              <Button variant="outline" onClick={exportFinalTeams} className="gap-1.5 text-xs px-3 py-1.5 border-[#c9a227]/30 text-[#c9a227] hover:bg-[#c9a227]/8">
                <Download className="size-3.5" />
                <span className="hidden sm:inline">Export</span>
              </Button>
            )}
            <Button variant="ghost" onClick={logout} className="text-xs px-3 py-1.5 text-[#94a3b8] hover:text-red-400">
              <LogOut className="size-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Active Ministries", value: stats.activeMinistries, icon: Building2, color: "text-[#c9a227]" },
          { label: "Pair Teams", value: pairTeams.filter((t) => t.team.ministry).length, icon: Users, color: "text-blue-400" },
          { label: "Final Teams", value: stats.finalCount, icon: CheckCircle2, color: "text-emerald-400" },
          { label: "Valid Finals", value: stats.validFinals, icon: CheckCircle2, color: "text-emerald-400" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-[rgba(147,197,253,0.10)] bg-[#0a1226]/60 p-4">
            <s.icon className={cn("size-5 mb-2", s.color)} />
            <p className="text-2xl font-black text-white">{s.value}</p>
            <p className="text-[10px] text-[#94a3b8] font-semibold uppercase tracking-wider mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Rules banner */}
      <div className="mb-5 rounded-2xl border border-[#c9a227]/20 bg-[#c9a227]/5 px-5 py-3.5">
        <p className="text-xs font-bold text-[#e8c058] mb-1.5">Final Team Rules</p>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-[#94a3b8]">
          <span>• Exactly <strong className="text-white">6 members</strong> per final team</span>
          <span>• Members from the <strong className="text-white">same ministry</strong></span>
          <span>• At least <strong className="text-white">2 departments</strong> represented</span>
          <span>• At least <strong className="text-white">2 female</strong> members</span>
          <span>• All members must have <strong className="text-white">different skillsets</strong></span>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="space-y-3 mb-5">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#94a3b8]" />
          <input
            type="text"
            placeholder="Search ministry…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-2xl border border-[rgba(147,197,253,0.14)] bg-[#0a1226]/60 pl-10 pr-4 py-3 text-sm text-white outline-none placeholder:text-[#94a3b8]/60 focus:border-[#c9a227]/50 transition-all"
          />
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">Show:</span>
          {[
            { id: "active",   label: "Active" },
            { id: "all",      label: "All" },
            { id: "outdated", label: "Outdated", icon: <AlertTriangle className="size-3 shrink-0" /> },
            { id: "new",      label: "New",      icon: <Sparkles className="size-3 shrink-0" /> },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border",
                statusFilter === f.id
                  ? f.id === "active"
                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                    : f.id === "outdated"
                    ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                    : f.id === "new"
                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                    : "bg-[#c9a227]/20 border-[#c9a227]/40 text-[#e8c058]"
                  : "bg-[#0a1226]/60 border-[rgba(147,197,253,0.14)] text-[#94a3b8] hover:text-white hover:border-[rgba(147,197,253,0.3)]"
              )}
            >
              {f.icon ?? null}
              {f.label}
            </button>
          ))}
          <span className="ml-auto text-[10px] text-[#94a3b8]">
            <span className="text-white font-bold">{displayedMinistries.length}</span> / {MINISTRIES.length} shown
          </span>
        </div>

        {/* Outdated info banner */}
        {statusFilter === "outdated" && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/8 px-4 py-3">
            <AlertTriangle className="size-3.5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-300/90 leading-relaxed">
              <span className="font-bold text-amber-300">What does "Outdated" mean?</span>
              {" "}These ministries are not listed in the official SIH 2026 Problem Statements. Teams that selected an outdated ministry will need to be reconsidered and reassigned to one of the currently active ministries.
            </p>
          </div>
        )}

        {/* New info banner */}
        {statusFilter === "new" && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/8 px-4 py-3">
            <Sparkles className="size-3.5 text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-emerald-300/90 leading-relaxed">
              <span className="font-bold text-emerald-300">What does "New" mean?</span>
              {" "}These ministries were newly added to the official SIH 2026 Problem Statements. Teams choosing these ministries are working on recently introduced problem statements.
            </p>
          </div>
        )}
      </div>

      {/* Ministry accordion list */}
      <div className="space-y-2">
          {displayedMinistries.length === 0 && (
          <div className="py-16 text-center text-sm text-[#94a3b8] rounded-2xl border border-[rgba(147,197,253,0.08)]">
            {statusFilter === "outdated"
              ? "No outdated ministries found."
              : statusFilter === "new"
              ? "No new ministries found."
              : search
              ? "No ministries match your search."
              : "No pair teams with ministries assigned yet."}
          </div>
        )}
        {displayedMinistries.map((ministry) => (
          <MinistryRow
            key={ministry}
            ministry={ministry}
            pairTeams={byMinistry.get(ministry) ?? []}
            finalTeams={finalTeams}
            profileMap={profileMap}
            onBuildTeam={(min, srcTeams) => openBuilder(min, srcTeams)}
            onEditTeam={(ft) => {
              const srcTeams = byMinistry.get(ft.ministry) ?? [];
              openBuilder(ft.ministry, srcTeams, ft);
            }}
            onDeleteTeam={handleDeleteFinalTeam}
          />
        ))}
      </div>

      {/* Team Builder Modal */}
      {builderOpen && (
        <TeamBuilderModal
          ministry={builderMinistry}
          sourceTeams={builderSourceTeams}
          editingTeam={editingFinalTeam}
          profileMap={profileMap}
          onSave={handleSaveFinalTeam}
          onClose={() => { setBuilderOpen(false); setEditingFinalTeam(null); }}
        />
      )}
    </main>
  );
}
