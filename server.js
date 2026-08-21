import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load environment variables locally
if (existsSync(join(__dirname, ".env.local"))) {
  dotenv.config({ path: join(__dirname, ".env.local") });
} else if (existsSync(join(__dirname, "../frontend/.env.local"))) {
  dotenv.config({ path: join(__dirname, "../frontend/.env.local") });
} else if (existsSync(join(__dirname, ".env"))) {
  dotenv.config({ path: join(__dirname, ".env") });
} else {
  dotenv.config();
}

import { runMigrations, dbQuery } from "./database.js";

const app = express();
const PORT = process.env.PORT || 3003;

app.use(express.json());

// Initialize Supabase backend client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

function getMemberSkillsAndDomains(member) {
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

// Helper to compute team compliance stats
function computeStats(members = [], category = "Pairs") {
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

  // Skill uniqueness is now enforced via the explicit assigned_skill assignment per member,
  // not by comparing broad profile domain fields.
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

// CORS Middleware
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3003",
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()) : [])
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const isAllowed = !origin || allowedOrigins.includes(origin) || allowedOrigins.includes("*") || (origin && origin.endsWith(".vercel.app"));
  res.header("Access-Control-Allow-Origin", isAllowed ? (origin || "*") : "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.set("trust proxy", true);

// Health Check
app.get(["/health", "/api/health"], (_req, res) => {
  res.json({
    status: "ok",
    service: "participant-mentor-backend",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ==========================================
// REST API ENDPOINTS FOR PARTICIPANT / MENTOR
// ==========================================

// 1. Auth: Login
app.post("/api/auth/login", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase client not configured in backend" });
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });

  try {
    const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) return res.status(401).json({ error: signInError.message });

    const user = authData.user;
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();

    return res.json({ session: authData.session, user, profile });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 2. Auth: Sign Up
app.post("/api/auth/signup", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase client not configured in backend" });
  const { email, password, meta } = req.body;

  try {
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: meta },
    });
    if (signUpError) return res.status(400).json({ error: signUpError.message });

    return res.json({ session: signUpData.session, user: signUpData.user });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 3. Auth: Current User Status
app.get("/api/auth/me", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase client not configured in backend" });
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  const token = authHeader.split(" ")[1];

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: "Invalid token" });

    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    return res.json({ user, profile });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 4. Reset Student Password RPC
app.post("/api/auth/reset-password", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase client not configured" });
  const { registerNo, email, newPassword } = req.body;

  const { data, error } = await supabase.rpc("reset_student_password", {
    p_register_no: registerNo,
    p_email: email,
    p_new_password: newPassword,
  });

  if (error) return res.status(400).json({ error: error.message });
  return res.json({ success: !!data, data });
});

// 5. Profile: Ensure Profile Row
app.post("/api/profiles/ensure", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase client not configured" });
  const { uid, meta } = req.body;

  const { error } = await supabase.from("profiles").upsert(
    {
      id: uid,
      name: meta.name ?? "",
      section: meta.section ?? null,
      department: meta.department ?? "",
      domain: meta.domain ?? null,
      language: meta.language ?? null,
      gender: meta.gender ?? "",
      github: meta.github ?? null,
      phone: meta.phone ?? "",
      email: meta.email ?? "",
      tech_stack: Array.isArray(meta.tech_stack) ? meta.tech_stack : [],
      role: meta.role ?? "student",
      register_no: meta.register_no ?? null,
      year: meta.year ?? null,
      languages: Array.isArray(meta.languages) ? meta.languages : [],
      linkedin: meta.linkedin ?? null,
      project_type: meta.project_type ?? null,
      project_title: meta.project_title ?? null,
      project_description: meta.project_description ?? null,
      youtube_link: meta.youtube_link ?? null,
      google_drive_ppt: meta.google_drive_ppt ?? null,
      software_domain: meta.software_domain ?? null,
      hardware_domain: meta.hardware_domain ?? null,
      domain_interests: Array.isArray(meta.domain_interests) ? meta.domain_interests : [],
      github_repo: meta.github_repo ?? null,
      resume_link: meta.resume_link ?? null,
      sih_participant: meta.sih_participant ?? false,
      sih_num_participations: meta.sih_num_participations ?? null,
      sih_participation_year: meta.sih_participation_year ?? null,
      sih_problem_statement: meta.sih_problem_statement ?? null,
      sih_project_domain: meta.sih_project_domain ?? null,
      sih_project_role: meta.sih_project_role ?? null,
      sih_position_reached: meta.sih_position_reached ?? null,
      sih_nodal_center: meta.sih_nodal_center ?? null,
      sih_history: Array.isArray(meta.sih_history) ? meta.sih_history : [],
      category: meta.category ?? "Pairs",
    },
    { onConflict: "id" }
  );

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ success: true });
});

