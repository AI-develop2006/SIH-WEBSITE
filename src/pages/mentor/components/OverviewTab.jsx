import { memo } from "react";
import { Card } from "@/components/unlumen-ui/card";
import { TeamFormationRules } from "./TeamFormationRules";
import { X, TrendingUp } from "lucide-react";

/**
 * SeatCapacityAlerts
 *
 * Shown on the Overview tab when the admin has raised seat caps for this
 * mentor's department in one or more ministries. Each alert card shows:
 *   - Ministry name
 *   - New cap vs previous cap
 *   - Current usage (how many already assigned)
 *   - Remaining slots available
 * Dismissible per-ministry.
 */
function SeatCapacityAlerts({ seatAlerts, mentorDept, onDismissAlert }) {
  if (!seatAlerts || seatAlerts.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <TrendingUp className="size-4 text-emerald-400 shrink-0" />
        <h3 className="text-sm font-extrabold text-emerald-300">
          Seat Capacity Increased — Action Required
        </h3>
        <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
          {seatAlerts.length} ministr{seatAlerts.length !== 1 ? "ies" : "y"}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {seatAlerts.map(({ ministry, cap, usage, prevCap }) => {
          const remaining = cap - usage;
          const pctUsed = cap > 0 ? Math.round((usage / cap) * 100) : 0;

          return (
            <div
              key={ministry}
              className="relative rounded-2xl border border-emerald-500/35 bg-emerald-500/8 p-4 space-y-3"
            >
              {/* Dismiss */}
              <button
                type="button"
                onClick={() => onDismissAlert(ministry)}
                className="absolute top-3 right-3 text-[#94a3b8]/60 hover:text-white transition-colors"
                aria-label="Dismiss"
              >
                <X className="size-3.5" />
              </button>

              {/* Ministry name */}
              <p className="text-xs font-extrabold text-white pr-6 leading-snug">{ministry}</p>

              {/* Dept tag */}
              <span className="inline-block text-[9px] font-bold px-2 py-0.5 rounded-full border border-[rgba(147,197,253,0.2)] bg-[rgba(147,197,253,0.06)] text-[#94a3b8]">
                {mentorDept}
              </span>

              {/* Cap change banner */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-500/15 border border-slate-500/25 text-slate-300 line-through">
                  {prevCap} seats
                </span>
                <span className="text-emerald-400 font-bold text-xs">→</span>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                  {cap} seats
                </span>
              </div>

              {/* Usage bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-[#94a3b8]">{usage} assigned · {remaining} available</span>
                  <span className={remaining > 0 ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                    {remaining > 0 ? `+${remaining} open` : "Full"}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-[rgba(147,197,253,0.08)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500 bg-emerald-500"
                    style={{ width: `${pctUsed}%` }}
                  />
                </div>
              </div>

              {remaining > 0 && (
                <p className="text-[10px] text-emerald-300/80 leading-relaxed">
                  You can now add <strong className="text-emerald-300">{remaining} more student{remaining !== 1 ? "s" : ""}</strong> to teams under this ministry.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const OverviewTab = memo(function OverviewTab({
  profiles,
  teams,
  unassignedCount,
  handleTeamCardClick,
  setShowCreateTeamModal,
  seatAlerts = [],
  mentorDept = "",
  onDismissAlert,
}) {
  return (
    <div className="space-y-8">
      {/* Seat Capacity Alerts — only visible when admin raised caps for this dept */}
      {seatAlerts.length > 0 && (
        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-5">
          <SeatCapacityAlerts
            seatAlerts={seatAlerts}
            mentorDept={mentorDept}
            onDismissAlert={onDismissAlert}
          />
        </div>
      )}

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
})
