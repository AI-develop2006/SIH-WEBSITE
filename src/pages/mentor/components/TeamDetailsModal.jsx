import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/unlumen-ui/button";
import { Avatar } from "@/components/unlumen-ui/avatar";
import {
  Users, User, Eye, Trash2, Pencil, Lock,
  AlertTriangle, CheckCircle2, X,
} from "lucide-react";
import { SOFTWARE_ROLES, HARDWARE_ROLES, OTHER_ROLES, MINISTRIES } from "@/lib/constants";

const ALL_SKILLS = [...SOFTWARE_ROLES, ...HARDWARE_ROLES, ...OTHER_ROLES];

function getMemberSkillOptions(member) {
  const interests = Array.isArray(member.domain_interests) ? member.domain_interests : [];
  if (interests.length > 0) {
    const recognised = interests.filter((i) => ALL_SKILLS.includes(i));
    if (recognised.length > 0) return recognised;
    return interests;
  }
  return ALL_SKILLS;
}

export function TeamDetailsModal({
  teamData,
  onClose,
  problemMap,
  removeMember,
  deleteTeam,
  renameTeam,
  onViewProfile,
  assignMemberSkill,
  assignTeamMinistry,
  readOnly = false,
}) {
  if (!teamData) return null;

  const team = teamData.team;
  const members = teamData.members || [];
  const stats = teamData.stats || {};
  const problemTitle = team.problem_id
    ? problemMap.get(team.problem_id)
    : "General Idea / Custom Problem";

  const category = team.category || (members.length === 1 ? "Solo" : "Pairs");
  const isSolo = category === "Solo";
  const targetLimit = isSolo ? 1 : 2;
  const isTeamComplete = members.length === targetLimit;

  // ── Draft state — changes only persist on Save ──────────────────────────
  const [draftMinistry, setDraftMinistry] = useState(team.ministry ?? "");
  const [draftSkills, setDraftSkills] = useState(
    () => Object.fromEntries(members.map((m) => [m.id, m.assigned_skill ?? ""]))
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // ── Rename state ─────────────────────────────────────────────────────────
  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState(team.name ?? "");
  const [renameBusy, setRenameBusy] = useState(false);

  // Sync rename draft when team changes (e.g. optimistic update propagates back)
  useEffect(() => { setDraftName(team.name ?? ""); setIsEditingName(false); }, [team.id, team.name]);

  // Sync drafts when parent data refreshes after a removeMember etc.
  useEffect(() => { setDraftMinistry(team.ministry ?? ""); }, [team.ministry, team.id]);
  useEffect(() => {
    setDraftSkills(Object.fromEntries(members.map((m) => [m.id, m.assigned_skill ?? ""])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members.map((m) => `${m.id}:${m.assigned_skill}`).join(",")]);

  const ministryChanged = draftMinistry !== (team.ministry ?? "");
  const skillsChanged = members.some(
    (m) => (draftSkills[m.id] ?? "") !== (m.assigned_skill ?? "")
  );
  const hasUnsaved = ministryChanged || skillsChanged;

  const handleRename = useCallback(async () => {
    const trimmed = draftName.trim();
    if (!trimmed || trimmed === team.name) { setIsEditingName(false); return; }
    setRenameBusy(true);
    if (renameTeam) await renameTeam(team.id, trimmed);
    setRenameBusy(false);
    setIsEditingName(false);
  }, [draftName, team.id, team.name, renameTeam]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    const tasks = [];
    if (ministryChanged) tasks.push(assignTeamMinistry(team.id, draftMinistry));
    for (const m of members) {
      const newSkill = draftSkills[m.id] ?? "";
      if (newSkill !== (m.assigned_skill ?? "")) {
        tasks.push(assignMemberSkill(team.id, m.id, newSkill));
      }
    }
    await Promise.all(tasks);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  }, [draftMinistry, draftSkills, members, ministryChanged, team.id, assignMemberSkill, assignTeamMinistry]);

  return (
    <div
      className="fixed inset-0 z-[99990] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[92dvh] overflow-y-auto rounded-3xl border border-border/80 bg-[#0a0f1d] p-5 sm:p-8 shadow-2xl text-left z-[99995] space-y-6 scrollbar-thin"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border/20 pb-4 gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl sm:text-2xl font-black text-white">{team.team_code || team.name}</h3>
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border shrink-0 ${
                isSolo
                  ? "bg-indigo-500/15 border-indigo-500/40 text-indigo-300"
                  : "bg-[#c9a227]/15 border-[#c9a227]/40 text-[#e8c058]"
              }`}>
                {isSolo ? <><User className="size-3 shrink-0 inline-block mr-1" />Solo Entry</> : <><Users className="size-3 shrink-0 inline-block mr-1" />Pairs Team</>}
              </span>
              {team.approved ? (
                <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">Approved</span>
              ) : (
                <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-300">Pending Review</span>
              )}
            </div>
            <p className="text-xs text-slate-300 font-semibold mt-1 font-mono">
              {readOnly ? (
                <>Team Name: {team.name}</>
              ) : isEditingName ? (
                <span className="flex items-center gap-2 flex-wrap">
                  <span className="text-muted-foreground">Team Name:</span>
                  <input
                    autoFocus
                    type="text"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRename();
                      if (e.key === "Escape") { setDraftName(team.name ?? ""); setIsEditingName(false); }
                    }}
                    className="rounded-lg border border-[#c9a227]/50 bg-card/60 text-white text-xs px-2 py-1 focus:outline-none focus:border-[#c9a227] w-48"
                  />
                  <button
                    type="button"
                    onClick={handleRename}
                    disabled={renameBusy || !draftName.trim()}
                    className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-[#c9a227] text-black hover:bg-[#e8c058] disabled:opacity-50 transition"
                  >
                    {renameBusy ? "…" : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDraftName(team.name ?? ""); setIsEditingName(false); }}
                    className="text-[10px] font-bold px-2.5 py-1 rounded-lg border border-border/40 text-muted-foreground hover:text-white transition"
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <span className="text-muted-foreground">Team Name:</span>
                  <span className="text-white">{team.name}</span>
                  <button
                    type="button"
                    onClick={() => { setDraftName(team.name ?? ""); setIsEditingName(true); }}
                    className="text-[10px] font-bold text-[#c9a227] hover:text-[#e8c058] transition cursor-pointer"
                    title="Edit team name"
                  >
                    <Pencil className="size-3 shrink-0 inline-block" /> Edit
                  </button>
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Problem: <span className="text-[#c9a227] font-semibold">{problemTitle}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="size-3.5" />
          </button>
        </div>

        {/* Read-only notice */}
        {readOnly && (
          <div className="rounded-2xl border border-slate-600/40 bg-slate-800/40 p-3 flex items-center gap-2.5 text-xs text-slate-300">
            <Eye className="size-3 shrink-0" />
            <div>
              <span className="font-bold text-white">View Only</span>
              <span className="text-slate-400"> — This team belongs to the <span className="text-[#c9a227] font-semibold">{team.created_by_dept || "another department"}</span>. You can view but not edit or delete it.</span>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-2xl border border-border/40 bg-card/40 p-3">
            <div className="text-[10px] uppercase font-bold text-muted-foreground">Members</div>
            <div className="text-base font-extrabold text-white mt-0.5">{members.length} / {targetLimit}</div>
          </div>
          <div className="rounded-2xl border border-border/40 bg-card/40 p-3">
            <div className="text-[10px] uppercase font-bold text-muted-foreground">Category</div>
            <div className={`text-base font-extrabold mt-0.5 ${isSolo ? "text-indigo-400" : "text-[#e8c058]"}`}>
              {isSolo ? "Solo Entry" : "Pairs Team"}
            </div>
          </div>
          <div className="rounded-2xl border border-border/40 bg-card/40 p-3">
            <div className="text-[10px] uppercase font-bold text-muted-foreground">Department</div>
            <div className={`text-base font-extrabold mt-0.5 ${
              isSolo ? "text-emerald-400" : stats.sameDept ? "text-emerald-400" : "text-amber-400"
            }`}>
              {isSolo ? "Solo" : stats.sameDept ? "Same Dept" : "Mixed Depts"}
            </div>
          </div>
        </div>

        {/* Constraint Alert */}
        {!stats.valid && stats.reason && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-300 flex items-center gap-2">
            <AlertTriangle className="size-3.5 shrink-0" />
            <span>SIH Diversity Compliance: {stats.reason}</span>
          </div>
        )}

        {/* Ministry Assignment — draft-controlled */}
        <div className="rounded-2xl border border-border/40 bg-card/40 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#c9a227]">
              Ministry / Organisation
            </h4>
            {!readOnly && draftMinistry && draftMinistry !== (team.ministry ?? "") && (
              <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/30 rounded px-2 py-0.5">
                Unsaved
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {isSolo
              ? "Assign this solo entry to a ministry. Max 6 members per department per ministry."
              : "Both members of a Pairs team are assigned under the same ministry. Max 6 members per department per ministry."}
          </p>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#c9a227] shrink-0 w-24">
              Ministry
            </label>
            {readOnly ? (
              <div className="flex-1 flex items-center gap-2">
                <span className="text-sm font-semibold text-white">
                  {team.ministry || <span className="text-muted-foreground italic">Not assigned</span>}
                </span>
                {team.ministry && (
                  <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 shrink-0">
                    ✓ Set
                  </span>
                )}
              </div>
            ) : (
              <div className="flex-1 flex items-center gap-2 flex-wrap">
                <select
                  value={draftMinistry}
                  onChange={(e) => setDraftMinistry(e.target.value)}
                  className="flex-1 min-w-0 w-full rounded-xl border border-border/50 bg-card/60 text-xs text-white px-3 py-2 focus:outline-none focus:border-[#c9a227] cursor-pointer"
                >
                  <option value="">— Select Ministry / Organisation —</option>
                  {MINISTRIES.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                {draftMinistry && (
                  <button
                    type="button"
                    onClick={() => setDraftMinistry("")}
                    className="text-[10px] text-muted-foreground hover:text-red-400 font-bold transition-colors"
                  >
                    <X className="size-3.5 inline-block" /> Clear
                  </button>
                )}
                {draftMinistry ? (
                  <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 shrink-0">
                    ✓ Set
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
                    Pending
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Team Members */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#c9a227] flex items-center justify-between flex-wrap gap-2">
            <span>Team Members ({members.length})</span>
            <span className="text-[11px] text-muted-foreground font-normal">
              Click Profile to view · Delete to remove
            </span>
          </h4>

          {members.length === 0 ? (
            <div className="p-8 text-center rounded-2xl border border-border/20 bg-muted/5 text-xs text-muted-foreground">
              This team currently has 0 members.
            </div>
          ) : (
            <div className="grid gap-3">
              {members.map((member) => {
                const skillOptions = getMemberSkillOptions(member);
                const takenByOthers = new Set(
                  members
                    .filter((m) => m.id !== member.id)
                    .map((m) => draftSkills[m.id])
                    .filter(Boolean)
                );
                const currentDraft = draftSkills[member.id] ?? "";
                const isDraftChanged = currentDraft !== (member.assigned_skill ?? "");

                return (
                  <div
                    key={member.id}
                    className="flex flex-col gap-3 p-4 rounded-2xl border border-border/30 bg-card/40 hover:bg-card/70 transition"
                  >
                    {/* Member info + actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3.5">
                        <Avatar
                          name={member.name}
                          src={member.avatar_url ?? undefined}
                          className="size-11 text-xs ring-1 ring-primary/30 shrink-0"
                        />
                        <div>
                          <span className="text-sm font-bold text-white">{member.name}</span>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {member.register_no} · {member.department}{" "}
                            {member.year ? `(Yr ${member.year})` : ""} · {member.gender}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 self-end sm:self-center flex-wrap">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => onViewProfile(member)}
                          className="border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white text-xs font-semibold px-3.5 py-1.5 rounded-xl"
                        >
                          <User className="size-3 shrink-0 mr-1.5" />Profile
                        </Button>
                        {!readOnly && (
                          <Button
                            type="button"
                            onClick={() => removeMember(team.id, member.id, member.name)}
                            className="bg-red-500/15 border border-red-500/40 text-red-300 hover:bg-red-500 hover:text-white text-xs font-semibold px-3.5 py-1.5 rounded-xl transition-colors"
                          >
                            <Trash2 className="size-3 shrink-0 mr-1.5" />Delete
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Skill Selector — draft-controlled or read-only */}
                    <div className="border-t border-border/20 pt-3 flex flex-col sm:flex-row sm:items-center gap-2">
                      <div className="flex items-center gap-2 shrink-0">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-[#c9a227] w-28">
                          Assigned Skill
                        </label>
                        {!readOnly && isDraftChanged && (
                          <span className="text-[9px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/30 rounded px-1.5 py-0.5">
                            Unsaved
                          </span>
                        )}
                      </div>
                      {readOnly ? (
                        <div className="flex-1 flex items-center gap-2">
                          <span className="text-sm font-semibold text-white">
                            {member.assigned_skill || <span className="text-muted-foreground italic">Not assigned</span>}
                          </span>
                          {member.assigned_skill && (
                            <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 shrink-0">
                              ✓ Assigned
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center gap-2 flex-wrap">
                          <select
                            value={currentDraft}
                            onChange={(e) =>
                              setDraftSkills((prev) => ({ ...prev, [member.id]: e.target.value }))
                            }
                            className="flex-1 min-w-0 w-full rounded-xl border border-border/50 bg-card/60 text-xs text-white px-3 py-2 focus:outline-none focus:border-[#c9a227] cursor-pointer"
                          >
                            <option value="">— Select a skill —</option>
                            {skillOptions.map((skill) => {
                              const isTaken = takenByOthers.has(skill);
                              return (
                                <option key={skill} value={skill} disabled={isTaken}>
                                  {skill}{isTaken ? " (taken)" : ""}
                                </option>
                              );
                            })}
                          </select>
                          {currentDraft && (
                            <button
                              type="button"
                              onClick={() =>
                                setDraftSkills((prev) => ({ ...prev, [member.id]: "" }))
                              }
                              className="text-[10px] text-muted-foreground hover:text-red-400 font-bold transition-colors"
                            >
                              <X className="size-3.5 inline-block" /> Clear
                            </button>
                          )}
                          {currentDraft ? (
                            <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 shrink-0">
                              ✓ Assigned
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
                              Pending
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Readiness banner */}
        {isTeamComplete && (
          <div className={`rounded-2xl border p-3.5 text-xs flex items-center gap-2 ${
            members.every((m) => (draftSkills[m.id] ?? ""))
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-amber-500/30 bg-amber-500/10 text-amber-300"
          }`}>
            {members.every((m) => (draftSkills[m.id] ?? ""))
              ? <CheckCircle2 className="size-3.5 shrink-0" />
              : <AlertTriangle className="size-3.5 shrink-0" />}
            <span>
              {members.every((m) => (draftSkills[m.id] ?? ""))
                ? isSolo
                  ? `Skill assigned: ${draftSkills[members[0].id]}. Entry is ready.`
                  : "Both members have unique skills assigned. Team is ready."
                : "Please assign a unique skill to each member before finalising the team."}
            </span>
          </div>
        )}

        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-t border-border/20 pt-4 mt-2">
          <Button variant="outline" onClick={onClose} className="text-xs">
            Close
          </Button>

          {!readOnly && (
            <div className="flex items-center gap-3 flex-wrap">
              {/* Delete team */}
              {members.length === 0 ? (
                <Button
                  onClick={() => { onClose(); deleteTeam(team.id, team.name, 0); }}
                  className="bg-red-500 text-white font-bold text-xs hover:bg-red-600 px-4 py-2"
                >
                  Delete Empty Team
                </Button>
              ) : (
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Lock className="size-3 shrink-0" /> Remove all members to delete
                </span>
              )}

              {/* Save button */}
              <Button
                type="button"
                onClick={handleSave}
                loading={saving}
                disabled={!hasUnsaved || saving}
                className={`text-xs font-bold px-5 py-2 border-0 transition-all ${
                  saved
                    ? "bg-emerald-500 text-white"
                    : hasUnsaved
                    ? "bg-[#c9a227] text-black hover:bg-[#e8c058]"
                    : "bg-muted/40 text-muted-foreground cursor-not-allowed"
                }`}
              >
                {saved ? "✓ Saved!" : hasUnsaved ? "Save Changes" : "No Changes"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