// 6. Profile: Update Profile
app.put("/api/profiles/me", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase client not configured" });
  const { uid, profileData } = req.body;

  const { error } = await supabase.from("profiles").update(profileData).eq("id", uid);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ success: true });
});

// 6b. Profile: Update Category by Mentor or User
app.put("/api/profiles/:id/category", async (req, res) => {
  const { id } = req.params;
  const { category } = req.body;
  if (!["Solo", "Pairs"].includes(category)) {
    return res.status(400).json({ error: "Category must be Solo or Pairs" });
  }

  try {
    if (supabase) {
      await supabase.from("profiles").update({ category }).eq("id", id);
    }
    try {
      await dbQuery(`UPDATE public.profiles SET category = $1 WHERE id = $2;`, [category, id]);
    } catch (_e) {
      // Ignore if table column not yet created in PostgreSQL fallback
    }
    return res.json({ success: true, category });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 7. Profile: Update Avatar URL
app.post("/api/profiles/avatar", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase client not configured" });
  const { uid, url } = req.body;

  const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", uid);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ success: true });
});

// 8. Profiles: Search Profiles
app.get("/api/profiles/search", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase client not configured" });
  const { excludeId, stack, q } = req.query;

  let query = supabase.from("profiles").select("*").order("name");
  if (excludeId) query = query.neq("id", excludeId);
  if (stack) query = query.contains("tech_stack", [stack]);
  if (q) query = query.or(`name.ilike.%${q}%,department.ilike.%${q}%,section.ilike.%${q}%,language.ilike.%${q}%`);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ data: data ?? [] });
});

