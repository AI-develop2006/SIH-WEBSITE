export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export type TeamStats = {
  memberCount: number;
  girlCount: number;
  deptCount: number;
  valid: boolean;
  reason?: string;
};

const RULES = {
  MAX_MEMBERS: 6,
  MIN_GIRLS: 2,
  MIN_DEPTS: 2,
};

export function computeStats(members: { gender?: string | null; department?: string | null }[]): TeamStats {
  const memberCount = members.length;
  const girlCount = members.filter((m) => m.gender === "Female").length;
  const deptCount = new Set(members.map((m) => m.department).filter(Boolean)).size;

  const reasons: string[] = [];
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

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function downloadCsv(
  filename: string,
  rows: Record<string, unknown>[],
  columns: { key: string; label: string }[]
): void {
  const esc = (v: unknown): string => {
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
