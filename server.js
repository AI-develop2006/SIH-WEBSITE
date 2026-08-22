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
const PORT = process.env.PORT || 3001;

// Enable JSON request body parsing
app.use(express.json());

// Initialize Supabase backend client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

// Helper function to calculate team stats
function computeStats(members = []) {
  const RULES = { MAX_MEMBERS: 6, MIN_GIRLS: 2, MIN_DEPTS: 2 };
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

// Allowed CORS origins
const allowedOrigins = [
  "https://sih-website-h8ajvlchv-srimaansrimaan543-2911s-projects.vercel.app",
  "https://sih-website-101h.onrender.com",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
  "http://localhost:3001",
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()) : [])
];

// CORS Middleware enforcing allowed frontend origin
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const isAllowed =
    !origin ||
    allowedOrigins.includes(origin) ||
    allowedOrigins.includes("*") ||
    (origin && origin.endsWith(".vercel.app"));

  if (isAllowed) {
    res.header("Access-Control-Allow-Origin", origin || "*");
  } else {
    res.header("Access-Control-Allow-Origin", "https://sih-website-h8ajvlchv-srimaansrimaan543-2911s-projects.vercel.app");
  }
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Trust proxy headers when deployed
app.set("trust proxy", true);

// WAF IP Whitelist Middleware
const allowedIpsEnv = process.env.ALLOWED_IPS || "";
const allowedIps = allowedIpsEnv
  .split(",")
  .map((ip) => ip.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  if (allowedIps.length === 0 || allowedIps.includes("*")) {
    return next();
  }

  const cfIp = req.headers["cf-connecting-ip"];
  const forwardedFor = req.headers["x-forwarded-for"];
  const rawIp = (typeof cfIp === "string" && cfIp.trim())
    ? cfIp.trim()
    : (forwardedFor ? forwardedFor.split(",")[0].trim() : req.socket.remoteAddress || req.ip || "");

  const clientIp = rawIp.replace(/^::ffff:/, "");

  const isAllowed = allowedIps.some((allowed) => {
    if (allowed === clientIp || allowed === rawIp) return true;
    if ((allowed === "127.0.0.1" || allowed === "localhost") && (clientIp === "::1" || clientIp === "127.0.0.1")) {
      return true;
    }
    return false;
  });

  if (!isAllowed) {
    console.warn(`[WAF Access Blocked] IP: ${clientIp} on route: ${req.originalUrl}`);
    return res.status(403).json({ error: "403 Forbidden: Access Restricted" });
  }

  next();
});

// Health check endpoints
app.get(["/health", "/api/health"], (_req, res) => {
  res.json({
    status: "ok",
    service: "admin-backend",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ==========================================
// REST API ENDPOINTS FOR ADMIN OPERATIONS
// ==========================================

// 1. Auth Login
app.post("/api/auth/login", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase client not configured in backend" });
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });

  try {
    const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) return res.status(401).json({ error: signInError.message });

    const user = authData.user;
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) return res.status(403).json({ error: "Profile not found" });
    if (profile.role !== "admin") return res.status(403).json({ error: "Access denied. Admin role required." });

    return res.json({ session: authData.session, user, profile });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 2. Get Current Auth Status
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

// 3. Fetch All Student Profiles
app.get("/api/profiles", async (_req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase client not configured" });
  const { data, error } = await supabase.from("profiles").select("*").order("name");
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ data: data ?? [] });
});

// 3b. Update Profile (Admin)
app.patch("/api/profiles/:id", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase client not configured" });
  const { id } = req.params;
  const patch = req.body;

  if (!patch || Object.keys(patch).length === 0) {
    return res.status(400).json({ error: "No fields provided" });
  }

  const { error } = await supabase.from("profiles").update(patch).eq("id", id);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ success: true });
});

// 3c. Toggle Verified on Profile (Admin)
app.post("/api/profiles/:id/verify", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase client not configured" });
  const { id } = req.params;
  const { verified } = req.body;

  const { error } = await supabase.from("profiles").update({ verified: !!verified }).eq("id", id);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ success: true });
});