// 9. Teams: Fetch Enriched Teams
app.get("/api/teams", async (_req, res) => {
  try {
    let teams = [], members = [], profiles = [];

    if (process.env.DATABASE_URL) {
      try {
        const [tRes, mRes, pRes] = await Promise.all([
          dbQuery(`SELECT * FROM public.teams ORDER BY created_at ASC;`),
          dbQuery(`SELECT * FROM public.team_members;`),
          dbQuery(`SELECT * FROM public.profiles;`),
        ]);
        teams = tRes.rows || [];
        members = mRes.rows || [];
        profiles = pRes.rows || [];
      } catch (_e) {
        // Fallback to Supabase if dbQuery query fails
      }
    }

    if (teams.length === 0 && supabase) {
      const [{ data: tData }, { data: mData }, { data: pData }] = await Promise.all([
        supabase.from("teams").select("*").order("created_at", { ascending: true }),
        supabase.from("team_members").select("*"),
        supabase.from("profiles").select("*"),
      ]);
      teams = tData || [];
      members = mData || [];
      profiles = pData || [];
    }

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
    const enriched = (teams || []).map((team) => {
      const teamMembers = (members || []).filter((m) => m.team_id === team.id);
      const memberProfiles = teamMembers.map((m) => {
        const profile = profileMap.get(m.member_id);
        if (!profile) return null;
        // Attach the mentor-assigned skill to the profile object
        return { ...profile, assigned_skill: m.assigned_skill ?? null };
      }).filter(Boolean);
      const leader = profileMap.get(team.leader_id) ?? null;
      const cat = team.category || (memberProfiles.length === 1 ? "Solo" : "Pairs");
      return {
        team,
        leader,
        members: memberProfiles,
        stats: computeStats(memberProfiles, cat),
      };
    });

    return res.json({ data: enriched });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Dept code map — mirrors DEPT_CODE on the frontend
const DEPT_CODE_MAP = {
  "computer science and engineering": "CSE",
  "information technology": "IT",
  "artificial intelligence and data science": "AI&DS",
  "civil engineering": "CIVIL",
  "mechanical engineering": "MECH",
  "instrumentation and control engineering": "ICE",
  "computer science and engineering and business systems": "CSEBS",
  "computer and communication engineering": "CCE",
  "mechatronics": "MCTR",
  "electrical and electronics engineering": "EEE",
  "electronics and communication engineering": "ECE",
  "biomedical engineering": "BME",
  "master of computer applications": "MCA",
  "master of business administration": "MBA",
};

// Normalize abbreviations/aliases to canonical full dept name
const DEPT_ABBREV_TO_CANONICAL = {
  "ai & ds":   "Artificial Intelligence and Data Science",
  "ai&ds":     "Artificial Intelligence and Data Science",
  "civil":     "Civil Engineering",
  "cse":       "Computer Science and Engineering",
  "csbs":      "Computer Science and Engineering and Business Systems",
  "csebs":     "Computer Science and Engineering and Business Systems",
  "it":        "Information Technology",
  "ece":       "Electronics and Communication Engineering",
  "eee":       "Electrical and Electronics Engineering",
  "mech":      "Mechanical Engineering",
  "ice":       "Instrumentation and Control Engineering",
  "i&ce":      "Instrumentation and Control Engineering",
  "cce":       "Computer and Communication Engineering",
  "mctr":      "Mechatronics",
  "mct":       "Mechatronics",
  "bme":       "BioMedical Engineering",
  "mca":       "Master of Computer Applications",
  "mba":       "Master of Business Administration",
};

function canonicalizeDept(raw) {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();
  // Already a canonical full name?
  if (DEPT_CODE_MAP[lower]) return raw.trim();
  // Abbreviation?
  return DEPT_ABBREV_TO_CANONICAL[lower] ?? raw.trim();
}

function getDeptCode(deptName) {
  if (!deptName) return "TEAM";
  const canonical = canonicalizeDept(deptName);
  return DEPT_CODE_MAP[canonical?.toLowerCase().trim() ?? ""]
    ?? (canonical ?? deptName).replace(/\s+/g, "").toUpperCase().slice(0, 8);
}

// Build a sequential team_code like "AI&DS#003" or "AI&DS-SOLO#001"
async function generateTeamCode(category, created_by_dept) {
  const canonical = canonicalizeDept(created_by_dept) || created_by_dept;
  const deptCode = getDeptCode(canonical);
  const prefix = category === "Solo" ? `${deptCode}-SOLO#` : `${deptCode}#`;

  let count = 0;
  if (process.env.DATABASE_URL) {
    try {
      // Count all teams for this canonical dept (handles both full name and abbreviation variants)
      const { rows } = await dbQuery(
        `SELECT COUNT(*) AS cnt FROM public.teams WHERE created_by_dept ILIKE $1;`,
        [canonical || ""]
      );
      count = parseInt(rows[0]?.cnt ?? "0", 10);
    } catch (_) { /* ignore — fall back to 0 */ }
  } else if (supabase) {
    try {
      const { count: cnt } = await supabase
        .from("teams")
        .select("*", { count: "exact", head: true })
        .ilike("created_by_dept", canonical || "");
      count = cnt ?? 0;
    } catch (_) { /* ignore */ }
  }

  return `${prefix}${String(count + 1).padStart(3, "0")}`;
}

// Create Empty Team by Mentor
app.post("/api/teams/empty", async (req, res) => {
  const { name, category, created_by_dept } = req.body;
  try {
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Team name is required." });
    }

    // Always store the canonical full dept name
    const canonicalDept = canonicalizeDept(created_by_dept) || created_by_dept || null;
    const teamCode = await generateTeamCode(category || "Pairs", canonicalDept);
    let createdRecord = null;

    if (process.env.DATABASE_URL) {
      try {
        const { rows } = await dbQuery(
          `INSERT INTO public.teams (name, team_code, approved, category, created_by_dept) VALUES ($1, $2, false, $3, $4) RETURNING *;`,
          [name.trim(), teamCode, category || "Pairs", canonicalDept]
        );
        createdRecord = rows[0];
      } catch (_err) {
        // Fallback: columns may not all exist yet
        const { rows } = await dbQuery(
          `INSERT INTO public.teams (name, approved) VALUES ($1, false) RETURNING *;`,
          [name.trim()]
        );
        createdRecord = rows[0];
      }
    }

    if (supabase) {
      try {
        const { data } = await supabase
          .from("teams")
          .insert([{ name: name.trim(), team_code: teamCode, approved: false, category: category || "Pairs", created_by_dept: canonicalDept }])
          .select("*")
          .single();
        if (data) createdRecord = data;
      } catch (_err) {
        const { data } = await supabase
          .from("teams")
          .insert([{ name: name.trim(), approved: false }])
          .select("*")
          .single();
        if (data) createdRecord = data;
      }
    }

    return res.json({ data: createdRecord, error: null });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── Backfill team_codes for existing teams ────────────────────────────────
// POST /api/admin/backfill-team-codes
// Assigns a proper dept-based team_code to every team that either:
//   - has no team_code at all, or
//   - has an old generic SIH… code (pre-migration)
// Department is resolved from created_by_dept first, then inferred from members.
// Sequential numbering is per-department ordered by team id (creation order).
app.post("/api/admin/backfill-team-codes", async (req, res) => {
  try {
    let teams = [];

    // Fetch all teams together with their member departments
    if (process.env.DATABASE_URL) {
      const { rows } = await dbQuery(`
        SELECT
          t.id,
          t.name,
          t.category,
          t.created_by_dept,
          t.team_code,
          ARRAY_AGG(p.department) FILTER (WHERE p.department IS NOT NULL) AS member_depts
        FROM public.teams t
        LEFT JOIN public.team_members tm ON tm.team_id = t.id
        LEFT JOIN public.profiles p ON p.id = tm.member_id
        GROUP BY t.id
        ORDER BY t.id;
      `);
      teams = rows;
    } else if (supabase) {
      // Supabase: fetch teams + members in two queries
      const { data: teamRows } = await supabase
        .from("teams")
        .select("id, name, category, created_by_dept, team_code")
        .order("id");
      const { data: memberRows } = await supabase
        .from("team_members")
        .select("team_id, profiles(department)");
      const memberDeptMap = {};
      for (const mr of memberRows || []) {
        if (!memberDeptMap[mr.team_id]) memberDeptMap[mr.team_id] = [];
        if (mr.profiles?.department) memberDeptMap[mr.team_id].push(mr.profiles.department);
      }
      teams = (teamRows || []).map((t) => ({
        ...t,
        member_depts: memberDeptMap[t.id] || [],
      }));
    }

    if (!teams.length) {
      return res.json({ updated: 0, skipped: 0, message: "No teams found." });
    }

    // Resolve department for each team
    const resolved = teams.map((t) => {
      let dept = t.created_by_dept?.trim() || null;
      if (!dept && t.member_depts?.length > 0) {
        // Pick the most common member dept
        const freq = {};
        for (const d of t.member_depts) freq[d] = (freq[d] || 0) + 1;
        dept = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
      }
      return { ...t, resolved_dept: dept };
    });

    // Group by resolved dept and sort each group by id (creation order)
    const byDept = {};
    const unresolvable = [];
    for (const t of resolved) {
      if (!t.resolved_dept) { unresolvable.push(t); continue; }
      const key = t.resolved_dept.toLowerCase().trim();
      if (!byDept[key]) byDept[key] = { dept: t.resolved_dept, teams: [] };
      byDept[key].teams.push(t);
    }
    for (const g of Object.values(byDept)) {
      g.teams.sort((a, b) => (a.id > b.id ? 1 : -1));
    }

    // Build update list — only for teams missing/stale team_code
    const updates = [];
    for (const { dept, teams: deptTeams } of Object.values(byDept)) {
      const deptCode = getDeptCode(dept);
      let seq = 1;
      for (const t of deptTeams) {
        const category = t.category || "Pairs";
        const prefix = category.toLowerCase() === "solo"
          ? `${deptCode}-SOLO#`
          : `${deptCode}#`;
        const newCode = `${prefix}${String(seq).padStart(3, "0")}`;
        seq++;

        const needsUpdate =
          !t.team_code ||
          t.team_code.trim() === "" ||
          /^SIH/i.test(t.team_code);  // old trigger-generated codes

        if (needsUpdate) {
          updates.push({ id: t.id, team_code: newCode, created_by_dept: dept });
        }
      }
    }

    // Apply updates
    let updatedCount = 0;
    for (const upd of updates) {
      if (process.env.DATABASE_URL) {
        await dbQuery(
          `UPDATE public.teams SET team_code = $1, created_by_dept = COALESCE(created_by_dept, $2) WHERE id = $3;`,
          [upd.team_code, upd.created_by_dept, upd.id]
        );
      } else if (supabase) {
        await supabase
          .from("teams")
          .update({ team_code: upd.team_code, created_by_dept: upd.created_by_dept })
          .eq("id", upd.id);
      }
      updatedCount++;
    }

    return res.json({
      updated: updatedCount,
      skipped: unresolvable.length,
      unresolvable: unresolvable.map((t) => ({ id: t.id, name: t.name })),
      message: `Backfilled ${updatedCount} team codes. ${unresolvable.length} teams could not be resolved (no dept, no members).`,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Delete Member from Team
app.delete("/api/teams/:teamId/members/:memberId", async (req, res) => {
  const { teamId, memberId } = req.params;
  try {
    if (process.env.DATABASE_URL) {
      await dbQuery(
        `DELETE FROM public.team_members WHERE team_id = $1 AND member_id = $2;`,
        [teamId, memberId]
      );
      const { rows: teamRows } = await dbQuery(
        `SELECT leader_id FROM public.teams WHERE id = $1;`,
        [teamId]
      );
      if (teamRows.length > 0 && teamRows[0].leader_id === memberId) {
        const { rows: rem } = await dbQuery(
          `SELECT member_id FROM public.team_members WHERE team_id = $1 LIMIT 1;`,
          [teamId]
        );
        const nextLeaderId = rem.length > 0 ? rem[0].member_id : null;
        await dbQuery(
          `UPDATE public.teams SET leader_id = $1 WHERE id = $2;`,
          [nextLeaderId, teamId]
        );
      }
    }

    if (supabase) {
      await supabase.from("team_members").delete().eq("team_id", teamId).eq("member_id", memberId);
      const { data: tData } = await supabase.from("teams").select("leader_id").eq("id", teamId).single();
      if (tData && tData.leader_id === memberId) {
        const { data: rem } = await supabase.from("team_members").select("member_id").eq("team_id", teamId).limit(1);
        const nextLeaderId = rem && rem.length > 0 ? rem[0].member_id : null;
        await supabase.from("teams").update({ leader_id: nextLeaderId }).eq("id", teamId);
      }
    }

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Add Member to Team
app.post("/api/teams/:teamId/members", async (req, res) => {
  const { teamId } = req.params;
  const { memberId } = req.body;
  try {
    if (process.env.DATABASE_URL) {
      await dbQuery(
        `INSERT INTO public.team_members (team_id, member_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
        [teamId, memberId]
      );
      const { rows: teamRows } = await dbQuery(
        `SELECT leader_id FROM public.teams WHERE id = $1;`,
        [teamId]
      );
      if (teamRows.length > 0 && !teamRows[0].leader_id) {
        await dbQuery(
          `UPDATE public.teams SET leader_id = $1 WHERE id = $2;`,
          [memberId, teamId]
        );
      }
    }

    if (supabase) {
      await supabase.from("team_members").insert([{ team_id: teamId, member_id: memberId }]);
      const { data: tData } = await supabase.from("teams").select("leader_id").eq("id", teamId).single();
      if (tData && !tData.leader_id) {
        await supabase.from("teams").update({ leader_id: memberId }).eq("id", teamId);
      }
    }

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Assign Skill to Team Member (Mentor)
app.put("/api/teams/:teamId/members/:memberId/skill", async (req, res) => {
  const { teamId, memberId } = req.params;
  const { skill } = req.body;

  try {
    // Validate: for Pairs teams, the same skill cannot be assigned to both members
    if (skill) {
      let otherMembers = [];
      if (process.env.DATABASE_URL) {
        const { rows } = await dbQuery(
          `SELECT tm.member_id, tm.assigned_skill
           FROM public.team_members tm
           WHERE tm.team_id = $1 AND tm.member_id != $2 AND tm.assigned_skill IS NOT NULL;`,
          [teamId, memberId]
        );
        otherMembers = rows;
      } else if (supabase) {
        const { data } = await supabase
          .from("team_members")
          .select("member_id, assigned_skill")
          .eq("team_id", teamId)
          .neq("member_id", memberId)
          .not("assigned_skill", "is", null);
        otherMembers = data || [];
      }

      const conflict = otherMembers.find(
        (m) => m.assigned_skill && m.assigned_skill.toLowerCase() === skill.toLowerCase()
      );
      if (conflict) {
        return res.status(400).json({
          error: `Skill conflict: "${skill}" is already assigned to another member of this team. Each member must have a unique skill.`,
        });
      }
    }

    // Apply the skill assignment
    if (process.env.DATABASE_URL) {
      await dbQuery(
        `UPDATE public.team_members SET assigned_skill = $1 WHERE team_id = $2 AND member_id = $3;`,
        [skill || null, teamId, memberId]
      );
    }
    if (supabase) {
      await supabase
        .from("team_members")
        .update({ assigned_skill: skill || null })
        .eq("team_id", teamId)
        .eq("member_id", memberId);
    }

    return res.json({ success: true, assigned_skill: skill || null });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Assign Ministry to Team (sets ministry for the whole team — Pairs share one ministry)
app.put("/api/teams/:teamId/ministry", async (req, res) => {
  const { teamId } = req.params;
  const { ministry } = req.body;

  try {
    // Enforce per-ministry per-department cap of 6 members
    if (ministry) {
      // Get members of THIS team with their departments
      let currentTeamMembers = [];
      if (process.env.DATABASE_URL) {
        const { rows } = await dbQuery(
          `SELECT p.department FROM public.team_members tm
           JOIN public.profiles p ON p.id = tm.member_id
           WHERE tm.team_id = $1;`,
          [teamId]
        );
        currentTeamMembers = rows;
      } else if (supabase) {
        // Fetch member IDs, then profiles separately to avoid relational query issues
        const { data: tmData } = await supabase
          .from("team_members")
          .select("member_id")
          .eq("team_id", teamId);
        if (tmData && tmData.length > 0) {
          const memberIds = tmData.map((r) => r.member_id);
          const { data: pData } = await supabase
            .from("profiles")
            .select("id, department")
            .in("id", memberIds);
          currentTeamMembers = (pData || []).map((p) => ({ department: p.department }));
        }
      }

      // For each unique department in this team, count existing members in this ministry
      const depts = [...new Set(currentTeamMembers.map((m) => m.department).filter(Boolean))];

      for (const dept of depts) {
        let existingCount = 0;
        if (process.env.DATABASE_URL) {
          const { rows } = await dbQuery(
            `SELECT COUNT(*)::int AS cnt
             FROM public.team_members tm
             JOIN public.teams t ON t.id = tm.team_id
             JOIN public.profiles p ON p.id = tm.member_id
             WHERE t.ministry = $1 AND t.id != $2 AND p.department = $3;`,
            [ministry, teamId, dept]
          );
          existingCount = rows[0]?.cnt || 0;
        } else if (supabase) {
          // Get teams with this ministry (excluding current)
          const { data: ministryTeams } = await supabase
            .from("teams")
            .select("id")
            .eq("ministry", ministry)
            .neq("id", teamId);

          if (ministryTeams && ministryTeams.length > 0) {
            const ministryTeamIds = ministryTeams.map((t) => t.id);
            const { data: mData } = await supabase
              .from("team_members")
              .select("member_id")
              .in("team_id", ministryTeamIds);

            if (mData && mData.length > 0) {
              const memberIds = mData.map((r) => r.member_id);
              const { data: pData } = await supabase
                .from("profiles")
                .select("id")
                .in("id", memberIds)
                .eq("department", dept);
              existingCount = pData?.length || 0;
            }
          }
        }

        // Count how many from this team belong to this dept
        const teamDeptCount = currentTeamMembers.filter((m) => m.department === dept).length;
        if (existingCount + teamDeptCount > 6) {
          return res.status(400).json({
            error: `Ministry cap exceeded: "${dept}" already has ${existingCount} member(s) under "${ministry}". Adding ${teamDeptCount} more would exceed the maximum of 6 per department per ministry.`,
          });
        }
      }
    }

    // Save ministry on the team
    if (process.env.DATABASE_URL) {
      await dbQuery(
        `UPDATE public.teams SET ministry = $1 WHERE id = $2;`,
        [ministry || null, teamId]
      );
    }
    if (supabase) {
      await supabase.from("teams").update({ ministry: ministry || null }).eq("id", teamId);
    }

    return res.json({ success: true, ministry: ministry || null });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Rename Team (Mentor — own department only, enforced client-side)
app.put("/api/teams/:teamId/name", async (req, res) => {
  const { teamId } = req.params;
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Team name cannot be empty." });
  }
  try {
    if (process.env.DATABASE_URL) {
      await dbQuery(
        `UPDATE public.teams SET name = $1 WHERE id = $2;`,
        [name.trim(), teamId]
      );
    }
    if (supabase) {
      await supabase.from("teams").update({ name: name.trim() }).eq("id", teamId);
    }
    return res.json({ success: true, name: name.trim() });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Delete Empty Team (Mentors and Admins)
app.delete("/api/teams/:id", async (req, res) => {
  const { id } = req.params;
  try {
    if (process.env.DATABASE_URL) {
      const { rows: members } = await dbQuery(
        `SELECT id FROM public.team_members WHERE team_id = $1;`,
        [id]
      );
      if (members && members.length > 0) {
        return res.status(400).json({ error: "Cannot delete team with active members. Remove all members first." });
      }
      await dbQuery(`UPDATE public.teams SET leader_id = NULL WHERE id = $1;`, [id]);
      await dbQuery(`DELETE FROM public.invites WHERE team_id = $1;`, [id]);
      await dbQuery(`DELETE FROM public.team_members WHERE team_id = $1;`, [id]);
      await dbQuery(`DELETE FROM public.teams WHERE id = $1;`, [id]);
    }

    if (supabase) {
      const { data: members } = await supabase.from("team_members").select("id").eq("team_id", id);
      if (members && members.length > 0) {
        return res.status(400).json({ error: "Cannot delete team with active members. Remove all members first." });
      }
      await supabase.from("teams").update({ leader_id: null }).eq("id", id);
      await supabase.from("team_members").delete().eq("team_id", id);
      await supabase.from("teams").delete().eq("id", id);
    }

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 10. Teams: Execute Team RPCs (create_team, send_invite, accept_invite, leave_team, etc.)
app.post("/api/rpc", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase client not configured" });
  const { name, params } = req.body;

  const { data, error } = await supabase.rpc(name, params);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ data: data ?? true });
});

// 11. Invites: Fetch User Invites
app.get("/api/teams/invites", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase client not configured" });
  const { uid } = req.query;

  const { data: all, error } = await supabase.from("invites").select("*").eq("status", "pending").order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  const invites = all ?? [];
  return res.json({
    incoming: invites.filter((i) => i.invitee_id === uid),
    sent: invites.filter((i) => i.sender_id === uid),
  });
});

// 12. Queries & Lookups
app.get("/api/problems", async (_req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase client not configured" });
  const { data, error } = await supabase.from("problems").select("*").order("title");
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ data: data ?? [] });
});

app.get("/api/themes", async (_req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase client not configured" });
  const { data, error } = await supabase.from("themes").select("*").order("name");
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ data: data ?? [] });
});

app.get("/api/timeline", async (_req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase client not configured" });
  const { data, error } = await supabase.from("timeline_events").select("*").order("sort_order", { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ data: data ?? [] });
});

app.get("/api/announcements", async (_req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase client not configured" });
  const { data, error } = await supabase.from("announcements").select("*").order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ data: data ?? [] });
});

app.get("/api/lookup/email-by-regno", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase client not configured" });
  const { registerNo } = req.query;
  const { data, error } = await supabase.from("profiles").select("email").ilike("register_no", (registerNo || "").trim()).maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ email: data?.email ?? null });
});

app.get("/api/lookup/email-by-phone", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase client not configured" });
  const { phone } = req.query;
  const { data, error } = await supabase.from("profiles").select("email").eq("phone", (phone || "").trim()).eq("role", "mentor").maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ email: data?.email ?? null });
});

app.get("/api/lookup/check-regno", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase client not configured" });
  const { registerNo } = req.query;
  const { data, error } = await supabase.from("profiles").select("id").ilike("register_no", (registerNo || "").trim()).maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ exists: !!data });
});

app.get("/api/lookup/check-email", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase client not configured" });
  const { email } = req.query;
  const { data, error } = await supabase.from("profiles").select("id").ilike("email", (email || "").trim()).maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ exists: !!data });
});

app.get("/api/lookup/check-phone", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase client not configured" });
  const { phone } = req.query;
  const { data, error } = await supabase.from("profiles").select("id").eq("phone", (phone || "").trim()).maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ exists: !!data });
});

// Helper for computing registration status
function computeRegistrationStatus(setting) {
  const manualStatus = setting?.manual_status ?? "open";
  const closingDate = setting?.closing_date ? new Date(setting.closing_date) : null;
  const now = new Date();

  let isExpired = false;
  if (closingDate && !isNaN(closingDate.getTime())) {
    if (now >= closingDate) {
      isExpired = true;
    }
  }

  const isOpen = manualStatus === "open" && !isExpired;

  return {
    manual_status: manualStatus,
    closing_date: setting?.closing_date || null,
    closing_message: setting?.closing_message || "Registration for SIH Internal Hackathon 2026 is currently closed.",
    is_open: isOpen,
    is_expired: isExpired
  };
}

app.get("/api/settings/registration", async (_req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase client not configured" });
  try {
    const { data, error } = await supabase
      .from("system_settings")
      .select("*")
      .eq("key", "registration_control")
      .maybeSingle();

    if (error && !error.message.includes("does not exist")) {
      return res.status(500).json({ error: error.message });
    }

    const value = data?.value || { manual_status: "open", closing_date: null };
    return res.json({ data: computeRegistrationStatus(value) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Serve static build if present
const distFolder = join(__dirname, "dist");
const indexHtmlFile = join(distFolder, "index.html");

if (existsSync(distFolder)) {
  app.use(express.static(distFolder));
}

app.get("*", (_req, res) => {
  if (existsSync(indexHtmlFile)) {
    return res.sendFile(indexHtmlFile);
  }

  res.status(200).send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Participant Mentor Backend API Server</title>
      <style>
        body { font-family: system-ui, sans-serif; background: #09090b; color: #f4f4f5; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
        .card { text-align: center; max-width: 480px; padding: 2.5rem; border: 1px solid #27272a; border-radius: 1rem; background: #121215; }
        .badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px; background: rgba(34, 197, 94, 0.1); color: #22c55e; border: 1px solid rgba(34, 197, 94, 0.3); font-size: 0.75rem; font-weight: 700; text-transform: uppercase; margin-bottom: 1rem; }
        h1 { font-size: 1.75rem; font-weight: 800; margin: 0 0 0.5rem 0; color: #ffffff; }
        p { color: #a1a1aa; font-size: 0.9rem; line-height: 1.5; margin: 0 0 1.25rem 0; }
        a { color: #38bdf8; text-decoration: none; font-weight: 600; }
      </style>
    </head>
    <body>
      <div class="card">
        <span class="badge">Backend Active</span>
        <h1>Participant Mentor REST API Server Active</h1>
        <p>Express server accepting API requests on port <code>${PORT}</code>.</p>
        <p><a href="/api/health">Check Health Status (/api/health) →</a></p>
      </div>
    </body>
    </html>
  `);
});

// Run migrations and then start listener
async function startServer() {
  try {
    await runMigrations();
  } catch (err) {
    console.error("Critical database migration failure. Continuing startup...", err);
  }

  app.listen(PORT, () => {
    console.log(`Participant Mentor Backend Server running on port ${PORT}`);
  });
}

startServer();
