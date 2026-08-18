export function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

// Maps every known abbreviation / short form / partial name to the canonical
// full department name as stored in DEPARTMENTS (and in student profiles).
const DEPT_ALIASES = {
  // Computer Science and Engineering
  "cse": "Computer Science and Engineering",
  "cs": "Computer Science and Engineering",
  "computer science": "Computer Science and Engineering",
  "computer science and engineering": "Computer Science and Engineering",

  // Information Technology
  "it": "Information Technology",
  "information technology": "Information Technology",

  // Artificial Intelligence and Data Science
  "ai": "Artificial Intelligence and Data Science",
  "ds": "Artificial Intelligence and Data Science",
  "ai & ds": "Artificial Intelligence and Data Science",
  "ai&ds": "Artificial Intelligence and Data Science",
  "ai and ds": "Artificial Intelligence and Data Science",
  "aids": "Artificial Intelligence and Data Science",
  "artificial intelligence": "Artificial Intelligence and Data Science",
  "data science": "Artificial Intelligence and Data Science",
  "artificial intelligence and data science": "Artificial Intelligence and Data Science",
  "ai/ds": "Artificial Intelligence and Data Science",

  // Civil Engineering
  "civil": "Civil Engineering",
  "ce": "Civil Engineering",
  "civil engineering": "Civil Engineering",

  // Mechanical Engineering
  "mech": "Mechanical Engineering",
  "me": "Mechanical Engineering",
  "mechanical": "Mechanical Engineering",
  "mechanical engineering": "Mechanical Engineering",

  // Instrumentation and Control Engineering
  "ice": "Instrumentation and Control Engineering",
  "i&ce": "Instrumentation and Control Engineering",
  "instrumentation": "Instrumentation and Control Engineering",
  "instrumentation and control": "Instrumentation and Control Engineering",
  "instrumentation and control engineering": "Instrumentation and Control Engineering",
  "inst": "Instrumentation and Control Engineering",

  // Computer Science and Engineering and Business Systems
  "csbs": "Computer Science and Engineering and Business Systems",
  "cse & bs": "Computer Science and Engineering and Business Systems",
  "cse&bs": "Computer Science and Engineering and Business Systems",
  "cse and bs": "Computer Science and Engineering and Business Systems",
  "business systems": "Computer Science and Engineering and Business Systems",
  "computer science and engineering and business systems": "Computer Science and Engineering and Business Systems",

  // Computer and Communication Engineering
  "cce": "Computer and Communication Engineering",
  "c&ce": "Computer and Communication Engineering",
  "computer and communication": "Computer and Communication Engineering",
  "computer and communication engineering": "Computer and Communication Engineering",

  // Mechatronics
  "mct": "Mechatronics",
  "mechatronics": "Mechatronics",

  // Electrical and Electronics Engineering
  "eee": "Electrical and Electronics Engineering",
  "electrical": "Electrical and Electronics Engineering",
  "electrical and electronics": "Electrical and Electronics Engineering",
  "electrical and electronics engineering": "Electrical and Electronics Engineering",

  // Electronics and Communication Engineering
  "ece": "Electronics and Communication Engineering",
  "electronics": "Electronics and Communication Engineering",
  "electronics and communication": "Electronics and Communication Engineering",
  "electronics and communication engineering": "Electronics and Communication Engineering",

  // BioMedical Engineering
  "bme": "BioMedical Engineering",
  "biomedical": "BioMedical Engineering",
  "bio medical": "BioMedical Engineering",
  "biomedical engineering": "BioMedical Engineering",
  "bio-medical engineering": "BioMedical Engineering",

  // Master of Computer Applications
  "mca": "Master of Computer Applications",
  "master of computer applications": "Master of Computer Applications",

  // Master of Business Administration
  "mba": "Master of Business Administration",
  "master of business administration": "Master of Business Administration",
};

/**
 * Normalizes a department string to its canonical full name.
 * Handles abbreviations, short forms, and case variations.
 * Returns the canonical name if found, otherwise returns the input trimmed.
 */
export function normalizeDepartment(dept) {
  if (!dept) return "";
  const key = dept.trim().toLowerCase();
  return DEPT_ALIASES[key] ?? dept.trim();
}

/**
 * Returns true if two department strings refer to the same department,
 * handling abbreviations on either side.
 */
export function isSameDepartment(a, b) {
  if (!a || !b) return false;
  return normalizeDepartment(a) === normalizeDepartment(b);
}

export function getMemberSkillsAndDomains(member) {
  if (!member) return new Set();
  const set = new Set();
  const add = (val) => {
    if (!val) return;
    if (Array.isArray(val)) {
      val.forEach((v) => v && set.add(String(v).trim().toLowerCase()));
    } else if (typeof val === "string") {
      val.split(",").forEach((v) => v && set.add(v.trim().toLowerCase()));
    }
  };
  add(member.domain_interests);
  add(member.software_domain);
  add(member.hardware_domain);
  add(member.skills);
  add(member.domain);
  add(member.sih_project_domain);
  add(member.project_domain);
  add(member.skills_list);
  return set;
}

export function computeStats(members = [], category = "Pairs") {
  const isSolo = category === "Solo";
  const targetCount = isSolo ? 1 : 2;
  const memberCount = members.length;
  const depts = members.map((m) => m.department).filter(Boolean);
  const deptSet = new Set(depts);
  const deptCount = deptSet.size;

  const reasons = [];
  if (isSolo) {
    if (memberCount > 1) {
      reasons.push("Solo entry can only have 1 member");
    } else if (memberCount === 0) {
      reasons.push("requires 1 member");
    }
  } else {
    if (memberCount > 2) {
      reasons.push("max 2 members allowed");
    } else if (memberCount < 2) {
      reasons.push("requires 2 members");
    }
  }

  const sameDept = isSolo ? true : (memberCount > 1 ? deptCount === 1 : true);
  if (!isSolo && memberCount > 1 && !sameDept) {
    reasons.push("members must be from the same department");
  }

  // Skill uniqueness is enforced via explicit assigned_skill assignment, not broad profile fields.
  const differentSkills = true;

  return {
    memberCount,
    targetCount,
    isSolo,
    deptCount,
    sameDept,
    differentSkills,
    valid: memberCount === targetCount && reasons.length === 0,
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