// 3d. Delete Profile (Admin)
app.delete("/api/profiles/:id", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase client not configured" });
  const { id } = req.params;

  // Remove from any teams first
  const { data: memberships } = await supabase.from("team_members").select("team_id").eq("member_id", id);
  if (memberships?.length) {
    await supabase.from("team_members").delete().eq("member_id", id);
    // Re-assign leaders where needed
    for (const { team_id } of memberships) {
      const { data: team } = await supabase.from("teams").select("leader_id").eq("id", team_id).single();
      if (team?.leader_id === id) {
        const { data: rem } = await supabase.from("team_members").select("member_id").eq("team_id", team_id).limit(1);
        await supabase.from("teams").update({ leader_id: rem?.[0]?.member_id ?? null }).eq("id", team_id);
      }
    }
  }

  const { error } = await supabase.from("profiles").delete().eq("id", id);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ success: true });
});

// 4. Fetch Enriched Teams List
app.get("/api/teams", async (_req, res) => {
  try {
    let teams = [], members = [], profiles = [];

    if (process.env.DATABASE_URL) {
      const [tRes, mRes, pRes] = await Promise.all([
        dbQuery(`SELECT * FROM public.teams ORDER BY created_at ASC;`),
        dbQuery(`SELECT * FROM public.team_members;`),
        dbQuery(`SELECT * FROM public.profiles;`),
      ]);
      teams = tRes.rows;
      members = mRes.rows;
      profiles = pRes.rows;
    } else if (supabase) {
      const [{ data: t, error: e1 }, { data: m, error: e2 }, { data: p, error: e3 }] =
        await Promise.all([
          supabase.from("teams").select("*").order("created_at", { ascending: true }),
          supabase.from("team_members").select("*"),
          supabase.from("profiles").select("*"),
        ]);
      if (e1 || e2 || e3) return res.status(500).json({ error: (e1 || e2 || e3).message });
      teams = t || []; members = m || []; profiles = p || [];
    } else {
      return res.status(500).json({ error: "No database connection configured" });
    }

    const profileMap = new Map(profiles.map((p) => [p.id, p]));
    const enriched = teams.map((team) => {
      const teamMembers = members.filter((m) => m.team_id === team.id);
      // Merge assigned_skill from team_members row into the profile object.
      // assigned_skill lives on team_members, not profiles, so it must be
      // explicitly carried over — otherwise it's silently dropped.
      const memberProfiles = teamMembers
        .map((m) => {
          const profile = profileMap.get(m.member_id);
          if (!profile) return null;
          return { ...profile, assigned_skill: m.assigned_skill ?? null };
        })
        .filter(Boolean);
      const leader = profileMap.get(team.leader_id) ?? null;
      return {
        team,
        leader,
        members: memberProfiles,
        stats: computeStats(memberProfiles),
      };
    });

    return res.json({ data: enriched });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 5. Toggle Team Approval
app.post("/api/teams/:id/toggle-approval", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase client not configured" });
  const { id } = req.params;
  const { approved } = req.body;

  const { error } = await supabase.rpc("toggle_team_approval", { p_team_id: id, p_approved: approved });
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ success: true });
});

// 6. Create Team (Admin)
app.post("/api/teams", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase client not configured" });
  const { name, category, ministry, problem_id } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "Team name is required" });

  const { data, error } = await supabase
    .from("teams")
    .insert([{
      name: name.trim(),
      category: category || "Pairs",
      ministry: ministry || null,
      problem_id: problem_id || null,
      approved: false,
    }])
    .select("*")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ data });
});

// 6b. Update Team (Admin) — name, ministry, problem_id, category, approved
app.patch("/api/teams/:id", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase client not configured" });
  const { id } = req.params;
  const { name, ministry, problem_id, category, approved } = req.body;

  const patch = {};
  if (name !== undefined) patch.name = name?.trim() || null;
  if (ministry !== undefined) patch.ministry = ministry || null;
  if (problem_id !== undefined) patch.problem_id = problem_id || null;
  if (category !== undefined) patch.category = category;
  if (approved !== undefined) patch.approved = approved;

  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }

  const { error } = await supabase.from("teams").update(patch).eq("id", id);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ success: true });
});

