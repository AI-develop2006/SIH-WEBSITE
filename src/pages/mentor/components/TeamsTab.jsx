import { useState } from "react";
import { Button } from "@/components/unlumen-ui/button";
import { GlowingBadge } from "@/components/unlumen-ui/glowing-badge";
import { cn, computeStats } from "@/lib/utils";
import { StudentDetailModal } from "./StudentDetailModal";
import { TeamDetailsModal } from "./TeamDetailsModal";
import { TeamFormationRules } from "./TeamFormationRules";

export function TeamsTab({
  teams,
  focusedTeamId,
  problemMap,
  removeMember,
  deleteTeam,
  setShowCreateTeamModal,
  onAddMemberClick,
  assignMemberSkill,
  assignTeamMinistry,
}) {
  const [detailStudent, setDetailStudent] = useState(null);
  const [selectedTeamOverlay, setSelectedTeamOverlay] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("All");

  // Keep selectedTeamOverlay in sync when teams array updates (e.g. member deleted)
  const activeOverlayData = selectedTeamOverlay
    ? teams.find((t) => t.team.id === selectedTeamOverlay.team.id) ?? null
    : null;

  const displayTeams = teams.filter((t) => {
    if (categoryFilter === "All") return true;
    const cat = t.team.category || (t.members.length === 1 ? "Solo" : "Pairs");
    return cat === categoryFilter;
  });

  return (
    <div className="space-y-6">
      <TeamFormationRules compact={true} />

      {/* Category Filter Bar for Mentors */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card/40 p-3 rounded-2xl border border-border/40">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Category:</span>
          {[
            { id: "All", label: "All Teams" },
            { id: "Pairs", label: "👥 Pairs" },
            { id: "Solo", label: "👤 Solo" },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoryFilter(cat.id)}
              className={cn(
                "px-3 py-1.5 text-xs font-extrabold rounded-xl transition-all cursor-pointer",
                categoryFilter === cat.id
                  ? "bg-[#c9a227] text-black shadow-md scale-[1.02]"
                  : "text-muted-foreground hover:text-white hover:bg-muted/20"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-3">
          <span className="text-xs text-muted-foreground font-semibold">
            <span className="text-white font-bold">{displayTeams.length}</span> team{displayTeams.length !== 1 ? "s" : ""}
          </span>
          {setShowCreateTeamModal && (
            <button
              type="button"
              onClick={() => setShowCreateTeamModal(true)}
              className="bg-[#c9a227] text-black font-bold text-xs px-3.5 py-1.5 rounded-xl hover:bg-[#e8c058] transition shadow cursor-pointer"
            >
              + Create Team
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {displayTeams.length === 0 && (
        <div className="col-span-full py-12 text-center text-sm text-muted-foreground">
          No teams match your category filter ({categoryFilter}).
        </div>
      )}
      {displayTeams.map((t) => {
        const isFocused = t.team.id === focusedTeamId;
        const category = t.team.category || (t.members.length === 1 ? "Solo" : "Pairs");
        const stats = computeStats(t.members, category);
        return (
          <div
            key={t.team.id}
            id={`team-card-${t.team.id}`}
            onClick={() => setSelectedTeamOverlay(t)}
            className={cn(
              "rounded-3xl border p-5 flex flex-col justify-between transition-all duration-300 relative bg-card/20 cursor-pointer hover:border-[#c9a227]/70 hover:shadow-lg hover:shadow-[#c9a227]/5 group",
              isFocused
                ? "border-[#c9a227] shadow-[0_0_20px_rgba(201,162,39,0.15)] ring-1 ring-[#c9a227]"
                : "border-border/40"
            )}
          >
            {isFocused && (
              <span className="absolute -top-2.5 left-6 bg-[#c9a227] text-black text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full shadow select-none">
                Currently Selected
              </span>
            )}

            <div>
              <div className="flex justify-between items-start gap-2">
                <div>
                  <h3 className="text-base font-extrabold text-foreground leading-tight group-hover:text-[#c9a227] transition-colors">
                    {t.team.team_code ?? "SIH2K26#—"}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-muted-foreground font-medium truncate">{t.team.name}</p>
                    <span className={cn(
                      "text-[10px] font-extrabold px-2 py-0.5 rounded-full border shrink-0",
                      category === "Solo"
                        ? "bg-indigo-500/15 border-indigo-500/40 text-indigo-300"
                        : "bg-[#c9a227]/15 border-[#c9a227]/40 text-[#e8c058]"
                    )}>
                      {category === "Solo" ? "👤 Solo" : "👥 Pairs"}
                    </span>
                  </div>
                </div>
                {t.team.approved ? (
                  <GlowingBadge variant="success" pulse={false}>Approved</GlowingBadge>
                ) : (
                  <GlowingBadge variant="warning" pulse={false}>Pending Review</GlowingBadge>
                )}
              </div>

              <p className="text-xs text-[#dba328] font-bold mt-2">
                Problem: {t.team.problem_id ? problemMap.get(t.team.problem_id) : "General Idea"}
              </p>

              <div className="mt-4 border-t border-border/20 pt-4 space-y-2">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <span>Members ({t.members.length}/{stats.targetCount})</span>
                  <span className="text-[#c9a227] group-hover:underline">Click card to manage ↗</span>
                </div>
                {t.members.length === 0 ? (
                  <div className="py-4 px-3 rounded-xl border border-dashed border-border/40 text-center bg-muted/5 my-2">
                    <p className="text-xs text-muted-foreground font-medium mb-2">No members added yet</p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onAddMemberClick) onAddMemberClick(t.team.id);
                      }}
                      className="bg-[#c9a227] text-black text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-[#e8c058] transition shadow cursor-pointer"
                    >
                      + Add Member from Roster
                    </button>
                  </div>
                ) : (
                  <ul className="space-y-1.5">
                    {t.members.map((m) => (
                      <li
                        key={m.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetailStudent(m);
                        }}
                        className="flex items-center justify-between text-xs hover:bg-muted/15 p-1.5 rounded-lg cursor-pointer group/item transition-colors"
                      >
                        <span className="text-muted-foreground font-medium group-hover/item:text-[#c9a227] transition-colors">{m.name}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] text-muted-foreground font-semibold bg-muted/20 px-1.5 py-0.5 rounded">{m.department}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeMember(t.team.id, m.id, m.name);
                            }}
                            className="text-xs font-bold px-2.5 py-1 rounded-lg bg-red-500/15 border border-red-500/40 text-red-400 hover:bg-red-500 hover:text-white transition-colors cursor-pointer"
                            title="Remove member"
                          >
                            Delete
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {t.members.length < stats.targetCount && t.members.length > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onAddMemberClick) onAddMemberClick(t.team.id);
                    }}
                    className="w-full text-center mt-2.5 py-1.5 bg-[#c9a227]/10 hover:bg-[#c9a227]/20 border border-[#c9a227]/30 text-[#e8c058] text-[11px] font-bold rounded-lg transition cursor-pointer"
                  >
                    + Add 2nd Member from Roster
                  </button>
                )}
              </div>
            </div>

            <div className="mt-5 border-t border-border/10 pt-4 flex flex-col gap-2">
              {/* Constraint Warning Box */}
              {!stats.valid && stats.reason && (
                <div className="text-[10px] text-danger bg-danger/5 border border-danger/20 px-2.5 py-1.5 rounded-lg font-medium leading-normal">
                  ⚠️ {stats.reason}
                </div>
              )}
              {/* Delete Team Action (Only allowed when team is empty) */}
              {t.members.length === 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteTeam(t.team.id, t.team.name, t.members.length);
                  }}
                  className="w-full text-danger border-danger/35 hover:bg-danger hover:text-white hover:border-danger text-xs font-semibold py-1.5 rounded-xl mt-1"
                >
                  Delete Empty Team
                </Button>
              ) : (
                <div className="flex items-center justify-center gap-1.5 py-1.5 text-[11px] text-muted-foreground bg-muted/10 rounded-xl border border-border/20">
                  <span>🔒</span>
                  <span>Remove all members to enable team deletion</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
      </div>

      {/* Large Team Details Overlay */}
      <TeamDetailsModal
        teamData={activeOverlayData}
        onClose={() => setSelectedTeamOverlay(null)}
        problemMap={problemMap}
        removeMember={removeMember}
        deleteTeam={deleteTeam}
        onViewProfile={(st) => setDetailStudent(st)}
        assignMemberSkill={assignMemberSkill}
        assignTeamMinistry={assignTeamMinistry}
      />

      {/* Student Full Detail Profile Modal */}
      <StudentDetailModal
        student={detailStudent}
        onClose={() => setDetailStudent(null)}
        isAssigned={true}
      />
    </div>
  );
}
