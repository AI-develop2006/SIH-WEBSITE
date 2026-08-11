import { Button } from "@/components/unlumen-ui/button";
import { Select } from "@/components/unlumen-ui/input";
import type { EnrichedTeam, Profile } from "@/lib/types";

interface AssignStudentModalProps {
  showAddModal: boolean;
  setShowAddModal: (show: boolean) => void;
  selectedStudent: Profile | null;
  setSelectedStudent: (student: Profile | null) => void;
  teams: EnrichedTeam[];
  selectedTeamId: string;
  setSelectedTeamId: (id: string) => void;
  busyAssign: boolean;
  handleAssignSubmit: (e: React.FormEvent) => void;
  setTab: (tab: "home" | "students" | "teams" | "problems") => void;
}

export function AssignStudentModal({
  showAddModal,
  setShowAddModal,
  selectedStudent,
  setSelectedStudent,
  teams,
  selectedTeamId,
  setSelectedTeamId,
  busyAssign,
  handleAssignSubmit,
  setTab,
}: AssignStudentModalProps) {
  if (!showAddModal || !selectedStudent) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-border/50 bg-[#0a0f18] p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-bold text-white leading-tight">Assign {selectedStudent.name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Register No: {selectedStudent.register_no}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowAddModal(false);
              setSelectedStudent(null);
            }}
            className="text-muted-foreground hover:text-white font-extrabold text-lg"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleAssignSubmit} className="space-y-4">
          {teams.length > 0 ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Select Team</label>
                <Select
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  required
                >
                  <option value="">-- Choose an existing team --</option>
                  {teams.map((t) => (
                    <option key={t.team.id} value={t.team.id}>
                      {t.team.team_code ?? "SIH2K26#—"} - {t.team.name} ({t.members.length}/6 members)
                    </option>
                  ))}
                </Select>
              </div>
              <p className="text-[10px] text-muted-foreground bg-muted/10 border border-border/20 p-2.5 rounded-lg leading-normal">
                💡 If this team has no members yet, assigning this student will automatically promote them to the **Team Leader**.
              </p>
            </div>
          ) : (
            <div className="text-center py-6 space-y-3">
              <p className="text-xs text-muted-foreground leading-normal">
                No teams have been created yet. You need to create an empty team from the **Home Overview** tab first.
              </p>
              <Button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  setSelectedStudent(null);
                  setTab("home");
                }}
                className="bg-[#c9a227] text-black font-bold text-xs hover:bg-[#e8c058] px-3 py-1.5 border-0 rounded-lg"
              >
                Go to Home tab
              </Button>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-border/10 pt-4 mt-6">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setShowAddModal(false);
                setSelectedStudent(null);
                setSelectedTeamId("");
              }}
              className="text-xs"
            >
              Cancel
            </Button>
            {teams.length > 0 && (
              <Button type="submit" loading={busyAssign} className="bg-[#c9a227] text-black font-bold text-xs hover:bg-[#e8c058]">
                Assign Student
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