// 6c. Add Member to Team (Admin — force, bypasses capacity checks)
app.post("/api/teams/:id/members", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase client not configured" });
  const { id } = req.params;
  const { member_id } = req.body;
  if (!member_id) return res.status(400).json({ error: "member_id is required" });

  const { error } = await supabase
    .from("team_members")
    .upsert([{ team_id: id, member_id }], { onConflict: "team_id,member_id" });
  if (error) return res.status(500).json({ error: error.message });

  // Set as leader if no leader yet
  const { data: team } = await supabase.from("teams").select("leader_id").eq("id", id).single();
  if (team && !team.leader_id) {
    await supabase.from("teams").update({ leader_id: member_id }).eq("id", id);
  }
  return res.json({ success: true });
});

// 6d. Remove Member from Team (Admin)
app.delete("/api/teams/:id/members/:memberId", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase client not configured" });
  const { id, memberId } = req.params;

  const { error } = await supabase
    .from("team_members")
    .delete()
    .eq("team_id", id)
    .eq("member_id", memberId);
  if (error) return res.status(500).json({ error: error.message });

  // Re-assign leader if removed member was leader
  const { data: team } = await supabase.from("teams").select("leader_id").eq("id", id).single();
  if (team && team.leader_id === memberId) {
    const { data: remaining } = await supabase.from("team_members").select("member_id").eq("team_id", id).limit(1);
    const nextLeader = remaining?.[0]?.member_id ?? null;
    await supabase.from("teams").update({ leader_id: nextLeader }).eq("id", id);
  }
  return res.json({ success: true });
});

// 6e. Assign Ministry to Team (Admin — bypasses cap)
app.put("/api/teams/:id/ministry", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase client not configured" });
  const { id } = req.params;
  const { ministry } = req.body;

  const { error } = await supabase.from("teams").update({ ministry: ministry || null }).eq("id", id);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ success: true });
});

// 6f. Assign Skill to Team Member (Admin)
app.put("/api/teams/:id/members/:memberId/skill", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase client not configured" });
  const { id, memberId } = req.params;
  const { skill } = req.body;

  const { error } = await supabase
    .from("team_members")
    .update({ assigned_skill: skill || null })
    .eq("team_id", id)
    .eq("member_id", memberId);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ success: true });
});

// 7. Delete Team (Admin — force-deletes even with members)
app.delete("/api/teams/:id", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase client not configured" });
  const { id } = req.params;
  const force = req.query.force === "true";

  try {
    // Count members
    const { data: members } = await supabase.from("team_members").select("id").eq("team_id", id);
    if ((members?.length ?? 0) > 0 && !force) {
      return res.status(400).json({ error: "Team has active members. Use force=true to delete anyway, or remove members first." });
    }

    // Force-delete: clear members, then team
    await supabase.from("teams").update({ leader_id: null }).eq("id", id);
    await supabase.from("team_members").delete().eq("team_id", id);
    const { error } = await supabase.from("teams").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 7. Fetch Problems
app.get("/api/problems", async (_req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase client not configured" });
  const { data, error } = await supabase.from("problems").select("*").order("title");
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ data: data ?? [] });
});

// 8. Fetch Themes
app.get("/api/themes", async (_req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase client not configured" });
  const { data, error } = await supabase.from("themes").select("*").order("name");
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ data: data ?? [] });
});

// 9. Upsert Problem
app.post("/api/problems", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase client not configured" });
  const input = req.body;

  const { error } = await supabase.rpc("upsert_problem_admin", {
    p_id: input.id ?? null,
    p_title: input.title,
    p_category: input.category ?? null,
    p_description: input.description ?? null,
    p_theme_id: input.themeId ?? null,
  });

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ success: true });
});

