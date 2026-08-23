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
  "https://sih-website-4axu.vercel.app",
  ...(process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((s) => s.trim().replace(/\/$/, ""))
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

// ─── Fallback / Root health page ─────────────────────────────────────────────
app.get("*", (_req, res) => {
  const dbStatus = DATABASE_URL ? "PostgreSQL (direct)" : supabase ? "Supabase client" : "⚠ Not configured";
  res.status(200).send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>SPOC Backend API — SIH 2026</title>
      <style>
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: system-ui, -apple-system, sans-serif;
          background: #050b18;
          color: #e8ecf7;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          padding: 1.5rem;
        }
        .card {
          text-align: center;
          max-width: 520px;
          width: 100%;
          padding: 2.5rem 2rem;
          border: 1px solid rgba(201,162,39,0.25);
          border-radius: 1.25rem;
          background: #0a1226;
          box-shadow: 0 0 40px rgba(201,162,39,0.06);
        }
        .icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 3rem;
          height: 3rem;
          border-radius: 0.75rem;
          background: rgba(201,162,39,0.1);
          border: 1px solid rgba(201,162,39,0.3);
          font-size: 1.4rem;
          margin-bottom: 1.25rem;
        }
        .badge {
          display: inline-block;
          padding: 0.2rem 0.75rem;
          border-radius: 9999px;
          background: rgba(34,197,94,0.1);
          color: #22c55e;
          border: 1px solid rgba(34,197,94,0.3);
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 1rem;
        }
        h1 {
          font-size: 1.5rem;
          font-weight: 800;
          color: #ffffff;
          margin-bottom: 0.4rem;
        }
        .subtitle {
          color: #94a3b8;
          font-size: 0.8rem;
          margin-bottom: 1.75rem;
        }
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
          margin-bottom: 1.75rem;
        }
        .info-item {
          background: rgba(147,197,253,0.05);
          border: 1px solid rgba(147,197,253,0.1);
          border-radius: 0.75rem;
          padding: 0.75rem;
          text-align: left;
        }
        .info-label {
          font-size: 0.65rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #94a3b8;
          margin-bottom: 0.25rem;
        }
        .info-value {
          font-size: 0.8rem;
          font-weight: 600;
          color: #e8ecf7;
          word-break: break-all;
        }
        .info-value.ok { color: #22c55e; }
        .info-value.warn { color: #f59e0b; }
        .divider {
          border: none;
          border-top: 1px solid rgba(147,197,253,0.1);
          margin: 0 0 1.5rem 0;
        }
        .links {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        a {
          display: block;
          padding: 0.6rem 1rem;
          border-radius: 0.65rem;
          background: rgba(201,162,39,0.08);
          border: 1px solid rgba(201,162,39,0.25);
          color: #c9a227;
          text-decoration: none;
          font-size: 0.8rem;
          font-weight: 600;
          transition: background 0.15s, border-color 0.15s;
        }
        a:hover {
          background: rgba(201,162,39,0.15);
          border-color: rgba(201,162,39,0.45);
        }
        .footer {
          margin-top: 1.5rem;
          font-size: 0.7rem;
          color: #94a3b8;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="icon">🛡</div>
        <span class="badge">● Backend Active</span>
        <h1>SPOC Backend API</h1>
        <p class="subtitle">SIH 2026 · Final Team Formation · SMVEC</p>

        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Status</div>
            <div class="info-value ok">Running</div>
          </div>
          <div class="info-item">
            <div class="info-label">Port</div>
            <div class="info-value">${PORT}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Database</div>
            <div class="info-value ${DATABASE_URL ? "ok" : supabase ? "ok" : "warn"}">${dbStatus}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Uptime</div>
            <div class="info-value">${Math.floor(process.uptime())}s</div>
          </div>
        </div>

        <hr class="divider" />

        <div class="links">
          <a href="/api/health">Check Health Status — /api/health →</a>
          <a href="/api/spoc/final-teams">List Final Teams — /api/spoc/final-teams →</a>
        </div>

        <p class="footer">SPOC Portal REST API · Not Found responses go to <code>/api/*</code> routes</p>
      </div>
    </body>
    </html>
  `);
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🛡  SPOC Backend running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
  console.log(`   DB    : ${DATABASE_URL ? "PostgreSQL (direct)" : supabase ? "Supabase client" : "⚠ not configured"}\n`);
});
