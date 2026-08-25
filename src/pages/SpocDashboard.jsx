import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Shield, LogOut, Users, Building2, CheckCircle2, AlertTriangle,
  ChevronDown, ChevronUp, Plus, X, Download, Search, RefreshCw, Sparkles, Trash2,
  ListChecks, Activity,
} from "lucide-react";
import {
  getCurrentProfile, logoutSpoc, fetchEnrichedTeams, fetchAllProfiles,
  fetchFinalTeams, saveFinalTeam, updateFinalTeam, deleteFinalTeam,
  fetchClaimedMembers, subscribeToTeamEvents, subscribeToPairTeamEvents,
} from "@/lib/data";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { cn, validateFinalTeam, downloadXlsx } from "@/lib/utils";
import { MINISTRIES, SPOC_TEAM_SIZE, SPOC_MIN_FEMALE, DEPT_CODE, OUTDATED_MINISTRIES, NEW_MINISTRIES, ACTIVE_MINISTRIES_COUNT } from "@/lib/constants";
import { TeamBuilderModal } from "@/components/TeamBuilderModal";
import { OutdatedMinistryBadge } from "@/components/OutdatedMinistryBadge";
import { NewMinistryBadge } from "@/components/NewMinistryBadge";
import { MonitoringView } from "@/components/MonitoringView";
import { AccessLogView } from "@/components/AccessLogView";

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
function MemberChip({ member }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-[rgba(147,197,253,0.14)] bg-[#0a1226] px-3 py-2">
      <Avatar name={member.name} className="size-7 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-white truncate leading-tight">{member.name}</p>
        <p className="text-[10px] text-[#94a3b8] truncate">
          {getDeptCode(member.department)}
          {member.assigned_skill ? ` · ${member.assigned_skill}` : ""}
        </p>
      </div>
      {genderBadge(member.gender)}
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

// ─── Final team card ─────────────────────────────────────────────────────────
function FinalTeamCard({ ft, profileMap, onEdit, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const members = useMemo(
    () => (ft.member_ids || []).map((id) => profileMap.get(id)).filter(Boolean),
    [ft.member_ids, profileMap]
  );
  const errors = validateFinalTeam(members);
  const isValid = errors.length === 0;

  async function handleConfirmDelete() {
    setDeleting(true);
    await onDelete(ft.id, ft.name);
    setDeleting(false);
    setConfirmDelete(false);
  }

  return (
    <div className={cn(
      "rounded-2xl border p-4 space-y-3 transition-all duration-200",
      isValid ? "border-emerald-500/25 bg-emerald-500/5" : "border-amber-500/20 bg-amber-500/5"
    )}>
      {/* Header row */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          {isValid
            ? <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
            : <AlertTriangle className="size-4 text-amber-400 shrink-0" />
          }
          <span className="text-sm font-extrabold text-white truncate">{ft.name}</span>
        </div>
        {!confirmDelete && (
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="ghost"
              onClick={() => onEdit(ft)}
              className="text-[11px] px-3 py-1.5 text-[#c9a227] hover:bg-[#c9a227]/10"
            >
              Edit Members
            </Button>
            <Button
              variant="ghost"
              onClick={() => setConfirmDelete(true)}
              className="text-[11px] px-3 py-1.5 text-red-400 hover:bg-red-500/10 hover:text-red-300"
            >
              <Trash2 className="size-3 shrink-0" />
              Delete
            </Button>
          </div>
        )}
      </div>

      {/* Inline delete confirmation */}
      {confirmDelete && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/8 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-red-300 font-semibold">
            Delete <span className="font-black">"{ft.name}"</span>? Members will be notified.
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="ghost"
              onClick={() => setConfirmDelete(false)}
              disabled={deleting}
              className="text-[11px] px-3 py-1.5 text-[#94a3b8]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmDelete}
              loading={deleting}
              className="text-[11px] px-3 py-1.5 bg-red-500 hover:bg-red-400 text-white"
            >
              <Trash2 className="size-3 shrink-0" />
              Confirm Delete
            </Button>
          </div>
        </div>
      )}

      <ValidationBar members={members} />

      <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3 mt-2">
        {members.map((m) => (
          <MemberChip key={m.id} member={m} />
        ))}
      </div>

      {!isValid && !confirmDelete && (
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
}

// ─── Final Teams Panel ────────────────────────────────────────────────────────
// Standalone filterable view of all created final teams, shown above the ministry accordion.
function FinalTeamsPanel({ finalTeams, profileMap, onEdit, onDelete }) {
  const [open, setOpen] = useState(true);
  const [search, setSearch] = useState("");
  const [ministryFilter, setMinistryFilter] = useState("all");
  const [validFilter, setValidFilter] = useState("all"); // "all" | "valid" | "invalid"

  const allMinistries = useMemo(() => {
    const s = new Set(finalTeams.map((ft) => ft.ministry).filter(Boolean));
    return [...s].sort();
  }, [finalTeams]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return finalTeams.filter((ft) => {
      const members = (ft.member_ids || []).map((id) => profileMap.get(id)).filter(Boolean);
      const isValid = validateFinalTeam(members).length === 0;

      if (ministryFilter !== "all" && ft.ministry !== ministryFilter) return false;
      if (validFilter === "valid" && !isValid) return false;
      if (validFilter === "invalid" && isValid) return false;
      if (needle) {
        const hay = [
          ft.name,
          ft.ministry,
          ...members.map((m) => `${m.name} ${m.register_no ?? ""} ${m.department ?? ""}`),
        ].join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [finalTeams, profileMap, search, ministryFilter, validFilter]);

  const validCount   = useMemo(() => finalTeams.filter((ft) => validateFinalTeam((ft.member_ids || []).map((id) => profileMap.get(id)).filter(Boolean)).length === 0).length, [finalTeams, profileMap]);
  const invalidCount = finalTeams.length - validCount;

  if (finalTeams.length === 0) return null;

  return (
    <div className="mb-6 rounded-2xl border border-emerald-500/25 bg-[#050b18]/60 overflow-hidden">
      {/* Header — click to collapse */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-emerald-500/5 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <ListChecks className="size-4 text-emerald-400 shrink-0" />
          <span className="text-sm font-extrabold text-white">Final Teams Created</span>
          <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
            {finalTeams.length} total
          </span>
          {validCount > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">
              {validCount} valid
            </span>
          )}
          {invalidCount > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400">
              {invalidCount} incomplete
            </span>
          )}
        </div>
        <ChevronDown className={cn("size-4 text-[#94a3b8] transition-transform duration-200", open ? "rotate-180" : "rotate-0")} />
      </button>

      {open && (
        <div className="border-t border-emerald-500/15 px-5 pb-5 pt-4 space-y-4">
          {/* Filters row */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[#94a3b8] pointer-events-none" />
              <input
                type="text"
                placeholder="Search team name or member…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-[rgba(147,197,253,0.18)] bg-[#050b18]/60 pl-9 pr-8 py-2 text-xs text-white outline-none placeholder:text-[#94a3b8]/50 focus:border-[#c9a227]/50 transition-all"
              />
              {search && (
                <button type="button" onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-white">
                  <X className="size-3" />
                </button>
              )}
            </div>

            {/* Ministry filter */}
            <select
              value={ministryFilter}
              onChange={(e) => setMinistryFilter(e.target.value)}
              className="rounded-xl border border-[rgba(147,197,253,0.18)] bg-[#050b18]/60 px-3 py-2 text-xs text-white outline-none focus:border-[#c9a227]/50 transition-all cursor-pointer min-w-[160px]"
            >
              <option value="all">All Ministries</option>
              {allMinistries.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>

            {/* Validity filter chips */}
            <div className="flex items-center gap-1.5 shrink-0">
              {[
                { id: "all",     label: "All" },
                { id: "valid",   label: "✓ Valid" },
                { id: "invalid", label: "⚠ Incomplete" },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setValidFilter(f.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer",
                    validFilter === f.id
                      ? f.id === "valid"
                        ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                        : f.id === "invalid"
                        ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                        : "bg-[#c9a227]/20 border-[#c9a227]/40 text-[#e8c058]"
                      : "bg-[#0a1226]/60 border-[rgba(147,197,253,0.14)] text-[#94a3b8] hover:text-white hover:border-[rgba(147,197,253,0.3)]"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Result count */}
          {(search || ministryFilter !== "all" || validFilter !== "all") && (
            <p className="text-[10px] text-[#94a3b8]">
              Showing <span className="text-white font-bold">{filtered.length}</span> of {finalTeams.length} teams
            </p>
          )}

          {/* Team cards */}
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-xs text-[#94a3b8]">No final teams match your filters.</p>
          ) : (
            <div className="space-y-3">
              {filtered.map((ft) => (
                <FinalTeamCard
                  key={ft.id}
                  ft={ft}
                  profileMap={profileMap}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Ministry accordion row ──────────────────────────────────────────────────
function MinistryRow({ ministry, pairTeams, finalTeams, onBuildTeam, onEditTeam, onDeleteTeam, profileMap, claimedMemberIds }) {
  const [open, setOpen] = useState(false);
  const bodyRef = useRef(null);
  const isOutdated = OUTDATED_MINISTRIES.has(ministry);

  const finalsForMinistry = finalTeams.filter((ft) => ft.ministry === ministry);
  const totalPairMembers = pairTeams.reduce((s, t) => s + t.members.length, 0);
  const canExpand = !isOutdated && pairTeams.length > 0;

  // Animate open/close with max-height
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    if (open) {
      // First pass: measure
      el.style.overflow = "hidden";
      el.style.maxHeight = el.scrollHeight + "px";
      el.style.opacity = "1";
      // After transition, allow overflow so inner scrollable areas work
      const timer = setTimeout(() => {
        if (el) {
          el.style.maxHeight = "none";
          el.style.overflow = "visible";
        }
      }, 300);
      return () => clearTimeout(timer);
    } else {
      // Snap back: first lock the current height, then animate to 0
      el.style.overflow = "hidden";
      el.style.maxHeight = el.scrollHeight + "px";
      // Force reflow
      // eslint-disable-next-line no-unused-expressions
      el.offsetHeight;
      el.style.maxHeight = "0px";
      el.style.opacity = "0";
    }
  }, [open]);

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
        onClick={() => canExpand && setOpen((o) => !o)}
        className={cn(
          "w-full flex items-center justify-between gap-3 px-5 py-4 text-left transition-colors",
          canExpand ? "cursor-pointer hover:bg-[rgba(201,162,39,0.04)]" : "cursor-default"
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
              {finalsForMinistry.length} final{finalsForMinistry.length !== 1 ? "s" : ""}
            </span>
          )}
          {pairTeams.length > 0 ? (
            <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-[#c9a227]/15 border border-[#c9a227]/30 text-[#e8c058]">
              {pairTeams.length} pair{pairTeams.length !== 1 ? "s" : ""} · {totalPairMembers}
            </span>
          ) : (
            <span className="text-[10px] text-[#94a3b8]/40 font-medium">No teams</span>
          )}
          {canExpand && (
            <div className={cn("transition-transform duration-200", open ? "rotate-180" : "rotate-0")}>
              <ChevronDown className="size-4 text-[#94a3b8]" />
            </div>
          )}
        </div>
      </button>

      {/* Outdated ministry notice */}
      {isOutdated && pairTeams.length > 0 && (
        <div className="border-t border-amber-500/15 px-5 py-3 flex items-center gap-2 text-[11px] text-amber-400/70">
          <AlertTriangle className="size-3.5 shrink-0" />
          <span>{pairTeams.length} pair team{pairTeams.length !== 1 ? "s" : ""} assigned — ministry is outdated, no further action allowed.</span>
        </div>
      )}

      {/* Animated body */}
      <div
        ref={bodyRef}
        style={{ maxHeight: "0px", opacity: "0", overflow: "hidden", transition: "max-height 0.28s ease, opacity 0.2s ease" }}
      >
        {canExpand && (
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
                        t.members.map((m) => {
                          const isClaimed = claimedMemberIds.has(m.id);
                          return (
                            <div key={m.id} className={cn("flex items-center gap-2", isClaimed && "opacity-40")}>
                              <Avatar name={m.name} className="size-5" />
                              <span className={cn("text-[11px] truncate flex-1", isClaimed ? "text-[#94a3b8]/60 line-through" : "text-[#e8ecf7]")}>{m.name}</span>
                              {genderBadge(m.gender)}
                              {isClaimed
                                ? <span className="text-[9px] font-bold text-rose-400/70">taken</span>
                                : m.assigned_skill && <span className="text-[9px] text-[#94a3b8] shrink-0">{m.assigned_skill}</span>
                              }
                            </div>
                          );
                        })
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
                  {finalsForMinistry.map((ft) => (
                    <FinalTeamCard
                      key={ft.id}
                      ft={ft}
                      profileMap={profileMap}
                      onEdit={onEditTeam}
                      onDelete={onDeleteTeam}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Build new final team button */}
            <Button
              variant="outline"
              onClick={() => onBuildTeam(ministry, pairTeams)}
              className="w-full border-[#c9a227]/30 text-[#c9a227] hover:bg-[#c9a227]/8 text-xs py-2.5"
            >
              <Plus className="size-3.5" />
              Build Final Team from this Ministry
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Skeleton loader ─────────────────────────────────────────────────────────
function Skeleton({ className }) {
  return <div className={cn("animate-pulse rounded-xl bg-[rgba(147,197,253,0.07)]", className)} />;
}

function DashboardSkeleton() {
  return (
    <main className="mx-auto min-h-screen max-w-[1400px] px-4 sm:px-6 pb-20 bg-[#050b18] text-white">
      <header className="sticky top-0 z-40 -mx-4 sm:-mx-6 mb-6 border-b border-[rgba(147,197,253,0.10)] bg-[#050b18]/90 px-4 sm:px-6 backdrop-blur">
        <div className="flex h-14 items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-[#c9a227]/30 bg-[#c9a227]/10">
              <Shield className="size-4 text-[#c9a227]" strokeWidth={2} />
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-extrabold text-white">SPOC Portal</p>
              <p className="text-[10px] text-[#94a3b8]">SIH 2026 · Final Team Formation</p>
            </div>
          </div>
        </div>
      </header>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <Skeleton className="h-16 mb-5" />
      <div className="space-y-2 mb-5">
        <Skeleton className="h-12" />
        <Skeleton className="h-10" />
      </div>
      <div className="space-y-2">
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16" />)}
      </div>
    </main>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────
export default function SpocDashboard() {
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [spocName, setSpocName] = useState("SPOC");
  const [allProfiles, setAllProfiles] = useState([]);
  const [pairTeams, setPairTeams] = useState([]);
  const [finalTeams, setFinalTeams] = useState([]);
  const [claimedMemberIds, setClaimedMemberIds] = useState(new Set());
  const [liveConnected, setLiveConnected] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("teams"); // "teams" | "monitoring"

  // Team builder modal state
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderMinistry, setBuilderMinistry] = useState(null);
  const [builderSourceTeams, setBuilderSourceTeams] = useState([]);
  const [editingFinalTeam, setEditingFinalTeam] = useState(null);

  // ── Load data ──────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    const [profileRes, teamsRes, finalRes, claimedRes, allProfilesRes] = await Promise.all([
      getCurrentProfile(),
      fetchEnrichedTeams(),
      fetchFinalTeams(),
      fetchClaimedMembers(),
      fetchAllProfiles(),
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
    setClaimedMemberIds(new Set(claimedRes.data ?? []));
    setAllProfiles(allProfilesRes.data ?? []);
  }, [navigate, toast]);

  const refreshData = useCallback(async (silent = true) => {
    if (!silent) setRefreshing(true);
    const [teamsRes, finalRes, claimedRes, allProfilesRes] = await Promise.all([
      fetchEnrichedTeams(),
      fetchFinalTeams(),
      fetchClaimedMembers(),
      fetchAllProfiles(),
    ]);
    if (teamsRes.data) setPairTeams(teamsRes.data);
    if (finalRes.data) setFinalTeams(finalRes.data);
    if (claimedRes.data) setClaimedMemberIds(new Set(claimedRes.data));
    if (allProfilesRes.data) setAllProfiles(allProfilesRes.data);
    setLastRefreshed(new Date());
    if (!silent) setRefreshing(false);
  }, []);

  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  useEffect(() => {
    (async () => {
      await loadAll();
      setLastRefreshed(new Date());
      setLoading(false);
    })();
  }, [loadAll]);

  // ── SSE: real-time updates from other SPOC sessions (final teams) ─────────
  // Subscribes to SPOC backend SSE; refreshes data on any final-team change.
  // Falls back to 30-second polling if SSE is unavailable.
  useEffect(() => {
    const cleanup = subscribeToTeamEvents(() => refreshData(true));
    setLiveConnected(true);
    // Polling fallback — fires only if SSE somehow misses an event
    const poll = setInterval(() => refreshData(true), 30_000);
    return () => { cleanup(); setLiveConnected(false); clearInterval(poll); };
  }, [refreshData]);

  // ── SSE: real-time updates from the mentor backend (pair teams) ────────────
  // When a mentor assigns/changes a ministry or skill on a pair-team, or adds /
  // removes a member, the mentor backend broadcasts `pair_teams_updated`.
  // We re-fetch pairTeams so the SPOC view stays in sync without a manual reload.
  useEffect(() => {
    const cleanupPair = subscribeToPairTeamEvents(async () => {
      const teamsRes = await fetchEnrichedTeams();
      if (teamsRes.data) setPairTeams(teamsRes.data);
    });
    return () => cleanupPair();
  }, []);

  // ── Derived state ──────────────────────────────────────────────────────────
  const profileMap = useMemo(() => {
    const map = new Map();
    pairTeams.forEach((t) => t.members.forEach((m) => map.set(m.id, m)));
    return map;
  }, [pairTeams]);

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

  const stats = useMemo(() => {
    const activeMinistries = [...byMinistry.entries()].filter(([, ts]) => ts.length > 0).length;
    const validFinals = finalTeams.filter((ft) => {
      const members = (ft.member_ids || []).map((id) => profileMap.get(id)).filter(Boolean);
      return validateFinalTeam(members).length === 0;
    }).length;
    return { activeMinistries, finalCount: finalTeams.length, validFinals };
  }, [byMinistry, finalTeams, profileMap]);

  const displayedMinistries = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return MINISTRIES.filter((m) => {
      const teams = byMinistry.get(m) ?? [];
      const hasTeams = teams.length > 0;
      const isOutdated = OUTDATED_MINISTRIES.has(m);
      if (statusFilter === "active" && (!hasTeams || isOutdated)) return false;
      if (statusFilter === "outdated" && !isOutdated) return false;
      if (statusFilter === "new" && !NEW_MINISTRIES.has(m)) return false;
      if (statusFilter === "all" && isOutdated) return false;
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

  async function handleDeleteFinalTeam(id, name) {
    // Optimistic remove
    setFinalTeams((prev) => prev.filter((ft) => ft.id !== id));
    setClaimedMemberIds((prev) => {
      // Remove claimed IDs that belonged to the deleted team
      // We don't know exactly which IDs — refresh will handle it
      return prev;
    });
    const res = await deleteFinalTeam(id);
    if (res.error) {
      toast("error", res.error);
      await refreshData(true); // rollback on failure
      return;
    }
    toast("success", `Team "${name}" deleted.`);
    refreshData(true); // sync claimed members
  }

  async function handleSaveFinalTeam({ name, ministry, member_ids }) {
    if (editingFinalTeam) {
      // Optimistic update
      setFinalTeams((prev) =>
        prev.map((ft) => ft.id === editingFinalTeam.id ? { ...ft, name, ministry, member_ids } : ft)
      );
      const res = await updateFinalTeam(editingFinalTeam.id, { name, ministry, member_ids });
      if (res.error) {
        toast("error", res.error);
        await refreshData(true); // rollback + sync
        return { conflict: res.error?.includes("already assigned") };
      }
      toast("success", `Final team "${name}" updated!`);
    } else {
      const res = await saveFinalTeam({ name, ministry, member_ids });
      if (res.error) {
        if (res.conflict) {
          toast("error", "⚡ One or more members were just claimed by another session. The list has been refreshed — please reselect.");
        } else {
          toast("error", res.error);
        }
        await refreshData(true);
        return { conflict: res.conflict };
      }
      if (res.data) setFinalTeams((prev) => [...prev, res.data]);
      toast("success", `Final team "${name}" saved!`);
    }
    setBuilderOpen(false);
    setEditingFinalTeam(null);
    refreshData(true);
    return { conflict: false };
  }

  async function exportFinalTeams() {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();

    // Group final teams by ministry
    const byMin = new Map();
    for (const ft of finalTeams) {
      const min = ft.ministry?.trim() || "No Ministry";
      if (!byMin.has(min)) byMin.set(min, []);
      byMin.get(min).push(ft);
    }

    // Sort ministries alphabetically, but put "No Ministry" last
    const sortedMinistries = [...byMin.keys()].sort((a, b) => {
      if (a === "No Ministry") return 1;
      if (b === "No Ministry") return -1;
      return a.localeCompare(b);
    });

    const HEADER = ["Team Name", "Register Number", "Member Name", "Department", "Year", "Section", "Phone Number"];

    for (const ministry of sortedMinistries) {
      const teams = byMin.get(ministry);
      const aoa = [HEADER]; // array-of-arrays for the sheet

      for (const ft of teams) {
        const members = (ft.member_ids || []).map((id) => profileMap.get(id)).filter(Boolean);

        members.forEach((m, idx) => {
          aoa.push([
            idx === 0 ? ft.name : "",   // Team Name only on first member row
            m.register_no ?? "",
            m.name ?? "",
            m.department ?? "",
            m.year ?? "",
            m.section ?? "",
            m.phone ?? "",
          ]);
        });

        // Blank separator row between teams
        aoa.push(["", "", "", "", "", "", ""]);
      }

      const ws = XLSX.utils.aoa_to_sheet(aoa);

      // Column widths
      ws["!cols"] = [
        { wch: 28 }, // Team Name
        { wch: 16 }, // Register Number
        { wch: 28 }, // Member Name
        { wch: 30 }, // Department
        { wch: 8  }, // Year
        { wch: 10 }, // Section
        { wch: 14 }, // Phone Number
      ];

      // Freeze header row
      ws["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft" };

      // Bold header row
      for (let c = 0; c < HEADER.length; c++) {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c });
        if (!ws[cellRef]) continue;
        ws[cellRef].s = { font: { bold: true } };
      }

      // Sheet name: Excel limits to 31 chars, strip invalid chars
      const sheetName = ministry.replace(/[:\\/?*[\]]/g, "").slice(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }

    XLSX.writeFile(wb, "spoc-final-teams-by-ministry.xlsx");
  }

  async function logout() {
    await logoutSpoc();
    navigate("/", { replace: true });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <DashboardSkeleton />;

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
              <p className="text-sm font-extrabold text-white truncate">SPOC Portal</p>
              <p className="text-[10px] text-[#94a3b8] flex items-center gap-1.5">
                SIH 2026 · {spocName}
                {liveConnected && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                    <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Live
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refreshData(false)}
              disabled={refreshing}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl text-[#94a3b8] hover:bg-[rgba(147,197,253,0.08)] hover:text-white transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
              <span className="hidden sm:inline">{refreshing ? "Refreshing…" : "Refresh"}</span>
            </button>
            <span className="hidden sm:inline text-[10px] text-[#94a3b8]/50">
              {lastRefreshed.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
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

      {/* Tab navigation */}
      <div className="flex items-center gap-1 bg-[#0a1226]/60 border border-[rgba(147,197,253,0.10)] rounded-2xl p-1 mb-6 mt-0">
        {[
          { id: "teams",      label: "Teams & Ministries", icon: Building2 },
          { id: "monitoring", label: "Monitoring",          icon: Activity  },
          { id: "access-log", label: "Access Log",          icon: Shield    },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer",
              activeTab === t.id
                ? "bg-[#c9a227] text-black shadow"
                : "text-[#94a3b8] hover:text-white hover:bg-[rgba(147,197,253,0.06)]"
            )}
          >
            <t.icon className="size-3.5 shrink-0" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Stats row — always visible */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Active Ministries", value: stats.activeMinistries, icon: Building2, color: "text-[#c9a227]" },
          { label: "Pair Teams", value: pairTeams.filter((t) => t.team.ministry).length, icon: Users, color: "text-blue-400" },
          { label: "Final Teams", value: stats.finalCount, icon: CheckCircle2, color: "text-emerald-400" },
          { label: "Valid Finals", value: stats.validFinals, icon: CheckCircle2, color: "text-emerald-400" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-[rgba(147,197,253,0.10)] bg-[#0a1226]/60 p-4 transition-all hover:border-[rgba(147,197,253,0.18)]">
            <s.icon className={cn("size-5 mb-2", s.color)} />
            <p className="text-2xl font-black text-white">{s.value}</p>
            <p className="text-[10px] text-[#94a3b8] font-semibold uppercase tracking-wider mt-0.5">{s.label}</p>
          </div>
        ))}

      </div>

      {/* ── TEAMS & MINISTRIES tab ────────────────────────────────────────── */}
      {activeTab === "teams" && (<>
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

      {/* Final Teams Panel — filterable overview of all created teams */}
      <FinalTeamsPanel
        finalTeams={finalTeams}
        profileMap={profileMap}
        onEdit={(ft) => {
          const srcTeams = byMinistry.get(ft.ministry) ?? [];
          openBuilder(ft.ministry, srcTeams, ft);
        }}
        onDelete={handleDeleteFinalTeam}
      />

      {/* Search + Filter */}
      <div className="space-y-3 mb-5">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#94a3b8] pointer-events-none" />
          <input
            type="text"
            placeholder="Search ministry…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-2xl border border-[rgba(147,197,253,0.14)] bg-[#0a1226]/60 pl-10 pr-4 py-3 text-sm text-white outline-none placeholder:text-[#94a3b8]/60 focus:border-[#c9a227]/50 transition-all"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-white transition-colors"
            >
              <X className="size-4" />
            </button>
          )}
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
            <span className="text-white font-bold">{displayedMinistries.length}</span> / {ACTIVE_MINISTRIES_COUNT} shown
          </span>
        </div>

        {statusFilter === "outdated" && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/8 px-4 py-3">
            <AlertTriangle className="size-3.5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-300/90 leading-relaxed">
              <span className="font-bold text-amber-300">What does "Outdated" mean?</span>
              {" "}These ministries are not listed in the official SIH 2026 Problem Statements. Teams assigned here need to be reassigned to an active ministry.
            </p>
          </div>
        )}

        {statusFilter === "new" && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/8 px-4 py-3">
            <Sparkles className="size-3.5 text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-emerald-300/90 leading-relaxed">
              <span className="font-bold text-emerald-300">What does "New" mean?</span>
              {" "}These ministries were newly added to the official SIH 2026 Problem Statements.
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
            claimedMemberIds={claimedMemberIds}
            onBuildTeam={(min, srcTeams) => openBuilder(min, srcTeams)}
            onEditTeam={(ft) => {
              const srcTeams = byMinistry.get(ft.ministry) ?? [];
              openBuilder(ft.ministry, srcTeams, ft);
            }}
            onDeleteTeam={handleDeleteFinalTeam}
          />
        ))}
      </div>
      </>)}

      {/* ── MONITORING tab ────────────────────────────────────────────────── */}
      {activeTab === "monitoring" && (
        <MonitoringView
          profiles={allProfiles}
          pairTeams={pairTeams}
          finalTeams={finalTeams}
          onRefresh={() => refreshData(false)}
          refreshing={refreshing}
        />
      )}

      {activeTab === "access-log" && (
        <AccessLogView />
      )}

      {/* Team Builder Modal */}
      {builderOpen && (
        <TeamBuilderModal
          ministry={builderMinistry}
          sourceTeams={builderSourceTeams}
          editingTeam={editingFinalTeam}
          profileMap={profileMap}
          claimedMemberIds={claimedMemberIds}
          onSave={handleSaveFinalTeam}
          onClose={() => { setBuilderOpen(false); setEditingFinalTeam(null); }}
        />
      )}
    </main>
  );
}