// 10. Delete Problem
app.delete("/api/problems/:id", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase client not configured" });
  const { id } = req.params;
  const { error } = await supabase.rpc("delete_problem_admin", { p_problem_id: id });
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ success: true });
});

// 11. Fetch Timeline Events
app.get("/api/timeline", async (_req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase client not configured" });
  const { data, error } = await supabase.from("timeline_events").select("*").order("sort_order", { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ data: data ?? [] });
});

// 12. Upsert Timeline Event
app.post("/api/timeline", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase client not configured" });
  const event = req.body;
  const { data, error } = await supabase.from("timeline_events").upsert(event).select().single();
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ data });
});

// 13. Delete Timeline Event
app.delete("/api/timeline/:id", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase client not configured" });
  const { id } = req.params;
  const { error } = await supabase.from("timeline_events").delete().eq("id", id);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ success: true });
});

// 14. Fetch Announcements
app.get("/api/announcements", async (_req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase client not configured" });
  const { data, error } = await supabase.from("announcements").select("*").order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ data: data ?? [] });
});

// 15. Upsert Announcement
app.post("/api/announcements", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase client not configured" });
  const announcement = req.body;
  const { data, error } = await supabase.from("announcements").upsert(announcement).select().single();
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ data });
});

// 16. Delete Announcement
app.delete("/api/announcements/:id", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase client not configured" });
  const { id } = req.params;
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ success: true });
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

