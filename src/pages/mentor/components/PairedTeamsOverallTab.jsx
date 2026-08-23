import { useMemo, useState, memo } from "react";
import {
  Users, User, Building, Building2, Eye, AlertTriangle, ChevronUp, ChevronDown, Sparkles, X,
} from "lucide-react";
import { cn, computeStats, isSameDepartment, normalizeDepartment } from "@/lib/utils";
import { MINISTRIES, MAX_MEMBERS_PER_MINISTRY_PER_DEPT, OUTDATED_MINISTRIES, NEW_MINISTRIES, ACTIVE_MINISTRIES_COUNT } from "@/lib/constants";
import { StudentDetailModal } from "./StudentDetailModal";
import { TeamDetailsModal } from "./TeamDetailsModal";
import { OutdatedMinistryBadge } from "@/components/common/OutdatedMinistryBadge";
import { NewMinistryBadge } from "@/components/common/NewMinistryBadge";

const CAP = MAX_MEMBERS_PER_MINISTRY_PER_DEPT;

/**
 * PairedTeamsOverallTab
 *
 * Shows ALL teams across every department — view-only for other departments.
 * Two sub-views:
 *   • "By Department" — left-sidebar dept list + right team grid
 *   • "By Ministry"  — cross-dept ministry accordion
 */
