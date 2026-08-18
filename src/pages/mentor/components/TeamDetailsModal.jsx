import { useState, useEffect } from "react";
import { Button } from "@/components/unlumen-ui/button";
import { Avatar } from "@/components/unlumen-ui/avatar";
import { GlowingBadge } from "@/components/unlumen-ui/glowing-badge";
import { SOFTWARE_ROLES, HARDWARE_ROLES, OTHER_ROLES, MINISTRIES } from "@/lib/constants";

// All possible skill options across every domain
const ALL_SKILLS = [...SOFTWARE_ROLES, ...HARDWARE_ROLES, ...OTHER_ROLES];

/** Returns skill options for a member based on their domain_interests */
function getMemberSkillOptions(member) {
  const interests = Array.isArray(member.domain_interests) ? member.domain_interests : [];
  if (interests.length > 0) {
    const recognised = interests.filter((i) => ALL_SKILLS.includes(i));
    if (recognised.length > 0) return recognised;
    return interests; // freeform interests still shown
  }
  return ALL_SKILLS;
}

/**
 * Local-state-backed skill selector.
 * Updating local state immediately on change eliminates the flicker caused by
 * waiting for the async optimistic-update → prop-change cycle to complete.
 */
function SkillSelector({ member, teamId, takenByOthers, assignMemberSkill }) {
  const [selected, setSelected] = useState(member.assigned_skill ?? "");

  // Keep in sync when parent sends a rollback or a background refresh
  useEffect(() => {
    setSelected(member.assigned_skill ?? "");
  }, [member.assigned_skill]);

  const skillOptions = getMemberSkillOptions(member);

  function handleChange(e) {
    const skill = e.target.value;
    setSelected(skill);                          // instant UI update
    assignMemberSkill(teamId, member.id, skill); // async persist + optimistic state
  }

  function handleClear() {
    setSelected("");
    assignMemberSkill(teamId, member.id, "");
  }

  return (
    <div className="border-t border-border/20 pt-3 flex flex-col sm:flex-row sm:items-center gap-2">
      <label className="text-[10px] font-bold uppercase tracking-wider text-[#c9a227] shrink-0 w-28">
        Assigned Skill
      </label>

      <div className="flex-1 flex items-center gap-2 flex-wrap">
        <select
          value={selected}
          onChange={handleChange}
          className="flex-1 min-w-0 w-full rounded-xl border border-border/50 bg-card/60 text-xs text-white px-3 py-2 focus:outline-none focus:border-[#c9a227] cursor-pointer"
        >
          <option value="">— Select a skill —</option>
          {skillOptions.map((skill) => {
            const isTaken = takenByOthers.has(skill);
            return (
              <option key={skill} value={skill} disabled={isTaken}>
                {skill}{isTaken ? " (assigned to other member)" : ""}
              </option>
            );
          })}
        </select>

        {selected && (
          <button
            type="button"
            onClick={handleClear}
            className="text-[10px] text-muted-foreground hover:text-red-400 font-bold transition-colors"
            title="Clear skill"
          >
            ✕ Clear
          </button>
        )}
      </div>

      {selected ? (
        <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 shrink-0">
          ✓ Assigned
        </span>
      ) : (
        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
          Pending
        </span>
      )}
    </div>
  );
}