// 17. Get Registration Settings
app.get("/api/settings/registration", async (req, res) => {
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

// 18. Update Registration Settings
app.post("/api/settings/registration", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase client not configured" });
  const { manual_status, closing_date, closing_message } = req.body;

  const payload = {
    manual_status: manual_status === "closed" ? "closed" : "open",
    closing_date: closing_date || null,
    closing_message: closing_message || "Registration for SIH Internal Hackathon 2026 is currently closed."
  };

  try {
    const { data, error } = await supabase
      .from("system_settings")
      .upsert({
        key: "registration_control",
        value: payload,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ data: computeRegistrationStatus(data.value) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Dept code map for backfill
const DEPT_CODE_MAP_ADMIN = {
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

function getAdminDeptCode(deptName) {
  if (!deptName) return "TEAM";
  return DEPT_CODE_MAP_ADMIN[deptName.toLowerCase().trim()]
    ?? deptName.replace(/\s+/g, "").toUpperCase().slice(0, 8);
}

// 19. Backfill team_codes — assigns dept-based codes to teams missing them or with old SIH… codes
app.post("/api/admin/backfill-team-codes", async (req, res) => {
  try {
    let teamRows = [], memberRows = [];

    if (process.env.DATABASE_URL) {
      const { rows: t } = await dbQuery(
        `SELECT t.id, t.name, t.category, t.created_by_dept, t.team_code,
           ARRAY_AGG(p.department) FILTER (WHERE p.department IS NOT NULL) AS member_depts
         FROM public.teams t
         LEFT JOIN public.team_members tm ON tm.team_id = t.id
         LEFT JOIN public.profiles p ON p.id = tm.member_id
         GROUP BY t.id ORDER BY t.id`
      );
      teamRows = t.map((r) => ({ ...r, member_depts: r.member_depts || [] }));
    } else if (supabase) {
      const { data: t, error: e1 } = await supabase.from("teams").select("id, name, category, created_by_dept, team_code").order("id");
      if (e1) throw new Error(e1.message);
      const { data: m, error: e2 } = await supabase.from("team_members").select("team_id, member_id");
      if (e2) throw new Error(e2.message);
      const { data: p, error: e3 } = await supabase.from("profiles").select("id, department");
      if (e3) throw new Error(e3.message);
      const profMap = new Map((p || []).map((x) => [x.id, x.department]));
      const deptMap = {};
      for (const mr of m || []) {
        if (!deptMap[mr.team_id]) deptMap[mr.team_id] = [];
        const dept = profMap.get(mr.member_id);
        if (dept) deptMap[mr.team_id].push(dept);
      }
      teamRows = (t || []).map((r) => ({ ...r, member_depts: deptMap[r.id] || [] }));
    } else {
      return res.status(500).json({ error: "No database connection configured" });
    }

    // Resolve canonical dept for each team
    const resolved = teamRows.map((t) => {
      let dept = t.created_by_dept?.trim() || null;
      if (!dept && t.member_depts?.length > 0) {
        const freq = {};
        for (const d of t.member_depts) freq[d] = (freq[d] || 0) + 1;
        dept = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
      }
      return { ...t, resolved_dept: dept };
    });

    const byDept = {};
    const unresolvable = [];
    for (const t of resolved) {
      if (!t.resolved_dept) { unresolvable.push(t); continue; }
      const key = t.resolved_dept.toLowerCase().trim();
      if (!byDept[key]) byDept[key] = { dept: t.resolved_dept, teams: [] };
      byDept[key].teams.push(t);
    }
    for (const g of Object.values(byDept)) g.teams.sort((a, b) => (a.id > b.id ? 1 : -1));

    const updates = [];
    for (const { dept, teams: deptTeams } of Object.values(byDept)) {
      const deptCode = getAdminDeptCode(dept);
      let seq = 1;
      for (const t of deptTeams) {
        const category = t.category || "Pairs";
        const prefix = category.toLowerCase() === "solo" ? `${deptCode}-SOLO#` : `${deptCode}#`;
        const newCode = `${prefix}${String(seq).padStart(3, "0")}`;
        seq++;
        if (!t.team_code || t.team_code.trim() === "" || /^SIH/i.test(t.team_code)) {
          updates.push({ id: t.id, team_code: newCode, created_by_dept: dept });
        }
      }
    }

    let updatedCount = 0;
    for (const upd of updates) {
      if (process.env.DATABASE_URL) {
        await dbQuery(`UPDATE public.teams SET team_code = $1, created_by_dept = $2 WHERE id = $3`, [upd.team_code, upd.created_by_dept, upd.id]);
      } else if (supabase) {
        await supabase.from("teams").update({ team_code: upd.team_code, created_by_dept: upd.created_by_dept }).eq("id", upd.id);
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

// ── Ministry Seats Configuration ──────────────────────────────────────────

// GET /api/settings/ministry-seats — fetch seat overrides
app.get("/api/settings/ministry-seats", async (_req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase not configured" });
  try {
    const { data, error } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "ministry_seats")
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ data: data?.value ?? {} });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings/ministry-seats — save seat overrides
app.put("/api/settings/ministry-seats", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase not configured" });
  const { seats } = req.body; // { "ministry|||dept": N, ... }
  if (!seats || typeof seats !== "object") return res.status(400).json({ error: "seats object required" });
  try {
    const { error } = await supabase
      .from("system_settings")
      .upsert({ key: "ministry_seats", value: seats, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Serve static files from Vite dist if present
const distFolder = join(__dirname, "dist");
const indexHtmlFile = join(distFolder, "index.html");

if (existsSync(distFolder)) {
  app.use(express.static(distFolder));
}

// Catch-all route
app.get("*", (_req, res) => {
  if (existsSync(indexHtmlFile)) {
    return res.sendFile(indexHtmlFile);
  }

  res.status(200).send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Admin Backend API Server</title>
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
        <h1>SIH Admin REST API Active</h1>
        <p>Express server is accepting API requests on port <code>${PORT}</code>.</p>
        <p><a href="/api/health">Check Health Status (/api/health) →</a></p>
      </div>
    </body>
    </html>
  `);
});

// Run migrations and then start server listener
async function startServer() {
  try {
    await runMigrations();
  } catch (err) {
    console.error("Critical database migration failure. Continuing startup...", err);
  }

  app.listen(PORT, () => {
    console.log(`Admin Backend REST API running on port ${PORT}`);
  });
}

startServer();
