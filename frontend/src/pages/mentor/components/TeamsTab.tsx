import { Button } from "@/components/unlumen-ui/button";
import { GlowingBadge } from "@/components/unlumen-ui/glowing-badge";
import { cn } from "@/lib/utils";
import type { EnrichedTeam } from "@/lib/types";

interface TeamsTabProps {
  teams: EnrichedTeam[];
  focusedTeamId: string | null;
  problemMap: Map<string, string>;
  removeMember: (teamId: string, memberId: string, memberName: string) => void;
  deleteTeam: (teamId: string, teamName: string) => void;
}

export function TeamsTab({
  teams,
  focusedTeamId,
  problemMap,
  removeMember,
  deleteTeam,
}: TeamsTabProps) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {teams.length === 0 && (
        <div className="col-span-full py-12 text-center text-sm text-muted-foreground">
          No hackathon teams have been registered yet.
        </div>
      )}
      {teams.map((t) => {
        const isFocused = t.team.id === focusedTeamId;
        return (
          <div
            key={t.team.id}
            id={`team-card-${t.team.id}`}
            className={cn(
              "rounded-3xl border p-5 flex flex-col justify-between transition-all duration-300 relative bg-card/20",
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
                  <h3 className="text-base font-extrabold text-foreground leading-tight">
                    {t.team.team_code ?? "SIH2K26#—"}
                  </h3>
                  <p className="text-xs text-muted-foreground font-medium mt-0.5 truncate">{t.team.name}</p>
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
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Members ({t.members.length}/6)</p>
                <ul className="space-y-1.5">
                  {t.members.map((m) => (
                    <li key={m.id} className="flex items-center justify-between text-xs hover:bg-muted/5 p-1.5 rounded-lg">
                      <span className="text-muted-foreground font-medium">{m.name}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] text-muted-foreground font-semibold bg-muted/20 px-1.5 py-0.5 rounded">{m.department}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeMember(t.team.id, m.id, m.name);
                          }}
                          className="text-danger hover:text-white font-extrabold text-sm px-1.5"
                          title="Remove member"
                        >
                          ×
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-5 border-t border-border/10 pt-4 flex flex-col gap-2">
              {/* Constraint Warning Box */}
              {!t.stats.valid && t.stats.reason && (
                <div className="text-[10px] text-danger bg-danger/5 border border-danger/20 px-2.5 py-1.5 rounded-lg font-medium leading-normal">
                  ⚠️ {t.stats.reason}
                </div>
              )}
              {/* Delete Team Button */}
              <Button
                type="button"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteTeam(t.team.id, t.team.name);
                }}
                className="w-full text-danger border-danger/35 hover:bg-danger hover:text-white hover:border-danger text-xs font-semibold py-1.5 rounded-xl mt-1"
              >
                Delete Team
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
