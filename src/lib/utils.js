export function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

const RULES = {
  MAX_MEMBERS: 6,
  MIN_GIRLS: 2,
  MIN_DEPTS: 2,
};

export function computeStats(members = []) {
  const memberCount = members.length;
  const girlCount = members.filter((m) => m.gender === "Female").length;
  const deptCount = new Set(members.map((m) => m.department).filter(Boolean)).size;

  const reasons = [];
  if (memberCount > RULES.MAX_MEMBERS) reasons.push(`max ${RULES.MAX_MEMBERS} members`);
  if (girlCount < RULES.MIN_GIRLS) reasons.push(`at least ${RULES.MIN_GIRLS} female members`);
  if (deptCount < RULES.MIN_DEPTS) reasons.push(`at least ${RULES.MIN_DEPTS} departments`);

  return {
    memberCount,
    girlCount,
    deptCount,
    valid: reasons.length === 0,
    reason: reasons.join(" · "),
  };
}

export function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function initials(name) {
  if (!name) return "";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function downloadCsv(filename, rows = [], columns = []) {
  const esc = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map((c) => esc(c.label)).join(",");
  const body = rows.map((r) => columns.map((c) => esc(r[c.key])).join(","));
  const csv = [header, ...body].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export rows as an .xlsx file with auto-filter enabled on all columns.
 * Requires the 'xlsx' (SheetJS) package.
 *
 * @param {string} filename  - e.g. "sih-teams.xlsx"
 * @param {object[]} rows    - array of plain objects
 * @param {{ key: string, label: string }[]} columns - column definitions
 */
export async function downloadXlsx(filename, rows = [], columns = []) {
  // Dynamically import so it doesn't bloat the initial bundle
  const XLSX = await import("xlsx");

  // Build array-of-arrays: header row + data rows
  const header = columns.map((c) => c.label);
  const data = rows.map((r) => columns.map((c) => {
    const v = r[c.key];
    return v == null ? "" : v;
  }));

  const wsData = [header, ...data];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Auto-filter across all columns
  ws["!autofilter"] = { ref: XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: wsData.length - 1, c: columns.length - 1 },
  })};

  // Column widths — auto-size based on max content length
  ws["!cols"] = columns.map((c, ci) => {
    const maxLen = Math.max(
      c.label.length,
      ...rows.map((r) => String(r[c.key] ?? "").length)
    );
    return { wch: Math.min(Math.max(maxLen + 2, 12), 60) };
  });

  // Freeze the header row
  ws["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft" };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Teams");
  XLSX.writeFile(wb, filename);
}
