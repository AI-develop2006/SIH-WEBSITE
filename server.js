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
import { startScrapeScheduler, getProblems, scrapeAndSync } from "./sih-scraper.js";

const app = express();
const PORT = process.env.PORT || 3003;

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Initialize Supabase backend client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  : null;

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

// CORS Middleware — strict exact-match only
const allowedOriginsSet = new Set([
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3003",
  "https://sih-website-4axu.vercel.app",
  ...(process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((s) => s.trim().replace(/\/$/, ""))
    : []),
]);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOriginsSet.has(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  }
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
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

// ─── SSE: real-time broadcast for pair-team changes ───────────────────────────
// Any portal that cares about team data (SPOC, mentor, participant) can
// connect to this endpoint and receive push notifications when pair-team
// data changes (ministry assigned, skill changed, member added/removed, etc.).
const pairTeamSseClients = new Set();

function broadcastPairTeamUpdate(action, meta = {}) {
  const payload = `event: pair_teams_updated\ndata: ${JSON.stringify({ action, ...meta })}\n\n`;
  for (const res of pairTeamSseClients) {
    try { res.write(payload); } catch (_) { pairTeamSseClients.delete(res); }
  }
}

app.get("/api/events", (req, res) => {
  const origin = req.headers.origin;
  if (origin && allowedOriginsSet.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  res.write("event: connected\ndata: {}\n\n");

  const keepAlive = setInterval(() => {
    try { res.write(": ping\n\n"); } catch (_) { clearInterval(keepAlive); }
  }, 25_000);

  pairTeamSseClients.add(res);
  req.on("close", () => {
    clearInterval(keepAlive);
    pairTeamSseClients.delete(res);
  });
});

// ─── Internal: allow sibling backends to trigger a broadcast ─────────────────
// POST /api/internal/broadcast-pair-team-update
// Called by the admin backend after it mutates teams/team_members.
// Requires the shared secret in the Authorization header to prevent abuse.
// Fire-and-forget for the caller — returns 200 immediately.
app.post("/api/internal/broadcast-pair-team-update", (req, res) => {
  const secret = process.env.INTERNAL_BROADCAST_SECRET;
  // If no secret is configured, allow calls from loopback only
  if (secret) {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${secret}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  } else {
    // Fallback: allow only from localhost when no secret is set
    const clientIp = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim().replace(/^::ffff:/, "");
    const isLocal = clientIp === "127.0.0.1" || clientIp === "::1" || clientIp === "localhost";
    if (!isLocal) {
      return res.status(401).json({ error: "Unauthorized — set INTERNAL_BROADCAST_SECRET" });
    }
  }

  const { action = "team_updated", ...meta } = req.body || {};
  broadcastPairTeamUpdate(action, meta);
  return res.json({ ok: true, clients: pairTeamSseClients.size });
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

    const user = signUpData.user;

    // Create the profile row immediately server-side so it's guaranteed to exist
    // when the user lands on /dashboard. The frontend ensureProfile call is a
    // best-effort fallback but can fail due to RLS or race conditions.
    if (user && meta) {
      try {
        const profilePayload = {
          id: user.id,
          name: meta.name ?? "",
          register_no: meta.register_no ?? null,
          email: meta.email ?? email,
          phone: meta.phone ?? "",
          department: meta.department ?? "",
          year: meta.year ?? null,
          section: meta.section ?? null,
          gender: meta.gender ?? "",
          languages: Array.isArray(meta.languages) ? meta.languages : [],
          linkedin: meta.linkedin ?? null,
          resume_link: meta.resume_link ?? null,
          domain_interests: Array.isArray(meta.domain_interests) ? meta.domain_interests : [],
          project_type: meta.project_type ?? null,
          project_title: meta.project_title ?? null,
          project_description: meta.project_description ?? null,
          youtube_link: meta.youtube_link ?? null,
          google_drive_ppt: meta.google_drive_ppt ?? null,
          software_domain: meta.software_domain ?? null,
          hardware_domain: meta.hardware_domain ?? null,
          domain: meta.domain ?? null,
          github: meta.github ?? null,
          github_repo: meta.github_repo ?? null,
          role: "student",
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
        };

        // Try PostgreSQL direct connection first (bypasses RLS entirely)
        if (process.env.DATABASE_URL) {
          try {
            await dbQuery(
              `INSERT INTO public.profiles (
                id, name, register_no, email, phone, department, year, section, gender,
                languages, linkedin, resume_link, domain_interests, project_type,
                project_title, project_description, youtube_link, google_drive_ppt,
                software_domain, hardware_domain, domain, github, github_repo, role,
                sih_participant, sih_num_participations, sih_participation_year,
                sih_problem_statement, sih_project_domain, sih_project_role,
                sih_position_reached, sih_nodal_center, sih_history, category
              ) VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,
                $10,$11,$12,$13,$14,
                $15,$16,$17,$18,
                $19,$20,$21,$22,$23,$24,
                $25,$26,$27,
                $28,$29,$30,
                $31,$32,$33,$34
              ) ON CONFLICT (id) DO NOTHING;`,
              [
                profilePayload.id, profilePayload.name, profilePayload.register_no, profilePayload.email, profilePayload.phone,
                profilePayload.department, profilePayload.year, profilePayload.section, profilePayload.gender,
                JSON.stringify(profilePayload.languages), profilePayload.linkedin, profilePayload.resume_link,
                JSON.stringify(profilePayload.domain_interests), profilePayload.project_type,
                profilePayload.project_title, profilePayload.project_description, profilePayload.youtube_link, profilePayload.google_drive_ppt,
                profilePayload.software_domain, profilePayload.hardware_domain, profilePayload.domain, profilePayload.github, profilePayload.github_repo, profilePayload.role,
                profilePayload.sih_participant, profilePayload.sih_num_participations, profilePayload.sih_participation_year,
                profilePayload.sih_problem_statement, profilePayload.sih_project_domain, profilePayload.sih_project_role,
                profilePayload.sih_position_reached, profilePayload.sih_nodal_center,
                JSON.stringify(profilePayload.sih_history), profilePayload.category,
              ]
            );
          } catch (dbErr) {
            // Fall through to Supabase upsert
            console.warn("Direct DB profile insert failed, falling back to Supabase:", dbErr.message);
            await supabase.from("profiles").upsert(profilePayload, { onConflict: "id" });
          }
        } else {
          await supabase.from("profiles").upsert(profilePayload, { onConflict: "id" });
        }
      } catch (profileErr) {
        // Non-fatal — log but don't fail the signup response
        console.error("Profile creation failed during signup:", profileErr.message);
      }
    }

    return res.json({ session: signUpData.session, user });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 2b. Auth: Refresh Token
app.post("/api/auth/refresh", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase client not configured in backend" });
  const { refresh_token } = req.body;
  if (!refresh_token) return res.status(400).json({ error: "refresh_token is required" });

  try {
    const { data, error } = await supabase.auth.refreshSession({ refresh_token });
    if (error || !data?.session) {
      return res.status(401).json({ error: error?.message || "Session refresh failed" });
    }
    return res.json({ session: data.session });
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

    let profile = null;

    // Try direct DB first (faster, bypasses RLS)
    if (process.env.DATABASE_URL) {
      try {
        const { rows } = await dbQuery(`SELECT * FROM public.profiles WHERE id = $1 LIMIT 1;`, [user.id]);
        profile = rows[0] ?? null;
      } catch (_) {
        // fall through to Supabase
      }
    }

    if (!profile) {
      const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      profile = p ?? null;
    }

    // If profile row is missing, return the user with a flag instead of null
    // so the frontend can show a proper error rather than silently logging the user out
    if (!profile) {
      return res.status(200).json({ user, profile: null, profileMissing: true });
    }

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

  // Never allow role or id to be overwritten via this route
  const { role: _r, id: _i, ...safeData } = profileData ?? {};

  if (process.env.DATABASE_URL) {
    // Build a parameterised SET clause from safeData
    const entries = Object.entries(safeData);
    if (entries.length === 0) return res.json({ success: true });
    const setClauses = entries.map(([col], idx) => `"${col}" = $${idx + 1}`).join(", ");
    const values = entries.map(([, v]) => v);
    values.push(uid); // last param for WHERE
    try {
      await dbQuery(
        `UPDATE public.profiles SET ${setClauses} WHERE id = $${values.length}`,
        values
      );
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  const { error } = await supabase.from("profiles").update(safeData).eq("id", uid);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ success: true });
});

// 6c. Update register number + change auth password to match
// The student's password is always their register number, so changing the
// register number must also update the Supabase auth password.
app.post("/api/auth/update-register-no", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase not configured" });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Not signed in" });
  const token = authHeader.split(" ")[1];

  const { newRegisterNo } = req.body;
  if (!newRegisterNo?.trim()) return res.status(400).json({ error: "Register number is required" });

  try {
    // 1. Verify token and get user
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return res.status(401).json({ error: "Invalid token" });

    const cleanRegNo = newRegisterNo.trim().toUpperCase();

    // 2. Check no other profile already uses this register number
    if (process.env.DATABASE_URL) {
      const { rows } = await dbQuery(
        `SELECT id FROM public.profiles WHERE UPPER(register_no) = $1 AND id <> $2 LIMIT 1`,
        [cleanRegNo, user.id]
      );
      if (rows.length > 0) return res.status(409).json({ error: "This register number is already in use." });
    } else {
      const { data: existing } = await supabase
        .from("profiles").select("id").ilike("register_no", cleanRegNo).neq("id", user.id).maybeSingle();
      if (existing) return res.status(409).json({ error: "This register number is already in use." });
    }

    // 3. Update the profile row
    if (process.env.DATABASE_URL) {
      await dbQuery(`UPDATE public.profiles SET register_no = $1 WHERE id = $2`, [cleanRegNo, user.id]);
    } else {
      await supabase.from("profiles").update({ register_no: cleanRegNo }).eq("id", user.id);
    }

    // 4. Update the auth password to the new register number
    // We create a Supabase client scoped to the user's own session token so
    // supabase.auth.updateUser changes that user's password (not the anon user).
    const { createClient } = await import("@supabase/supabase-js");
    const userSupabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { error: pwErr } = await userSupabase.auth.updateUser({ password: cleanRegNo });
    if (pwErr) {
      return res.status(500).json({ error: `Register number saved, but password update failed: ${pwErr.message}. You may need to reset your password manually.` });
    }

    return res.json({ success: true, register_no: cleanRegNo });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
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
  const { excludeId, stack, q } = req.query;

  try {
    // Prefer direct pg connection — bypasses Supabase client row limits and RLS quirks
    if (process.env.DATABASE_URL) {
      let sql = `SELECT * FROM public.profiles WHERE 1=1`;
      const params = [];

      if (excludeId) {
        params.push(excludeId);
        sql += ` AND id <> $${params.length}`;
      }
      if (stack) {
        params.push(`{${stack}}`);
        sql += ` AND tech_stack @> $${params.length}`;
      }
      if (q) {
        const needle = `%${q.toLowerCase()}%`;
        params.push(needle);
        sql += ` AND (LOWER(name) LIKE $${params.length} OR LOWER(department) LIKE $${params.length} OR LOWER(section) LIKE $${params.length})`;
      }

      sql += ` ORDER BY name ASC`;
      const { rows } = await dbQuery(sql, params);
      return res.json({ data: rows });
    }

    // Supabase fallback — fetch in chunks to avoid the default 1000-row cap
    if (!supabase) return res.status(500).json({ error: "No database configured" });

    let query = supabase.from("profiles").select("*", { count: "exact" }).order("name");
    if (excludeId) query = query.neq("id", excludeId);
    if (stack) query = query.contains("tech_stack", [stack]);
    if (q) query = query.or(`name.ilike.%${q}%,department.ilike.%${q}%,section.ilike.%${q}%`);

    // Fetch all pages
    const PAGE = 1000;
    let all = [];
    let from = 0;
    while (true) {
      const { data, error } = await query.range(from, from + PAGE - 1);
      if (error) return res.status(500).json({ error: error.message });
      if (!data || data.length === 0) break;
      all = all.concat(data);
      if (data.length < PAGE) break;
      from += PAGE;
    }

    return res.json({ data: all });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
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
      // Fetch member IDs per team, then profiles separately — avoids relational join
      // which requires the FK to be in Supabase's schema cache.
      const { data: memberRows } = await supabase
        .from("team_members")
        .select("team_id, member_id");
      const memberDeptMap = {};
      if (memberRows && memberRows.length > 0) {
        const allMemberIds = [...new Set(memberRows.map((r) => r.member_id))];
        const { data: profileRows } = await supabase
          .from("profiles")
          .select("id, department")
          .in("id", allMemberIds);
        const profDeptMap = new Map((profileRows || []).map((p) => [p.id, p.department]));
        for (const mr of memberRows) {
          if (!memberDeptMap[mr.team_id]) memberDeptMap[mr.team_id] = [];
          const dept = profDeptMap.get(mr.member_id);
          if (dept) memberDeptMap[mr.team_id].push(dept);
        }
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
    // ── Fetch team info (ministry + category) ──────────────────────────────
    let team = null;
    if (process.env.DATABASE_URL) {
      const { rows } = await dbQuery(
        `SELECT t.ministry, t.category, p.department
         FROM public.teams t
         LEFT JOIN public.profiles p ON p.id = $2
         WHERE t.id = $1;`,
        [teamId, memberId]
      );
      team = rows[0] ?? null;
    } else if (supabase) {
      const [{ data: tData }, { data: pData }] = await Promise.all([
        supabase.from("teams").select("ministry, category").eq("id", teamId).maybeSingle(),
        supabase.from("profiles").select("department").eq("id", memberId).maybeSingle(),
      ]);
      if (tData) team = { ...tData, department: pData?.department ?? null };
    }

    // ── Enforce seat cap if team has a ministry and the member has a dept ──
    if (team?.ministry && team?.department) {
      const { ministry, department } = team;

      // Fetch admin-configured cap from system_settings
      let cap = 6; // default
      try {
        if (process.env.DATABASE_URL) {
          const { rows: sr } = await dbQuery(
            `SELECT value FROM public.system_settings WHERE key = 'ministry_seats' LIMIT 1`
          );
          const seats = sr[0]?.value ?? {};
          cap = seats[`${ministry}|||${department}`] ?? 6;
        } else if (supabase) {
          const { data: sd } = await supabase
            .from("system_settings")
            .select("value")
            .eq("key", "ministry_seats")
            .maybeSingle();
          const seats = sd?.value ?? {};
          cap = seats[`${ministry}|||${department}`] ?? 6;
        }
      } catch (_) { /* ignore — fall back to cap=6 */ }

      // Count how many members from this dept are already in teams under this ministry
      let currentCount = 0;
      if (process.env.DATABASE_URL) {
        const { rows: cr } = await dbQuery(
          `SELECT COUNT(*) AS cnt
           FROM public.team_members tm
           JOIN public.teams t ON t.id = tm.team_id
           JOIN public.profiles p ON p.id = tm.member_id
           WHERE t.ministry = $1 AND p.department = $2;`,
          [ministry, department]
        );
        currentCount = parseInt(cr[0]?.cnt ?? 0, 10);
      } else if (supabase) {
        // Pull all team_members for teams under this ministry, then filter by dept
        const { data: allTeams } = await supabase
          .from("teams")
          .select("id")
          .eq("ministry", ministry);
        const teamIds = (allTeams ?? []).map((t) => t.id);
        if (teamIds.length > 0) {
          const { data: members } = await supabase
            .from("team_members")
            .select("member_id, profiles(department)")
            .in("team_id", teamIds);
          currentCount = (members ?? []).filter(
            (m) => m.profiles?.department === department
          ).length;
        }
      }

      if (currentCount >= cap) {
        return res.status(400).json({
          error: `Seat limit reached: ${department} already has ${currentCount}/${cap} members assigned to teams under "${ministry}". ${cap === 6 ? "Contact admin to increase the seat cap." : `The admin has set a cap of ${cap} for this combination.`}`,
        });
      }
    }

    // ── Insert member ──────────────────────────────────────────────────────
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

    broadcastPairTeamUpdate("member_added", { team_id: teamId, member_id: memberId });
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

    broadcastPairTeamUpdate("skill_updated", { team_id: teamId, member_id: memberId });
    return res.json({ success: true, assigned_skill: skill || null });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Assign Ministry to Team
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

        // Read the admin-configured cap from system_settings (falls back to 6)
        let deptCap = 6;
        try {
          if (process.env.DATABASE_URL) {
            const { rows: sr } = await dbQuery(
              `SELECT value FROM public.system_settings WHERE key = 'ministry_seats' LIMIT 1`
            );
            const seats = sr[0]?.value ?? {};
            deptCap = seats[`${ministry}|||${dept}`] ?? 6;
          } else if (supabase) {
            const { data: sd } = await supabase
              .from("system_settings")
              .select("value")
              .eq("key", "ministry_seats")
              .maybeSingle();
            const seats = sd?.value ?? {};
            deptCap = seats[`${ministry}|||${dept}`] ?? 6;
          }
        } catch (_) { /* fall back to 6 */ }

        if (existingCount + teamDeptCount > deptCap) {
          return res.status(400).json({
            error: `Ministry cap exceeded: "${dept}" already has ${existingCount} member(s) under "${ministry}". Adding ${teamDeptCount} more would exceed the cap of ${deptCap} per department per ministry.`,
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

    broadcastPairTeamUpdate("ministry_updated", { team_id: teamId, ministry: ministry || null });
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
    broadcastPairTeamUpdate("team_renamed", { team_id: teamId });
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

// ─── Personal Notifications ───────────────────────────────────────────────────

// GET /api/notifications — fetch notifications for the authenticated user
app.get("/api/notifications", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Not signed in" });
  const token = authHeader.split(" ")[1];

  try {
    // Get user id from token
    let userId = null;
    if (supabase) {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) return res.status(401).json({ error: "Invalid token" });
      userId = user.id;
    }

    let notifications = [];
    if (process.env.DATABASE_URL && userId) {
      const { rows } = await dbQuery(
        `SELECT * FROM public.notifications
         WHERE profile_id = $1
         ORDER BY created_at DESC
         LIMIT 50`,
        [userId]
      );
      notifications = rows;
    } else if (supabase && userId) {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("profile_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) return res.status(500).json({ error: error.message });
      notifications = data ?? [];
    }

    return res.json({ data: notifications });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /api/notifications/:id/read — mark a notification as read
app.patch("/api/notifications/:id/read", async (req, res) => {
  const { id } = req.params;
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Not signed in" });

  try {
    if (process.env.DATABASE_URL) {
      await dbQuery(
        `UPDATE public.notifications SET read = TRUE WHERE id = $1`,
        [id]
      );
    } else if (supabase) {
      await supabase.from("notifications").update({ read: true }).eq("id", id);
    }
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /api/notifications/read-all — mark all notifications as read for the user
app.patch("/api/notifications/read-all", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Not signed in" });
  const token = authHeader.split(" ")[1];

  try {
    let userId = null;
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id;
    }
    if (!userId) return res.status(401).json({ error: "Invalid token" });

    if (process.env.DATABASE_URL) {
      await dbQuery(
        `UPDATE public.notifications SET read = TRUE WHERE profile_id = $1`,
        [userId]
      );
    } else if (supabase) {
      await supabase.from("notifications").update({ read: true }).eq("profile_id", userId);
    }
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
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
  const normalizedEmail = (email || "").trim().toLowerCase();

  // Check profiles table first
  const { data: profileData } = await supabase.from("profiles").select("id").ilike("email", normalizedEmail).maybeSingle();
  if (profileData) return res.json({ exists: true });

  // Also check auth.users via direct DB to catch orphaned auth accounts
  // (signup that created an auth user but failed before creating the profile row)
  if (process.env.DATABASE_URL) {
    try {
      const { rows } = await dbQuery(
        `SELECT id FROM auth.users WHERE LOWER(email) = $1 LIMIT 1;`,
        [normalizedEmail]
      );
      if (rows.length > 0) return res.json({ exists: true });
    } catch (_) {
      // auth schema may not be accessible via this connection — ignore
    }
  }

  return res.json({ exists: false });
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

// GET /api/settings/ministry-seats — public read, no auth required
// Returns the admin-configured seat caps as { "Ministry|||Dept": N, ... }
// Falls back gracefully to {} if the row doesn't exist yet.
app.get("/api/settings/ministry-seats", async (_req, res) => {
  try {
    let seats = {};
    if (process.env.DATABASE_URL) {
      const { rows } = await dbQuery(
        `SELECT value FROM public.system_settings WHERE key = 'ministry_seats' LIMIT 1`
      );
      seats = rows[0]?.value ?? {};
    } else if (supabase) {
      const { data, error } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "ministry_seats")
        .maybeSingle();
      if (error && !error.message.includes("does not exist")) {
        return res.status(500).json({ error: error.message });
      }
      seats = data?.value ?? {};
    }
    return res.json({ data: seats });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/settings/ministry-seats-for-dept?dept=<department>
// Returns per-ministry seat cap + current usage for ONE department.
// This is what the mentor dashboard polls — it only returns data relevant
// to the requesting mentor's department so they can see extra capacity.
app.get("/api/settings/ministry-seats-for-dept", async (req, res) => {
  const { dept } = req.query;
  if (!dept) return res.status(400).json({ error: "dept query param required" });

  try {
    // 1. Read seat caps
    let seats = {};
    if (process.env.DATABASE_URL) {
      const { rows } = await dbQuery(
        `SELECT value FROM public.system_settings WHERE key = 'ministry_seats' LIMIT 1`
      );
      seats = rows[0]?.value ?? {};
    } else if (supabase) {
      const { data } = await supabase
        .from("system_settings").select("value")
        .eq("key", "ministry_seats").maybeSingle();
      seats = data?.value ?? {};
    }

    // 2. Count current members per ministry for this department
    let usageRows = [];
    if (process.env.DATABASE_URL) {
      const { rows } = await dbQuery(
        `SELECT t.ministry, COUNT(*)::int AS cnt
         FROM public.team_members tm
         JOIN public.teams t ON t.id = tm.team_id
         JOIN public.profiles p ON p.id = tm.member_id
         WHERE p.department = $1 AND t.ministry IS NOT NULL
         GROUP BY t.ministry;`,
        [dept]
      );
      usageRows = rows;
    } else if (supabase) {
      // Get teams with a ministry, then count members from this dept
      const { data: allTeams } = await supabase
        .from("teams").select("id, ministry").not("ministry", "is", null);
      if (allTeams?.length) {
        const teamIds = allTeams.map((t) => t.id);
        const { data: members } = await supabase
          .from("team_members")
          .select("team_id, profiles(department)")
          .in("team_id", teamIds);
        const ministryCounts = {};
        for (const tm of members ?? []) {
          if (tm.profiles?.department !== dept) continue;
          const ministry = allTeams.find((t) => t.id === tm.team_id)?.ministry;
          if (ministry) ministryCounts[ministry] = (ministryCounts[ministry] ?? 0) + 1;
        }
        usageRows = Object.entries(ministryCounts).map(([ministry, cnt]) => ({ ministry, cnt }));
      }
    }

    // 3. Build result: only ministries where this dept has a cap override OR usage > 0
    const usageMap = {};
    for (const r of usageRows) usageMap[r.ministry] = r.cnt;

    // Include every ministry that has a custom cap for this dept
    const relevantKeys = Object.keys(seats).filter((k) => k.endsWith(`|||${dept}`));
    const ministriesWithCustomCap = relevantKeys.map((k) => k.split("|||")[0]);

    // Also include ministries where this dept already has members
    const ministriesWithUsage = Object.keys(usageMap);

    const allRelevantMinistries = [...new Set([...ministriesWithCustomCap, ...ministriesWithUsage])];

    const result = allRelevantMinistries.map((ministry) => ({
      ministry,
      cap: seats[`${ministry}|||${dept}`] ?? 6,
      usage: usageMap[ministry] ?? 0,
    }));

    return res.json({ data: result, seats });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── SPOC Final Teams API ─────────────────────────────────────────────────────
// These endpoints manage the 6-member final teams formed by the SPOC
// from the pair-teams created by mentors.

// Ensure the spoc_final_teams table exists (creates on first request)
async function ensureSpocTable() {
  if (process.env.DATABASE_URL) {
    try {
      await dbQuery(`
        CREATE TABLE IF NOT EXISTS public.spoc_final_teams (
          id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name        TEXT NOT NULL,
          ministry    TEXT,
          member_ids  TEXT[] NOT NULL DEFAULT '{}',
          created_by  UUID REFERENCES public.profiles(id),
          created_at  TIMESTAMPTZ DEFAULT now(),
          updated_at  TIMESTAMPTZ DEFAULT now()
        );
      `);
    } catch (_) { /* table may already exist */ }
  } else if (supabase) {
    // Supabase — table must be created via migrations; log a warning if missing
  }
}

/**
 * Fire-and-forget notification sender for SPOC final team events.
 * Inserts one notification row per profile_id. Errors are logged only.
 */
async function sendFinalTeamNotifications(profileIds, { type, title, message, metadata = {} }) {
  if (!profileIds || profileIds.length === 0) return;
  try {
    if (process.env.DATABASE_URL) {
      for (const pid of profileIds) {
        await dbQuery(
          `INSERT INTO public.notifications (profile_id, type, title, message, metadata)
           VALUES ($1, $2, $3, $4, $5)`,
          [pid, type, title, message, JSON.stringify(metadata)]
        );
      }
    } else if (supabase) {
      const rows = profileIds.map((pid) => ({
        profile_id: pid, type, title, message, metadata,
      }));
      await supabase.from("notifications").insert(rows);
    }
  } catch (err) {
    console.warn("[notifications] Failed to insert:", err.message);
  }
}

// GET /api/spoc/final-teams — list all final teams
app.get("/api/spoc/final-teams", async (req, res) => {
  try {
    await ensureSpocTable();
    if (process.env.DATABASE_URL) {
      const { rows } = await dbQuery(
        `SELECT * FROM public.spoc_final_teams ORDER BY created_at ASC;`
      );
      return res.json({ data: rows });
    } else if (supabase) {
      const { data, error } = await supabase
        .from("spoc_final_teams")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ data: data ?? [] });
    }
    return res.json({ data: [] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/spoc/final-teams — create a new final team
app.post("/api/spoc/final-teams", async (req, res) => {
  const { name, ministry, member_ids } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "Team name is required" });
  if (!Array.isArray(member_ids)) return res.status(400).json({ error: "member_ids must be an array" });

  try {
    await ensureSpocTable();

    // Auth — get creator id from token
    let createdBy = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ") && supabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser(authHeader.split(" ")[1]);
        createdBy = user?.id ?? null;
      } catch (_) {}
    }

    let created = null;
    if (process.env.DATABASE_URL) {
      const { rows } = await dbQuery(
        `INSERT INTO public.spoc_final_teams (name, ministry, member_ids, created_by)
         VALUES ($1, $2, $3, $4)
         RETURNING *;`,
        [name.trim(), ministry || null, member_ids, createdBy]
      );
      created = rows[0];
    } else if (supabase) {
      const { data, error } = await supabase
        .from("spoc_final_teams")
        .insert([{ name: name.trim(), ministry: ministry || null, member_ids, created_by: createdBy }])
        .select()
        .single();
      if (error) return res.status(500).json({ error: error.message });
      created = data;
    } else {
      return res.status(500).json({ error: "No database configured" });
    }

    // Notify all members they've been added to a final team
    sendFinalTeamNotifications(member_ids, {
      type: "spoc_team_added",
      title: "🎉 You're in the Final Team!",
      message: `You have been selected for the final SIH 2026 team "${name.trim()}"${ministry ? ` under ${ministry}` : ""}. Congratulations!`,
      metadata: { team_name: name.trim(), ministry: ministry || null, team_id: created?.id },
    });

    return res.json({ data: created });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /api/spoc/final-teams/:id — update a final team
app.patch("/api/spoc/final-teams/:id", async (req, res) => {
  const { id } = req.params;
  const { name, ministry, member_ids } = req.body;

  try {
    await ensureSpocTable();

    // Fetch current team to detect member changes for notifications
    let prevMemberIds = [];
    let prevName = "";
    if (process.env.DATABASE_URL) {
      const { rows: prev } = await dbQuery(
        `SELECT name, member_ids FROM public.spoc_final_teams WHERE id = $1`, [id]
      );
      if (prev[0]) { prevMemberIds = prev[0].member_ids || []; prevName = prev[0].name; }
    } else if (supabase) {
      const { data: prev } = await supabase
        .from("spoc_final_teams").select("name, member_ids").eq("id", id).maybeSingle();
      if (prev) { prevMemberIds = prev.member_ids || []; prevName = prev.name; }
    }

    let updated = null;
    if (process.env.DATABASE_URL) {
      const { rows } = await dbQuery(
        `UPDATE public.spoc_final_teams
         SET name = COALESCE($1, name),
             ministry = COALESCE($2, ministry),
             member_ids = COALESCE($3, member_ids),
             updated_at = now()
         WHERE id = $4
         RETURNING *;`,
        [name?.trim() ?? null, ministry ?? null, member_ids ?? null, id]
      );
      if (!rows.length) return res.status(404).json({ error: "Team not found" });
      updated = rows[0];
    } else if (supabase) {
      const patch = {};
      if (name !== undefined) patch.name = name.trim();
      if (ministry !== undefined) patch.ministry = ministry;
      if (member_ids !== undefined) patch.member_ids = member_ids;
      patch.updated_at = new Date().toISOString();
      const { data, error } = await supabase
        .from("spoc_final_teams")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) return res.status(500).json({ error: error.message });
      updated = data;
    } else {
      return res.status(500).json({ error: "No database configured" });
    }

    // Send notifications for membership changes
    const finalName = updated?.name ?? name?.trim() ?? prevName;
    const finalMinistry = updated?.ministry ?? ministry ?? null;
    const finalIds = updated?.member_ids ?? member_ids ?? prevMemberIds;
    const prevSet = new Set(prevMemberIds);
    const newSet = new Set(finalIds);
    const addedIds = finalIds.filter((uid) => !prevSet.has(uid));
    const removedIds = prevMemberIds.filter((uid) => !newSet.has(uid));
    const keptIds = finalIds.filter((uid) => prevSet.has(uid));

    await sendFinalTeamNotifications(addedIds, {
      type: "spoc_team_added",
      title: "🎉 You're in the Final Team!",
      message: `You have been selected for the final SIH 2026 team "${finalName}"${finalMinistry ? ` under ${finalMinistry}` : ""}. Congratulations!`,
      metadata: { team_name: finalName, ministry: finalMinistry, team_id: id },
    });
    await sendFinalTeamNotifications(removedIds, {
      type: "spoc_team_removed",
      title: "⚠ Removed from Final Team",
      message: `You have been removed from the final SIH 2026 team "${finalName}"${finalMinistry ? ` (${finalMinistry})` : ""}. Please await further instructions from your SPOC.`,
      metadata: { team_name: finalName, ministry: finalMinistry, team_id: id },
    });
    if (keptIds.length > 0 && (name !== undefined || ministry !== undefined)) {
      await sendFinalTeamNotifications(keptIds, {
        type: "spoc_team_added",
        title: "📋 Your Final Team Was Updated",
        message: `Your SIH 2026 final team has been updated to "${finalName}"${finalMinistry ? ` under ${finalMinistry}` : ""}. Your membership continues.`,
        metadata: { team_name: finalName, ministry: finalMinistry, team_id: id },
      });
    }

    return res.json({ data: updated });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/spoc/final-teams/:id — disabled to protect finalised teams
app.delete("/api/spoc/final-teams/:id", async (_req, res) => {
  return res.status(403).json({
    error: "Final teams cannot be deleted once formed. Use the PATCH endpoint to update membership.",
  });
});

// ─── Participant: "Which final team am I in?" ────────────────────────────────
// GET /api/spoc/my-final-team — returns the SPOC final team the authenticated
// participant belongs to, with all member profiles resolved.
app.get("/api/spoc/my-final-team", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Not signed in" });
  const token = authHeader.split(" ")[1];

  try {
    // Resolve user id
    let userId = null;
    if (supabase) {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) return res.status(401).json({ error: "Invalid token" });
      userId = user.id;
    } else {
      return res.status(500).json({ error: "Auth not configured" });
    }

    // Find a final team that contains this user's id
    let finalTeam = null;
    if (process.env.DATABASE_URL) {
      const { rows } = await dbQuery(
        `SELECT * FROM public.spoc_final_teams WHERE $1 = ANY(member_ids) LIMIT 1`,
        [userId]
      );
      finalTeam = rows[0] ?? null;
    } else if (supabase) {
      const { data, error } = await supabase
        .from("spoc_final_teams")
        .select("*")
        .contains("member_ids", [userId])
        .limit(1)
        .maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      finalTeam = data ?? null;
    }

    if (!finalTeam) return res.json({ data: null });

    // Resolve member profiles from the member_ids array
    const memberIds = finalTeam.member_ids || [];
    let members = [];
    if (memberIds.length > 0) {
      if (process.env.DATABASE_URL) {
        const { rows: profiles } = await dbQuery(
          `SELECT id, name, register_no, department, year, section, gender, email, phone,
                  avatar_url, linkedin, github, github_repo, resume_link,
                  software_domain, hardware_domain, domain, domain_interests,
                  project_type, project_title, project_description,
                  youtube_link, google_drive_ppt, languages,
                  sih_participant, sih_num_participations, sih_participation_year,
                  sih_problem_statement, sih_project_domain, sih_project_role,
                  sih_position_reached, sih_nodal_center, sih_history
           FROM public.profiles WHERE id = ANY($1)`,
          [memberIds]
        );
        // Keep order matching member_ids
        const profileMap = new Map(profiles.map((p) => [p.id, p]));
        members = memberIds.map((id) => profileMap.get(id)).filter(Boolean);
      } else if (supabase) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select(`id, name, register_no, department, year, section, gender, email, phone,
                   avatar_url, linkedin, github, github_repo, resume_link,
                   software_domain, hardware_domain, domain, domain_interests,
                   project_type, project_title, project_description,
                   youtube_link, google_drive_ppt, languages,
                   sih_participant, sih_num_participations, sih_participation_year,
                   sih_problem_statement, sih_project_domain, sih_project_role,
                   sih_position_reached, sih_nodal_center, sih_history`)
          .in("id", memberIds);
        const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
        members = memberIds.map((id) => profileMap.get(id)).filter(Boolean);
      }
    }

    return res.json({ data: { ...finalTeam, members } });
  } catch (err) {
    console.error("[/api/spoc/my-final-team] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /api/spoc/select-ps — any authenticated team member can set the
// selected_ps_number on their own final team. Once a PS is confirmed it
// CANNOT be changed — this is enforced here on the backend.
// Body: { ps_number: "SIH26042" }
app.patch("/api/spoc/select-ps", async (req, res) => {  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Not signed in" });
  const token = authHeader.split(" ")[1];

  const { ps_number } = req.body;

  // ps_number is required — clearing is no longer allowed once set
  if (!ps_number || typeof ps_number !== "string" || !ps_number.trim()) {
    return res.status(400).json({ error: "ps_number is required" });
  }

  try {
    // Resolve caller's user id
    let userId = null;
    if (supabase) {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) return res.status(401).json({ error: "Invalid token" });
      userId = user.id;
    } else {
      return res.status(500).json({ error: "Auth not configured" });
    }

    // Find the final team this user belongs to
    let teamId = null;
    let teamName = null;
    let existingPs = null;
    if (process.env.DATABASE_URL) {
      const { rows } = await dbQuery(
        `SELECT id, name, selected_ps_number FROM public.spoc_final_teams WHERE $1 = ANY(member_ids) LIMIT 1`,
        [userId]
      );
      if (!rows[0]) return res.status(404).json({ error: "You are not in any final team" });
      teamId     = rows[0].id;
      teamName   = rows[0].name;
      existingPs = rows[0].selected_ps_number ?? null;
    } else if (supabase) {
      const { data } = await supabase
        .from("spoc_final_teams")
        .select("id, name, selected_ps_number")
        .contains("member_ids", [userId])
        .limit(1)
        .maybeSingle();
      if (!data) return res.status(404).json({ error: "You are not in any final team" });
      teamId     = data.id;
      teamName   = data.name;
      existingPs = data.selected_ps_number ?? null;
    }

    // ── Lock: once a PS is confirmed it cannot be changed ────────────────────
    if (existingPs) {
      return res.status(409).json({
        error: "Problem statement already confirmed",
        message: `Your team has already locked in PS ${existingPs}. Problem statements cannot be changed after confirmation.`,
        locked_ps: existingPs,
      });
    }

    // Update selected_ps_number
    let updated = null;
    if (process.env.DATABASE_URL) {
      const { rows } = await dbQuery(
        `UPDATE public.spoc_final_teams
         SET selected_ps_number = $1, updated_at = now()
         WHERE id = $2 RETURNING *;`,
        [ps_number.trim(), teamId]
      );
      updated = rows[0];
    } else if (supabase) {
      const { data, error } = await supabase
        .from("spoc_final_teams")
        .update({ selected_ps_number: ps_number.trim(), updated_at: new Date().toISOString() })
        .eq("id", teamId)
        .select().single();
      if (error) return res.status(500).json({ error: error.message });
      updated = data;
    }

    // Broadcast so SPOC/participant dashboards refresh
    broadcastPairTeamUpdate("ps_selected", { team_id: teamId, ps_number: ps_number.trim() });

    return res.json({ data: updated });
  } catch (err) {
    console.error("[/api/spoc/select-ps] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /api/spoc/submit-custom-ps — for AICTE (Open Innovation) teams only.
// Instead of picking from the official PS list, the team writes their own
// problem statement title. Stored in custom_ps_title on spoc_final_teams.
// Once confirmed it cannot be changed (same lock semantics as select-ps).
// Body: { custom_title: "Our innovative idea description..." }
app.patch("/api/spoc/submit-custom-ps", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Not signed in" });
  const token = authHeader.split(" ")[1];

  const { custom_title } = req.body;

  if (!custom_title || typeof custom_title !== "string" || !custom_title.trim()) {
    return res.status(400).json({ error: "custom_title is required" });
  }
  if (custom_title.trim().length < 10) {
    return res.status(400).json({ error: "Problem statement title must be at least 10 characters" });
  }
  if (custom_title.trim().length > 500) {
    return res.status(400).json({ error: "Problem statement title cannot exceed 500 characters" });
  }

  try {
    // Resolve caller's user id
    let userId = null;
    if (supabase) {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) return res.status(401).json({ error: "Invalid token" });
      userId = user.id;
    } else {
      return res.status(500).json({ error: "Auth not configured" });
    }

    // Find the final team this user belongs to
    let teamId = null;
    let teamName = null;
    let existingCustomTitle = null;
    let ministry = null;
    if (process.env.DATABASE_URL) {
      const { rows } = await dbQuery(
        `SELECT id, name, ministry, custom_ps_title FROM public.spoc_final_teams WHERE $1 = ANY(member_ids) LIMIT 1`,
        [userId]
      );
      if (!rows[0]) return res.status(404).json({ error: "You are not in any final team" });
      teamId            = rows[0].id;
      teamName          = rows[0].name;
      ministry          = rows[0].ministry ?? "";
      existingCustomTitle = rows[0].custom_ps_title ?? null;
    } else if (supabase) {
      const { data } = await supabase
        .from("spoc_final_teams")
        .select("id, name, ministry, custom_ps_title")
        .contains("member_ids", [userId])
        .limit(1)
        .maybeSingle();
      if (!data) return res.status(404).json({ error: "You are not in any final team" });
      teamId              = data.id;
      teamName            = data.name;
      ministry            = data.ministry ?? "";
      existingCustomTitle = data.custom_ps_title ?? null;
    }

    // Only AICTE (Open Innovation) teams may use this endpoint
    if (!ministry.toLowerCase().includes("aicte")) {
      return res.status(403).json({
        error: "This endpoint is only available for AICTE (Open Innovation) teams",
      });
    }

    // Lock: once confirmed it cannot be changed
    if (existingCustomTitle) {
      return res.status(409).json({
        error: "Problem statement already confirmed",
        message: "Your team has already locked in a custom problem statement. It cannot be changed after confirmation.",
        locked_title: existingCustomTitle,
      });
    }

    // Save the custom title
    let updated = null;
    if (process.env.DATABASE_URL) {
      const { rows } = await dbQuery(
        `UPDATE public.spoc_final_teams
         SET custom_ps_title = $1, updated_at = now()
         WHERE id = $2 RETURNING *;`,
        [custom_title.trim(), teamId]
      );
      updated = rows[0];
    } else if (supabase) {
      const { data, error } = await supabase
        .from("spoc_final_teams")
        .update({ custom_ps_title: custom_title.trim(), updated_at: new Date().toISOString() })
        .eq("id", teamId)
        .select().single();
      if (error) return res.status(500).json({ error: error.message });
      updated = data;
    }

    // Broadcast so SPOC/participant dashboards refresh
    broadcastPairTeamUpdate("custom_ps_submitted", { team_id: teamId, custom_title: custom_title.trim() });

    return res.json({ data: updated });
  } catch (err) {
    console.error("[/api/spoc/submit-custom-ps] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── PS Change Requests ───────────────────────────────────────────────────────

// POST /api/spoc/ps-change-request
// Submit a request to change the team's locked problem statement.
// Body: { reason, new_ps, new_custom }
//   reason     – why they want to change (required, 10–1000 chars)
//   new_ps     – new PS number (for non-AICTE teams)
//   new_custom – new custom title (for AICTE teams)
app.post("/api/spoc/ps-change-request", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Not signed in" });
  const token = authHeader.split(" ")[1];

  const { reason, new_ps, new_custom } = req.body;

  if (!reason || typeof reason !== "string" || reason.trim().length < 10) {
    return res.status(400).json({ error: "Reason must be at least 10 characters" });
  }
  if (reason.trim().length > 1000) {
    return res.status(400).json({ error: "Reason cannot exceed 1000 characters" });
  }
  if (!new_ps && !new_custom) {
    return res.status(400).json({ error: "Either new_ps (PS number) or new_custom (title) is required" });
  }

  try {
    let userId = null;
    if (supabase) {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) return res.status(401).json({ error: "Invalid token" });
      userId = user.id;
    } else {
      return res.status(500).json({ error: "Auth not configured" });
    }

    // Get the team
    let team = null;
    if (process.env.DATABASE_URL) {
      const { rows } = await dbQuery(
        `SELECT id, name, selected_ps_number, custom_ps_title FROM public.spoc_final_teams
         WHERE $1 = ANY(member_ids) LIMIT 1`,
        [userId]
      );
      if (!rows[0]) return res.status(404).json({ error: "You are not in any final team" });
      team = rows[0];
    } else if (supabase) {
      const { data } = await supabase
        .from("spoc_final_teams")
        .select("id, name, selected_ps_number, custom_ps_title")
        .contains("member_ids", [userId]).limit(1).maybeSingle();
      if (!data) return res.status(404).json({ error: "You are not in any final team" });
      team = data;
    }

    // Must have a locked PS to request a change
    if (!team.selected_ps_number && !team.custom_ps_title) {
      return res.status(400).json({ error: "Your team has not confirmed a problem statement yet. No change request needed." });
    }

    // Check no pending request already exists for this team
    let existingPending = null;
    if (process.env.DATABASE_URL) {
      const { rows } = await dbQuery(
        `SELECT id FROM public.ps_change_requests WHERE team_id = $1 AND status = 'pending' LIMIT 1`,
        [team.id]
      );
      existingPending = rows[0] ?? null;
    } else if (supabase) {
      const { data } = await supabase
        .from("ps_change_requests")
        .select("id")
        .eq("team_id", team.id)
        .eq("status", "pending")
        .limit(1).maybeSingle();
      existingPending = data ?? null;
    }
    if (existingPending) {
      return res.status(409).json({
        error: "Your team already has a pending change request. Wait for the SPOC to review it before submitting another.",
      });
    }

    // Insert the request
    let created = null;
    if (process.env.DATABASE_URL) {
      const { rows } = await dbQuery(
        `INSERT INTO public.ps_change_requests
           (team_id, team_name, requested_by, current_ps, current_custom, new_ps, new_custom, reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *;`,
        [
          team.id,
          team.name,
          userId,
          team.selected_ps_number ?? null,
          team.custom_ps_title ?? null,
          new_ps?.trim() ?? null,
          new_custom?.trim() ?? null,
          reason.trim(),
        ]
      );
      created = rows[0];
    } else if (supabase) {
      const { data, error } = await supabase
        .from("ps_change_requests")
        .insert([{
          team_id:        team.id,
          team_name:      team.name,
          requested_by:   userId,
          current_ps:     team.selected_ps_number ?? null,
          current_custom: team.custom_ps_title ?? null,
          new_ps:         new_ps?.trim() ?? null,
          new_custom:     new_custom?.trim() ?? null,
          reason:         reason.trim(),
        }])
        .select().single();
      if (error) return res.status(500).json({ error: error.message });
      created = data;
    }

    // Notify SPOC via broadcast
    broadcastPairTeamUpdate("ps_change_request", { team_id: team.id, team_name: team.name });

    return res.status(201).json({ data: created });
  } catch (err) {
    console.error("[/api/spoc/ps-change-request] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/spoc/ps-change-request/my
// Returns the current team's latest change request (pending or resolved).
app.get("/api/spoc/ps-change-request/my", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Not signed in" });
  const token = authHeader.split(" ")[1];

  try {
    let userId = null;
    if (supabase) {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) return res.status(401).json({ error: "Invalid token" });
      userId = user.id;
    } else {
      return res.status(500).json({ error: "Auth not configured" });
    }

    // Find team
    let teamId = null;
    if (process.env.DATABASE_URL) {
      const { rows } = await dbQuery(
        `SELECT id FROM public.spoc_final_teams WHERE $1 = ANY(member_ids) LIMIT 1`, [userId]
      );
      teamId = rows[0]?.id ?? null;
    } else if (supabase) {
      const { data } = await supabase
        .from("spoc_final_teams").select("id")
        .contains("member_ids", [userId]).limit(1).maybeSingle();
      teamId = data?.id ?? null;
    }
    if (!teamId) return res.json({ data: null });

    let requests = [];
    if (process.env.DATABASE_URL) {
      const { rows } = await dbQuery(
        `SELECT * FROM public.ps_change_requests
         WHERE team_id = $1 ORDER BY created_at DESC LIMIT 5`,
        [teamId]
      );
      requests = rows;
    } else if (supabase) {
      const { data } = await supabase
        .from("ps_change_requests")
        .select("*")
        .eq("team_id", teamId)
        .order("created_at", { ascending: false })
        .limit(5);
      requests = data ?? [];
    }
    return res.json({ data: requests });
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

// ─── SIH Problem Statements API ───────────────────────────────────────────────
// GET /api/problems/sih2026
// Returns all SIH 2026 PS from the DB (with in-memory cache).
// Used by participant/mentor, SPOC, and admin frontends.
app.get("/api/problems/sih2026", async (_req, res) => {
  try {
    const problems = await getProblems(dbQuery);
    return res.json({ data: problems, count: problems.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/problems/sih2026/sync-status
// Returns info about the last scrape run.
app.get("/api/problems/sih2026/sync-status", async (_req, res) => {
  try {
    let lastSync = null;
    if (process.env.DATABASE_URL) {
      const { rows } = await dbQuery(
        `SELECT scraped_at, total_found, added, updated, unchanged, error, duration_ms
         FROM public.sih_problems_sync_log
         ORDER BY scraped_at DESC LIMIT 1`
      );
      lastSync = rows[0] ?? null;
    }
    return res.json({ data: lastSync });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/problems/sih2026/sync  (manual trigger — admin/SPOC use only)
// Triggers an immediate scrape outside the 5-hour schedule.
app.post("/api/problems/sih2026/sync", async (_req, res) => {
  scrapeAndSync(dbQuery).catch((e) =>
    console.error("[SIH scraper] Manual sync error:", e.message)
  );
  return res.json({ ok: true, message: "Scrape started in background" });
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

  // Start the SIH PS scrape scheduler (initial DB load + scrape every 5 h)
  try {
    startScrapeScheduler(dbQuery);
  } catch (err) {
    console.error("[SIH scraper] Scheduler init failed:", err.message);
  }
}

startServer();
