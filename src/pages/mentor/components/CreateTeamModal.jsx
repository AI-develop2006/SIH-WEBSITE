import { useState, useEffect } from "react";
import { Users, User } from "lucide-react";
import { Button } from "@/components/unlumen-ui/button";
import { Input } from "@/components/unlumen-ui/input";
import { cn } from "@/lib/utils";

export function CreateTeamModal({
  showCreateTeamModal,
  setShowCreateTeamModal,
  teamsCount,
  busyAssign,
  deptCode,
  deptTeamCount,
  handleCreateTeamDirectSubmit,
}) {
  const [teamName, setTeamName] = useState("");
  const [teamCategory, setTeamCategory] = useState("Pairs");
  const [hasReadInstructions, setHasReadInstructions] = useState(false);

  useEffect(() => {
    if (showCreateTeamModal) {
      setTeamName(""); // always clear — mentor must type a name
      setHasReadInstructions(false);
      setTeamCategory("Pairs");
    }
  }, [showCreateTeamModal]);

  if (!showCreateTeamModal) return null;

  // Preview the auto-generated team ID based on dept
  const prefix = teamCategory === "Solo"
    ? `${deptCode || "TEAM"}-SOLO#`
    : `${deptCode || "TEAM"}#`;
  const nextNum = String((deptTeamCount || 0) + 1).padStart(3, "0");
  const previewId = `${prefix}${nextNum}`;

  const canSubmit = teamName.trim().length > 0 && hasReadInstructions;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-border/80 bg-[#0a0f18] p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between border-b border-border/10 pb-4 mb-4">
          <div>
            <h3 className="text-base font-extrabold text-white">Create New Team / Entry</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">
              Specify any team or entry name, choose category, and initialize
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateTeamModal(false)}
            className="text-muted-foreground hover:text-white font-extrabold text-xl p-1"
          >
            ×
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreateTeamDirectSubmit(teamName, teamCategory);
          }}
          className="space-y-4"
        >
          {/* Team Category Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[#c9a227]">
              Team Category
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTeamCategory("Pairs")}
                className={cn(
                  "flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer",
                  teamCategory === "Pairs"
                    ? "bg-[#c9a227] text-black border-[#c9a227] shadow"
                    : "bg-card/40 border-border/40 text-muted-foreground hover:text-white"
                )}
              >
                <Users className="size-3.5 shrink-0" /> Pairs Team (2 Members)
              </button>
              <button
                type="button"
                onClick={() => setTeamCategory("Solo")}
                className={cn(
                  "flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer",
                  teamCategory === "Solo"
                    ? "bg-indigo-600 text-white border-indigo-500 shadow"
                    : "bg-card/40 border-border/40 text-muted-foreground hover:text-white"
                )}
              >
                <User className="size-3.5 shrink-0" /> Solo Entry
              </button>
            </div>
          </div>

          {/* Team / Entry Name Input Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[#c9a227]">
              {teamCategory === "Solo" ? "Solo Entry Name / Title" : "Team Name"} <span className="text-red-400">*</span>
            </label>
            <Input
              type="text"
              placeholder={teamCategory === "Solo" ? "e.g. Participant Name / Project Title / Custom Name" : "e.g. Tech Titans / SIH2K26#001"}
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              required
              className="bg-card/60 border-border/50 text-white focus:border-[#c9a227]"
            />
            <p className="text-[11px] text-muted-foreground">
              {teamCategory === "Solo"
                ? "Enter any custom name, project title, or participant name for this solo entry."
                : "Enter any team name or custom identifier for this 2-member pair."}
            </p>
          </div>

          <div className="rounded-2xl border border-[#c9a227]/30 bg-[#c9a227]/5 p-4 space-y-3 max-h-[260px] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#c9a227]/20 pb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#c9a227]">
                Team Formation & Ministry Rules
              </h4>
              <span className="text-[10px] font-extrabold text-[#e8c058] bg-[#c9a227]/20 px-2 py-0.5 rounded-full">
                37 Ministries
              </span>
            </div>
            <ol className="text-xs text-muted-foreground space-y-2.5 leading-relaxed list-decimal list-inside font-medium">
              {teamCategory === "Solo" ? (
                <>
                  <li>
                    <strong className="text-white">Team Size:</strong> Solo Entry consists of exactly 1 member.
                  </li>
                  <li>
                    <strong className="text-white">Full Coverage:</strong> Every department should choose the problem statements from the given ministries.
                  </li>
                  <li>
                    <strong className="text-white">Final Selection:</strong> Final entry of 1 member is decided exclusively by SPOC and mentors.
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <strong className="text-white">Team Size:</strong> Each team must consist of exactly 2 members.
                  </li>
                  <li>
                    <strong className="text-white">Full Coverage:</strong> Every department should choose the problem statements from the given ministries.
                  </li>
                  <li>
                    <strong className="text-white">Department Constraint:</strong> Both members in a 2-member team must be from the exact same department.
                  </li>
                  <li>
                    <strong className="text-white">Skill & Domain Diversity:</strong> Members in the 2-member team must not have the same skillset or domain of interest.
                  </li>
                  <li>
                    <strong className="text-white">Final Selection:</strong> Final team of 2 members is decided exclusively by SPOC and mentors.
                  </li>
                </>
              )}
            </ol>
          </div>

          <div className="flex items-start gap-2.5 pt-2 select-none">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground hover:text-white">
              <input
                type="checkbox"
                checked={hasReadInstructions}
                onChange={(e) => setHasReadInstructions(e.target.checked)}
                className="rounded border-border text-[#c9a227] focus:ring-[#c9a227]"
                required
              />
              <span>I have read and understood the team creation rules and constraints.</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 border-t border-border/10 pt-4 mt-6">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowCreateTeamModal(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={busyAssign}
              disabled={!canSubmit}
              className="bg-[#c9a227] text-black font-bold text-xs hover:bg-[#e8c058] disabled:opacity-50"
            >
              Create New Team
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
