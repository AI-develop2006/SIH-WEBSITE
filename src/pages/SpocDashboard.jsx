import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Shield, LogOut, Users, Building2, CheckCircle2, AlertTriangle,
  ChevronDown, ChevronUp, Plus, X, Download, Search, RefreshCw, Sparkles, Trash2,
  ListChecks, Activity, TableProperties, BookOpen, Clock, UserX, FileText, MessageSquare,
  HardDrive, Code2, Cpu, Globe,
} from "lucide-react";
import {
  getCurrentProfile, logoutSpoc, logoutAllSessions, fetchEnrichedTeams, fetchAllProfiles,
  fetchFinalTeams, saveFinalTeam, updateFinalTeam, deleteFinalTeam,
  fetchClaimedMembers, subscribeToTeamEvents, subscribeToPairTeamEvents,
  isMasterSession, sessionMsRemaining, SESSION_TIMEOUT_MS, fetchPsChangeRequests,
  downloadTeamsXlsx, downloadRefineryDoc,
} from "@/lib/data";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { cn, validateFinalTeam, downloadXlsx } from "@/lib/utils";
import { MINISTRIES, SPOC_TEAM_SIZE, SPOC_MIN_FEMALE, DEPT_CODE, OUTDATED_MINISTRIES, NEW_MINISTRIES, ACTIVE_MINISTRIES_COUNT } from "@/lib/constants";
import { TeamBuilderModal } from "@/components/TeamBuilderModal";
import { OutdatedMinistryBadge } from "@/components/OutdatedMinistryBadge";
import { SIH2026ProblemsView } from "@/components/SIH2026ProblemsView";
import { NewMinistryBadge } from "@/components/NewMinistryBadge";
import { MonitoringView } from "@/components/MonitoringView";
import { AccessLogView } from "@/components/AccessLogView";
import { DeptRosterView } from "@/components/DeptRosterView";
import { PsChangeRequestsView } from "@/components/PsChangeRequestsView";
import { FinalTeamsPsView } from "@/components/FinalTeamsPsView";
import { SIH2026_PROBLEMS, useSihProblems, useSihPsMap } from "@/lib/sih2026Problems";

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
function MemberChip({ member, selectedPs, customPs }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-[rgba(147,197,253,0.14)] bg-[#0a1226] px-3 py-2">
      <Avatar name={member.name} className="size-7 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-white truncate leading-tight">{member.name}</p>
        <p className="text-[10px] text-[#94a3b8] truncate">
          {member.register_no ? <span className="font-mono text-[#c9a227]/80">{member.register_no} · </span> : null}
          {getDeptCode(member.department)}
          {member.assigned_skill ? ` · ${member.assigned_skill}` : ""}
        </p>
        {selectedPs && (
          <span className="inline-flex items-center gap-1 mt-0.5 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full border border-violet-500/40 bg-violet-500/10 text-violet-300">
            🔒 {selectedPs}
          </span>
        )}
        {customPs && !selectedPs && (
          <span className="inline-flex items-center gap-1 mt-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-300">
            ✨ Open Innovation
          </span>
        )}
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
function FinalTeamCard({ ft, profileMap, onEdit, onDelete, onChangeMinistry, onSelectPs, readOnly = false }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showMinistryPicker, setShowMinistryPicker] = useState(false);
  const [newMinistry, setNewMinistry] = useState(ft.ministry ?? "");
  const [savingMinistry, setSavingMinistry] = useState(false);
  const [showPsPicker, setShowPsPicker] = useState(false);
  const [psSearch, setPsSearch] = useState("");
  const [savingPs, setSavingPs] = useState(false);

  const problems = useSihProblems();

  const isAicte = ft.ministry?.toLowerCase().includes("aicte") ?? false;
  const hasCustomPs = Boolean(ft.custom_ps_title);
  const hasSelectedPs = Boolean(ft.selected_ps_number);

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

  async function handleSaveMinistry() {
    if (!newMinistry.trim()) return;
    if (newMinistry === ft.ministry) { setShowMinistryPicker(false); return; }
    setSavingMinistry(true);
    await onChangeMinistry(ft.id, ft.name, newMinistry.trim());
    setSavingMinistry(false);
    setShowMinistryPicker(false);
  }

  // PS list filtered to this team's ministry (not used for AICTE)
  const ministryProblems = useMemo(() => {
    if (!ft.ministry || isAicte) return problems;
    const needle = ft.ministry.trim().toLowerCase();
    return problems.filter((p) =>
      p.organization.toLowerCase().includes(needle) ||
      needle.includes(p.organization.toLowerCase().replace(/\s*\([^)]*\)\s*$/, "").trim().slice(0, 12))
    );
  }, [ft.ministry, isAicte, problems]);

  const filteredPs = useMemo(() => {
    const n = psSearch.trim().toLowerCase();
    if (!n) return ministryProblems;
    return ministryProblems.filter((p) =>
      p.psNumber.toLowerCase().includes(n) || p.title.toLowerCase().includes(n)
    );
  }, [ministryProblems, psSearch]);

  async function handleSelectPs(psNumber) {
    setSavingPs(true);
    await onSelectPs(ft.id, ft.name, psNumber === ft.selected_ps_number ? null : psNumber);
    setSavingPs(false);
    setShowPsPicker(false);
    setPsSearch("");
  }

  // Determine the PS button label
  const psButtonLabel = isAicte
    ? (hasCustomPs ? "✨ Open Innovation" : "Open Innovation PS")
    : (hasSelectedPs ? ft.selected_ps_number : "Select PS");

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
          {isAicte && (
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 shrink-0">
              ✨ Open Innovation
            </span>
          )}
        </div>
        {!confirmDelete && !readOnly && (
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="ghost"
              onClick={() => { setShowMinistryPicker((v) => !v); setShowPsPicker(false); setNewMinistry(ft.ministry ?? ""); }}
              className="text-[11px] px-3 py-1.5 text-blue-400 hover:bg-blue-500/10"
              title="Change the ministry for this final team"
            >
              <Building2 className="size-3 shrink-0" />
              Ministry
            </Button>
            {/* AICTE teams: PS is written by the team — no picker needed from SPOC side */}
            {!isAicte && (
              <Button
                variant="ghost"
                onClick={() => { setShowPsPicker((v) => !v); setShowMinistryPicker(false); setPsSearch(""); }}
                className={cn(
                  "text-[11px] px-3 py-1.5 hover:bg-violet-500/10",
                  hasSelectedPs ? "text-violet-300" : "text-[#94a3b8] hover:text-violet-300"
                )}
                title="Select the problem statement this team is working on"
              >
                <FileText className="size-3 shrink-0" />
                {psButtonLabel}
              </Button>
            )}
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

      {/* AICTE custom PS badge */}
      {isAicte && hasCustomPs && !showPsPicker && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/8 px-3 py-2">
          <FileText className="size-3.5 text-amber-400 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Open Innovation Problem Statement</p>
              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-300">
                🔒 Locked by team
              </span>
            </div>
            <p className="text-[11px] text-white leading-snug">{ft.custom_ps_title}</p>
          </div>
        </div>
      )}

      {/* AICTE — no PS yet */}
      {isAicte && !hasCustomPs && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/15 bg-amber-500/5 px-3 py-2">
          <FileText className="size-3.5 text-amber-400/50 shrink-0" />
          <p className="text-[10px] text-amber-400/60 italic">
            Team has not submitted their Open Innovation problem statement yet.
          </p>
        </div>
      )}

      {/* Non-AICTE: Selected PS badge */}
      {!isAicte && hasSelectedPs && !showPsPicker && (() => {
        const ps = problems.find((p) => p.psNumber === ft.selected_ps_number);
        return (
          <div className="flex items-start gap-2 rounded-xl border border-violet-500/25 bg-violet-500/8 px-3 py-2">
            <FileText className="size-3.5 text-violet-400 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <p className="text-[10px] font-bold text-violet-400 uppercase tracking-wider">Working on</p>
                <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-300">
                  🔒 Locked by team
                </span>
              </div>
              <p className="text-[11px] font-extrabold text-white font-mono">{ft.selected_ps_number}</p>
              {ps && <p className="text-[10px] text-violet-200 leading-snug line-clamp-2">{ps.title}</p>}
            </div>
          </div>
        );
      })()}

      {/* Inline ministry picker */}
      {showMinistryPicker && !confirmDelete && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/8 px-4 py-3 space-y-2.5">
          <p className="text-[11px] font-bold text-blue-300 flex items-center gap-1.5">
            <Building2 className="size-3.5 shrink-0" />
            Change Ministry — all members will be notified
          </p>
          <div className="flex items-center gap-2">
            <select
              value={newMinistry}
              onChange={(e) => setNewMinistry(e.target.value)}
              className="flex-1 rounded-xl border border-[rgba(147,197,253,0.18)] bg-[#050b18]/60 px-3 py-2 text-xs text-white outline-none focus:border-blue-400/50 transition-all cursor-pointer"
            >
              <option value="">— No Ministry —</option>
              {MINISTRIES.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <Button
              onClick={handleSaveMinistry}
              loading={savingMinistry}
              disabled={!newMinistry.trim() || newMinistry === ft.ministry}
              className="text-[11px] px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              Save
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowMinistryPicker(false)}
              className="text-[11px] px-3 py-2 text-[#94a3b8]"
            >
              Cancel
            </Button>
          </div>
          {ft.ministry && (
            <p className="text-[10px] text-[#94a3b8]">
              Current: <span className="text-white font-semibold">{ft.ministry}</span>
            </p>
          )}
        </div>
      )}

      {/* Inline PS picker */}
      {showPsPicker && !confirmDelete && (
        <div className="rounded-xl border border-violet-500/30 bg-violet-500/8 px-4 py-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold text-violet-300 flex items-center gap-1.5">
              <FileText className="size-3.5 shrink-0" />
              Select Problem Statement — visible to SPOC &amp; Admin
            </p>
            {ft.selected_ps_number && (
              <button
                type="button"
                onClick={() => handleSelectPs(ft.selected_ps_number)}
                disabled={savingPs}
                className="text-[10px] text-red-400 hover:underline font-bold shrink-0"
              >
                Clear selection
              </button>
            )}
          </div>
          {/* Current selection */}
          {ft.selected_ps_number && (() => {
            const cur = problems.find((p) => p.psNumber === ft.selected_ps_number);
            return cur ? (
              <div className="rounded-xl border border-violet-500/40 bg-violet-500/15 px-3 py-2">
                <p className="text-[10px] font-bold text-violet-200 uppercase tracking-wider mb-0.5">Currently selected</p>
                <p className="text-xs font-extrabold text-white font-mono">{cur.psNumber}</p>
                <p className="text-[11px] text-violet-200 leading-snug line-clamp-2">{cur.title}</p>
              </div>
            ) : null;
          })()}
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3 text-[#94a3b8] pointer-events-none" />
            <input
              type="text"
              placeholder={`Search PS number or title${ft.ministry ? "" : " (all 226)"}…`}
              value={psSearch}
              onChange={(e) => setPsSearch(e.target.value)}
              className="w-full rounded-xl border border-[rgba(147,197,253,0.18)] bg-[#050b18]/60 pl-8 pr-3 py-1.5 text-xs text-white outline-none placeholder:text-[#94a3b8]/50 focus:border-violet-400/50 transition-all"
            />
          </div>
          {/* PS list */}
          <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
            {filteredPs.length === 0 ? (
              <p className="text-xs text-[#94a3b8] text-center py-4">No problem statements found</p>
            ) : filteredPs.map((p) => {
              const isSelected = ft.selected_ps_number === p.psNumber;
              return (
                <button
                  key={p.psNumber}
                  type="button"
                  disabled={savingPs}
                  onClick={() => handleSelectPs(p.psNumber)}
                  className={cn(
                    "w-full text-left rounded-xl border px-3 py-2 transition-all cursor-pointer space-y-0.5",
                    isSelected
                      ? "border-violet-500/50 bg-violet-500/20"
                      : "border-[rgba(147,197,253,0.10)] bg-[#050b18]/40 hover:border-violet-500/30 hover:bg-violet-500/10"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-extrabold font-mono text-violet-300 shrink-0">{p.psNumber}</span>
                    {isSelected && <CheckCircle2 className="size-3 text-violet-400 shrink-0" />}
                    <span className={cn(
                      "text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0",
                      p.category === "Software"
                        ? "border-blue-500/30 bg-blue-500/10 text-blue-300"
                        : "border-orange-500/30 bg-orange-500/10 text-orange-300"
                    )}>
                      {p.category === "Software" ? "SW" : "HW"}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#94a3b8] leading-snug line-clamp-2">{p.title}</p>
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-[#94a3b8]">
            {ft.ministry ? `Showing ${filteredPs.length} PS under this ministry` : `Showing ${filteredPs.length} of all 226 PS`}
          </p>
        </div>
      )}

      <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3 mt-2">
        {members.map((m) => (
          <MemberChip
            key={m.id}
            member={m}
            selectedPs={ft.selected_ps_number ?? null}
            customPs={ft.custom_ps_title ?? null}
          />
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
function FinalTeamsPanel({ finalTeams, profileMap, onEdit, onDelete, onChangeMinistry, onSelectPs, readOnly = false }) {
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
                  readOnly={readOnly}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onChangeMinistry={onChangeMinistry}
                  onSelectPs={onSelectPs}
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
function MinistryRow({ ministry, pairTeams, finalTeams, onBuildTeam, onEditTeam, onDeleteTeam, onChangeMinistryTeam, onSelectPsTeam, profileMap, claimedMemberIds, readOnly = false, isMaster = false }) {
  const [open, setOpen] = useState(false);
  const bodyRef = useRef(null);
  const isOutdated = OUTDATED_MINISTRIES.has(ministry);

  const finalsForMinistry = finalTeams.filter((ft) => ft.ministry === ministry);
  const totalPairMembers = pairTeams.reduce((s, t) => s + t.members.length, 0);
  // Only allow expanding the accordion when under maintenance (master session)
  const canExpand = !isOutdated && pairTeams.length > 0 && isMaster;

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
          {!canExpand && !isOutdated && pairTeams.length > 0 && (
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border border-[rgba(147,197,253,0.15)] bg-[#0a1226]/60 text-[#94a3b8]/60">
              🔒 master only
            </span>
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
                              <div className="min-w-0 flex-1">
                                <span className={cn("text-[11px] truncate block", isClaimed ? "text-[#94a3b8]/60 line-through" : "text-[#e8ecf7]")}>{m.name}</span>
                                {m.register_no && (
                                  <span className="text-[9px] font-mono text-[#c9a227]/70 truncate block">{m.register_no}</span>
                                )}
                              </div>
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
                      readOnly={readOnly}
                      onEdit={onEditTeam}
                      onDelete={onDeleteTeam}
                      onChangeMinistry={onChangeMinistryTeam}
                      onSelectPs={onSelectPsTeam}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Build new final team button — master only */}
            {!readOnly && (
              <Button
                variant="outline"
                onClick={() => onBuildTeam(ministry, pairTeams)}
                className="w-full border-[#c9a227]/30 text-[#c9a227] hover:bg-[#c9a227]/8 text-xs py-2.5"
              >
                <Plus className="size-3.5" />
                Build Final Team from this Ministry
              </Button>
            )}
            {readOnly && (
              <div className="w-full text-center py-2 text-[10px] text-[#94a3b8]/50 border border-[rgba(147,197,253,0.08)] rounded-xl">
                🔒 Log in with admin credentials to build final teams
              </div>
            )}
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
  const [finalTeamValidityFilter, setFinalTeamValidityFilter] = useState("all"); // "all" | "valid" | "draft"
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("teams"); // "teams" | "final-teams" | "monitoring" | "dept" | "ps-requests" | "access-log"
  const [pendingPsRequests, setPendingPsRequests] = useState(0);
  const [isMaster, setIsMaster] = useState(false);

  // ── Session timeout state ─────────────────────────────────────────────────
  // msLeft: ms remaining in the session. Shown as a warning when < 10 min.
  const [sessionMsLeft, setSessionMsLeft] = useState(() => sessionMsRemaining());
  const [logoutAllBusy, setLogoutAllBusy] = useState(false);

  // Team builder modal state
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderMinistry, setBuilderMinistry] = useState(null);
  const [builderSourceTeams, setBuilderSourceTeams] = useState([]);
  const [editingFinalTeam, setEditingFinalTeam] = useState(null);

  // Export dropdown state
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef(null);

  // Downloads tab state — tracks per-type loading/error
  const [dlState, setDlState] = useState({
    software: "idle",
    hardware: "idle",
    aicte: "idle",
    all: "idle",
    software_refinery: "idle",
    hardware_refinery: "idle",
  });

  // ── Load data ──────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    const [profileRes, teamsRes, finalRes, claimedRes, allProfilesRes, psReqRes] = await Promise.all([
      getCurrentProfile(),
      fetchEnrichedTeams(),
      fetchFinalTeams(),
      fetchClaimedMembers(),
      fetchAllProfiles(),
      fetchPsChangeRequests(),
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
    setIsMaster(isMasterSession());
    setPairTeams(teamsRes.data ?? []);
    setFinalTeams(finalRes.data ?? []);
    setClaimedMemberIds(new Set(claimedRes.data ?? []));
    setAllProfiles(allProfilesRes.data ?? []);
    setPendingPsRequests((psReqRes.data ?? []).filter((r) => r.status === "pending").length);
  }, [navigate, toast]);

  const refreshData = useCallback(async (silent = true) => {
    if (!silent) setRefreshing(true);
    const [teamsRes, finalRes, claimedRes, allProfilesRes, psReqRes] = await Promise.all([
      fetchEnrichedTeams(),
      fetchFinalTeams(),
      fetchClaimedMembers(),
      fetchAllProfiles(),
      fetchPsChangeRequests(),
    ]);
    if (teamsRes.data) setPairTeams(teamsRes.data);
    if (finalRes.data) setFinalTeams(finalRes.data);
    if (claimedRes.data) setClaimedMemberIds(new Set(claimedRes.data));
    if (allProfilesRes.data) setAllProfiles(allProfilesRes.data);
    setPendingPsRequests((psReqRes.data ?? []).filter((r) => r.status === "pending").length);
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

  // Close export dropdown on outside click
  useEffect(() => {
    function handleOutside(e) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setExportMenuOpen(false);
      }
    }
    if (exportMenuOpen) document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [exportMenuOpen]);

  // ── SSE: real-time updates from other SPOC sessions (final teams) ─────────
  // Subscribes to SPOC backend SSE; refreshes data on any final-team change.
  // Also listens for session_invalidated events to force logout.
  // Falls back to 30-second polling if SSE is unavailable.
  useEffect(() => {
    const cleanup = subscribeToTeamEvents(
      () => refreshData(true),
      () => {
        // session_invalidated received — clear local session and redirect
        logoutSpoc();
        toast("error", "Your session was cleared by an administrator. Please sign in again.");
        navigate("/", { replace: true });
      }
    );
    setLiveConnected(true);
    // Polling fallback — fires only if SSE somehow misses an event
    const poll = setInterval(() => refreshData(true), 30_000);
    return () => { cleanup(); setLiveConnected(false); clearInterval(poll); };
  }, [refreshData, navigate, toast]);

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

  // ── Session timeout: countdown + auto-logout ───────────────────────────────
  // Updates sessionMsLeft every minute. Auto-logouts when time reaches 0.
  // Master sessions don't expire.
  useEffect(() => {
    if (isMaster) return; // master session never times out
    const tick = () => {
      const ms = sessionMsRemaining();
      setSessionMsLeft(ms);
      if (ms <= 0) {
        logoutSpoc();
        toast("error", "Your session has expired. Please sign in again.");
        navigate("/", { replace: true });
      }
    };
    tick(); // run immediately
    const interval = setInterval(tick, 60_000); // recheck every minute
    return () => clearInterval(interval);
  }, [isMaster, navigate, toast]);

  const sihPsMap = useSihPsMap();

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
    const draftCount = finalTeams.filter((ft) => {
      const members = (ft.member_ids || []).map((id) => profileMap.get(id)).filter(Boolean);
      return members.length < 6;
    }).length;
    return { activeMinistries, finalCount: finalTeams.length, validFinals, draftCount };
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

  const activeStatId = useMemo(() => {
    if (activeTab === "teams") {
      return statusFilter === "active" ? "active-ministries" : "pair-teams";
    }
    if (activeTab === "final-teams") {
      if (finalTeamValidityFilter === "draft") return "incomplete-drafts";
      if (finalTeamValidityFilter === "valid") return "valid-finals";
      return "final-teams";
    }
    return null;
  }, [activeTab, statusFilter, finalTeamValidityFilter]);

  function handleStatCardClick(cardId) {
    if (cardId === "active-ministries") {
      setActiveTab("teams");
      setStatusFilter("active");
    } else if (cardId === "pair-teams") {
      setActiveTab("teams");
      setStatusFilter("all");
    } else if (cardId === "final-teams") {
      setActiveTab("final-teams");
      setFinalTeamValidityFilter("all");
    } else if (cardId === "incomplete-drafts") {
      setActiveTab("final-teams");
      setFinalTeamValidityFilter("draft");
    } else if (cardId === "valid-finals") {
      setActiveTab("final-teams");
      setFinalTeamValidityFilter("valid");
    }
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  function openBuilder(ministry, sourceTeams, existingFinalTeam = null) {
    setBuilderMinistry(ministry);
    setBuilderSourceTeams(sourceTeams);
    setEditingFinalTeam(existingFinalTeam);
    setBuilderOpen(true);
  }

  async function handleDeleteFinalTeam(id, name) {
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

  async function handleChangeMinistryFinalTeam(id, teamName, newMinistry) {
    // Optimistic update
    setFinalTeams((prev) =>
      prev.map((ft) => ft.id === id ? { ...ft, ministry: newMinistry || null } : ft)
    );
    const res = await updateFinalTeam(id, { ministry: newMinistry || null });
    if (res.error) {
      toast("error", res.error);
      await refreshData(true); // rollback
    } else {
      toast("success", `Ministry for "${teamName}" updated to "${newMinistry}". Members notified.`);
      refreshData(true);
    }
  }

  async function handleSelectPsFinalTeam(id, teamName, psNumber) {
    // Optimistic update
    setFinalTeams((prev) =>
      prev.map((ft) => ft.id === id ? { ...ft, selected_ps_number: psNumber || null } : ft)
    );
    const res = await updateFinalTeam(id, { selected_ps_number: psNumber || null });
    if (res.error) {
      toast("error", res.error);
      await refreshData(true);
    } else {
      if (psNumber) {
        toast("success", `"${teamName}" is now working on ${psNumber}. All members notified.`);
      } else {
        toast("success", `Problem statement selection cleared for "${teamName}".`);
      }
      refreshData(true);
    }
  }

  async function handleSaveFinalTeam({ name, ministry, member_ids, draft = false }) {
    if (editingFinalTeam) {
      // Optimistic update
      setFinalTeams((prev) =>
        prev.map((ft) => ft.id === editingFinalTeam.id ? { ...ft, name, ministry, member_ids } : ft)
      );
      const res = await updateFinalTeam(editingFinalTeam.id, { name, ministry, member_ids, draft });
      if (res.error) {
        toast("error", res.error);
        await refreshData(true); // rollback + sync
        return { conflict: res.error?.includes("already assigned") };
      }
      toast("success", draft ? `Draft "${name}" saved — complete the team later.` : `Final team "${name}" updated!`);
    } else {
      const res = await saveFinalTeam({ name, ministry, member_ids, draft });
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
      toast("success", draft ? `Draft "${name}" saved — complete the team later.` : `Final team "${name}" saved!`);
    }
    setBuilderOpen(false);
    setEditingFinalTeam(null);
    refreshData(true);
    return { conflict: false };
  }

  // ── Export state (dropdown) — declared above near other state ────────────────

  /**
   * Export final teams to xlsx matching the software_teams / aicte_teams format:
   *   Row 0: "SIH 2026 — Final Teams (…)"
   *   Row 1: column headers
   *   Per team: first-member row carries S.No + "TeamName\n[Ministry:…]\n[PS:…]"
   *             subsequent members: null in those cells
   *
   * mode = "ministry"  → one sheet per ministry
   * mode = "whole"     → single sheet, all teams sorted alphabetically
   */
  async function exportFinalTeams(mode = "ministry") {
    const XLSX = await import("xlsx");
    setExportMenuOpen(false);

    // ── Lookups ────────────────────────────────────────────────────────────
    const psMap = sihPsMap;

    // ── Colour palette ─────────────────────────────────────────────────────
    const C = {
      navy:       "FF1A2744",
      gold:       "FFC9A227",
      goldLight:  "FFFFF8E7",
      colHeader:  "FF1F2937",
      white:      "FFFFFFFF",
      rowEven:    "FFF8FAFC",
      rowOdd:     "FFFFFFFF",
      border:     "FFCBD5E1",
      pending:    "FFFBBF24",
      pendingFg:  "FF78350F",
    };

    const line   = (rgb) => ({ style: "thin", color: { rgb } });
    const border = { top: line(C.border), bottom: line(C.border), left: line(C.border), right: line(C.border) };

    // Styles
    const titleStyle = {
      font:      { bold: true, sz: 13, color: { rgb: C.white } },
      fill:      { patternType: "solid", fgColor: { rgb: C.navy } },
      alignment: { horizontal: "left", vertical: "center" },
      border,
    };
    const headerStyle = {
      font:      { bold: true, sz: 10, color: { rgb: C.white } },
      fill:      { patternType: "solid", fgColor: { rgb: C.colHeader } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border,
    };
    const rowEvenStyle = {
      font:      { sz: 10 },
      fill:      { patternType: "solid", fgColor: { rgb: C.rowEven } },
      alignment: { horizontal: "left", vertical: "center", wrapText: true },
      border,
    };
    const rowOddStyle = {
      font:      { sz: 10 },
      fill:      { patternType: "solid", fgColor: { rgb: C.rowOdd } },
      alignment: { horizontal: "left", vertical: "center", wrapText: true },
      border,
    };
    const teamNameStyle = {
      font:      { bold: true, sz: 10 },
      fill:      { patternType: "solid", fgColor: { rgb: C.goldLight } },
      alignment: { horizontal: "left", vertical: "center", wrapText: true },
      border,
    };
    const pendingStyle = {
      font:      { bold: true, sz: 10, color: { rgb: C.pendingFg } },
      fill:      { patternType: "solid", fgColor: { rgb: C.pending } },
      alignment: { horizontal: "center", vertical: "center" },
      border,
    };

    // COLUMNS (matching institutional specification & picture format):
    // 0: S.No  1: Team Name  2: Team Members  3: Register No  4: Year  5: Section
    // 6: Department  7: Ministry  8: PS Number  9: Phone  10: Gender  11: Category
    const NCOLS = 12;
    const COL_W = [5, 28, 28, 16, 6, 8, 38, 34, 38, 14, 8, 18];
    const COL_HEADERS = [
      "S.No", "Team Name", "Team Members", "Register No", "Year", "Section",
      "Department", "Ministry", "PS Number", "Phone", "Gender", "Category",
    ];

    // Helper: write a cell
    function sc(ws, r, c, value, style) {
      const ref = XLSX.utils.encode_cell({ r, c });
      const isNum = typeof value === "number";
      ws[ref] = { v: value ?? "", t: isNum ? "n" : "s", s: style };
    }

    // Helper: build one worksheet from an array of final teams
    function buildSheet(teams, sheetTitle) {
      const ws     = {};
      const merges = [];
      const rows   = [];
      let   r      = 0;

      // Row 0: title spanning all columns
      sc(ws, r, 0, sheetTitle, titleStyle);
      for (let c = 1; c < NCOLS; c++) sc(ws, r, c, "", titleStyle);
      merges.push({ s: { r, c: 0 }, e: { r, c: NCOLS - 1 } });
      rows[r] = { hpt: 22 };
      r++;

      // Row 1: column headers
      COL_HEADERS.forEach((h, c) => sc(ws, r, c, h, headerStyle));
      rows[r] = { hpt: 18 };
      r++;

      let sno = 0;
      for (const ft of teams) {
        sno++;
        const members   = (ft.member_ids || []).map((id) => profileMap.get(id)).filter(Boolean);
        const rowCount  = Math.max(members.length, 1);
        const baseStyle = sno % 2 === 0 ? rowEvenStyle : rowOddStyle;

        const psRecord = ft.selected_ps_number ? psMap.get(ft.selected_ps_number) : null;
        const psLabel  = ft.custom_ps_title ? "Open Innovation" : (ft.selected_ps_number ?? "Pending");
        const psTitle  = ft.custom_ps_title || psRecord?.title || "";
        const psText   = psTitle ? `${psLabel}\n${psTitle}` : psLabel;
        const category = ft.category || psRecord?.category || (ft.ministry?.toLowerCase().includes("aicte") ? "Open Innovation" : "Pending");

        for (let i = 0; i < rowCount; i++) {
          const m  = members[i];
          const rs = baseStyle;

          // 0: S.No (first row only)
          sc(ws, r, 0, i === 0 ? sno : null, i === 0 ? { ...rs, font: { ...rs.font, bold: true } } : rs);

          // 1: Team Name (first row only)
          sc(ws, r, 1, i === 0 ? (ft.name || "") : null, i === 0 ? teamNameStyle : rs);

          // Member data
          // 2: Team Members
          sc(ws, r, 2, m?.name ?? (i === 0 ? "(no members)" : ""), rs);
          // 3: Register No
          sc(ws, r, 3, m?.register_no ?? "", rs);
          // 4: Year
          sc(ws, r, 4, m?.year ?? "", rs);
          // 5: Section
          sc(ws, r, 5, m?.section ?? "", rs);
          // 6: Department
          sc(ws, r, 6, m?.department ?? "", rs);

          // 7: Ministry (first row only)
          sc(ws, r, 7, i === 0 ? (ft.ministry ?? "") : null, rs);

          // 8: PS Number (first row only)
          sc(ws, r, 8, i === 0 ? psText : null, rs);

          // 9: Phone
          sc(ws, r, 9, m?.phone ?? "", rs);
          // 10: Gender
          sc(ws, r, 10, m?.gender ?? "", rs);

          // 11: Category (first row only)
          sc(ws, r, 11, i === 0 ? category : null, i === 0 ? { ...rs, font: { ...rs.font, bold: true } } : rs);

          rows[r] = { hpt: 16 };
          r++;
        }

        // Merge team-level columns vertically across all member rows: 0 (S.No), 1 (Team Name), 7 (Ministry), 8 (PS Number), 11 (Category)
        if (rowCount > 1) {
          merges.push({ s: { r: r - rowCount, c: 0 }, e: { r: r - 1, c: 0 } });
          merges.push({ s: { r: r - rowCount, c: 1 }, e: { r: r - 1, c: 1 } });
          merges.push({ s: { r: r - rowCount, c: 7 }, e: { r: r - 1, c: 7 } });
          merges.push({ s: { r: r - rowCount, c: 8 }, e: { r: r - 1, c: 8 } });
          merges.push({ s: { r: r - rowCount, c: 11 }, e: { r: r - 1, c: 11 } });
        }
      }

      ws["!ref"]    = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: r - 1, c: NCOLS - 1 } });
      ws["!merges"] = merges;
      ws["!cols"]   = COL_W.map((wch) => ({ wch }));
      ws["!rows"]   = rows;
      return ws;
    }

    const wb = XLSX.utils.book_new();

    if (mode === "ministry") {
      // ── By Ministry: one sheet per ministry ───────────────────────────
      const byMin = new Map();
      for (const ft of finalTeams) {
        const key = ft.ministry?.trim() || "No Ministry";
        if (!byMin.has(key)) byMin.set(key, []);
        byMin.get(key).push(ft);
      }
      const ministries = [...byMin.keys()].sort((a, b) => {
        if (a === "No Ministry") return 1;
        if (b === "No Ministry") return -1;
        return a.localeCompare(b);
      });

      for (const ministry of ministries) {
        const teams     = byMin.get(ministry);
        const sheetName = ministry
          .replace(/[:\\/?*[\]]/g, "").replace(/\s+/g, " ").trim().slice(0, 31) || "Sheet";
        const title = `SIH 2026 — Final Teams [${ministry}]`;
        XLSX.utils.book_append_sheet(wb, buildSheet(teams, title), sheetName);
      }

      XLSX.writeFile(wb, "spoc-final-teams-by-ministry.xlsx");
    } else {
      // ── As a Whole: single sheet, all teams sorted by ministry then name ─
      const sorted = [...finalTeams].sort((a, b) => {
        const ma = a.ministry ?? "zzz";
        const mb = b.ministry ?? "zzz";
        if (ma !== mb) return ma.localeCompare(mb);
        return a.name.localeCompare(b.name);
      });
      const ws = buildSheet(sorted, "SIH 2026 — Final Teams (All)");
      XLSX.utils.book_append_sheet(wb, ws, "All Final Teams");
      XLSX.writeFile(wb, "spoc-final-teams-all.xlsx");
    }
  }

  // ── (end of export section) ─────────────────────────────────────────────────

  async function logout() {
    await logoutSpoc();
    navigate("/", { replace: true });
  }

  async function handleLogoutAll() {
    if (!confirm("This will immediately log out ALL currently active SPOC sessions. Continue?")) return;
    setLogoutAllBusy(true);
    const { ok, error } = await logoutAllSessions();
    setLogoutAllBusy(false);
    if (!ok) {
      toast("error", error || "Failed to clear sessions");
    } else {
      toast("success", "All sessions cleared. Other users will be forced to sign in again.");
    }
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
            {/* Session time remaining — shown when < 30 min left */}
            {!isMaster && sessionMsLeft > 0 && sessionMsLeft < 30 * 60 * 1000 && (
              <span className={cn(
                "hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border tabular-nums",
                sessionMsLeft < 10 * 60 * 1000
                  ? "bg-red-500/15 border-red-500/30 text-red-300"
                  : "bg-amber-500/15 border-amber-500/30 text-amber-300"
              )}>
                <Clock className="size-3 shrink-0" />
                {Math.ceil(sessionMsLeft / 60_000)}m left
              </span>
            )}
            {finalTeams.length > 0 && (
              <div className="relative" ref={exportMenuRef}>
                <Button
                  variant="outline"
                  onClick={() => setExportMenuOpen((v) => !v)}
                  className="gap-1.5 text-xs px-3 py-1.5 border-[#c9a227]/30 text-[#c9a227] hover:bg-[#c9a227]/8"
                >
                  <Download className="size-3.5" />
                  <span className="hidden sm:inline">Export</span>
                  <ChevronDown className={cn("size-3 transition-transform duration-150", exportMenuOpen && "rotate-180")} />
                </Button>
                {exportMenuOpen && (
                  <div className="absolute right-0 top-full mt-1.5 z-50 w-48 rounded-2xl border border-[rgba(201,162,39,0.25)] bg-[#0a1226] shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden">
                    <div className="px-3 py-2 border-b border-[rgba(147,197,253,0.08)]">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">Export Format</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => exportFinalTeams("ministry")}
                      className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-[rgba(201,162,39,0.06)] transition-colors"
                    >
                      <div className="size-7 shrink-0 flex items-center justify-center rounded-lg bg-[#c9a227]/10 border border-[#c9a227]/20 mt-0.5">
                        <FileText className="size-3.5 text-[#c9a227]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white">By Ministry</p>
                        <p className="text-[10px] text-[#94a3b8] leading-snug">One sheet per ministry</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => exportFinalTeams("whole")}
                      className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-[rgba(201,162,39,0.06)] transition-colors border-t border-[rgba(147,197,253,0.06)]"
                    >
                      <div className="size-7 shrink-0 flex items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 mt-0.5">
                        <Download className="size-3.5 text-emerald-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white">As a Whole</p>
                        <p className="text-[10px] text-[#94a3b8] leading-snug">All teams in one sheet</p>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            )}
            {/* Master-only: clear all active sessions */}
            {isMaster && (
              <Button
                variant="ghost"
                onClick={handleLogoutAll}
                loading={logoutAllBusy}
                className="text-xs px-3 py-1.5 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
                title="Force all active SPOC sessions to expire"
              >
                <UserX className="size-3.5" />
                <span className="hidden sm:inline">Clear Sessions</span>
              </Button>
            )}
            <Button variant="ghost" onClick={logout} className="text-xs px-3 py-1.5 text-[#94a3b8] hover:text-red-400">
              <LogOut className="size-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Read-only mode banner — shown for normal (non-master) sessions */}
      {!isMaster && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-[rgba(147,197,253,0.20)] bg-[#0a1226]/80 px-4 py-3">
          <Shield className="size-4 text-[#c9a227] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-[#e8c058]">View-only mode</p>
            <p className="text-[10px] text-[#94a3b8] mt-0.5">
              You are logged in as a standard SPOC viewer. All data is visible but changes are disabled.
              Log in with <span className="font-bold text-white">admin credentials</span> to create teams, change ministries, or approve requests.
            </p>
          </div>
        </div>
      )}

      {/* Session expiry warning banner */}
      {!isMaster && sessionMsLeft > 0 && sessionMsLeft < 10 * 60 * 1000 && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/8 px-4 py-3">
          <Clock className="size-4 text-red-400 shrink-0" />
          <p className="text-xs text-red-300 font-semibold flex-1">
            Your session expires in <strong className="text-red-200">{Math.ceil(sessionMsLeft / 60_000)} minute{Math.ceil(sessionMsLeft / 60_000) !== 1 ? "s" : ""}</strong>. Save your work and sign in again to continue.
          </p>
        </div>
      )}

      {/* Tab navigation */}
      <div className="flex items-center gap-1 bg-[#0a1226]/60 border border-[rgba(147,197,253,0.10)] rounded-2xl p-1 mb-6 mt-0">
        {[
          { id: "teams",       label: "Teams & Ministries", icon: Building2       },
          { id: "final-teams", label: "Final Teams",         icon: ListChecks      },
          { id: "problems",    label: "SIH 2026 Problems",   icon: BookOpen        },
          { id: "monitoring",  label: "Monitoring",          icon: Activity        },
          { id: "dept",        label: "Dept Roster",         icon: TableProperties },
          { id: "ps-requests", label: "PS Change Requests",  icon: MessageSquare, badge: pendingPsRequests > 0 ? pendingPsRequests : null },
          { id: "downloads",   label: "Downloads",           icon: HardDrive       },
          ...(isMaster ? [{ id: "access-log", label: "Access Log", icon: Shield }] : []),
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer relative",
              activeTab === t.id
                ? "bg-[#c9a227] text-black shadow"
                : "text-[#94a3b8] hover:text-white hover:bg-[rgba(147,197,253,0.06)]"
            )}
          >
            <t.icon className="size-3.5 shrink-0" />
            <span className="hidden sm:inline">{t.label}</span>
            <span className="sm:hidden">{t.id === "final-teams" ? "Finals" : t.id === "access-log" ? "Master" : t.id === "problems" ? "PS" : t.id === "ps-requests" ? "Requests" : t.id === "downloads" ? "Downloads" : t.label}</span>
            {t.badge && (
              <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-extrabold text-white shadow-lg">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Stats row — interactive filter cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 mb-6">
        {[
          { id: "active-ministries", label: "Active Ministries", value: stats.activeMinistries,                          icon: Building2,     color: "text-[#c9a227]"   },
          { id: "pair-teams",        label: "Pair Teams",        value: pairTeams.filter((t) => t.team.ministry).length, icon: Users,         color: "text-blue-400"    },
          { id: "final-teams",       label: "Final Teams",       value: stats.finalCount,                                icon: CheckCircle2,  color: "text-emerald-400" },
          { id: "incomplete-drafts", label: "Incomplete Drafts", value: stats.draftCount,                                icon: AlertTriangle, color: "text-amber-400"  },
          { id: "valid-finals",      label: "Valid Finals",      value: stats.validFinals,                               icon: CheckCircle2,  color: "text-emerald-400" },
        ].map((s) => {
          const isSelected = activeStatId === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => handleStatCardClick(s.id)}
              className={cn(
                "rounded-2xl border p-4 transition-all text-left cursor-pointer relative overflow-hidden group focus:outline-none",
                isSelected
                  ? "border-[#c9a227] bg-[#c9a227]/12 ring-2 ring-[#c9a227]/50 shadow-lg shadow-[#c9a227]/10"
                  : "border-[rgba(147,197,253,0.10)] bg-[#0a1226]/60 hover:border-[rgba(147,197,253,0.25)] hover:bg-[#0a1226]/90"
              )}
            >
              <s.icon className={cn("size-5 mb-2 transition-transform group-hover:scale-110", s.color)} />
              <p className="text-2xl font-black text-white">{s.value}</p>
              <div className="flex items-center justify-between mt-0.5">
                <p className="text-[10px] text-[#94a3b8] font-semibold uppercase tracking-wider">{s.label}</p>
                {isSelected && (
                  <span className="inline-block size-1.5 rounded-full bg-[#c9a227] animate-pulse" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* ── TEAMS & MINISTRIES tab ────────────────────────────────────────── */}
      {activeTab === "teams" && (<>
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
            readOnly={!isMaster}
            isMaster={isMaster}
            onBuildTeam={(min, srcTeams) => openBuilder(min, srcTeams)}
            onEditTeam={(ft) => {
              const srcTeams = byMinistry.get(ft.ministry) ?? [];
              openBuilder(ft.ministry, srcTeams, ft);
            }}
            onDeleteTeam={handleDeleteFinalTeam}
            onChangeMinistryTeam={handleChangeMinistryFinalTeam}
            onSelectPsTeam={handleSelectPsFinalTeam}
          />
        ))}
      </div>
      </>)}

      {/* ── FINAL TEAMS tab ───────────────────────────────────────────────── */}
      {activeTab === "final-teams" && (
        <div className="space-y-5">
          <FinalTeamsPsView
            finalTeams={finalTeams}
            profileMap={profileMap}
            validityFilter={finalTeamValidityFilter}
            onValidityFilterChange={setFinalTeamValidityFilter}
          />
        </div>
      )}

      {/* ── PROBLEMS tab ─────────────────────────────────────────────────── */}
      {activeTab === "problems" && <SIH2026ProblemsView />}

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

      {activeTab === "dept" && (
        <DeptRosterView
          allProfiles={allProfiles}
          pairTeams={pairTeams}
          finalTeams={finalTeams}
        />
      )}

      {activeTab === "ps-requests" && (
        <PsChangeRequestsView readOnly={!isMaster} />
      )}

      {/* ── DOWNLOADS tab ─────────────────────────────────────────────────── */}
      {activeTab === "downloads" && (
        <div className="space-y-6">
          {/* Header */}
          <div className="rounded-2xl border border-[rgba(147,197,253,0.12)] bg-[#0a1226]/60 px-5 py-4 space-y-1">
            <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
              <HardDrive className="size-4 text-[#c9a227]" />
              Team Roster Downloads
            </h2>
            <p className="text-[11px] text-[#94a3b8]">
              Generate and download up-to-date xlsx files directly from the live database.
              Only teams with exactly 6 members and a confirmed PS are included.
            </p>
          </div>

          {/* Six download cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                type:     "software",
                label:    "Software Teams",
                desc:     "All final teams working on Software category problem statements",
                icon:     Code2,
                accent:   "blue",
                border:   "border-blue-500/25",
                bg:       "bg-blue-500/5",
                iconBg:   "bg-blue-500/10 border-blue-500/20",
                iconClr:  "text-blue-400",
                btnClr:   "bg-blue-600 hover:bg-blue-500",
                pdfFile:  "software_teams.pdf",
                docxFile: "software_teams.xlsx",
                isRoster: true,
              },
              {
                type:     "hardware",
                label:    "Hardware Teams",
                desc:     "All final teams working on Hardware category problem statements",
                icon:     Cpu,
                accent:   "orange",
                border:   "border-orange-500/25",
                bg:       "bg-orange-500/5",
                iconBg:   "bg-orange-500/10 border-orange-500/20",
                iconClr:  "text-orange-400",
                btnClr:   "bg-orange-600 hover:bg-orange-500",
                pdfFile:  "hardware_teams.pdf",
                docxFile: "hardware_teams.xlsx",
                isRoster: true,
              },
              {
                type:     "aicte",
                label:    "AICTE Teams",
                desc:     "Open Innovation teams under AICTE with custom problem statements",
                icon:     Sparkles,
                accent:   "amber",
                border:   "border-amber-500/25",
                bg:       "bg-amber-500/5",
                iconBg:   "bg-amber-500/10 border-amber-500/20",
                iconClr:  "text-amber-400",
                btnClr:   "bg-amber-600 hover:bg-amber-500",
                pdfFile:  "aicte_teams.pdf",
                docxFile: "aicte_teams.xlsx",
                isRoster: true,
              },
              {
                type:     "all",
                label:    "Master Roster",
                desc:     "Consolidated roster of all Software, Hardware & AICTE final teams",
                icon:     Globe,
                accent:   "emerald",
                border:   "border-emerald-500/25",
                bg:       "bg-emerald-500/5",
                iconBg:   "bg-emerald-500/10 border-emerald-500/20",
                iconClr:  "text-emerald-400",
                btnClr:   "bg-emerald-600 hover:bg-emerald-500",
                pdfFile:  "final_teams_all.pdf",
                docxFile: "all_sih_teams.xlsx",
                isRoster: true,
              },
              {
                type:     "software_refinery",
                label:    "Software Refinery",
                desc:     "Software Room Allotment document containing room and venue allocations",
                icon:     FileText,
                accent:   "violet",
                border:   "border-violet-500/25",
                bg:       "bg-violet-500/5",
                iconBg:   "bg-violet-500/10 border-violet-500/20",
                iconClr:  "text-violet-400",
                btnClr:   "bg-violet-600 hover:bg-violet-500",
                pdfFile:  "Software_Room_Allotment.pdf",
                docxFile: "Software_Room_Allotment.docx",
                isDoc:    true,
              },
              {
                type:     "hardware_refinery",
                label:    "Hardware Refinery",
                desc:     "Hardware Room Allotment document containing room and venue allocations",
                icon:     FileText,
                accent:   "cyan",
                border:   "border-cyan-500/25",
                bg:       "bg-cyan-500/5",
                iconBg:   "bg-cyan-500/10 border-cyan-500/20",
                iconClr:  "text-cyan-400",
                btnClr:   "bg-cyan-600 hover:bg-cyan-500",
                pdfFile:  "Hardware_Room_Allotment.pdf",
                docxFile: "Hardware_Room_Allotment.docx",
                isDoc:    true,
              },
            ].map(({ type, label, desc, icon: Icon, border, bg, iconBg, iconClr, btnClr, pdfFile, docxFile, isRoster, isDoc }) => {
              const state = dlState[type]; // "idle" | "loading" | "done" | "error"
              return (
                <div key={type} className={cn("rounded-2xl border p-5 flex flex-col gap-3.5 transition-all", border, bg)}>
                  {/* Icon + label */}
                  <div className="flex items-center gap-3">
                    <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl border", iconBg)}>
                      <Icon className={cn("size-5", iconClr)} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold text-white">{label}</p>
                      <p className="text-[10px] font-mono text-[#94a3b8] truncate max-w-[180px]">
                        Formats: PDF & {docxFile.endsWith(".xlsx") ? "XLSX" : "DOCX"}
                      </p>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-[11px] text-[#94a3b8] leading-relaxed flex-1">{desc}</p>

                  {/* Status / error */}
                  {state === "done" && (
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400">
                      <CheckCircle2 className="size-3.5 shrink-0" />
                      Download started
                    </div>
                  )}
                  {state === "error" && (
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-red-400">
                      <AlertTriangle className="size-3.5 shrink-0" />
                      Failed to download document
                    </div>
                  )}

                  {/* Dual Format Download Buttons: PDF & DOCX/XLSX */}
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {/* PDF Button */}
                    <button
                      type="button"
                      disabled={state === "loading"}
                      onClick={async () => {
                        setDlState((s) => ({ ...s, [type]: "loading" }));
                        const { ok, error } = await downloadRefineryDoc(pdfFile);
                        setDlState((s) => ({ ...s, [type]: ok ? "done" : "error" }));
                        if (!ok) toast("error", error || `Failed to download ${pdfFile}`);
                        setTimeout(() => setDlState((s) => ({ ...s, [type]: "idle" })), 4000);
                      }}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/15 hover:bg-red-500/25 px-3 py-2 text-xs font-extrabold text-red-300 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                    >
                      <FileText className="size-3.5 shrink-0 text-red-400" />
                      PDF
                    </button>

                    {/* DOCX / XLSX Button */}
                    <button
                      type="button"
                      disabled={state === "loading"}
                      onClick={async () => {
                        setDlState((s) => ({ ...s, [type]: "loading" }));
                        let res;
                        if (isDoc) {
                          res = await downloadRefineryDoc(docxFile);
                        } else {
                          res = await downloadTeamsXlsx(type);
                        }
                        const { ok, error } = res;
                        setDlState((s) => ({ ...s, [type]: ok ? "done" : "error" }));
                        if (!ok) toast("error", error || `Failed to download ${docxFile}`);
                        setTimeout(() => setDlState((s) => ({ ...s, [type]: "idle" })), 4000);
                      }}
                      className={cn(
                        "flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-extrabold text-white transition-all cursor-pointer shadow-sm disabled:opacity-50",
                        btnClr
                      )}
                    >
                      {docxFile.endsWith(".xlsx") ? (
                        <>
                          <HardDrive className="size-3.5 shrink-0" />
                          XLSX
                        </>
                      ) : (
                        <>
                          <Download className="size-3.5 shrink-0" />
                          DOCX
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Info note */}
          <div className="rounded-2xl border border-[rgba(147,197,253,0.08)] bg-[#0a1226]/40 px-5 py-3 flex items-start gap-3">
            <FileText className="size-3.5 text-[#94a3b8] shrink-0 mt-0.5" />
            <p className="text-[10px] text-[#94a3b8] leading-relaxed">
              Each file is generated live from the database and matches the official format used for SIH 2026 submissions.
              Only teams with <span className="text-white font-bold">exactly 6 members</span> and a <span className="text-white font-bold">confirmed problem statement</span> are included.
            </p>
          </div>
        </div>
      )}

      {activeTab === "access-log" && isMaster && (
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
