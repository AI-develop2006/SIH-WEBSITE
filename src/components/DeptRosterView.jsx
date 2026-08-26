"use client";

import { useMemo, useState } from "react";
import { Download, Users, CheckCircle2, UserX, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEPT_CODE } from "@/lib/constants";

/**
 * DeptRosterView
 *
 * Department-wise student roster for the SPOC portal.
 *
 * For each student the "Final Team" column shows:
 *   - The SPOC final team name  → if the student is in one
 *   - "—"                       → if they are only in a pair team (or no team)
 *   - "—"                       → if they have no team at all
 *
 * Columns: Student Name | Register No | Year | Section | Gender | Status | Final Team
 *
 * Filters: Department (required), Year, Section, Gender, Status
 * Export:  CSV (scoped to current filter)
 */

// Readable dept label from full name
function deptLabel(dept) {
  return DEPT_CODE[dept] ?? (dept ?? "Unknown").slice(0, 20);
}

export function DeptRosterView({ allProfiles = [], pairTeams = [], finalTeams = [] }) {
  // ── Pre-compute lookup maps ──────────────────────────────────────────────
  // Which profile IDs are in a final team, and what's the team name?
  const finalTeamByMemberId = useMemo(() => {
    const map = new Map(); // profileId → finalTeam name
    finalTeams.forEach((ft) => {
      (ft.member_ids || []).forEach((id) => map.set(id, ft.name));
    });
    return map;
  }, [finalTeams]);

  // Which profile IDs are in a pair team (mentor-formed)?
  const inPairTeam = useMemo(() => {
    const set = new Set();
    pairTeams.forEach((t) => t.members.forEach((m) => set.add(m.id)));
    return set;
  }, [pairTeams]);

  // All students only
  const students = useMemo(
    () => allProfiles.filter((p) => p.role === "student"),
    [allProfiles]
  );

  // Unique departments sorted
  const departments = useMemo(() => {
    const set = new Set(students.map((s) => s.department).filter(Boolean));
    return [...set].sort();
  }, [students]);

  // Unique years
  const years = useMemo(() => {
    const set = new Set(students.map((s) => s.year).filter(Boolean));
    return [...set].sort();
  }, [students]);

  // ── Filter state ─────────────────────────────────────────────────────────
  const [dept, setDept]       = useState("");
  const [year, setYear]       = useState("");
  const [section, setSection] = useState("");
  const [gender, setGender]   = useState("");
  const [status, setStatus]   = useState(""); // "" | "profile_only" | "pair_team" | "final_team"

  // Unique sections (scoped to selected dept for relevance)
  const sections = useMemo(() => {
    const base = dept
      ? students.filter((s) => s.department === dept)
      : students;
    const set = new Set(base.map((s) => (s.section ?? "").toUpperCase()).filter(Boolean));
    return [...set].sort();
  }, [students, dept]);

  // ── Filtered rows ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return students.filter((s) => {
      if (dept    && s.department !== dept) return false;
      if (year    && s.year !== year) return false;
      if (section && (s.section ?? "").toUpperCase() !== section) return false;
      if (gender  && s.gender !== gender) return false;

      if (status) {
        const inFinal = finalTeamByMemberId.has(s.id);
        const inPair  = inPairTeam.has(s.id);
        if (status === "final_team"   && !inFinal) return false;
        if (status === "pair_team"    && (inFinal || !inPair)) return false;
        if (status === "profile_only" && (inFinal || inPair)) return false;
      }

      return true;
    });
  }, [students, dept, year, section, gender, status, finalTeamByMemberId, inPairTeam]);

  // ── Counts for stat chips ─────────────────────────────────────────────────
  const counts = useMemo(() => {
    const base = dept ? students.filter((s) => s.department === dept) : students;
    return {
      total:        base.length,
      finalTeam:    base.filter((s) => finalTeamByMemberId.has(s.id)).length,
      pairOnly:     base.filter((s) => !finalTeamByMemberId.has(s.id) && inPairTeam.has(s.id)).length,
      profileOnly:  base.filter((s) => !finalTeamByMemberId.has(s.id) && !inPairTeam.has(s.id)).length,
    };
  }, [students, dept, finalTeamByMemberId, inPairTeam]);

  // ── CSV Export ────────────────────────────────────────────────────────────
  function exportCsv() {
    const rows = [
      ["Student Name", "Register No", "Year", "Section", "Gender", "Status", "Final Team"],
      ...filtered.map((s) => {
        const inFinal = finalTeamByMemberId.has(s.id);
        const inPair  = inPairTeam.has(s.id);
        const statusLabel = inFinal ? "In Final Team" : inPair ? "Pair Team Only" : "Profile Only";
        const finalName   = inFinal ? finalTeamByMemberId.get(s.id) : "";
        return [
          s.name ?? "",
          s.register_no ?? "",
          s.year ?? "",
          s.section ?? "",
          s.gender ?? "",
          statusLabel,
          finalName,
        ];
      }),
    ];

    const csv = rows
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    const deptPart = dept ? `_${deptLabel(dept)}` : "";
    const filters  = [year, section, gender, status].filter(Boolean).join("_");
    a.download = `dept_roster${deptPart}${filters ? "_" + filters : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Status badge helper ───────────────────────────────────────────────────
  function StatusBadge({ profileId }) {
    const inFinal = finalTeamByMemberId.has(profileId);
    const inPair  = inPairTeam.has(profileId);
    if (inFinal) return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
        <CheckCircle2 className="size-2.5 shrink-0" />Final Team
      </span>
    );
    if (inPair) return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-500/40 bg-blue-500/10 text-blue-300">
        <Users className="size-2.5 shrink-0" />Pair Team
      </span>
    );
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-500/40 bg-slate-500/10 text-slate-400">
        <UserX className="size-2.5 shrink-0" />Profile Only
      </span>
    );
  }

  const hasFilters = dept || year || section || gender || status;

  return (
    <div className="space-y-5">

      {/* ── Filter bar ──────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-[rgba(147,197,253,0.12)] bg-[#0a1226]/60 p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Filter className="size-3.5 text-[#c9a227]" />
          <span className="text-xs font-bold uppercase tracking-wider text-[#94a3b8]">Filters</span>
          {hasFilters && (
            <button
              type="button"
              onClick={() => { setDept(""); setYear(""); setSection(""); setGender(""); setStatus(""); }}
              className="ml-auto flex items-center gap-1 text-[10px] text-[#94a3b8] hover:text-white transition-colors"
            >
              <X className="size-3" /> Clear all
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Department */}
          <div className="lg:col-span-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#94a3b8] mb-1">
              Department
            </label>
            <select
              value={dept}
              onChange={(e) => { setDept(e.target.value); setSection(""); }}
              className="w-full rounded-xl border border-[rgba(147,197,253,0.15)] bg-[#050b18] px-3 py-2 text-xs text-white outline-none focus:border-[#c9a227]/50 transition-all cursor-pointer"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>{deptLabel(d)} — {d}</option>
              ))}
            </select>
          </div>

          {/* Year */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#94a3b8] mb-1">Year</label>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full rounded-xl border border-[rgba(147,197,253,0.15)] bg-[#050b18] px-3 py-2 text-xs text-white outline-none focus:border-[#c9a227]/50 transition-all cursor-pointer"
            >
              <option value="">All Years</option>
              {years.map((y) => <option key={y} value={y}>Year {y}</option>)}
            </select>
          </div>

          {/* Section */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#94a3b8] mb-1">Section</label>
            <select
              value={section}
              onChange={(e) => setSection(e.target.value)}
              className="w-full rounded-xl border border-[rgba(147,197,253,0.15)] bg-[#050b18] px-3 py-2 text-xs text-white outline-none focus:border-[#c9a227]/50 transition-all cursor-pointer"
            >
              <option value="">All Sections</option>
              {sections.map((s) => <option key={s} value={s}>Section {s}</option>)}
            </select>
          </div>

          {/* Gender */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#94a3b8] mb-1">Gender</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full rounded-xl border border-[rgba(147,197,253,0.15)] bg-[#050b18] px-3 py-2 text-xs text-white outline-none focus:border-[#c9a227]/50 transition-all cursor-pointer"
            >
              <option value="">All Genders</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>
        </div>

        {/* Status quick-filter chips */}
        <div className="flex flex-wrap gap-2 pt-1">
          {[
            { id: "",             label: `All (${counts.total})`,              cls: "bg-[#c9a227]/20 border-[#c9a227]/40 text-[#e8c058]" },
            { id: "final_team",   label: `In Final Team (${counts.finalTeam})`,  cls: "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" },
            { id: "pair_team",    label: `Pair Team Only (${counts.pairOnly})`,  cls: "bg-blue-500/20 border-blue-500/40 text-blue-300" },
            { id: "profile_only", label: `Profile Only (${counts.profileOnly})`, cls: "bg-slate-500/20 border-slate-500/40 text-slate-300" },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatus(f.id)}
              className={cn(
                "px-3 py-1 rounded-full text-[10px] font-bold border transition-all cursor-pointer",
                status === f.id
                  ? f.cls
                  : "bg-transparent border-[rgba(147,197,253,0.14)] text-[#94a3b8] hover:border-[rgba(147,197,253,0.3)] hover:text-white"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Results header ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-[#94a3b8]">
          Showing{" "}
          <span className="text-white font-bold">{filtered.length}</span> student
          {filtered.length !== 1 ? "s" : ""}
          {dept && (
            <span className="ml-1 text-[#c9a227] font-semibold">
              in {deptLabel(dept)}
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow"
        >
          <Download className="size-3.5" />
          Export CSV
        </button>
      </div>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center rounded-2xl border border-[rgba(147,197,253,0.08)] bg-[#0a1226]/40">
          <UserX className="size-8 text-[#94a3b8]/40 mx-auto mb-3" />
          <p className="text-sm text-[#94a3b8]">No students match the selected filters.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-[rgba(147,197,253,0.10)] bg-[#0a1226]/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-[rgba(147,197,253,0.10)] bg-[#050b18]/60 text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Student Name</th>
                  <th className="px-4 py-3">Register No</th>
                  <th className="px-4 py-3">Year</th>
                  <th className="px-4 py-3">Section</th>
                  <th className="px-4 py-3">Gender</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Final Team</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, idx) => {
                  const finalName = finalTeamByMemberId.get(s.id);
                  const isEven = idx % 2 === 0;
                  return (
                    <tr
                      key={s.id}
                      className={cn(
                        "border-b border-[rgba(147,197,253,0.06)] transition-colors hover:bg-[rgba(147,197,253,0.04)]",
                        isEven ? "bg-transparent" : "bg-[#050b18]/30"
                      )}
                    >
                      <td className="px-4 py-2.5 text-[#94a3b8] font-mono">{idx + 1}</td>
                      <td className="px-4 py-2.5 font-semibold text-white">{s.name ?? "—"}</td>
                      <td className="px-4 py-2.5 font-mono text-[#94a3b8]">{s.register_no ?? "—"}</td>
                      <td className="px-4 py-2.5 text-[#94a3b8]">{s.year ?? "—"}</td>
                      <td className="px-4 py-2.5 text-[#94a3b8]">{s.section ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        {s.gender === "Female" ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-500/15 border border-pink-500/30 text-pink-300">F</span>
                        ) : s.gender === "Male" ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300">M</span>
                        ) : (
                          <span className="text-[#94a3b8]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge profileId={s.id} />
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-emerald-300">
                        {finalName ?? <span className="text-[#94a3b8]/50">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
