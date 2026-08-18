import { Card } from "@/components/unlumen-ui/card";
import { GlowingBadge } from "@/components/unlumen-ui/glowing-badge";
import { cn } from "@/lib/utils";
import { TeamFormationRules } from "./TeamFormationRules";

export function OverviewTab({
  profiles,
  teams,
  unassignedCount,
  handleTeamCardClick,
  setShowCreateTeamModal,
}) {
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

      {/* Official Team Formation & Ministry Rules */}
      <TeamFormationRules />

      {/* Quick Action Header for Teams Builder */}
      <Card className="p-6 border border-border/40 bg-card/40 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-extrabold text-white">Manage & Build Teams</h3>
          <p className="text-xs text-muted-foreground mt-1">
            All hackathon teams created by mentors are managed exclusively inside the <strong className="text-[#c9a227]">Teams Builder</strong> tab.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateTeamModal(true)}
          className="bg-[#c9a227] text-black font-bold text-xs px-5 py-2.5 rounded-xl hover:bg-[#e8c058] transition shrink-0 cursor-pointer shadow-lg shadow-[#c9a227]/10"
        >
          + Create New Team
        </button>
      </Card>
    </div>
  );
}