export const PairedTeamsOverallTab = memo(function PairedTeamsOverallTab({ teams, mentorDept, problemMap }) {
  const [detailStudent, setDetailStudent] = useState(null);
  const [selectedTeamOverlay, setSelectedTeamOverlay] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [subView, setSubView] = useState("dept"); // "dept" | "ministry"

  // By Department — selected dept in sidebar
  const [selectedDept, setSelectedDept] = useState(null);
  const [deptTeamSearch, setDeptTeamSearch] = useState("");

  // By Ministry filters
  const [ministrySearch, setMinistrySearch] = useState("");
  const [ministryStatusFilter, setMinistryStatusFilter] = useState("all");
  const [expandedMinistry, setExpandedMinistry] = useState(null);
  const [deptFilter, setDeptFilter] = useState("All");

  // Sync overlay with live data
  const activeOverlayData = selectedTeamOverlay
    ? teams.find((t) => t.team.id === selectedTeamOverlay.team.id) ?? null
    : null;

  const overlayIsOwnDept = useMemo(() => {
    if (!activeOverlayData) return true;
    if (!mentorDept) return true;
    if (activeOverlayData.team.created_by_dept) {
      return isSameDepartment(activeOverlayData.team.created_by_dept, mentorDept);
    }
    const members = activeOverlayData.members || [];
    if (members.length > 0) {
      return members.every((m) => !m.department || isSameDepartment(m.department, mentorDept));
    }
    return false;
  }, [activeOverlayData, mentorDept]);

  // Category-filtered teams
  const filteredTeams = useMemo(() => {
    return teams.filter((t) => {
      if (categoryFilter === "All") return true;
      const cat = t.team.category || (t.members.length === 1 ? "Solo" : "Pairs");
      return cat === categoryFilter;
    });
  }, [teams, categoryFilter]);

  // Group by department (normalized)
  const deptGrouped = useMemo(() => {
    const map = new Map();
    for (const t of filteredTeams) {
      let rawDept = t.team.created_by_dept;
      if (!rawDept) {
        const memberDepts = [...new Set(t.members.map((m) => m.department).filter(Boolean))];
        rawDept = memberDepts.length >= 1 ? memberDepts[0] : null;
      }
      const dept = rawDept ? normalizeDepartment(rawDept) : "Other / Legacy";
      if (!map.has(dept)) map.set(dept, []);
      map.get(dept).push(t);
    }
    const normalizedMentorDept = mentorDept ? normalizeDepartment(mentorDept) : null;
    return [...map.entries()].sort(([a], [b]) => {
      if (normalizedMentorDept) {
        if (a === normalizedMentorDept) return -1;
        if (b === normalizedMentorDept) return 1;
      }
      return a.localeCompare(b);
    });
  }, [filteredTeams, mentorDept]);

  // Auto-select own dept (or first dept)
  const activeDept = useMemo(() => {
    if (!deptGrouped.length) return null;
    if (selectedDept && deptGrouped.some(([d]) => d === selectedDept)) return selectedDept;
    const own = deptGrouped.find(([d]) => isSameDepartment(d, mentorDept || ""));
    return own ? own[0] : deptGrouped[0][0];
  }, [deptGrouped, selectedDept, mentorDept]);

  const activeDeptTeams = useMemo(() => {
    const base = deptGrouped.find(([d]) => d === activeDept)?.[1] ?? [];
    if (!deptTeamSearch.trim()) return base;
    const needle = deptTeamSearch.trim().toLowerCase();
    return base.filter((t) => {
      const hay = [t.team.team_code, t.team.name, t.team.ministry, ...t.members.map((m) => `${m.name} ${m.section ?? ""}`)]
        .filter(Boolean).join(" ").toLowerCase();
      return hay.includes(needle);
    });
  }, [deptGrouped, activeDept, deptTeamSearch]);

  // Ministry grouping
  const ministryData = useMemo(() => {
    const map = new Map();
    for (const m of MINISTRIES) map.set(m, { teams: [], membersByDept: {} });
    for (const t of filteredTeams) {
      const ministry = t.team.ministry;
      if (!ministry) continue;
      if (!map.has(ministry)) map.set(ministry, { teams: [], membersByDept: {} });
      const entry = map.get(ministry);
      entry.teams.push(t);
      for (const m of t.members) {
        const dept = m.department || "Unknown";
        entry.membersByDept[dept] = (entry.membersByDept[dept] || 0) + 1;
      }
    }
    return map;
  }, [filteredTeams]);

  const assignedMinistryCount = useMemo(() => {
    return MINISTRIES.filter((m) => {
      const entry = ministryData.get(m);
      const allTeams = entry?.teams ?? [];
      if (deptFilter === "All") return allTeams.length > 0;
      return allTeams.some(
        (t) =>
          t.members.some((mb) => mb.department === deptFilter) ||
          t.team.created_by_dept === deptFilter
      );
    }).length;
  }, [ministryData, deptFilter]);

  const filteredMinistries = useMemo(() => {
    const needle = ministrySearch.trim().toLowerCase();
    return MINISTRIES.filter((m) => {
      if (needle && !m.toLowerCase().includes(needle)) return false;
      const entry = ministryData.get(m);
      const allTeams = entry?.teams ?? [];

      // When a dept filter is active, only show ministries that have teams from that dept
      const visibleTeams = deptFilter === "All"
        ? allTeams
        : allTeams.filter((t) =>
            t.members.some((mb) => mb.department === deptFilter) ||
            t.team.created_by_dept === deptFilter
          );

      const hasVisibleTeams = visibleTeams.length > 0;

      if (ministryStatusFilter === "active" && !hasVisibleTeams) return false;
      // When filtering by dept, "empty" means no teams from that dept — don't show empties
      if (ministryStatusFilter === "inactive" && hasVisibleTeams) return false;
      if (ministryStatusFilter === "outdated" && !OUTDATED_MINISTRIES.has(m)) return false;
      if (ministryStatusFilter === "new" && !NEW_MINISTRIES.has(m)) return false;
      // When a dept filter is active, always hide ministries with no teams from that dept
      if (deptFilter !== "All" && !hasVisibleTeams) return false;

      return true;
    });
  }, [ministrySearch, ministryStatusFilter, ministryData, deptFilter]);

  const allDepts = useMemo(() => {
    const set = new Set();
    for (const t of filteredTeams) {
      for (const m of t.members) if (m.department) set.add(m.department);
    }
    return ["All", ...Array.from(set).sort()];
  }, [filteredTeams]);

  const totalCount = filteredTeams.length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl border border-[rgba(201,162,39,0.25)] bg-card/30 p-4 space-y-1">
        <h2 className="text-base font-extrabold text-white flex items-center gap-2">
          Paired Teams Overall — All Departments
        </h2>
        <p className="text-xs text-muted-foreground">
          View all teams across every department. Other departments' teams are{" "}
          <span className="text-[#c9a227] font-semibold">view-only</span>. Switch views to browse by department or ministry.
        </p>
      </div>

      {/* Sub-view switcher */}
      <div className="flex items-center gap-2 bg-card/30 border border-border/40 rounded-2xl p-1.5">
        {[
          { id: "dept", label: "By Department", icon: <Building className="size-3.5 shrink-0" />, desc: "Sidebar dept nav" },
          { id: "ministry", label: "By Ministry", icon: <Building2 className="size-3.5 shrink-0" />, desc: "Cross-dept view" },
        ].map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSubView(s.id)}
            className={cn(
              "flex-1 flex flex-col items-center py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer",
              subView === s.id
                ? "bg-[#c9a227] text-black shadow"
                : "text-muted-foreground hover:text-white hover:bg-muted/20"
            )}
          >
            <span className="flex items-center gap-1.5">{s.icon}{s.label}</span>
            <span className={cn("text-[9px] font-normal mt-0.5", subView === s.id ? "text-black/70" : "text-muted-foreground/60")}>{s.desc}</span>
          </button>
        ))}
      </div>

      {/* Category filter — shared */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card/40 p-3 rounded-2xl border border-border/40">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Category:</span>
          {[
            { id: "All", label: "All Teams" },
            { id: "Pairs", label: <><Users className="size-3 shrink-0 inline-block mr-1" />Pairs</> },
            { id: "Solo", label: <><User className="size-3 shrink-0 inline-block mr-1" />Solo</> },
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
        <span className="text-xs text-muted-foreground font-semibold">
          <span className="text-white font-bold">{totalCount}</span> team{totalCount !== 1 ? "s" : ""} ·{" "}
          <span className="text-white font-bold">{deptGrouped.length}</span> dept{deptGrouped.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── BY DEPARTMENT: left sidebar + right content ── */}
      {subView === "dept" && (
        <div className="flex gap-4 min-h-[400px]">

          {/* Left sidebar — desktop only */}
          <aside className="hidden md:flex flex-col w-56 shrink-0 gap-1 rounded-2xl border border-border/40 bg-card/20 p-2 self-start sticky top-20 max-h-[calc(100vh-10rem)] overflow-y-auto">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 pt-1 pb-2">
              Departments
            </p>
            {deptGrouped.length === 0 && (
              <p className="text-xs text-muted-foreground px-2 py-3">No teams yet.</p>
            )}
            {deptGrouped.map(([dept, deptTeams]) => {
              const isOwn = isSameDepartment(dept, mentorDept || "");
              const isActive = dept === activeDept;
              return (
                <button
                  key={dept}
                  type="button"
                  onClick={() => setSelectedDept(dept)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-start justify-between gap-2",
                    isActive
                      ? isOwn
                        ? "bg-[#c9a227] text-black font-bold shadow"
                        : "bg-slate-700 text-white font-bold shadow"
                      : isOwn
                      ? "text-[#e8c058] hover:bg-[#c9a227]/10 border border-transparent hover:border-[#c9a227]/20"
                      : "text-slate-300 hover:bg-muted/20 border border-transparent"
                  )}
                >
                  <span className="leading-snug">
                    {isOwn && <span className="size-1.5 rounded-full bg-[#c9a227] inline-block mr-1.5 align-middle" />}
                    {dept}
                  </span>
                  <span className={cn(
                    "shrink-0 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full mt-0.5",
                    isActive ? "bg-black/20 text-current" : "bg-muted/30 text-muted-foreground"
                  )}>
                    {deptTeams.length}
                  </span>
                </button>
              );
            })}
          </aside>

          {/* Mobile dept picker (dropdown) */}
          <div className="md:hidden w-full self-start">
            <select
              value={activeDept ?? ""}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full rounded-xl border border-border/50 bg-card/60 text-xs text-white px-3 py-2.5 focus:outline-none focus:border-[#c9a227] cursor-pointer"
            >
              {deptGrouped.map(([dept, deptTeams]) => (
                <option key={dept} value={dept}>
                  {isSameDepartment(dept, mentorDept || "") ? `${dept} (You)` : dept} ({deptTeams.length})
                </option>
              ))}
            </select>
          </div>

          {/* Right panel — teams for selected dept */}
          <div className="flex-1 min-w-0 space-y-4">
            {!activeDept || activeDeptTeams.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground rounded-2xl border border-border/20 bg-card/10">
                No teams found for this department.
              </div>
            ) : (() => {
              const isOwnDept = isSameDepartment(activeDept, mentorDept || "");
              return (
                <>
                  {/* Dept header bar */}
                  <div className={cn(
                    "flex flex-wrap items-center gap-3 px-4 py-2.5 rounded-2xl border",
                    isOwnDept ? "border-[#c9a227]/30 bg-[#c9a227]/5" : "border-slate-700/40 bg-slate-900/20"
                  )}>
                    {isOwnDept && <span className="size-1.5 rounded-full bg-[#c9a227] inline-block" />}
                    <span className={cn("text-sm font-extrabold uppercase tracking-wide", isOwnDept ? "text-[#e8c058]" : "text-slate-200")}>
                      {activeDept}
                    </span>
                    {isOwnDept && (
                      <span className="text-[9px] font-bold text-[#c9a227] bg-[#c9a227]/10 border border-[#c9a227]/30 px-1.5 py-0.5 rounded-full">
                        Your Dept
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      · {activeDeptTeams.length} team{activeDeptTeams.length !== 1 ? "s" : ""}
                    </span>
                    {!isOwnDept && (
                      <span className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                        <Eye className="size-3 shrink-0" /> view only
                      </span>
                    )}
                    {/* Team search within dept */}
                    <div className="relative ml-auto">
                      <input
                        type="text"
                        placeholder="Search teams, names, section…"
                        value={deptTeamSearch}
                        onChange={(e) => setDeptTeamSearch(e.target.value)}
                        className="rounded-xl border border-border/40 bg-card/60 pl-3 pr-7 py-1.5 text-xs text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#c9a227]/50 transition-all w-48"
                      />
                      {deptTeamSearch && (
                        <button type="button" onClick={() => setDeptTeamSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white">
                          <X className="size-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Team cards */}
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {activeDeptTeams.map((t) => {
                      const category = t.team.category || (t.members.length === 1 ? "Solo" : "Pairs");
                      const stats = computeStats(t.members, category);
                      return (
                        <div
                          key={t.team.id}
                          onClick={() => setSelectedTeamOverlay(t)}
                          className={cn(
                            "rounded-3xl border p-4 flex flex-col gap-3 transition-all duration-200 cursor-pointer group",
                            isOwnDept
                              ? "border-[#c9a227]/30 bg-card/30 hover:border-[#c9a227]/70 hover:shadow-lg hover:shadow-[#c9a227]/5"
                              : "border-slate-700/40 bg-slate-900/30 hover:border-slate-500/60"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className={cn("text-sm font-extrabold leading-tight truncate", isOwnDept ? "text-white group-hover:text-[#c9a227]" : "text-slate-200 group-hover:text-slate-100")}>
                                {t.team.team_code ?? "SIH2K26#—"}
                              </h3>
                              <p className="text-[11px] text-muted-foreground font-medium truncate mt-0.5">{t.team.name}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span className={cn("text-[10px] font-extrabold px-2 py-0.5 rounded-full border flex items-center gap-1", category === "Solo" ? "bg-indigo-500/15 border-indigo-500/40 text-indigo-300" : "bg-[#c9a227]/15 border-[#c9a227]/40 text-[#e8c058]")}>
                                {category === "Solo" ? <><User className="size-3 shrink-0" /> Solo</> : <><Users className="size-3 shrink-0" /> Pairs</>}
                              </span>
                              {t.team.approved ? (
                                <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">Approved</span>
                              ) : (
                                <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-300">Pending</span>
                              )}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              <span>Members ({t.members.length}/{stats.targetCount})</span>
                              {!isOwnDept && <span className="flex items-center gap-1 text-slate-500 font-normal"><Eye className="size-3 shrink-0" /> view only</span>}
                            </div>
                            {t.members.length === 0 ? (
                              <p className="text-[11px] text-muted-foreground italic py-1">No members yet</p>
                            ) : (
                              <ul className="space-y-1">
                                {t.members.map((m) => (
                                  <li
                                    key={m.id}
                                    onClick={(e) => { e.stopPropagation(); setDetailStudent(m); }}
                                    className="flex items-center justify-between text-xs hover:bg-muted/10 px-1.5 py-1 rounded-lg cursor-pointer transition-colors"
                                  >
                                    <span className="text-slate-300 font-medium truncate">{m.name}</span>
                                    <span className="text-[9px] text-muted-foreground font-semibold bg-muted/20 px-1.5 py-0.5 rounded shrink-0 ml-1">{m.department}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>

                          {t.team.ministry && (
                            <div className="text-[10px] text-muted-foreground border-t border-border/20 pt-2 flex items-center gap-1.5 flex-wrap">
                              Ministry: <span className="text-[#c9a227] font-semibold">{t.team.ministry}</span>
                              <OutdatedMinistryBadge ministry={t.team.ministry} inline />
                              <NewMinistryBadge ministry={t.team.ministry} inline />
                            </div>
                          )}
                          {!stats.valid && stats.reason && (
                            <div className="flex items-center gap-1.5 text-[10px] text-amber-400 bg-amber-500/5 border border-amber-500/20 px-2 py-1 rounded-lg">
                              <AlertTriangle className="size-3 shrink-0" />
                              {stats.reason}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── BY MINISTRY sub-view ── */}
      {subView === "ministry" && (
        <div className="space-y-4">
          {/* Controls */}
          <div className="rounded-2xl border border-border/40 bg-card/30 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <input
                type="text"
                placeholder="Search ministry..."
                value={ministrySearch}
                onChange={(e) => setMinistrySearch(e.target.value)}
                className="flex-1 rounded-xl border border-border/50 bg-card/60 text-xs text-white px-3 py-2 focus:outline-none focus:border-[#c9a227] placeholder:text-muted-foreground"
              />
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Show:</span>
                {[
                  { id: "all", label: "All" },
                  { id: "active", label: "Active" },
                  { id: "inactive", label: "Empty" },
                  { id: "outdated", label: "Outdated" },
                  { id: "new", label: "New" },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setMinistryStatusFilter(f.id)}
                    className={cn(
                      "flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border",
                      ministryStatusFilter === f.id
                        ? f.id === "active"
                          ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                          : f.id === "outdated"
                          ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                          : f.id === "new"
                          ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                          : "bg-[#c9a227] text-black border-[#c9a227]"
                        : "bg-card/30 border-border/30 text-muted-foreground hover:text-white"
                    )}
                  >
                    {f.id === "outdated" && <AlertTriangle className="size-3 shrink-0" />}
                    {f.id === "new" && <Sparkles className="size-3 shrink-0" />}
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Outdated banner */}
            {ministryStatusFilter === "outdated" && (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/8 px-4 py-3">
                <AlertTriangle className="size-3.5 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-300/90 leading-relaxed">
                  <span className="font-bold text-amber-300">What does "Outdated" mean?</span>
                  {" "}These ministries are not listed in the official SIH 2026 Problem Statements. Teams that selected an outdated ministry will need to be reconsidered and reassigned to one of the currently active ministries.
                </p>
              </div>
            )}

            {/* New banner */}
            {ministryStatusFilter === "new" && (
              <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/8 px-4 py-3">
                <Sparkles className="size-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-emerald-300/90 leading-relaxed">
                  <span className="font-bold text-emerald-300">What does "New" mean?</span>
                  {" "}These ministries were newly added to the official SIH 2026 Problem Statements. Teams choosing these ministries are working on recently introduced problem statements.
                </p>
              </div>
            )}

            {/* Dept chip filter */}
            <div className="flex items-center gap-2 flex-wrap border-t border-border/20 pt-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground shrink-0">Filter by Dept:</span>
              {allDepts.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDeptFilter(d)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer border",
                    deptFilter === d
                      ? (d !== "All" && isSameDepartment(d, mentorDept || ""))
                        ? "bg-[#c9a227] text-black border-[#c9a227]"
                        : "bg-slate-600 text-white border-slate-500"
                      : "bg-card/20 border-border/30 text-muted-foreground hover:text-white"
                  )}
                >
                  {d !== "All" && isSameDepartment(d, mentorDept || "") ? `${d} (You)` : d}
                </button>
              ))}
            </div>

            <div className="text-[10px] text-muted-foreground pt-1">
              <span className="text-[#c9a227] font-bold">{assignedMinistryCount}</span> / {ACTIVE_MINISTRIES_COUNT} ministries active ·{" "}
              Showing <span className="text-white font-bold">{filteredMinistries.length}</span> ministries
            </div>
          </div>

          {/* Ministry accordion */}
          <div className="space-y-2">
            {filteredMinistries.length === 0 && (
              <div className="py-10 text-center rounded-2xl border border-border/20 bg-card/10 text-sm text-muted-foreground">
                No ministries match your filters.
              </div>
            )}
            {filteredMinistries.map((ministry, idx) => {
              const entry = ministryData.get(ministry) || { teams: [], membersByDept: {} };
              const hasTeams = entry.teams.length > 0;
              const isOpen = expandedMinistry === ministry;
              const totalMembers = entry.teams.reduce((s, t) => s + t.members.length, 0);
              const cappedDepts = Object.entries(entry.membersByDept).filter(([, c]) => c >= CAP);
              const nearCapDepts = Object.entries(entry.membersByDept).filter(([, c]) => c === CAP - 1);

              const visibleTeams = deptFilter === "All"
                ? entry.teams
                : entry.teams.filter((t) =>
                    t.members.some((m) => m.department === deptFilter) ||
                    t.team.created_by_dept === deptFilter
                  );

              return (
                <div key={ministry} className={cn("rounded-2xl border transition-all duration-200", hasTeams ? "border-[#c9a227]/30 bg-card/30" : "border-border/20 bg-card/10")}>
                  <button
                    type="button"
                    onClick={() => setExpandedMinistry(isOpen ? null : ministry)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-[10px] font-bold text-muted-foreground w-5 shrink-0">{String(idx + 1).padStart(2, "0")}</span>
                      <span className={cn("text-sm font-semibold truncate", hasTeams ? "text-white" : "text-muted-foreground/60")}>{ministry}</span>
                      <OutdatedMinistryBadge ministry={ministry} inline />
                      <NewMinistryBadge ministry={ministry} inline />
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                      {cappedDepts.length > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-300">
                          {cappedDepts.length} dept{cappedDepts.length > 1 ? "s" : ""} FULL
                        </span>
                      )}
                      {nearCapDepts.length > 0 && cappedDepts.length === 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300">Near cap</span>
                      )}
                      {hasTeams ? (
                        <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-[#c9a227]/15 border border-[#c9a227]/30 text-[#e8c058]">
                          {entry.teams.length} team{entry.teams.length !== 1 ? "s" : ""} · {totalMembers} member{totalMembers !== 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/40 font-medium">Unassigned</span>
                      )}
                      <span className="text-muted-foreground/50 text-xs ml-1">{isOpen ? "▲" : "▼"}</span>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-border/20 px-4 pb-4 pt-3 space-y-4">
                      {!hasTeams ? (
                        <p className="text-xs text-muted-foreground py-4 text-center">No teams assigned to this ministry yet.</p>
                      ) : (
                        <>
                          {/* Per-dept capacity bars */}
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                              Dept Capacity (max {CAP} per dept)
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                              {Object.entries(entry.membersByDept).sort((a, b) => b[1] - a[1]).map(([dept, count]) => {
                                const pct = Math.min((count / CAP) * 100, 100);
                                const isFull = count >= CAP;
                                const isNear = count === CAP - 1;
                                const isOwn = isSameDepartment(dept, mentorDept || "");
                                return (
                                  <div key={dept} className={cn("rounded-xl border bg-muted/10 p-2.5 space-y-1.5", isOwn ? "border-[#c9a227]/30" : "border-border/30")}>
                                    <div className="flex justify-between items-center gap-1">
                                      <span className={cn("text-[10px] font-bold truncate", isOwn ? "text-[#e8c058]" : "text-white")}>
                                        {isOwn ? `${dept} (You)` : dept}
                                      </span>
                                      <span className={cn("text-[10px] font-extrabold shrink-0", isFull ? "text-red-400" : isNear ? "text-amber-400" : "text-emerald-400")}>{count}/{CAP}</span>
                                    </div>
                                    <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
                                      <div className={cn("h-full rounded-full transition-all duration-500", isFull ? "bg-red-500" : isNear ? "bg-amber-400" : "bg-emerald-500")} style={{ width: `${pct}%` }} />
                                    </div>
                                    {isFull && <p className="text-[9px] text-red-400 font-bold">⚠ Max capacity reached</p>}
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Teams */}
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                              Assigned Teams {deptFilter !== "All" && <span className="text-[#c9a227]">· {deptFilter}</span>}
                            </p>
                            {visibleTeams.length === 0 ? (
                              <p className="text-xs text-muted-foreground italic">No teams from {deptFilter} assigned here.</p>
                            ) : (
                              <div className="space-y-2">
                                {visibleTeams.map((t) => {
                                  const category = t.team.category || (t.members.length === 1 ? "Solo" : "Pairs");
                                  const isSolo = category === "Solo";
                                  const isOwnDeptTeam = !mentorDept || !t.team.created_by_dept
                                    ? (!mentorDept || (t.members.length > 0 && t.members.every((m) => !m.department || isSameDepartment(m.department, mentorDept))))
                                    : isSameDepartment(t.team.created_by_dept, mentorDept);
                                  return (
                                    <div
                                      key={t.team.id}
                                      onClick={() => setSelectedTeamOverlay(t)}
                                      className={cn(
                                        "rounded-xl border p-3 space-y-2 cursor-pointer transition-all",
                                        isOwnDeptTeam
                                          ? "border-[#c9a227]/20 bg-card/30 hover:border-[#c9a227]/50"
                                          : "border-border/30 bg-card/20 hover:border-slate-500/50"
                                      )}
                                    >
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-xs font-extrabold text-white">{t.team.team_code || t.team.name}</span>
                                        {t.team.team_code && t.team.name !== t.team.team_code && (
                                          <span className="text-[10px] text-muted-foreground font-mono">{t.team.name}</span>
                                        )}
                                        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1", isSolo ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-300" : "bg-[#c9a227]/15 border-[#c9a227]/30 text-[#e8c058]")}>
                                          {isSolo ? <><User className="size-3 shrink-0" /> Solo</> : <><Users className="size-3 shrink-0" /> Pairs</>}
                                        </span>
                                        {t.team.created_by_dept && (
                                          <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", isOwnDeptTeam ? "bg-[#c9a227]/10 border-[#c9a227]/20 text-[#e8c058]" : "bg-slate-700/40 border-slate-600/40 text-slate-300")}>
                                            {isOwnDeptTeam ? `${t.team.created_by_dept} (You)` : t.team.created_by_dept}
                                          </span>
                                        )}
                                        {!isOwnDeptTeam && (
                                          <span className="flex items-center gap-1 text-[9px] text-slate-500 font-medium"><Eye className="size-3 shrink-0" /> view only</span>
                                        )}
                                      </div>
                                      {t.members.length === 0 ? (
                                        <p className="text-[11px] text-muted-foreground italic">No members yet</p>
                                      ) : (
                                        <div className="space-y-1">
                                          {t.members.map((m) => (
                                            <div
                                              key={m.id}
                                              onClick={(e) => { e.stopPropagation(); setDetailStudent(m); }}
                                              className="flex items-center justify-between gap-1 text-[11px] py-1.5 px-2.5 rounded-lg bg-muted/10 cursor-pointer hover:bg-muted/20 transition-colors"
                                            >
                                              <div className="flex items-center gap-2 min-w-0">
                                                <span className="font-semibold text-white truncate">{m.name}</span>
                                                <span className="text-muted-foreground font-mono text-[10px] shrink-0">{m.register_no}</span>
                                              </div>
                                              <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="text-[10px] bg-muted/20 border border-border/30 px-1.5 py-0.5 rounded text-muted-foreground truncate max-w-[120px]">{m.department}</span>
                                                {m.assigned_skill && (
                                                  <span className="text-[10px] bg-[#c9a227]/10 border border-[#c9a227]/30 px-1.5 py-0.5 rounded text-[#e8c058] truncate max-w-[100px]">{m.assigned_skill}</span>
                                                )}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Team Details Overlay */}
      <TeamDetailsModal
        teamData={activeOverlayData}
        onClose={() => setSelectedTeamOverlay(null)}
        problemMap={problemMap}
        removeMember={() => {}}
        deleteTeam={() => {}}
        onViewProfile={(st) => setDetailStudent(st)}
        assignMemberSkill={() => {}}
        assignTeamMinistry={() => {}}
        readOnly={!overlayIsOwnDept}
      />

      {/* Student Profile Modal */}
      <StudentDetailModal
        student={detailStudent}
        onClose={() => setDetailStudent(null)}
        isAssigned={true}
      />
    </div>
  );
});