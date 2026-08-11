import { useState } from "react";
import { Button } from "@/components/unlumen-ui/button";

interface CreateTeamModalProps {
  showCreateTeamModal: boolean;
  setShowCreateTeamModal: (show: boolean) => void;
  teamsCount: number;
  busyAssign: boolean;
  handleCreateTeamDirectSubmit: (e: React.FormEvent) => void;
}

export function CreateTeamModal({
  showCreateTeamModal,
  setShowCreateTeamModal,
  teamsCount,
  busyAssign,
  handleCreateTeamDirectSubmit,
}: CreateTeamModalProps) {
  const [hasReadInstructions, setHasReadInstructions] = useState(false);

  if (!showCreateTeamModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-border/80 bg-[#0a0f18] p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between border-b border-border/10 pb-4 mb-4">
          <div>
            <h3 className="text-base font-extrabold text-white">
              Create Team SIH2K26#{String(teamsCount + 1).padStart(3, "0")}
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">Start a new empty hackathon team</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowCreateTeamModal(false);
              setHasReadInstructions(false);
            }}
            className="text-muted-foreground hover:text-white font-extrabold text-xl p-1"
          >
            ×
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreateTeamDirectSubmit(e);
            setHasReadInstructions(false);
          }}
          className="space-y-4"
        >
          <div className="rounded-2xl border border-[#c9a227]/25 bg-[#c9a227]/5 p-4 space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#c9a227]">Team Creation Instructions</h4>
            <ul className="text-xs text-muted-foreground space-y-2 leading-relaxed">
              <li className="flex items-start gap-1.5">
                <span className="text-[#c9a227] mt-0.5">•</span>
                <span>
                  This team will be created under the code <strong>SIH2K26#{String(teamsCount + 1).padStart(3, "0")}</strong>.
                </span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#c9a227] mt-0.5">•</span>
                <span><strong>Maximum 6 members</strong> limit per team.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#c9a227] mt-0.5">•</span>
                <span><strong>Minimum 2 female members</strong> are required to meet diversity rules.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#c9a227] mt-0.5">•</span>
                <span>
                  <strong>Minimum 2 inter-departments</strong> are required (members must represent at least 2 distinct departments).
                </span>
              </li>
            </ul>
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
              onClick={() => {
                setShowCreateTeamModal(false);
                setHasReadInstructions(false);
              }}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={busyAssign}
              disabled={!hasReadInstructions}
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
