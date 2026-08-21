import { Button } from "@/components/unlumen-ui/button";
import { Select } from "@/components/unlumen-ui/input";
import { isSameDepartment } from "@/lib/utils";

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
  mentorDept,
}) {
  if (!showAddModal || !selectedStudent) return null;

  // Check if the selected student's department matches the mentor's department
  const deptMismatch =
    mentorDept &&
    selectedStudent.department &&
    !isSameDepartment(selectedStudent.department, mentorDept);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-border/50 bg-[#0a0f18] p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-bold text-white leading-tight">Assign {selectedStudent.name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Register No: {selectedStudent.register_no || "—"}
              {selectedStudent.department && (
                <span className="ml-2 font-semibold text-[#c9a227]">· {selectedStudent.department}</span>
              )}
            </p>
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

        {/* Department mismatch hard block */}
        {deptMismatch ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-red-400 text-base">🚫</span>
                <p className="text-sm font-bold text-red-300">Department Mismatch</p>
              </div>
              <p className="text-xs text-red-200/80 leading-relaxed">
                You can only assign students from your department{" "}
                <span className="font-extrabold text-[#c9a227]">({mentorDept})</span>.
                This student belongs to{" "}
                <span className="font-extrabold text-red-300">{selectedStudent.department}</span>.
              </p>
            </div>
            <div className="flex justify-end border-t border-border/10 pt-4">
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
                Close
              </Button>
            </div>
          </div>
        ) : (
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
                    <option value="">-- Select Team / Solo Entry --</option>
                    {teams.map((t) => {
                      const cat = t.team.category || (t.members.length === 1 ? "Solo" : "Pairs");
                      const isSolo = cat === "Solo";
                      const maxLimit = isSolo ? 1 : 2;
                      const isFull = t.members.length >= maxLimit;
                      return (
                        <option key={t.team.id} value={t.team.id} disabled={isFull}>
                          {isSolo ? "Solo: " : "Pairs: "}
                          {t.team.team_code ? `${t.team.team_code} - ` : ""}
                          {t.team.name} ({t.members.length}/{maxLimit} members) {isFull ? "— FULL" : ""}
                        </option>
                      );
                    })}
                  </Select>
                </div>
                <p className="text-[10px] text-muted-foreground bg-muted/10 border border-border/20 p-2.5 rounded-lg leading-normal">
                  Assigning this student will add them to the selected team/entry. If empty, they will be set as the lead member.
                </p>
              </div>
            ) : (
              <div className="text-center py-6 space-y-3">
                <p className="text-xs text-muted-foreground leading-normal">
                  No teams or solo entries have been created yet. Go to <strong>Teams Builder</strong> to create one first.
                </p>
                <Button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setSelectedStudent(null);
                    setTab("teams");
                  }}
                  className="bg-[#c9a227] text-black font-bold text-xs hover:bg-[#e8c058] px-3 py-1.5 border-0 rounded-lg"
                >
                  Go to Teams Builder
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
        )}
      </div>
    </div>
  );
}