/** Ministry selector with local state to avoid flicker */
function MinistrySelector({ teamId, currentMinistry, assignTeamMinistry }) {
  const [selected, setSelected] = useState(currentMinistry ?? "");

  function handleChange(e) {
    const val = e.target.value;
    setSelected(val);
    assignTeamMinistry(teamId, val);
  }

  function handleClear() {
    setSelected("");
    assignTeamMinistry(teamId, "");
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
      <label className="text-[10px] font-bold uppercase tracking-wider text-[#c9a227] shrink-0 w-28">
        Ministry
      </label>
      <div className="flex-1 flex items-center gap-2 flex-wrap">
        <select
          value={selected}
          onChange={handleChange}
          className="flex-1 min-w-0 w-full rounded-xl border border-border/50 bg-card/60 text-xs text-white px-3 py-2 focus:outline-none focus:border-[#c9a227] cursor-pointer"
        >
          <option value="">— Select Ministry / Organisation —</option>
          {MINISTRIES.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        {selected && (
          <button
            type="button"
            onClick={handleClear}
            className="text-[10px] text-muted-foreground hover:text-red-400 font-bold transition-colors"
          >
            ✕ Clear
          </button>
        )}
      </div>
      {selected ? (
        <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 shrink-0">
          ✓ Set
        </span>
      ) : (
        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
          Pending
        </span>
      )}
    </div>
  );
}

export function TeamDetailsModal({
  teamData,
  onClose,
  problemMap,
  removeMember,
  deleteTeam,
  onViewProfile,
  assignMemberSkill,
  assignTeamMinistry,
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

  return (
    <div
      className="fixed inset-0 z-[99990] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-3xl border border-border/80 bg-[#0a0f1d] p-6 sm:p-8 shadow-2xl text-left z-[99995] space-y-6 scrollbar-thin"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Gold Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#c9a227] to-transparent" />

        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-border/20 pb-4 gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl sm:text-2xl font-black text-white">{team.team_code || team.name}</h3>
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border shrink-0 ${
                isSolo
                  ? "bg-indigo-500/15 border-indigo-500/40 text-indigo-300"
                  : "bg-[#c9a227]/15 border-[#c9a227]/40 text-[#e8c058]"
              }`}>
                {isSolo ? "👤 Solo Entry" : "👥 Pairs Team"}
              </span>
              {team.approved ? (
                <GlowingBadge variant="success" pulse={false}>Approved</GlowingBadge>
              ) : (
                <GlowingBadge variant="warning" pulse={false}>Pending Review</GlowingBadge>
              )}
            </div>
            <p className="text-xs text-slate-300 font-semibold mt-1 font-mono">
              Team Name: {team.name}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Problem: <span className="text-[#c9a227] font-semibold">{problemTitle}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer shrink-0"
            aria-label="Close details"
          >
            ✕
          </button>
        </div>

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

        {/* Constraint Reason Alert */}
        {!stats.valid && stats.reason && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-300 flex items-center gap-2">
            <span>⚠️</span>
            <span>SIH Diversity Compliance: {stats.reason}</span>
          </div>
        )}

        {/* Ministry Assignment */}
        <div className="rounded-2xl border border-border/40 bg-card/40 p-4 space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#c9a227]">
            Ministry / Organisation
          </h4>
          <p className="text-[11px] text-muted-foreground">
            Both members of a Pairs team are assigned under the same ministry. Max 6 members per department per ministry.
          </p>
          <MinistrySelector
            teamId={team.id}
            currentMinistry={team.ministry}
            assignTeamMinistry={assignTeamMinistry}
          />
        </div>

        {/* Team Members List */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#c9a227] flex items-center justify-between">
            <span>Team Members ({members.length})</span>
            <span className="text-[11px] text-muted-foreground font-normal">
              Click Profile to view details or Delete to remove
            </span>
          </h4>

          {members.length === 0 ? (
            <div className="p-8 text-center rounded-2xl border border-border/20 bg-muted/5 text-xs text-muted-foreground">
              This team currently has 0 members.
            </div>
          ) : (
            <div className="grid gap-3">
              {members.map((member) => {
                const isLeader = member.id === team.leader_id;
                // Skills already taken by the OTHER member(s) in this team
                const takenByOthers = new Set(
                  members
                    .filter((m) => m.id !== member.id && m.assigned_skill)
                    .map((m) => m.assigned_skill)
                );

                return (
                  <div
                    key={member.id}
                    className="flex flex-col gap-3 p-4 rounded-2xl border border-border/30 bg-card/40 hover:bg-card/70 transition"
                  >
                    {/* Member info + action buttons */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3.5">
                        <Avatar
                          name={member.name}
                          src={member.avatar_url ?? undefined}
                          className="size-11 text-xs ring-1 ring-primary/30 shrink-0"
                        />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-white">{member.name}</span>
                            {isLeader && (
                              <span className="rounded bg-[#c9a227]/20 border border-[#c9a227]/40 px-2 py-0.5 text-[10px] font-bold text-[#e8c058]">
                                LEADER
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {member.register_no} · {member.department}{" "}
                            {member.year ? `(Yr ${member.year})` : ""} · {member.gender}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 self-end sm:self-center">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => onViewProfile(member)}
                          className="border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white text-xs font-semibold px-3.5 py-1.5 rounded-xl flex items-center gap-1.5"
                        >
                          <span>👤 Profile</span>
                        </Button>
                        <Button
                          type="button"
                          onClick={() => removeMember(team.id, member.id, member.name)}
                          className="bg-red-500/15 border border-red-500/40 text-red-300 hover:bg-red-500 hover:text-white text-xs font-semibold px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors"
                        >
                          <span>🗑 Delete</span>
                        </Button>
                      </div>
                    </div>

                    {/* Skill Selector — local state prevents dropdown flicker */}
                    <SkillSelector
                      member={member}
                      teamId={team.id}
                      takenByOthers={takenByOthers}
                      assignMemberSkill={assignMemberSkill}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Skill readiness banner — shown once team is full */}
        {isTeamComplete && (
          <div className={`rounded-2xl border p-3.5 text-xs flex items-center gap-2 ${
            members.every((m) => m.assigned_skill)
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-amber-500/30 bg-amber-500/10 text-amber-300"
          }`}>
            <span>{members.every((m) => m.assigned_skill) ? "✅" : "⚠️"}</span>
            <span>
              {members.every((m) => m.assigned_skill)
                ? isSolo
                  ? `Skill assigned: ${members[0].assigned_skill}. Entry is ready.`
                  : "Both members have unique skills assigned. Team is ready."
                : "Please assign a unique skill to each member before finalising the team."}
            </span>
          </div>
        )}

        {/* Modal Actions Footer */}
        <div className="flex items-center justify-between border-t border-border/20 pt-4 mt-6">
          <Button variant="outline" onClick={onClose} className="text-xs">
            Close Overlay
          </Button>

          {members.length === 0 ? (
            <Button
              onClick={() => {
                onClose();
                deleteTeam(team.id, team.name, 0);
              }}
              className="bg-red-500 text-white font-bold text-xs hover:bg-red-600 px-5 py-2"
            >
              Delete Empty Team
            </Button>
          ) : (
            <div className="text-xs text-muted-foreground">
              🔒 Remove all members to enable team deletion
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
