import { Card } from "@/components/unlumen-ui/card";
import { GlowingBadge } from "@/components/unlumen-ui/glowing-badge";
import { cn } from "@/lib/utils";
import type { EnrichedTeam, Profile } from "@/lib/types";

interface OverviewTabProps {
  profiles: Profile[];
  teams: EnrichedTeam[];
  unassignedCount: number;
  handleTeamCardClick: (teamId: string) => void;
  setShowCreateTeamModal: (show: boolean) => void;
}

export function OverviewTab({
  profiles,
  teams,
  unassignedCount,
  handleTeamCardClick,
  setShowCreateTeamModal,
}: OverviewTabProps) {
  return (
    <div className="space-y-8">
      {/* Stats Section */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5 border border-border/40 bg-card/40 flex flex-col justify-center">
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider font-bold">Total Registered Students</p>
          <h2 className="text-3xl font-extrabold text-white mt-1">
            {profiles.filter((p) => p.role === "student").length}
          </h2>
        </Card>
        <Card className="p-5 border border-border/40 bg-card/40 flex flex-col justify-center">
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider font-bold">Formed Hackathon Teams</p>
          <h2 className="text-3xl font-extrabold text-[#c9a227] mt-1">{teams.length}</h2>
        </Card>
        <Card className="p-5 border border-border/40 bg-card/40 flex flex-col justify-center">
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider font-bold">Unassigned Students</p>
          <h2 className="text-3xl font-extrabold text-danger mt-1">{unassignedCount}</h2>
        </Card>
      </div>

      {/* Teams Grid */}
      <div>
        <h3 className="text-lg font-bold mb-4 tracking-tight">Teams Created</h3>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Plus card */}
          <div
            onClick={() => setShowCreateTeamModal(true)}
            className="flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-border/50 bg-card/10 p-5 text-center transition-all duration-300 hover:border-[#c9a227] hover:bg-[#c9a227]/5 group"
          >
            <div className="flex size-12 items-center justify-center rounded-full bg-muted/20 text-[#c9a227] transition-all group-hover:scale-110">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="size-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <h4 className="mt-4 text-sm font-bold text-foreground">Create a Team</h4>
            <p className="mt-1 text-xs text-muted-foreground">Start a new empty team and assign students</p>
          </div>

          {/* Team Mockup Cards */}
          {teams.map((t) => {
            const girlsCount = t.stats.girlCount;
            const deptsCount = t.stats.deptCount;
            const totalMembers = t.members.length;
            const availSlots = Math.max(0, 6 - totalMembers);
            const createdDate = new Date(t.team.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <div
                key={t.team.id}
                onClick={() => handleTeamCardClick(t.team.id)}
                className="flex min-h-[220px] cursor-pointer flex-col justify-between rounded-3xl border border-border/40 bg-[#0c121e] p-6 transition-all duration-300 hover:border-[#c9a227]/80 hover:bg-[#121b2d] hover:shadow-xl"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-base font-extrabold tracking-tight text-white">
                      {t.team.team_code ?? "SIH2K26#—"}
                    </h4>
                    {t.team.approved ? (
                      <GlowingBadge variant="success" pulse={false}>Approved</GlowingBadge>
                    ) : (
                      <GlowingBadge variant="warning" pulse={false}>Pending</GlowingBadge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-semibold mt-0.5 truncate">{t.team.name}</p>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">student count</span>
                      <span className="font-semibold text-white mt-0.5">{totalMembers}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">student availability</span>
                      <span className="font-semibold text-[#c9a227] mt-0.5">{availSlots}</span>
                    </div>
                  </div>

                  {/* Checklist constraints status */}
                  <div className="mt-4 space-y-1.5 border-t border-border/10 pt-3">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Constraints</p>
                    
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className={cn("size-3.5 flex items-center justify-center rounded-sm text-[8px]", girlsCount >= 2 ? "bg-success/20 text-success" : "bg-danger/20 text-danger")}>
                        {girlsCount >= 2 ? "✓" : "✗"}
                      </span>
                      <span className={girlsCount >= 2 ? "text-muted-foreground" : "text-danger font-medium"}>Min of two girls ({girlsCount})</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className={cn("size-3.5 flex items-center justify-center rounded-sm text-[8px]", deptsCount >= 2 ? "bg-success/20 text-success" : "bg-danger/20 text-danger")}>
                        {deptsCount >= 2 ? "✓" : "✗"}
                      </span>
                      <span className={deptsCount >= 2 ? "text-muted-foreground" : "text-danger font-medium"}>Min of two inter departments ({deptsCount})</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className={cn("size-3.5 flex items-center justify-center rounded-sm text-[8px]", totalMembers <= 6 ? "bg-success/20 text-success" : "bg-danger/20 text-danger")}>
                        {totalMembers <= 6 ? "✓" : "✗"}
                      </span>
                      <span className="text-muted-foreground">Maximum 6 members limit</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex justify-end text-[10px] text-muted-foreground italic font-medium">
                  {createdDate}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
