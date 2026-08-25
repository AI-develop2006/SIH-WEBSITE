export function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

export function initials(name) {
  if (!name) return "?";
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

/**
 * Check if all members have DIFFERENT assigned skills.
 * Returns true when skills are unique (no conflict).
 */
export function allSkillsUnique(members) {
  const skills = members.map((m) => m.assigned_skill).filter(Boolean);
  return skills.length === new Set(skills.map((s) => s.toLowerCase())).size;
}

/**
 * Returns the list of duplicated skill labels for warning display.
 * Empty array = no conflicts.
 */
export function duplicatedSkills(members) {
  const freq = {};
  for (const m of members) {
    if (!m.assigned_skill) continue;
    const key = m.assigned_skill.toLowerCase();
    freq[key] = (freq[key] ?? 0) + 1;
  }
  return Object.entries(freq).filter(([, n]) => n > 1).map(([k]) => k);
}

/**
 * Validate a final 6-member SPOC team.
 * Returns array of BLOCKING error strings (empty = valid).
 * Skill conflicts are NOT blocking — they are warnings only (see duplicatedSkills).
 */
export function validateFinalTeam(members) {
  const errors = [];
  if (members.length < 6) errors.push(`Need ${6 - members.length} more member(s) — must have exactly 6`);
  if (members.length > 6) errors.push("Team cannot exceed 6 members");

  const depts = [...new Set(members.map((m) => m.department).filter(Boolean))];
  if (depts.length < 2) errors.push("Members must come from at least 2 different departments");

  const femaleCount = members.filter((m) => m.gender === "Female").length;
  if (femaleCount < 2) errors.push(`Need at least 2 female members (currently ${femaleCount})`);

  // Skill uniqueness is a WARNING, not a blocking error — removed from here.

  return errors;
}

export async function downloadXlsx(filename, rows = [], columns = []) {
  const XLSX = await import("xlsx");
  const header = columns.map((c) => c.label);
  const data = rows.map((r) => columns.map((c) => r[c.key] ?? ""));
  const wsData = [header, ...data];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!autofilter"] = {
    ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: wsData.length - 1, c: columns.length - 1 } }),
  };
  ws["!cols"] = columns.map((c, ci) => ({
    wch: Math.min(Math.max(c.label.length + 2, 12, ...rows.map((r) => String(r[c.key] ?? "").length + 2)), 60),
  }));
  ws["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft" };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Final Teams");
  XLSX.writeFile(wb, filename);
}
