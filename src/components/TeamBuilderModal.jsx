import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  X, CheckCircle2, AlertTriangle, Plus, Minus,
} from "lucide-react";
import { cn, validateFinalTeam, duplicatedSkills } from "@/lib/utils";
import { SPOC_TEAM_SIZE, DEPT_CODE } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { fetchClaimedMembers, subscribeToTeamEvents } from "@/lib/data";

function getDeptCode(dept) {
  return DEPT_CODE[dept] ?? (dept ?? "?").replace(/\s+/g, "").toUpperCase().slice(0, 6);
}

function genderBadge(gender) {
  if (gender === "Female")
    return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-pink-500/15 border border-pink-500/30 text-pink-300">F</span>;
  if (gender === "Male")
    return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300">M</span>;
  return null;
}

/**
 * TeamBuilderModal
 *
 * Allows the SPOC to pick exactly 6 members from the pair-teams
 * in a given ministry to form one final SIH team.
 *
 * Constraints enforced in real-time:
 *   - Exactly 6 members
 *   - ≥2 different departments
 *   - ≥2 female members
 *   - All assigned skills must be unique (no two members share a skill)
 */
export function TeamBuilderModal({ ministry, sourceTeams, editingTeam, profileMap, claimedMemberIds: initialClaimedIds = new Set(), onSave, onClose }) {
  const modalRef = useRef(null);

  // ── Live claimed-member state ───────────────────────────────────────────────
  // Maintain our own live claimed set inside the modal so that when another
  // session saves a team while this modal is open, we instantly see who's taken.
  // When editing, exclude this team's own members from the claimed set.
  const [liveClaimed, setLiveClaimed] = useState(initialClaimedIds);
  const [liveRefreshing, setLiveRefreshing] = useState(false);

  const refreshClaimed = useCallback(async () => {
    setLiveRefreshing(true);
    const { data } = await fetchClaimedMembers(editingTeam?.id ?? null);
    setLiveClaimed(new Set(data ?? []));
    setLiveRefreshing(false);
  }, [editingTeam?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribe to SSE while modal is open — re-fetch claimed on any team event
  useEffect(() => {
    const cleanup = subscribeToTeamEvents(() => {
      refreshClaimed();
    });
    return cleanup;
  }, [refreshClaimed]);

  // Also sync when the parent's claimedMemberIds prop changes
  useEffect(() => {
    setLiveClaimed(initialClaimedIds);
  }, [initialClaimedIds]);

  // Collect all available members from the source pair-teams
  const allMembers = useMemo(() => {
    const seen = new Set();
    const list = [];
    for (const t of sourceTeams) {
      for (const m of t.members) {
        if (!seen.has(m.id)) {
          seen.add(m.id);
          list.push({ ...m, _pairTeamCode: t.team.team_code || t.team.name });
        }
      }
    }
    return list;
  }, [sourceTeams]);

  // Initial selected members when editing
  const initialSelected = useMemo(() => {
    if (!editingTeam) return [];
    return (editingTeam.member_ids || []).map((id) => profileMap.get(id)).filter(Boolean);
  }, [editingTeam, profileMap]);

  const [teamName, setTeamName] = useState(editingTeam?.name ?? "");
  const [selected, setSelected] = useState(initialSelected);
  const [busy, setSaving] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberDeptFilter, setMemberDeptFilter] = useState("");
  const [memberGenderFilter, setMemberGenderFilter] = useState("");

  useEffect(() => {
    modalRef.current?.focus();
    // Lock body scroll while modal is open
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const selectedIds = useMemo(() => new Set(selected.map((m) => m.id)), [selected]);

  const errors = useMemo(() => validateFinalTeam(selected), [selected]);
  const isValid = errors.length === 0 && selected.length === SPOC_TEAM_SIZE && teamName.trim();
  // Draft: name + at least 1 member — always available regardless of completeness
  const canSaveDraft = Boolean(teamName.trim()) && selected.length > 0;

  // Skill conflict — warning only, does NOT block saving
  const skillConflictIds = useMemo(() => {
    const skillMap = {};
    for (const m of selected) {
      if (!m.assigned_skill) continue;
      const key = m.assigned_skill.toLowerCase();
      if (!skillMap[key]) skillMap[key] = [];
      skillMap[key].push(m.id);
    }
    const conflicting = new Set();
    for (const ids of Object.values(skillMap)) {
      if (ids.length > 1) ids.forEach((id) => conflicting.add(id));
    }
    return conflicting;
  }, [selected]);

  const skillWarnings = useMemo(() => duplicatedSkills(selected), [selected]);

  function toggleMember(member) {
    if (selectedIds.has(member.id)) {
      setSelected((prev) => prev.filter((m) => m.id !== member.id));
    } else {
      if (selected.length >= SPOC_TEAM_SIZE) return; // cap at 6
      setSelected((prev) => [...prev, member]);
    }
  }

  async function handleSave(draft = false) {
    if (!teamName.trim()) return;
    if (!draft && !isValid) return;
    setSaving(true);
    try {
      const result = await onSave({
        name: teamName.trim(),
        ministry,
        member_ids: selected.map((m) => m.id),
        ...(draft ? { draft: true } : {}),
      });
      // If the parent returns a conflict signal, refresh claimed and stay open
      if (result?.conflict) {
        await refreshClaimed();
        // Remove any selected members that are now claimed by another session
        setSelected((prev) => prev.filter((m) => !liveClaimed.has(m.id)));
      }
    } finally {
      setSaving(false);
    }
  }

  // Group available members by their pair-team for better UI
  const membersByPairTeam = useMemo(() => {
    const needle = memberSearch.trim().toLowerCase();
    const map = new Map();
    for (const m of allMembers) {
      // Apply filters
      if (memberDeptFilter && m.department !== memberDeptFilter) continue;
      if (memberGenderFilter && m.gender !== memberGenderFilter) continue;
      if (needle && !`${m.name} ${m.assigned_skill ?? ""} ${m.section ?? ""}`.toLowerCase().includes(needle)) continue;
      const key = m._pairTeamCode;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(m);
    }
    return map;
  }, [allMembers, memberSearch, memberDeptFilter, memberGenderFilter]);

  const availableMemberDepts = useMemo(
    () => [...new Set(allMembers.map((m) => m.department).filter(Boolean))].sort(),
    [allMembers]
  );
  const filteredMemberCount = useMemo(
    () => [...membersByPairTeam.values()].reduce((s, arr) => s + arr.length, 0),
    [membersByPairTeam]
  );

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#050b18]/85 backdrop-blur-md p-4 overflow-hidden"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="relative w-full max-w-4xl rounded-3xl border border-[rgba(147,197,253,0.14)] bg-[#0a1226] shadow-2xl outline-none flex flex-col"
        style={{ maxHeight: "calc(100vh - 2rem)" }}
      >
        {/* Gold top accent */}
        <div className="absolute top-0 left-0 right-0 h-1 rounded-t-3xl bg-gradient-to-r from-transparent via-[#c9a227] to-transparent" />

        {/* Modal header — fixed */}
        <div className="flex items-start justify-between gap-4 px-6 pt-7 pb-5 border-b border-[rgba(147,197,253,0.10)] shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8] mb-1">
              Building Final Team · {ministry}
            </p>
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              {editingTeam ? "Edit Final Team" : "Build Final Team"}
              <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            </h2>
            <p className="text-xs text-[#94a3b8] mt-0.5">
              Select exactly 6 members · ≥2 depts · ≥2 female · shared skills allowed with warning · or save as draft anytime
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 flex size-8 items-center justify-center rounded-full bg-[rgba(147,197,253,0.08)] text-[#94a3b8] hover:bg-[rgba(147,197,253,0.14)] hover:text-white transition-colors cursor-pointer mt-0.5"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body — scrollable, two columns always side-by-side */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6 h-full">
            {/* ── Left: Source members ── */}
            <div className="flex flex-col gap-3 min-h-0">
              <div className="flex items-center justify-between gap-2 shrink-0">
                <p className="text-xs font-bold uppercase tracking-wider text-[#94a3b8]">
                  Available Members ({filteredMemberCount}/{allMembers.length})
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  {liveClaimed.size > 0 && (
                    <span className={cn(
                      "text-[9px] font-bold px-2 py-0.5 rounded-full border border-rose-500/25 bg-rose-500/8 text-rose-400/80",
                      liveRefreshing && "opacity-50"
                    )}>
                      {[...liveClaimed].filter(id => allMembers.some(m => m.id === id)).length} taken
                      {liveRefreshing && " …"}
                    </span>
                  )}
                  {(memberSearch || memberDeptFilter || memberGenderFilter) && (
                    <button type="button" onClick={() => { setMemberSearch(""); setMemberDeptFilter(""); setMemberGenderFilter(""); }} className="text-[10px] text-red-400 hover:underline font-semibold">✕ Clear</button>
                  )}
                </div>
              </div>

              {/* Member search + filters */}
              <div className="space-y-2 shrink-0">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search name, skill, section…"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className="w-full rounded-xl border border-[rgba(147,197,253,0.18)] bg-[#050b18]/60 pl-3 pr-8 py-2 text-xs text-white outline-none placeholder:text-[#94a3b8]/50 focus:border-[#c9a227]/60 transition-all"
                  />
                  {memberSearch && (
                    <button type="button" onClick={() => setMemberSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-white">
                      <X className="size-3" />
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <select
                    value={memberDeptFilter}
                    onChange={(e) => setMemberDeptFilter(e.target.value)}
                    className="flex-1 rounded-xl border border-[rgba(147,197,253,0.18)] bg-[#050b18]/60 px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#c9a227]/60 transition-all cursor-pointer"
                  >
                    <option value="">All Depts</option>
                    {availableMemberDepts.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <select
                    value={memberGenderFilter}
                    onChange={(e) => setMemberGenderFilter(e.target.value)}
                    className="w-28 rounded-xl border border-[rgba(147,197,253,0.18)] bg-[#050b18]/60 px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#c9a227]/60 transition-all cursor-pointer"
                  >
                    <option value="">Any Gender</option>
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                  </select>
                </div>
              </div>

              {/* Member list — takes remaining space and scrolls */}
              {allMembers.length === 0 ? (
                <div className="py-10 text-center text-sm text-[#94a3b8] rounded-2xl border border-[rgba(147,197,253,0.08)] shrink-0">
                  No members in pair teams for this ministry.
                </div>
              ) : membersByPairTeam.size === 0 ? (
                <div className="py-8 text-center text-xs text-[#94a3b8] rounded-2xl border border-[rgba(147,197,253,0.08)] shrink-0">
                  No members match your filters.
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto pr-1 space-y-3 min-h-0">
                  {[...membersByPairTeam.entries()].map(([pairCode, members]) => (
                    <div key={pairCode}>
                      <p className="text-[10px] font-extrabold text-[#c9a227] uppercase tracking-wider mb-1.5 px-1">
                        {pairCode}
                      </p>
                      <div className="space-y-1.5">
                        {members.map((m) => {
                          const isSelected = selectedIds.has(m.id);
                          const isFull = selected.length >= SPOC_TEAM_SIZE && !isSelected;
                          const hasConflict = skillConflictIds.has(m.id) && isSelected;
                          // Claimed: already in another final team (uses live state)
                          const isClaimed = liveClaimed.has(m.id) && !isSelected;

                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => !isFull && !isClaimed && toggleMember(m)}
                              disabled={isFull || isClaimed}
                              title={isClaimed ? "Already assigned to another final team" : undefined}
                              className={cn(
                                "w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all",
                                isSelected
                                  ? hasConflict
                                    ? "border-amber-500/50 bg-amber-500/10 cursor-pointer"
                                    : "border-[#c9a227]/50 bg-[#c9a227]/8 cursor-pointer"
                                  : isClaimed
                                  ? "border-[rgba(147,197,253,0.06)] bg-transparent opacity-35 cursor-not-allowed select-none"
                                  : isFull
                                  ? "border-[rgba(147,197,253,0.08)] bg-transparent opacity-40 cursor-not-allowed"
                                  : "border-[rgba(147,197,253,0.12)] bg-[#050b18]/40 hover:border-[#c9a227]/30 hover:bg-[#c9a227]/5 cursor-pointer"
                              )}
                            >
                              <Avatar name={m.name} className={cn("size-7 shrink-0", isClaimed && "opacity-40")} />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-white truncate">{m.name}</p>
                                <p className="text-[10px] text-[#94a3b8]">
                                  {m.register_no && <span className="font-mono text-[#c9a227]/80">{m.register_no} · </span>}
                                  {getDeptCode(m.department)}
                                  {m.assigned_skill ? ` · ${m.assigned_skill}` : " · No skill"}
                                  {isClaimed && <span className="ml-1 text-rose-400/70 font-bold">· taken</span>}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {genderBadge(m.gender)}
                                {hasConflict && <AlertTriangle className="size-3.5 text-amber-400" />}
                                {isClaimed
                                  ? <span className="text-[9px] font-bold text-rose-400/60 px-1.5 py-0.5 rounded-full border border-rose-500/20 bg-rose-500/8">taken</span>
                                  : isSelected
                                  ? <Minus className="size-4 text-[#c9a227]" />
                                  : <Plus className="size-4 text-[#94a3b8]" />
                                }
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Right: Selected team ── */}
            <div className="flex flex-col gap-4 min-h-0">
              {/* Team name input */}
              <div className="shrink-0">
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#94a3b8]">
                  Final Team Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="e.g. SIH-FINAL-001"
                  className="w-full rounded-xl border border-[rgba(147,197,253,0.18)] bg-[#050b18]/60 px-4 py-2.5 text-sm text-white outline-none placeholder:text-[#94a3b8]/50 focus:border-[#c9a227]/60 focus:shadow-[0_0_0_3px_rgba(201,162,39,0.10)] transition-all"
                />
              </div>

              {/* Selected members — takes remaining space */}
              <div className="flex flex-col flex-1 min-h-0 gap-2">
                <div className="flex items-center justify-between shrink-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#94a3b8]">
                    Selected ({selected.length}/{SPOC_TEAM_SIZE})
                  </p>
                  {selected.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelected([])}
                      className="text-[10px] text-red-400 hover:underline cursor-pointer"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                {/* Progress bar */}
                <div className="h-1.5 rounded-full bg-[rgba(147,197,253,0.08)] overflow-hidden shrink-0">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-300",
                      selected.length === SPOC_TEAM_SIZE ? "bg-emerald-500" : "bg-[#c9a227]"
                    )}
                    style={{ width: `${(selected.length / SPOC_TEAM_SIZE) * 100}%` }}
                  />
                </div>

                <div className="flex-1 overflow-y-auto pr-1 space-y-1.5 min-h-0">
                  {selected.length === 0 ? (
                    <div className="py-8 text-center rounded-xl border border-dashed border-[rgba(147,197,253,0.14)] text-xs text-[#94a3b8]">
                      Click members on the left to add them
                    </div>
                  ) : (
                    selected.map((m) => {
                      const hasConflict = skillConflictIds.has(m.id);
                      return (
                        <div
                          key={m.id}
                          className={cn(
                            "flex items-center gap-2.5 rounded-xl border px-3 py-2 group transition-all",
                            hasConflict
                              ? "border-amber-500/40 bg-amber-500/8"
                              : "border-[rgba(147,197,253,0.12)] bg-[#050b18]/40"
                          )}
                        >
                          <Avatar name={m.name} className="size-7 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-white truncate">{m.name}</p>
                            <p className="text-[10px] text-[#94a3b8]">
                              {m.register_no && <span className="font-mono text-[#c9a227]/80">{m.register_no} · </span>}
                              {m.department ? getDeptCode(m.department) : "—"}
                              {m.assigned_skill ? ` · ${m.assigned_skill}` : " · No skill"}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {genderBadge(m.gender)}
                            {hasConflict && (
                              <span title="Skill conflict" className="text-amber-400">
                                <AlertTriangle className="size-3.5" />
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => toggleMember(m)}
                              className="text-[#94a3b8] hover:text-red-400 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                            >
                              <X className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Validation pills + errors — always at bottom of right column */}
              {selected.length > 0 && (
                <div className="space-y-1.5 shrink-0">
                  {(() => {
                    const femaleCount = selected.filter((m) => m.gender === "Female").length;
                    const depts = [...new Set(selected.map((m) => m.department).filter(Boolean))];

                    return (
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { label: `${selected.length}/6`, ok: selected.length === SPOC_TEAM_SIZE },
                          { label: `${depts.length} dept${depts.length !== 1 ? "s" : ""}`, ok: depts.length >= 2 },
                          { label: `${femaleCount}F`, ok: femaleCount >= 2 },
                          {
                            label: skillWarnings.length === 0 ? "Skills ✓" : `${skillWarnings.length} skill conflict${skillWarnings.length > 1 ? "s" : ""}`,
                            ok: skillWarnings.length === 0,
                            warn: skillWarnings.length > 0,
                          },
                        ].map((c) => (
                          <span
                            key={c.label}
                            className={cn(
                              "text-[10px] font-bold px-2.5 py-1 rounded-full border inline-flex items-center gap-1",
                              c.ok
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                                : c.warn
                                ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                                : "bg-red-500/10 border-red-500/30 text-red-400"
                            )}
                          >
                            {c.ok ? <CheckCircle2 className="size-3" /> : <AlertTriangle className="size-3" />}
                            {c.label}
                          </span>
                        ))}
                      </div>
                    );
                  })()}

                  {errors.length > 0 && (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2.5 space-y-1">
                      {errors.map((e) => (
                        <p key={e} className="text-[11px] text-red-400 flex items-start gap-1.5">
                          <AlertTriangle className="size-3 mt-0.5 shrink-0" />{e}
                        </p>
                      ))}
                    </div>
                  )}

                  {skillWarnings.length > 0 && (
                    <div className="rounded-xl border border-amber-500/25 bg-amber-500/8 px-3 py-2.5 space-y-1">
                      <p className="text-[11px] font-bold text-amber-400 flex items-center gap-1.5">
                        <AlertTriangle className="size-3 shrink-0" />
                        Skill overlap detected — allowed but not recommended
                      </p>
                      {skillWarnings.map((s) => (
                        <p key={s} className="text-[10px] text-amber-400/80 pl-4">
                          · Multiple members share the skill "{s}"
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer — fixed at bottom */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-[rgba(147,197,253,0.10)] shrink-0">
          <Button variant="ghost" onClick={onClose} className="text-sm px-5">
            Cancel
          </Button>
          <div className="flex items-center gap-3">
            {!isValid && selected.length > 0 && errors.length > 0 && (
              <p className="text-[11px] text-red-400 hidden sm:block max-w-[260px] text-right leading-snug">
                {errors[0]}
              </p>
            )}
            {isValid && skillWarnings.length > 0 && (
              <p className="text-[11px] text-amber-400 hidden sm:block max-w-[260px] text-right leading-snug">
                ⚠ Skill overlap — saving anyway
              </p>
            )}
            {/* Draft save — always visible when name + ≥1 member selected */}
            {canSaveDraft && (
              <Button
                onClick={() => handleSave(true)}
                loading={busy}
                className="px-5 text-sm bg-[#1e293b] border border-[rgba(147,197,253,0.25)] text-[#94a3b8] hover:bg-[rgba(147,197,253,0.08)] hover:text-white hover:border-[rgba(147,197,253,0.4)]"
              >
                Save as Draft
              </Button>
            )}
            <Button
              onClick={() => handleSave(false)}
              loading={busy}
              disabled={!isValid}
              className={cn(
                "px-6 text-sm",
                isValid ? "bg-emerald-500 text-white hover:bg-emerald-400" : "opacity-60 cursor-not-allowed"
              )}
            >
              {isValid ? <CheckCircle2 className="size-4" /> : null}
              {editingTeam ? "Update Team" : "Save Final Team"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
