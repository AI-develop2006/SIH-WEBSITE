/**
 * SPOC Portal — Standalone Backend Server
 * ─────────────────────────────────────────
 * Handles auth, team reads, and SPOC final-team management.
 * Uses the same Supabase project as the other portals.
 * Start with: npm start
 */

import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync as fsExists } from "node:fs";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env from this folder
const envPath = join(__dirname, ".env");
if (fsExists(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

const app = express();
const PORT = process.env.PORT || 3004;

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ─── CORS ────────────────────────────────────────────────────────────────────
const ALLOWED = new Set([
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:5176",
  "http://localhost:3004",
  ...(process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((s) => s.trim())
    : []),
]);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// ─── Database clients ─────────────────────────────────────────────────────────
const DATABASE_URL   = process.env.DATABASE_URL;
const SUPABASE_URL   = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON  = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = SUPABASE_URL && SUPABASE_ANON
  ? createClient(SUPABASE_URL, SUPABASE_ANON)
  : null;

let pool = null;
if (DATABASE_URL) {
  pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
}

async function dbQuery(sql, params = []) {
  if (!pool) throw new Error("DATABASE_URL not configured");
  const client = await pool.connect();
  try {
    return await client.query(sql, params);
  } finally {
    client.release();
  }
}

// ─── computeStats helper ──────────────────────────────────────────────────────
function computeStats(members = [], category = "Pairs") {
  const isSolo = category === "Solo";
  const targetCount = isSolo ? 1 : 2;
  const memberCount = members.length;
  const deptSet = new Set(members.map((m) => m.department).filter(Boolean));
  const reasons = [];
  if (isSolo) {
    if (memberCount !== 1) reasons.push(memberCount === 0 ? "requires 1 member" : "Solo: max 1 member");
  } else {
    if (memberCount > 2) reasons.push("max 2 members allowed");
    else if (memberCount < 2) reasons.push("requires 2 members");
    if (memberCount > 1 && deptSet.size !== 1) reasons.push("members must be from the same department");
  }
  return {
    memberCount, targetCount, isSolo,
    deptCount: deptSet.size,
    sameDept: isSolo ? true : deptSet.size <= 1,
    differentSkills: true,
    valid: memberCount === targetCount && reasons.length === 0,
    reason: reasons.join(" · "),
  };
}

// ─── Health ───────────────────────────────────────────────────────────────────
app.get(["/health", "/api/health"], (_req, res) => {
  res.json({ status: "ok", service: "spoc-backend", port: PORT });
});

// ─── Auth: Login ─────────────────────────────────────────────────────────────
// Accepts { email, password } — frontend sends phone-derived email internally
app.post("/api/auth/login", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase not configured" });
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });

  try {
    const { data: authData, error: signInError } =
      await supabase.auth.signInWithPassword({ email, password });
    if (signInError) return res.status(401).json({ error: signInError.message });

    const user = authData.user;
    const { data: profile } = await supabase
      .from("profiles").select("*").eq("id", user.id).maybeSingle();

    return res.json({ session: authData.session, user, profile });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── Auth: Get current user ───────────────────────────────────────────────────
app.get("/api/auth/me", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase not configured" });
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer "))
    return res.status(401).json({ error: "Not signed in" });
  const token = authHeader.split(" ")[1];

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: "Invalid or expired token" });

    let profile = null;
    if (DATABASE_URL) {
      const { rows } = await dbQuery(
        `SELECT * FROM public.profiles WHERE id = $1 LIMIT 1`, [user.id]
      );
      profile = rows[0] ?? null;
    } else {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      profile = data;
    }

    return res.json({ user, profile });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── Teams: Read all enriched teams ──────────────────────────────────────────
// SPOC reads all mentor-created pair-teams to pick members from
app.get("/api/teams", async (_req, res) => {
  try {
    let teams = [], members = [], profiles = [];

    if (DATABASE_URL) {
      const [tRes, mRes, pRes] = await Promise.all([
        dbQuery(`SELECT * FROM public.teams ORDER BY created_at ASC;`),
        dbQuery(`SELECT * FROM public.team_members;`),
        dbQuery(`SELECT * FROM public.profiles;`),
      ]);
      teams    = tRes.rows || [];
      members  = mRes.rows || [];
      profiles = pRes.rows || [];
    } else if (supabase) {
      const [{ data: tData }, { data: mData }, { data: pData }] = await Promise.all([
        supabase.from("teams").select("*").order("created_at", { ascending: true }),
        supabase.from("team_members").select("*"),
        supabase.from("profiles").select("*"),
      ]);
      teams    = tData || [];
      members  = mData || [];
      profiles = pData || [];
    }

    const profileMap = new Map(profiles.map((p) => [p.id, p]));
    const enriched = teams.map((team) => {
      const teamMembers = members.filter((m) => m.team_id === team.id);
      const memberProfiles = teamMembers.map((m) => {
        const profile = profileMap.get(m.member_id);
        if (!profile) return null;
        return { ...profile, assigned_skill: m.assigned_skill ?? null };
      }).filter(Boolean);
      const cat = team.category || (memberProfiles.length === 1 ? "Solo" : "Pairs");
      return {
        team,
        leader: profileMap.get(team.leader_id) ?? null,
        members: memberProfiles,
        stats: computeStats(memberProfiles, cat),
      };
    });

    return res.json({ data: enriched });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── SPOC Final Teams ─────────────────────────────────────────────────────────

// ── Notification helper ───────────────────────────────────────────────────────
/**
 * Insert a notification row for each profile_id in the list.
 * Fire-and-forget — errors are logged but don't fail the main request.
 */
async function sendNotifications(profileIds, { type, title, message, metadata = {} }) {
  if (!profileIds || profileIds.length === 0) return;
  const rows = profileIds.map((id) => ({ profile_id: id, type, title, message, metadata }));
  try {
    if (DATABASE_URL) {
      for (const r of rows) {
        await dbQuery(
          `INSERT INTO public.notifications (profile_id, type, title, message, metadata)
           VALUES ($1, $2, $3, $4, $5)`,
          [r.profile_id, r.type, r.title, r.message, JSON.stringify(r.metadata)]
        );
      }
    } else if (supabase) {
      await supabase.from("notifications").insert(rows);
    }
  } catch (err) {
    console.warn("[notifications] Failed to send:", err.message);
  }
}

// GET — list all final teams
app.get("/api/spoc/final-teams", async (_req, res) => {
  try {
    if (DATABASE_URL) {
      const { rows } = await dbQuery(
        `SELECT * FROM public.spoc_final_teams ORDER BY created_at ASC;`
      );
      return res.json({ data: rows });
    } else if (supabase) {
      const { data, error } = await supabase
        .from("spoc_final_teams").select("*").order("created_at", { ascending: true });
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ data: data ?? [] });
    }
    return res.json({ data: [] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST — create a new final team
app.post("/api/spoc/final-teams", async (req, res) => {
  const { name, ministry, member_ids } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "Team name is required" });
  if (!Array.isArray(member_ids)) return res.status(400).json({ error: "member_ids must be an array" });

  // Resolve creator from token
  let createdBy = null;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ") && supabase) {
    try {
      const { data: { user } } = await supabase.auth.getUser(authHeader.split(" ")[1]);
      createdBy = user?.id ?? null;
    } catch (_) {}
  }

  try {
    if (DATABASE_URL) {
      const { rows } = await dbQuery(
        `INSERT INTO public.spoc_final_teams (name, ministry, member_ids, created_by)
         VALUES ($1, $2, $3, $4) RETURNING *;`,
        [name.trim(), ministry || null, member_ids, createdBy]
      );
      // Notify all members they've been added to a final team
      sendNotifications(member_ids, {
        type: "spoc_team_added",
        title: "🎉 You're in the Final Team!",
        message: `You have been selected for the final SIH 2026 team "${name.trim()}"${ministry ? ` under ${ministry}` : ""}. Congratulations!`,
        metadata: { team_name: name.trim(), ministry: ministry || null, team_id: rows[0]?.id },
      });
      return res.json({ data: rows[0] });
    } else if (supabase) {
      const { data, error } = await supabase
        .from("spoc_final_teams")
        .insert([{ name: name.trim(), ministry: ministry || null, member_ids, created_by: createdBy }])
        .select().single();
      if (error) return res.status(500).json({ error: error.message });
      // Notify all members
      sendNotifications(member_ids, {
        type: "spoc_team_added",
        title: "🎉 You're in the Final Team!",
        message: `You have been selected for the final SIH 2026 team "${name.trim()}"${ministry ? ` under ${ministry}` : ""}. Congratulations!`,
        metadata: { team_name: name.trim(), ministry: ministry || null, team_id: data?.id },
      });
      return res.json({ data });
    }
    return res.status(500).json({ error: "No database configured" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH — update a final team
app.patch("/api/spoc/final-teams/:id", async (req, res) => {
  const { id } = req.params;
  const { name, ministry, member_ids } = req.body;

  try {
    if (DATABASE_URL) {
      const { rows } = await dbQuery(
        `UPDATE public.spoc_final_teams
         SET name       = COALESCE($1, name),
             ministry   = COALESCE($2, ministry),
             member_ids = COALESCE($3, member_ids),
             updated_at = now()
         WHERE id = $4 RETURNING *;`,
        [name?.trim() ?? null, ministry ?? null, member_ids ?? null, id]
      );
      if (!rows.length) return res.status(404).json({ error: "Team not found" });
      return res.json({ data: rows[0] });
    } else if (supabase) {
      const patch = { updated_at: new Date().toISOString() };
      if (name !== undefined) patch.name = name.trim();
      if (ministry !== undefined) patch.ministry = ministry;
      if (member_ids !== undefined) patch.member_ids = member_ids;
      const { data, error } = await supabase
        .from("spoc_final_teams").update(patch).eq("id", id).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ data });
    }
    return res.status(500).json({ error: "No database configured" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE — remove a final team
app.delete("/api/spoc/final-teams/:id", async (req, res) => {
  const { id } = req.params;
  try {
    // Fetch the team first so we know who to notify
    let memberIds = [];
    let teamName = "";
    let ministry = "";

    if (DATABASE_URL) {
      const { rows } = await dbQuery(
        `SELECT name, ministry, member_ids FROM public.spoc_final_teams WHERE id = $1`,
        [id]
      );
      if (rows[0]) {
        memberIds = rows[0].member_ids || [];
        teamName  = rows[0].name;
        ministry  = rows[0].ministry || "";
      }
      await dbQuery(`DELETE FROM public.spoc_final_teams WHERE id = $1;`, [id]);
    } else if (supabase) {
      const { data: ft } = await supabase
        .from("spoc_final_teams").select("name, ministry, member_ids").eq("id", id).single();
      if (ft) {
        memberIds = ft.member_ids || [];
        teamName  = ft.name;
        ministry  = ft.ministry || "";
      }
      const { error } = await supabase.from("spoc_final_teams").delete().eq("id", id);
      if (error) return res.status(500).json({ error: error.message });
    }

    // Notify all affected members
    if (memberIds.length > 0) {
      sendNotifications(memberIds, {
        type: "spoc_team_removed",
        title: "⚠ Final Team Disbanded",
        message: `The final SIH 2026 team "${teamName}"${ministry ? ` (${ministry})` : ""} that you were part of has been removed by the SPOC. Please await further instructions.`,
        metadata: { team_name: teamName, ministry, team_id: id },
      });
    }

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── Fallback ─────────────────────────────────────────────────────────────────
app.get("*", (_req, res) => res.status(404).json({ error: "Not found" }));

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🛡  SPOC Backend running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
  console.log(`   DB    : ${DATABASE_URL ? "PostgreSQL (direct)" : supabase ? "Supabase client" : "⚠ not configured"}\n`);
});
