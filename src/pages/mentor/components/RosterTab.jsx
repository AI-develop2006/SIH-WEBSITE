import { useState, useMemo } from "react";
import { SlidersHorizontal, Users, User } from "lucide-react";
import { Button } from "@/components/unlumen-ui/button";
import { Card } from "@/components/unlumen-ui/card";
import { Input, Select } from "@/components/unlumen-ui/input";
import { Avatar } from "@/components/unlumen-ui/avatar";
import { cn } from "@/lib/utils";
import { DEPARTMENTS } from "@/lib/constants";
import { StudentDetailModal } from "./StudentDetailModal";

const POPULAR_DOMAINS = [
  "AI / Machine Learning",
  "Frontend Development",
  "Backend Development",
  "Full Stack Development",
  "Mobile App Development",
  "UI/UX designer",
  "Cybersecurity / Blockchain",
  "IoT & Sensors",
  "Cloud Computing",
  "Smart Automation & Industrial Control",
  "Circuit Design & PCB Layout",
  "Edge AI & Hardware AI",
  "Robotics & Drones",
  "Embedded Systems",
];

export function RosterTab({
  students,
  studentsInTeams,
  teams,
  q,
  setQ,
  availabilityFilter,
  setAvailabilityFilter,
  dept,
  setDept,
  gender,
  setGender,
  projType,
  setProjType,
  yearFilter,
  setYearFilter,
  sectionFilter,
  setSectionFilter,
  selectedDomains,
  setSelectedDomains,
  showFilterDrawer,
  setShowFilterDrawer,
  setSelectedStudent,
  setShowAddModal,
  toast,
}) {
  const [detailStudent, setDetailStudent] = useState(null);

  const studentTeamMap = useMemo(() => {
    const map = new Map();
    (teams || []).forEach((t) => {
      if (t.team.leader_id) map.set(t.team.leader_id, t);
      (t.members || []).forEach((m) => map.set(m.id, t));
    });
    return map;
  }, [teams]);

  const toggleDomainSelection = (d) => {
    if (selectedDomains.includes(d)) {
      setSelectedDomains(selectedDomains.filter((item) => item !== d));
    } else {
      setSelectedDomains([...selectedDomains, d]);
    }
  };

  const activeFiltersCount =
    selectedDomains.length +
    (dept ? 1 : 0) +
    (gender ? 1 : 0) +
    (projType ? 1 : 0) +
    (yearFilter ? 1 : 0) +
    (sectionFilter ? 1 : 0) +
    (availabilityFilter !== "all" ? 1 : 0);

  return (
    <div className="flex gap-6 items-start">
      {/* Left Sidebar Filter Card (Desktop only, pushes layout) */}
      {showFilterDrawer && (
        <Card className="w-[300px] shrink-0 p-5 border border-border/40 bg-card/60 backdrop-blur-md hidden lg:flex flex-col gap-5 animate-in slide-in-from-left duration-300">
          <div className="flex items-center justify-between border-b border-border/10 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white">Filter Options</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">Updates list in real time</p>
            </div>
            <button
              type="button"
              onClick={() => setShowFilterDrawer(false)}
              className="text-muted-foreground hover:text-white font-extrabold text-sm p-1"
            >
              ✕
            </button>
          </div>

          {/* Form Filter Inputs */}
          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Availability</label>
              <Select value={availabilityFilter} onChange={(e) => setAvailabilityFilter(e.target.value)}>
                <option value="all">All Availability</option>
                <option value="available">Available (Yes)</option>
                <option value="assigned">Assigned (No)</option>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Department</label>
              <Select value={dept} onChange={(e) => setDept(e.target.value)}>
                <option value="">All Departments</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Gender</label>
              <Select value={gender} onChange={(e) => setGender(e.target.value)}>
                <option value="">All Genders</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Project Type</label>
              <Select value={projType} onChange={(e) => setProjType(e.target.value)}>
                <option value="">All Project Types</option>
                <option value="Software">Software</option>
                <option value="Hardware">Hardware</option>
                <option value="Hardware & Software">Both</option>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Year</label>
              <Select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
                <option value="">All Years</option>
                <option value="I">Year I</option>
                <option value="II">Year II</option>
                <option value="III">Year III</option>
                <option value="IV">Year IV</option>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Section</label>
              <Select value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)}>
                <option value="">All Sections</option>
                {["A", "B", "C", "D", "E", "F", "G"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            </div>

            {/* Domain Interests checklist */}
            <div className="flex flex-col gap-1.5 border-t border-border/10 pt-4 mt-2">
              <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Domain Interests</label>
              <div className="grid grid-cols-1 gap-2 max-h-[220px] overflow-y-auto pr-1">
                {POPULAR_DOMAINS.map((d) => {
                  const active = selectedDomains.includes(d);
                  return (
                    <label
                      key={d}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-xl border p-2 text-[10px] transition duration-200 select-none",
                        active
                          ? "border-[#c9a227] bg-[#c9a227]/5 text-white"
                          : "border-border/40 text-muted-foreground hover:bg-muted/5 hover:text-foreground"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggleDomainSelection(d)}
                        className="hidden"
                      />
                      <span className={cn("size-3.5 flex items-center justify-center rounded border text-[8px]", active ? "bg-[#c9a227] border-[#c9a227] text-black" : "border-border")}>
                        {active && "✓"}
                      </span>
                      <span className="truncate">{d}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sidebar Footer */}
          <div className="border-t border-border/10 pt-3 mt-1 flex justify-between items-center text-xs">
            <button
              type="button"
              onClick={() => {
                setAvailabilityFilter("all");
                setDept("");
                setGender("");
                setProjType("");
                setYearFilter("");
                setSectionFilter("");
                setSelectedDomains([]);
                toast("success", "Filters cleared!");
              }}
              className="text-danger hover:underline font-bold"
            >
              Clear All
            </button>
          </div>
        </Card>
      )}

      {/* Right Main Roster Area */}
      <div className="flex-grow min-w-0 space-y-6">

        {/* Search and Drawer Trigger row */}
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="primary"
            onClick={() => setShowFilterDrawer(!showFilterDrawer)}
            className="font-bold text-xs py-2.5 px-4 rounded-xl flex items-center gap-2 shrink-0 h-[42px] transition text-black"
          >
            <SlidersHorizontal className="size-4 text-black" strokeWidth={2} />
            Filter
            {activeFiltersCount > 0 && (
              <span className="bg-black text-[#c9a227] text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">
                {activeFiltersCount}
              </span>
            )}
          </Button>
          <div className="grow">
            <Input
              placeholder="Search students by name, register number, project..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        {/* Student Table */}
        <Card className="overflow-hidden p-0 border border-border/40 bg-card/40">
          {/* Mobile card list */}
          <div className="md:hidden divide-y divide-border/40">
            {students.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                No registrations match your search filters.
              </p>
            )}
            {students.map((s) => {
              const isAssigned = studentsInTeams.has(s.id);
              const assignedTeam = studentTeamMap.get(s.id);
              return (
                <div
                  key={s.id}
                  onClick={() => setDetailStudent(s)}
                  className="px-4 py-4 flex flex-col gap-3 cursor-pointer hover:bg-card/70 transition active:bg-card/80"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={s.name} className="size-10 text-xs shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm truncate text-foreground">{s.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{s.register_no ?? "—"}</p>
                      <p className="text-xs text-muted-foreground truncate">{s.department ?? "—"} · Yr {s.year ?? "—"}</p>
                    </div>
                    <div className="shrink-0">
                      {isAssigned ? (
                        <span className="rounded-lg bg-danger/10 border border-danger/30 text-danger px-2 py-0.5 text-[10px] font-bold">
                          Assigned
                        </span>
                      ) : (
                        <span className="rounded-lg bg-success/10 border border-success/30 text-success px-2 py-0.5 text-[10px] font-bold">
                          Available
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Team chip */}
                  {assignedTeam && (
                    <div>
                      {(assignedTeam.team.category || (assignedTeam.members.length === 1 ? "Solo" : "Pairs")) === "Solo" ? (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-500/15 border border-indigo-500/40 text-indigo-300 px-2 py-0.5 text-[10px] font-bold">
                          <User className="size-3 shrink-0" /> Solo: {assignedTeam.team.name}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-[#c9a227]/15 border border-[#c9a227]/40 text-[#e8c058] px-2 py-0.5 text-[10px] font-bold">
                          <Users className="size-3 shrink-0" /> {assignedTeam.team.name}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Domain chips */}
                  {s.domain_interests && s.domain_interests.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {s.domain_interests.slice(0, 2).map((d) => (
                        <span key={d} className="rounded bg-muted/40 border border-border px-1.5 py-0.5 text-[9px]">{d}</span>
                      ))}
                      {s.domain_interests.length > 2 && (
                        <span className="text-[9px] text-muted-foreground self-center">+{s.domain_interests.length - 2}</span>
                      )}
                    </div>
                  )}

                  {/* Add button */}
                  {!isAssigned && (
                    <Button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedStudent(s);
                        setShowAddModal(true);
                      }}
                      className="bg-[#c9a227] text-black font-bold text-xs hover:bg-[#e8c058] px-3 py-1.5 border-0 rounded-lg self-start"
                    >
                      + Add to Team
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border/80 bg-muted/40 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3.5">Student Name</th>
                  <th className="px-5 py-3.5">Category</th>
                  <th className="px-5 py-3.5">Year</th>
                  <th className="px-5 py-3.5">Department</th>
                  <th className="px-5 py-3.5">Gender</th>
                  <th className="px-5 py-3.5">Domain Interest</th>
                  <th className="px-5 py-3.5">Project</th>
                  <th className="px-5 py-3.5">Availability</th>
                </tr>
              </thead>
              <tbody>
                {students.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-sm text-muted-foreground">
                      No registrations match your search filters.
                    </td>
                  </tr>
                )}
                {students.map((s) => {
                  const isAssigned = studentsInTeams.has(s.id);
                  return (
                    <tr
                      key={s.id}
                      onClick={() => setDetailStudent(s)}
                      className="border-b border-border/40 last:border-0 hover:bg-card/70 transition cursor-pointer group"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={s.name} className="size-8 text-[10px]" />
                          <div className="leading-tight">
                            <p className="font-semibold text-foreground group-hover:text-[#c9a227] transition-colors">{s.name}</p>
                            <p className="text-xs text-muted-foreground">{s.email ?? "—"}</p>
                            <p className="text-xs text-muted-foreground font-mono">{s.register_no ?? "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {(() => {
                          const assignedTeam = studentTeamMap.get(s.id);
                          if (!assignedTeam) {
                            return <span className="text-xs text-muted-foreground font-mono">Unassigned</span>;
                          }
                          const cat = assignedTeam.team.category || (assignedTeam.members.length === 1 ? "Solo" : "Pairs");
                          if (cat === "Solo") {
                            return (
                              <span
                                className="rounded-lg bg-indigo-500/15 border border-indigo-500/40 text-indigo-300 px-2.5 py-1 text-xs font-bold truncate max-w-[150px] inline-block"
                                title={`Solo Entry: ${assignedTeam.team.name}`}
                              >
                                👤 Solo ({assignedTeam.team.name})
                              </span>
                            );
                          }
                          return (
                            <span
                              className="rounded-lg bg-[#c9a227]/15 border border-[#c9a227]/40 text-[#e8c058] px-2.5 py-1 text-xs font-bold truncate max-w-[150px] inline-block"
                              title={`Pairs Team: ${assignedTeam.team.name}`}
                            >
                              👥 {assignedTeam.team.name}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-5 py-4 text-muted-foreground font-medium">Yr {s.year ?? "—"}</td>
                      <td className="px-5 py-4 text-muted-foreground">{s.department ?? "—"}</td>
                      <td className="px-5 py-4 text-muted-foreground">{s.gender ?? "—"}</td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1 max-w-[180px]">
                          {s.domain_interests && s.domain_interests.length > 0 ? (
                            s.domain_interests.slice(0, 3).map((d) => (
                              <span key={d} className="rounded bg-muted/40 border border-border px-1.5 py-0.5 text-[9px] truncate">
                                {d}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                          {s.domain_interests && s.domain_interests.length > 3 && (
                            <span className="text-[9px] text-muted-foreground font-bold self-center">
                              +{s.domain_interests.length - 3} more
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">
                        <div className="leading-tight max-w-[200px]">
                          <p className="font-semibold text-xs text-foreground">{s.project_type ?? "—"}</p>
                          {s.project_title && (
                            <p className="text-[11px] truncate mt-0.5 text-muted-foreground" title={s.project_title}>
                              {s.project_title}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          {isAssigned ? (
                            <span className="rounded-lg bg-danger/10 border border-danger/30 text-danger px-2.5 py-1 text-xs font-bold select-none">
                              No
                            </span>
                          ) : (
                            <>
                              <span className="rounded-lg bg-success/10 border border-success/30 text-success px-2.5 py-1 text-xs font-bold select-none">
                                Yes
                              </span>
                              <Button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedStudent(s);
                                  setShowAddModal(true);
                                }}
                                className="bg-[#c9a227] text-black font-bold text-[11px] hover:bg-[#e8c058] px-2.5 py-1.5 border-0 rounded-lg"
                              >
                                Add
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Student Full Detail Modal */}
      <StudentDetailModal
        student={detailStudent}
        onClose={() => setDetailStudent(null)}
        isAssigned={detailStudent ? studentsInTeams.has(detailStudent.id) : false}
        onAssign={(st) => {
          setSelectedStudent(st);
          setShowAddModal(true);
        }}
      />

      {/* Mobile Drawer (slides from left to right) */}
      <div 
        className={cn(
          "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden",
          showFilterDrawer ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setShowFilterDrawer(false)}
      />
      <div 
        className={cn(
          "fixed top-0 left-0 z-50 h-full w-[min(320px,85vw)] bg-[#070c14] border-r border-border/40 p-6 flex flex-col justify-between shadow-2xl transition-transform duration-300 ease-out transform lg:hidden",
          showFilterDrawer ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col grow overflow-y-auto pr-1">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/10 pb-4 mb-5">
            <div>
              <h3 className="text-base font-bold text-white">Filter Students</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">Refine roster list</p>
            </div>
            <button
              type="button"
              onClick={() => setShowFilterDrawer(false)}
              className="text-muted-foreground hover:text-white font-extrabold text-xl p-1"
            >
              ×
            </button>
          </div>

          {/* Form Filter Inputs */}
          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Availability</label>
              <Select value={availabilityFilter} onChange={(e) => setAvailabilityFilter(e.target.value)}>
                <option value="all">All Availability</option>
                <option value="available">Available (Yes)</option>
                <option value="assigned">Assigned (No)</option>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Department</label>
              <Select value={dept} onChange={(e) => setDept(e.target.value)}>
                <option value="">All Departments</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Gender</label>
              <Select value={gender} onChange={(e) => setGender(e.target.value)}>
                <option value="">All Genders</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Project Type</label>
              <Select value={projType} onChange={(e) => setProjType(e.target.value)}>
                <option value="">All Project Types</option>
                <option value="Software">Software</option>
                <option value="Hardware">Hardware</option>
                <option value="Hardware & Software">Both</option>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Year</label>
              <Select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
                <option value="">All Years</option>
                <option value="I">Year I</option>
                <option value="II">Year II</option>
                <option value="III">Year III</option>
                <option value="IV">Year IV</option>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Section</label>
              <Select value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)}>
                <option value="">All Sections</option>
                {["A", "B", "C", "D", "E", "F", "G"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            </div>

            {/* Domain Interests checklist */}
            <div className="flex flex-col gap-1.5 border-t border-border/10 pt-4 mt-2">
              <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Domain Interests</label>
              <div className="grid grid-cols-2 gap-2">
                {POPULAR_DOMAINS.map((d) => {
                  const active = selectedDomains.includes(d);
                  return (
                    <label
                      key={d}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-xl border p-2 text-[10px] transition duration-200 select-none",
                        active
                          ? "border-[#c9a227] bg-[#c9a227]/5 text-white"
                          : "border-border/40 text-muted-foreground hover:bg-muted/5 hover:text-foreground"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggleDomainSelection(d)}
                        className="hidden"
                      />
                      <span className={cn("size-3.5 flex items-center justify-center rounded border text-[8px]", active ? "bg-[#c9a227] border-[#c9a227] text-black" : "border-border")}>
                        {active && "✓"}
                      </span>
                      <span className="truncate">{d}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Drawer footer actions */}
        <div className="border-t border-border/10 pt-4 mt-6 flex justify-between items-center text-xs">
          <button
            type="button"
            onClick={() => {
              setAvailabilityFilter("all");
              setDept("");
              setGender("");
              setProjType("");
              setYearFilter("");
              setSectionFilter("");
              setSelectedDomains([]);
              toast("success", "Filters cleared!");
            }}
            className="text-danger hover:underline font-bold"
          >
            Clear All
          </button>
          <Button
            type="button"
            onClick={() => setShowFilterDrawer(false)}
            className="bg-[#c9a227] text-black font-bold text-xs hover:bg-[#e8c058] px-4 py-2 rounded-xl border-0"
          >
            Apply Filters
          </Button>
        </div>
      </div>
    </div>
  );
}
