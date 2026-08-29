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

// ─── SSE broadcast registry ───────────────────────────────────────────────────
// Keeps a set of active SSE response objects. When final teams change,
// all connected SPOC clients are notified to re-fetch.
const sseClients = new Set();

function broadcastUpdate(event, data = {}) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try { res.write(payload); } catch (_) { sseClients.delete(res); }
  }
}

// ─── Session invalidation ─────────────────────────────────────────────────────
// validSince: all sessions whose loginTime < validSince are rejected.
// Starts at server boot time — so a server restart clears all sessions.
// Call invalidateAllSessions() to clear without restarting.
//
// SESSION_TIMEOUT_MS: max session lifetime from login time.
// Default: 8 hours. Override via env SESSION_TIMEOUT_HOURS.
const SESSION_TIMEOUT_MS = (parseInt(process.env.SESSION_TIMEOUT_HOURS ?? "8", 10) || 8) * 60 * 60 * 1000;
let validSince = Date.now(); // server start = clears any pre-restart sessions

function invalidateAllSessions() {
  validSince = Date.now();
  // Broadcast to all connected SSE clients so they auto-logout immediately
  broadcastUpdate("session_invalidated", { reason: "logout_all" });
  console.log(`[SPOC] All sessions invalidated at ${new Date(validSince).toISOString()}`);
}

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
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Login-Time");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// ─── Database clients ─────────────────────────────────────────────────────────
const DATABASE_URL   = process.env.DATABASE_URL;
const SUPABASE_URL   = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON  = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = SUPABASE_URL && SUPABASE_ANON
  ? createClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
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

// ─── Request IP helper ───────────────────────────────────────────────────────
function extractIp(req) {
  return (req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "")
    .split(",")[0].trim().replace(/^::ffff:/, "");
}

// ─── Health ───────────────────────────────────────────────────────────────────
app.get(["/health", "/api/health"], (_req, res) => {
  res.json({ status: "ok", service: "spoc-backend", port: PORT });
});

// ─── SSE: real-time push to all SPOC clients ──────────────────────────────────
// Clients connect once and receive "final_teams_updated" events whenever
// any final team is created or patched. No auth required for SSE — the
// data sent is just a signal to re-fetch, not actual team content.
app.get("/api/spoc/events", (req, res) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering
  res.flushHeaders();

  // Send a heartbeat immediately so the client knows it's connected
  res.write("event: connected\ndata: {}\n\n");

  // Keep-alive ping every 25 s to prevent proxy timeouts
  const keepAlive = setInterval(() => {
    try { res.write(": ping\n\n"); } catch (_) { clearInterval(keepAlive); }
  }, 25_000);

  sseClients.add(res);

  req.on("close", () => {
    clearInterval(keepAlive);
    sseClients.delete(res);
  });
});

// ─── Claimed members: which member IDs are already in a final team ────────────
// Used by the TeamBuilder modal to grey-out taken members in real-time.
// Optional query param: excludeTeamId — omits that team's members from the result
// (used when editing an existing team so its own members aren't shown as "taken").
app.get("/api/spoc/claimed-members", async (req, res) => {
  const { excludeTeamId } = req.query;
  try {
    let ids = [];
    if (DATABASE_URL) {
      const { rows } = excludeTeamId
        ? await dbQuery(`SELECT member_ids FROM public.spoc_final_teams WHERE id <> $1;`, [excludeTeamId])
        : await dbQuery(`SELECT member_ids FROM public.spoc_final_teams;`);
      ids = rows.flatMap((r) => r.member_ids || []);
    } else if (supabase) {
      let q = supabase.from("spoc_final_teams").select("member_ids");
      if (excludeTeamId) q = q.neq("id", excludeTeamId);
      const { data } = await q;
      ids = (data ?? []).flatMap((r) => r.member_ids || []);
    }
    return res.json({ data: [...new Set(ids)] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── Logout All Sessions (master-only) ───────────────────────────────────────
// Bumps validSince to now, instantly invalidating every non-master token.
// All connected SSE clients receive a session_invalidated event and auto-logout.
app.post("/api/spoc/logout-all", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Not signed in" });
  const token = authHeader.split(" ")[1];
  if (token !== "master") return res.status(403).json({ error: "Master session required" });

  invalidateAllSessions();
  return res.json({ ok: true, invalidatedAt: validSince });
});

// ─── Access Log: read login attempts (admin use) ─────────────────────────────
// Returns the most recent N login attempts. Master-session only.
app.get("/api/spoc/access-log", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Not signed in" });
  const token = authHeader.split(" ")[1];

  // Only the master-password session may read access logs
  if (token !== "master") return res.status(403).json({ error: "Access denied — master session required" });

  try {
    const limit = Math.min(parseInt(req.query.limit ?? "200", 10), 500);

    let rows = [];
    if (DATABASE_URL) {
      const result = await dbQuery(
        `SELECT id, attempted_name, resolved_email, success, failure_reason,
                ip_address, user_agent, created_at
         FROM public.spoc_access_log
         ORDER BY created_at DESC
         LIMIT $1`,
        [limit]
      );
      rows = result.rows;
    } else if (supabase) {
      const { data, error: qErr } = await supabase
        .from("spoc_access_log")
        .select("id, attempted_name, resolved_email, success, failure_reason, ip_address, user_agent, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (qErr) return res.status(500).json({ error: qErr.message });
      rows = data ?? [];
    }

    return res.json({ data: rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── Auth: Login by name ──────────────────────────────────────────────────────
// Accepts { name, password } — looks up the SPOC profile by name to resolve
// the internal email, then signs in via Supabase. Never exposes the email.
//
// Master password path: if the supplied password matches SPOC_MASTER_PASSWORD,
// the login bypasses Supabase auth entirely and returns the SPOC profile
// directly. No Supabase session is issued — the frontend receives a synthetic
// token ("master") which the backend honours on subsequent requests.
app.post("/api/auth/login-by-name", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase not configured" });
  const { name, password } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "Name is required" });
  if (!password) return res.status(400).json({ error: "Password is required" });

  // Capture request metadata for access logging
  const ip = (req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "")
    .split(",")[0].trim().replace(/^::ffff:/, "");
  const userAgent = req.headers["user-agent"] || "";

  async function logAccess({ success, resolvedEmail = null, reason = null }) {
    try {
      if (DATABASE_URL) {
        await dbQuery(
          `INSERT INTO public.spoc_access_log (attempted_name, resolved_email, success, failure_reason, ip_address, user_agent)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [name.trim(), resolvedEmail, success, reason, ip, userAgent]
        );
      } else if (supabase) {
        await supabase.from("spoc_access_log").insert([{
          attempted_name: name.trim(), resolved_email: resolvedEmail,
          success, failure_reason: reason, ip_address: ip, user_agent: userAgent,
        }]);
      }
    } catch (_) { /* fire-and-forget */ }
  }

  // ── Master password bypass ────────────────────────────────────────────────
  // If the caller knows the master password they get full SPOC access without
  // going through Supabase. The name can be anything — we look up the first
  // SPOC profile in the DB and return it (or fall back to a synthetic profile).
  const MASTER_PASSWORD = process.env.SPOC_MASTER_PASSWORD;
  if (MASTER_PASSWORD && password === MASTER_PASSWORD) {
    let profile = null;
    let resolvedEmail = null;
    try {
      if (DATABASE_URL) {
        const { rows } = await dbQuery(
          `SELECT * FROM public.profiles WHERE role = 'spoc' LIMIT 1`
        );
        profile = rows[0] ?? null;
      } else {
        const { data } = await supabase
          .from("profiles").select("*").eq("role", "spoc").limit(1).maybeSingle();
        profile = data ?? null;
      }
      resolvedEmail = profile?.email ?? null;
    } catch (_) {}

    // If no SPOC profile exists in DB yet, synthesise a minimal one so the
    // frontend still gets a usable object.
    if (!profile) {
      profile = {
        id: "master",
        name: name.trim(),
        email: process.env.SPOC_EMAIL ?? "spoc@smvec.ac.in",
        role: "spoc",
      };
    }

    await logAccess({ success: true, resolvedEmail: resolvedEmail ?? profile.email, reason: "master-password" });

    // Return a synthetic session. The token value "master" is recognised by
    // /api/auth/me and other guarded routes below.
    return res.json({
      session: { access_token: "master", token_type: "bearer" },
      user: { id: profile.id, email: profile.email },
      profile,
    });
  }

  try {
    // Resolve the internal email from the profile row by matching name + role
    let email = null;
    if (DATABASE_URL) {
      const { rows } = await dbQuery(
        `SELECT email FROM public.profiles
         WHERE role = 'spoc' AND LOWER(name) = LOWER($1) LIMIT 1`,
        [name.trim()]
      );
      email = rows[0]?.email ?? null;
    } else {
      const { data } = await supabase
        .from("profiles")
        .select("email")
        .eq("role", "spoc")
        .ilike("name", name.trim())
        .limit(1)
        .maybeSingle();
      email = data?.email ?? null;
    }

    if (!email) {
      await logAccess({ success: false, reason: "Name not found" });
      return res.status(401).json({ error: "Invalid name or password" });
    }

    const { data: authData, error: signInError } =
      await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      await logAccess({ success: false, resolvedEmail: email, reason: "Wrong password" });
      return res.status(401).json({ error: "Invalid name or password" });
    }

    await logAccess({ success: true, resolvedEmail: email });

    const user = authData.user;
    let profile = null;
    if (DATABASE_URL) {
      const { rows } = await dbQuery(
        `SELECT * FROM public.profiles WHERE id = $1 LIMIT 1`, [user.id]
      );
      profile = rows[0] ?? null;
    } else {
      const { data } = await supabase
        .from("profiles").select("*").eq("id", user.id).maybeSingle();
      profile = data;
    }

    return res.json({ session: authData.session, user, profile });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── Auth: Login (email + password — kept for backward compat) ───────────────
// Accepts { email, password }
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

  // ── Session freshness check ───────────────────────────────────────────────
  // The frontend sends X-Login-Time (ms since epoch) so we can enforce:
  //   1. loginTime >= validSince   (not cleared by a logout-all)
  //   2. Date.now() - loginTime <= SESSION_TIMEOUT_MS  (not timed out)
  const loginTimeHeader = req.headers["x-login-time"];
  if (loginTimeHeader && token !== "master") {
    const loginTime = parseInt(loginTimeHeader, 10);
    if (!isNaN(loginTime)) {
      if (loginTime < validSince) {
        return res.status(401).json({ error: "Session cleared — please sign in again.", code: "SESSION_CLEARED" });
      }
      if (Date.now() - loginTime > SESSION_TIMEOUT_MS) {
        return res.status(401).json({ error: "Session expired — please sign in again.", code: "SESSION_EXPIRED" });
      }
    }
  }

  // ── Master token shortcut ─────────────────────────────────────────────────
  if (token === "master") {
    let profile = null;
    try {
      if (DATABASE_URL) {
        const { rows } = await dbQuery(`SELECT * FROM public.profiles WHERE role = 'spoc' LIMIT 1`);
        profile = rows[0] ?? null;
      } else {
        const { data } = await supabase.from("profiles").select("*").eq("role", "spoc").limit(1).maybeSingle();
        profile = data ?? null;
      }
    } catch (_) {}
    if (!profile) {
      profile = { id: "master", name: "SPOC", email: process.env.SPOC_EMAIL ?? "spoc@smvec.ac.in", role: "spoc" };
    }
    return res.json({ user: { id: profile.id, email: profile.email }, profile });
  }

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

// ─── Maintenance Mode gate ───────────────────────────────────────────────────
// Called by the SPOC frontend before rendering anything.
// Reads the "spoc_maintenance" key from system_settings (no auth needed).
app.get("/api/settings/spoc-maintenance", async (_req, res) => {
  try {
    let enabled = false;
    let message = "The SPOC portal is temporarily unavailable for maintenance. Please check back later.";
    if (DATABASE_URL) {
      const { rows } = await dbQuery(
        `SELECT value FROM public.system_settings WHERE key = 'spoc_maintenance' LIMIT 1`
      );
      if (rows[0]) {
        enabled = rows[0].value?.enabled === true;
        if (rows[0].value?.message) message = rows[0].value.message;
      }
    } else if (supabase) {
      const { data } = await supabase
        .from("system_settings").select("value")
        .eq("key", "spoc_maintenance").maybeSingle();
      if (data) {
        enabled = data.value?.enabled === true;
        if (data.value?.message) message = data.value.message;
      }
    }
    return res.json({ enabled, message: enabled ? message : "" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── Profiles: all students (for monitoring tab) ─────────────────────────────
app.get("/api/profiles", async (_req, res) => {
  try {
    if (DATABASE_URL) {
      const { rows } = await dbQuery(
        `SELECT id, name, register_no, email, department, year, section, gender, role
         FROM public.profiles WHERE role = 'student' ORDER BY name;`
      );
      return res.json({ data: rows });
    } else if (supabase) {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, register_no, email, department, year, section, gender, role")
        .eq("role", "student")
        .order("name");
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ data: data ?? [] });
    }
    return res.json({ data: [] });
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

// ─── Audit Log helper ────────────────────────────────────────────────────────
/**
 * logAudit({ action, entityId, entityName, details, ip })
 *
 * Writes one row to spoc_audit_log. Fire-and-forget — never throws.
 *
 * action      : 'CREATE_FINAL_TEAM' | 'UPDATE_FINAL_TEAM' | 'DELETE_FINAL_TEAM'
 * entityId    : final team id (string)
 * entityName  : team name at time of action
 * details     : arbitrary JSON object (diff summary)
 * ip          : requester IP — pass the already-extracted string
 */
async function logAudit({ action, entityId = null, entityName = null, details = {}, ip = null }) {
  try {
    if (DATABASE_URL) {
      await dbQuery(
        `INSERT INTO public.spoc_audit_log (action, entity_type, entity_id, entity_name, details, ip_address)
         VALUES ($1, 'final_team', $2, $3, $4, $5)`,
        [action, entityId ? String(entityId) : null, entityName, JSON.stringify(details), ip]
      );
    } else if (supabase) {
      await supabase.from("spoc_audit_log").insert([{
        action,
        entity_type: "final_team",
        entity_id: entityId ? String(entityId) : null,
        entity_name: entityName,
        details,
        ip_address: ip,
      }]);
    }
  } catch (_) { /* fire-and-forget */ }
}

// ─── Audit Log: read action history ──────────────────────────────────────────
app.get("/api/spoc/audit-log", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Not signed in" });
  const token = authHeader.split(" ")[1];

  // Only the master-password session may read audit/access logs
  if (token !== "master") return res.status(403).json({ error: "Access denied — master session required" });

  try {
    const limit = Math.min(parseInt(req.query.limit ?? "200", 10), 500);
    let rows = [];

    if (DATABASE_URL) {
      const result = await dbQuery(
        `SELECT id, action, entity_type, entity_id, entity_name, details, ip_address, created_at
         FROM public.spoc_audit_log
         ORDER BY created_at DESC
         LIMIT $1`,
        [limit]
      );
      rows = result.rows;
    } else if (supabase) {
      const { data, error: qErr } = await supabase
        .from("spoc_audit_log")
        .select("id, action, entity_type, entity_id, entity_name, details, ip_address, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (qErr) return res.status(500).json({ error: qErr.message });
      rows = data ?? [];
    }

    return res.json({ data: rows });
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

// ── Team composition validator ────────────────────────────────────────────────
// Resolves member profiles from IDs and checks the hard rules:
//   • Exactly 6 members
//   • ≥ 2 female members
// Returns null if valid, or an error string if not.
async function validateTeamComposition(memberIds, excludeTeamId = null, draft = false) {
  if (!memberIds || memberIds.length === 0) return null; // no members to check yet
  // Draft teams are allowed to have fewer than 6 members — skip the count check.
  if (!draft && memberIds.length !== 6) return `Team must have exactly 6 members (got ${memberIds.length})`;
  // Draft teams with < 6 members skip gender/dept validation too — nothing to enforce yet.
  if (draft && memberIds.length < 6) return null;

  // Resolve genders
  let profiles = [];
  if (DATABASE_URL) {
    const { rows } = await dbQuery(
      `SELECT gender FROM public.profiles WHERE id = ANY($1)`, [memberIds]
    );
    profiles = rows;
  } else if (supabase) {
    const { data } = await supabase
      .from("profiles").select("gender").in("id", memberIds);
    profiles = data ?? [];
  }

  const femaleCount = profiles.filter((p) => p.gender === "Female").length;
  if (femaleCount < 2) {
    return `Team must include at least 2 female members (currently ${femaleCount}). Please add more female members before saving.`;
  }
  return null;
}
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

// ── Master-only guard helper ──────────────────────────────────────────────────
// Returns true if the request carries the master token.
// Used to block all write operations for read-only (normal SPOC) sessions.
function requireMaster(req, res) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
  if (token !== "master") {
    res.status(403).json({
      error: "Read-only access — this action requires a master session. Please log in with the master password to make changes.",
    });
    return false;
  }
  return true;
}

// POST — create a new final team
app.post("/api/spoc/final-teams", async (req, res) => {
  if (!requireMaster(req, res)) return;
  const { name, ministry, member_ids, draft = false, selected_ps_number: initialPs } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "Team name is required" });
  if (!Array.isArray(member_ids)) return res.status(400).json({ error: "member_ids must be an array" });
  if (member_ids.length === 0) return res.status(400).json({ error: "At least one member is required" });

  const ip = extractIp(req);

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
    // ── Race-condition guard: check no member is already claimed ────────────
    let alreadyClaimedIds = [];
    if (DATABASE_URL) {
      const { rows: existing } = await dbQuery(
        `SELECT member_ids FROM public.spoc_final_teams;`
      );
      const allClaimed = new Set(existing.flatMap((r) => r.member_ids || []));
      alreadyClaimedIds = member_ids.filter((id) => allClaimed.has(id));
    } else if (supabase) {
      const { data: existing } = await supabase.from("spoc_final_teams").select("member_ids");
      const allClaimed = new Set((existing ?? []).flatMap((r) => r.member_ids || []));
      alreadyClaimedIds = member_ids.filter((id) => allClaimed.has(id));
    }
    if (alreadyClaimedIds.length > 0) {
      return res.status(409).json({
        error: "One or more members are already assigned to another final team.",
        claimed_ids: alreadyClaimedIds,
      });
    }

    // ── Female-count rule ─────────────────────────────────────────────────────
    const compositionError = await validateTeamComposition(member_ids, null, draft);
    if (compositionError) {
      return res.status(422).json({ error: compositionError });
    }

    if (DATABASE_URL) {
      const { rows } = await dbQuery(
        `INSERT INTO public.spoc_final_teams (name, ministry, member_ids, created_by, selected_ps_number)
         VALUES ($1, $2, $3, $4, $5) RETURNING *;`,
        [name.trim(), ministry || null, member_ids, createdBy, initialPs ?? null]
      );
      sendNotifications(member_ids, {
        type: "spoc_team_added",
        title: "🎉 You're in the Final Team!",
        message: `You have been selected for the final SIH 2026 team "${name.trim()}"${ministry ? ` under ${ministry}` : ""}. Congratulations!`,
        metadata: { team_name: name.trim(), ministry: ministry || null, team_id: rows[0]?.id },
      });
      broadcastUpdate("final_teams_updated", { action: "created", team_id: rows[0]?.id });
      logAudit({
        action: "CREATE_FINAL_TEAM",
        entityId: rows[0]?.id,
        entityName: name.trim(),
        details: { ministry: ministry || null, member_count: member_ids.length },
        ip,
      });
      return res.json({ data: rows[0] });
    } else if (supabase) {
      const { data, error } = await supabase
        .from("spoc_final_teams")
        .insert([{ name: name.trim(), ministry: ministry || null, member_ids, created_by: createdBy, selected_ps_number: initialPs ?? null }])
        .select().single();
      if (error) return res.status(500).json({ error: error.message });
      sendNotifications(member_ids, {
        type: "spoc_team_added",
        title: "🎉 You're in the Final Team!",
        message: `You have been selected for the final SIH 2026 team "${name.trim()}"${ministry ? ` under ${ministry}` : ""}. Congratulations!`,
        metadata: { team_name: name.trim(), ministry: ministry || null, team_id: data?.id },
      });
      broadcastUpdate("final_teams_updated", { action: "created", team_id: data?.id });
      logAudit({
        action: "CREATE_FINAL_TEAM",
        entityId: data?.id,
        entityName: name.trim(),
        details: { ministry: ministry || null, member_count: member_ids.length },
        ip,
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
  if (!requireMaster(req, res)) return;
  const { id } = req.params;
  const { name, ministry, member_ids, draft = false, selected_ps_number } = req.body;
  const ip = extractIp(req);

  try {
    // Fetch current team to detect member changes for notifications
    let prevMemberIds = [];
    let prevName = "";
    let prevSelectedPs = null;
    if (DATABASE_URL) {
      const { rows: prev } = await dbQuery(
        `SELECT name, member_ids, selected_ps_number FROM public.spoc_final_teams WHERE id = $1`,
        [id]
      );
      if (prev[0]) {
        prevMemberIds   = prev[0].member_ids || [];
        prevName        = prev[0].name;
        prevSelectedPs  = prev[0].selected_ps_number ?? null;
      }
    } else if (supabase) {
      const { data: prev } = await supabase
        .from("spoc_final_teams").select("name, member_ids, selected_ps_number").eq("id", id).maybeSingle();
      if (prev) {
        prevMemberIds  = prev.member_ids || [];
        prevName       = prev.name;
        prevSelectedPs = prev.selected_ps_number ?? null;
      }
    }

    // ── Race-condition guard: new members must not be claimed elsewhere ────────
    if (member_ids !== undefined) {
      let existingClaimed = [];
      if (DATABASE_URL) {
        const { rows: others } = await dbQuery(
          `SELECT member_ids FROM public.spoc_final_teams WHERE id <> $1;`, [id]
        );
        const claimedElsewhere = new Set(others.flatMap((r) => r.member_ids || []));
        existingClaimed = member_ids.filter((mid) => claimedElsewhere.has(mid));
      } else if (supabase) {
        const { data: others } = await supabase
          .from("spoc_final_teams").select("member_ids").neq("id", id);
        const claimedElsewhere = new Set((others ?? []).flatMap((r) => r.member_ids || []));
        existingClaimed = member_ids.filter((mid) => claimedElsewhere.has(mid));
      }
      if (existingClaimed.length > 0) {
        return res.status(409).json({
          error: "One or more members are already assigned to another final team.",
          claimed_ids: existingClaimed,
        });
      }

      // ── Female-count rule ───────────────────────────────────────────────────
      const compositionError = await validateTeamComposition(member_ids, null, draft);
      if (compositionError) {
        return res.status(422).json({ error: compositionError });
      }
    }

    let updated = null;
    if (DATABASE_URL) {
      const { rows } = await dbQuery(
        `UPDATE public.spoc_final_teams
         SET name                = COALESCE($1, name),
             ministry            = COALESCE($2, ministry),
             member_ids          = COALESCE($3, member_ids),
             selected_ps_number  = CASE WHEN $5::boolean THEN $6 ELSE selected_ps_number END,
             updated_at          = now()
         WHERE id = $4 RETURNING *;`,
        [
          name?.trim() ?? null,
          ministry ?? null,
          member_ids ?? null,
          id,
          selected_ps_number !== undefined,   // $5 — whether to update
          selected_ps_number ?? null,          // $6 — new value (null clears it)
        ]
      );
      if (!rows.length) return res.status(404).json({ error: "Team not found" });
      updated = rows[0];
    } else if (supabase) {
      const patch = { updated_at: new Date().toISOString() };
      if (name !== undefined) patch.name = name.trim();
      if (ministry !== undefined) patch.ministry = ministry;
      if (member_ids !== undefined) patch.member_ids = member_ids;
      if (selected_ps_number !== undefined) patch.selected_ps_number = selected_ps_number ?? null;
      const { data, error } = await supabase
        .from("spoc_final_teams").update(patch).eq("id", id).select().single();
      if (error) return res.status(500).json({ error: error.message });
      updated = data;
    } else {
      return res.status(500).json({ error: "No database configured" });
    }

    // Notify members about the update
    const finalName = updated?.name ?? name?.trim() ?? prevName;
    const finalMinistry = updated?.ministry ?? ministry ?? null;
    const finalIds = updated?.member_ids ?? member_ids ?? prevMemberIds;

    // Newly added members: in finalIds but not in prevMemberIds
    const prevSet = new Set(prevMemberIds);
    const newSet = new Set(finalIds);
    const addedIds = finalIds.filter((id) => !prevSet.has(id));
    const removedIds = prevMemberIds.filter((id) => !newSet.has(id));
    const keptIds = finalIds.filter((id) => prevSet.has(id));

    if (addedIds.length > 0) {
      sendNotifications(addedIds, {
        type: "spoc_team_added",
        title: "🎉 You're in the Final Team!",
        message: `You have been selected for the final SIH 2026 team "${finalName}"${finalMinistry ? ` under ${finalMinistry}` : ""}. Congratulations!`,
        metadata: { team_name: finalName, ministry: finalMinistry, team_id: id },
      });
    }
    if (removedIds.length > 0) {
      sendNotifications(removedIds, {
        type: "spoc_team_removed",
        title: "⚠ Removed from Final Team",
        message: `You have been removed from the final SIH 2026 team "${finalName}"${finalMinistry ? ` (${finalMinistry})` : ""}. Please await further instructions from your SPOC.`,
        metadata: { team_name: finalName, ministry: finalMinistry, team_id: id },
      });
    }
    if (keptIds.length > 0 && (name !== undefined || ministry !== undefined)) {
      sendNotifications(keptIds, {
        type: "spoc_team_added",
        title: "📋 Your Final Team Was Updated",
        message: `Your SIH 2026 final team has been updated to "${finalName}"${finalMinistry ? ` under ${finalMinistry}` : ""}. Your membership continues.`,
        metadata: { team_name: finalName, ministry: finalMinistry, team_id: id },
      });
    }

    // Notify all members when the selected problem statement changes
    const finalSelectedPs = updated?.selected_ps_number ?? null;
    if (selected_ps_number !== undefined && selected_ps_number !== prevSelectedPs) {
      const notifyIds = [...new Set([...addedIds, ...keptIds])];
      if (finalSelectedPs) {
        sendNotifications(notifyIds, {
          type: "spoc_ps_selected",
          title: "📌 Problem Statement Selected",
          message: `Your final team "${finalName}" has selected problem statement ${finalSelectedPs} to work on.`,
          metadata: { team_name: finalName, ministry: finalMinistry, team_id: id, ps_number: finalSelectedPs },
        });
      } else {
        sendNotifications(notifyIds, {
          type: "spoc_ps_selected",
          title: "📌 Problem Statement Cleared",
          message: `The selected problem statement for your final team "${finalName}" has been cleared.`,
          metadata: { team_name: finalName, ministry: finalMinistry, team_id: id, ps_number: null },
        });
      }
    }

    broadcastUpdate("final_teams_updated", { action: "updated", team_id: id });

    // Build a human-readable diff for the audit log
    const auditDetails = {};
    if (name !== undefined && name?.trim() !== prevName) auditDetails.renamed = { from: prevName, to: name.trim() };
    if (ministry !== undefined) auditDetails.ministry = ministry || null;
    if (selected_ps_number !== undefined) auditDetails.selected_ps_number = selected_ps_number ?? null;
    if (addedIds.length > 0)   auditDetails.members_added   = addedIds.length;
    if (removedIds.length > 0) auditDetails.members_removed = removedIds.length;
    if (keptIds.length > 0)    auditDetails.members_kept    = keptIds.length;
    logAudit({
      action: "UPDATE_FINAL_TEAM",
      entityId: id,
      entityName: finalName,
      details: auditDetails,
      ip,
    });

    return res.json({ data: updated });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE — remove a final team (with member notifications + broadcast)
app.delete("/api/spoc/final-teams/:id", async (req, res) => {
  if (!requireMaster(req, res)) return;
  const { id } = req.params;
  const ip = extractIp(req);
  try {
    let memberIds = [];
    let teamName  = "";
    let ministry  = "";

    // Fetch team details before deleting so we can notify members
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
    } else {
      return res.status(500).json({ error: "No database configured" });
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

    broadcastUpdate("final_teams_updated", { action: "deleted", team_id: id });
    logAudit({
      action: "DELETE_FINAL_TEAM",
      entityId: id,
      entityName: teamName,
      details: { ministry, member_count: memberIds.length },
      ip,
    });
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

// ─── PS Change Requests (SPOC) ───────────────────────────────────────────────

// GET /api/spoc/ps-change-requests
// Returns all change requests (pending first, then by date).
app.get("/api/spoc/ps-change-requests", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Not signed in" });

  try {
    let rows = [];
    if (DATABASE_URL) {
      const result = await dbQuery(
        `SELECT r.*,
                p.name AS requester_name, p.register_no AS requester_regno, p.department AS requester_dept
         FROM public.ps_change_requests r
         LEFT JOIN public.profiles p ON p.id = r.requested_by
         ORDER BY
           CASE r.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
           r.created_at DESC`
      );
      rows = result.rows;
    } else if (supabase) {
      const { data, error } = await supabase
        .from("ps_change_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      rows = data ?? [];
    }
    return res.json({ data: rows });
  } catch (err) {
    console.warn("[ps-change-requests] Error:", err.message);
    return res.json({ data: [] });
  }
});

// PATCH /api/spoc/ps-change-requests/:id/review
// Approve or reject a change request.
// Body: { action: "approve" | "reject", review_note?: string }
// When approved: updates the team's selected_ps_number / custom_ps_title.
app.patch("/api/spoc/ps-change-requests/:id/review", async (req, res) => {
  if (!requireMaster(req, res)) return;
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Not signed in" });

  const { id } = req.params;
  const { action, review_note } = req.body;

  if (!["approve", "reject"].includes(action)) {
    return res.status(400).json({ error: "action must be 'approve' or 'reject'" });
  }

  try {
    // Fetch the request
    let cr = null;
    if (DATABASE_URL) {
      const { rows } = await dbQuery(
        `SELECT * FROM public.ps_change_requests WHERE id = $1 LIMIT 1`, [id]
      );
      cr = rows[0] ?? null;
    } else if (supabase) {
      const { data } = await supabase
        .from("ps_change_requests").select("*").eq("id", id).maybeSingle();
      cr = data ?? null;
    }
    if (!cr) return res.status(404).json({ error: "Change request not found" });
    if (cr.status !== "pending") {
      return res.status(409).json({ error: `Request is already ${cr.status}` });
    }

    const newStatus    = action === "approve" ? "approved" : "rejected";
    const reviewedAt   = new Date().toISOString();

    if (DATABASE_URL) {
      await dbQuery(
        `UPDATE public.ps_change_requests
         SET status = $1, review_note = $2, reviewed_at = $3
         WHERE id = $4`,
        [newStatus, review_note?.trim() ?? null, reviewedAt, id]
      );
    } else if (supabase) {
      await supabase.from("ps_change_requests").update({
        status: newStatus,
        review_note: review_note?.trim() ?? null,
        reviewed_at: reviewedAt,
      }).eq("id", id);
    }

    // If approved → apply the new PS to the team
    if (action === "approve") {
      if (DATABASE_URL) {
        await dbQuery(
          `UPDATE public.spoc_final_teams
           SET selected_ps_number = $1,
               custom_ps_title    = $2,
               updated_at         = now()
           WHERE id = $3`,
          [cr.new_ps ?? null, cr.new_custom ?? null, cr.team_id]
        );
      } else if (supabase) {
        await supabase.from("spoc_final_teams").update({
          selected_ps_number: cr.new_ps ?? null,
          custom_ps_title:    cr.new_custom ?? null,
          updated_at:         reviewedAt,
        }).eq("id", cr.team_id);
      }
      broadcastUpdate("final_teams_updated", { action: "ps_change_approved", team_id: cr.team_id });
    }

    // Notify the team members
    try {
      let memberIds = [];
      if (DATABASE_URL) {
        const { rows } = await dbQuery(
          `SELECT member_ids FROM public.spoc_final_teams WHERE id = $1`, [cr.team_id]
        );
        memberIds = rows[0]?.member_ids ?? [];
      } else if (supabase) {
        const { data } = await supabase
          .from("spoc_final_teams").select("member_ids").eq("id", cr.team_id).maybeSingle();
        memberIds = data?.member_ids ?? [];
      }
      if (memberIds.length > 0) {
        await sendNotifications(memberIds, {
          type:    "ps_change_request",
          title:   action === "approve" ? "PS Change Request Approved ✅" : "PS Change Request Rejected ❌",
          message: action === "approve"
            ? `Your request to change problem statement has been approved. Your team is now working on ${cr.new_ps || "your updated problem statement"}.`
            : `Your request to change problem statement has been rejected.${review_note ? ` Note: ${review_note}` : ""}`,
          metadata: { team_id: cr.team_id, request_id: id },
        });
      }
    } catch (_) { /* fire-and-forget */ }

    return res.json({ ok: true, status: newStatus });
  } catch (err) {
    console.error("[ps-change-requests/review] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── SIH Problem Statements (read from shared DB table) ───────────────────────
// GET /api/problems/sih2026// Reads from the sih_problems table kept current by the participant backend.
// Falls back to an empty array if the table doesn't exist yet.
app.get("/api/problems/sih2026", async (_req, res) => {
  try {
    if (DATABASE_URL) {
      const { rows } = await dbQuery(
        `SELECT ps_number AS "psNumber", sno, organization, title, category, theme, deadline
         FROM public.sih_problems ORDER BY sno ASC`
      );
      return res.json({ data: rows, count: rows.length });
    } else if (supabase) {
      const { data, error } = await supabase
        .from("sih_problems")
        .select("ps_number, sno, organization, title, category, theme, deadline")
        .order("sno", { ascending: true });
      if (error) throw new Error(error.message);
      const rows = (data ?? []).map((r) => ({ ...r, psNumber: r.ps_number }));
      return res.json({ data: rows, count: rows.length });
    }
    return res.json({ data: [], count: 0 });
  } catch (err) {
    // Table might not exist yet — return empty so frontends fall back to static data
    console.warn("[/api/problems/sih2026] DB read failed:", err.message);
    return res.json({ data: [], count: 0 });
  }
});

// ─── Team XLSX Export ─────────────────────────────────────────────────────────
// GET /api/spoc/export-teams/:type
// type = "software" | "hardware" | "aicte"
// Returns an xlsx file generated live from the database.
// Same format as export-teams-xlsx.js.

const PS_CATEGORY_MAP = {
  SIH26001:"Software",SIH26002:"Software",SIH26003:"Software",SIH26004:"Hardware",
  SIH26005:"Hardware",SIH26006:"Software",SIH26007:"Hardware",SIH26008:"Hardware",
  SIH26009:"Software",SIH26010:"Hardware",SIH26011:"Software",SIH26012:"Software",
  SIH26013:"Software",SIH26014:"Software",SIH26015:"Software",SIH26016:"Software",
  SIH26017:"Software",SIH26018:"Software",SIH26019:"Software",SIH26020:"Software",
  SIH26021:"Software",SIH26022:"Software",SIH26023:"Software",SIH26024:"Hardware",
  SIH26025:"Hardware",SIH26026:"Hardware",SIH26027:"Software",SIH26028:"Software",
  SIH26029:"Software",SIH26030:"Software",SIH26031:"Software",SIH26032:"Software",
  SIH26033:"Software",SIH26034:"Software",SIH26035:"Software",SIH26036:"Software",
  SIH26037:"Hardware",SIH26038:"Hardware",SIH26039:"Software",SIH26040:"Software",
  SIH26041:"Software",SIH26042:"Software",SIH26043:"Software",SIH26044:"Hardware",
  SIH26045:"Hardware",SIH26046:"Hardware",SIH26047:"Software",SIH26048:"Software",
  SIH26049:"Software",SIH26050:"Software",SIH26051:"Software",SIH26052:"Software",
  SIH26053:"Software",SIH26054:"Software",SIH26055:"Software",SIH26056:"Software",
  SIH26057:"Software",SIH26058:"Software",SIH26059:"Software",SIH26060:"Software",
  SIH26061:"Software",SIH26062:"Software",SIH26063:"Software",SIH26064:"Software",
  SIH26065:"Software",SIH26066:"Software",SIH26067:"Software",SIH26068:"Software",
  SIH26069:"Software",SIH26070:"Software",SIH26071:"Software",SIH26072:"Software",
  SIH26073:"Software",SIH26074:"Software",SIH26075:"Software",SIH26076:"Software",
  SIH26077:"Software",SIH26078:"Software",SIH26079:"Software",SIH26080:"Software",
  SIH26081:"Software",SIH26082:"Software",SIH26083:"Software",SIH26084:"Software",
  SIH26085:"Software",SIH26086:"Hardware",SIH26087:"Hardware",SIH26088:"Hardware",
  SIH26089:"Hardware",SIH26090:"Hardware",SIH26091:"Hardware",SIH26092:"Hardware",
  SIH26093:"Hardware",SIH26094:"Hardware",SIH26095:"Hardware",SIH26096:"Hardware",
  SIH26097:"Hardware",SIH26098:"Hardware",SIH26099:"Hardware",SIH26100:"Hardware",
  SIH26101:"Software",SIH26102:"Software",SIH26103:"Software",SIH26104:"Software",
  SIH26105:"Software",SIH26106:"Software",SIH26107:"Software",SIH26108:"Software",
  SIH26109:"Software",SIH26110:"Software",SIH26111:"Software",SIH26112:"Software",
  SIH26113:"Software",SIH26114:"Software",SIH26115:"Software",SIH26116:"Software",
  SIH26117:"Software",SIH26118:"Hardware",SIH26119:"Hardware",SIH26120:"Hardware",
  SIH26121:"Hardware",SIH26122:"Hardware",SIH26123:"Software",SIH26124:"Software",
  SIH26125:"Software",SIH26126:"Software",SIH26127:"Software",SIH26128:"Software",
  SIH26129:"Software",SIH26130:"Software",SIH26131:"Software",SIH26132:"Software",
  SIH26133:"Software",SIH26134:"Software",SIH26135:"Software",SIH26136:"Software",
  SIH26137:"Software",SIH26138:"Software",SIH26139:"Software",SIH26140:"Software",
  SIH26141:"Software",SIH26142:"Software",SIH26143:"Software",SIH26144:"Software",
  SIH26145:"Software",SIH26146:"Software",SIH26147:"Software",SIH26148:"Software",
  SIH26149:"Software",SIH26150:"Software",SIH26151:"Hardware",SIH26152:"Hardware",
  SIH26153:"Hardware",SIH26154:"Hardware",SIH26155:"Hardware",SIH26156:"Hardware",
  SIH26157:"Hardware",SIH26158:"Hardware",SIH26159:"Hardware",SIH26160:"Hardware",
  SIH26161:"Hardware",SIH26162:"Hardware",SIH26163:"Software",SIH26164:"Software",
  SIH26165:"Software",SIH26166:"Software",SIH26167:"Software",SIH26168:"Software",
  SIH26169:"Software",SIH26170:"Software",SIH26171:"Software",SIH26172:"Software",
  SIH26173:"Software",SIH26174:"Software",SIH26175:"Software",SIH26176:"Software",
  SIH26177:"Software",SIH26178:"Software",SIH26179:"Software",SIH26180:"Software",
  SIH26181:"Hardware",SIH26182:"Hardware",SIH26183:"Hardware",SIH26184:"Hardware",
  SIH26185:"Hardware",SIH26186:"Hardware",SIH26187:"Hardware",SIH26188:"Hardware",
  SIH26189:"Hardware",SIH26190:"Hardware",SIH26191:"Hardware",SIH26192:"Hardware",
  SIH26193:"Hardware",SIH26194:"Software",SIH26195:"Software",SIH26196:"Software",
  SIH26197:"Software",SIH26198:"Software",SIH26199:"Software",SIH26200:"Software",
  SIH26201:"Software",SIH26202:"Software",SIH26203:"Software",SIH26204:"Software",
  SIH26205:"Software",SIH26206:"Software",SIH26207:"Software",SIH26208:"Software",
  SIH26209:"Software",SIH26210:"Software",SIH26211:"Software",SIH26212:"Software",
  SIH26213:"Software",SIH26214:"Software",SIH26215:"Software",SIH26216:"Hardware",
  SIH26217:"Hardware",SIH26218:"Hardware",SIH26219:"Hardware",SIH26220:"Hardware",
  SIH26221:"Hardware",SIH26222:"Hardware",SIH26223:"Hardware",SIH26224:"Hardware",
  SIH26225:"Hardware",SIH26226:"Hardware",SIH26227:"Hardware",SIH26228:"Hardware",
  SIH26229:"Software",
};

const XLSX_COL_HEADERS = ["S.No","Team Name","Member Name","Register No","Phone","Department / Year / Sec","Gender","Hindi Proficiency","Remarks"];
const XLSX_COL_WIDTHS  = [6, 38, 28, 16, 14, 42, 10, 20, 30];

function buildTeamsSheet(ws, teams, memberMap, label) {
  const ExcelJS = ws.workbook.creator ? ws : null; void ExcelJS;

  // Title row
  ws.mergeCells(1, 1, 1, XLSX_COL_HEADERS.length);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = `SIH 2026 — Final Teams (${label})`;
  titleCell.font  = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  titleCell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A2744" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 28;

  // Column header row
  const hdrRow = ws.getRow(2);
  hdrRow.values = XLSX_COL_HEADERS;
  hdrRow.eachCell((cell) => {
    cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3864" } };
    cell.font      = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.border    = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  hdrRow.height = 22;

  XLSX_COL_WIDTHS.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  let rowIdx = 3;
  let sno    = 1;

  for (const team of teams) {
    const members = (team.member_ids ?? []).map((id) => memberMap[id]).filter(Boolean);
    const isAicte = (team.ministry ?? "").toLowerCase().includes("aicte");
    const psInfo  = team.selected_ps_number
      ? `${team.selected_ps_number} (${PS_CATEGORY_MAP[team.selected_ps_number] ?? "?"})`
      : isAicte
      ? "AICTE Open Innovation"
      : "Open Innovation";

    const numRows  = Math.max(members.length, 1);
    const startRow = rowIdx;
    const endRow   = rowIdx + numRows - 1;
    const bgArgb   = sno % 2 === 0 ? "FFF2F2F2" : "FFFFFFFF";
    const bdr      = { top: { style: "thin", color: { argb: "FFBFBFBF" } }, left: { style: "thin", color: { argb: "FFBFBFBF" } }, bottom: { style: "thin", color: { argb: "FFBFBFBF" } }, right: { style: "thin", color: { argb: "FFBFBFBF" } } };

    const mergeCols = [1, 2, 8, 9];
    if (numRows > 1) {
      for (const col of mergeCols) ws.mergeCells(startRow, col, endRow, col);
    }

    // S.No cell
    const snoCell = ws.getCell(startRow, 1);
    snoCell.value     = sno++;
    snoCell.font      = { bold: true };
    snoCell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: bgArgb } };
    snoCell.alignment = { vertical: "middle", horizontal: "center" };
    snoCell.border    = bdr;

    // Team name cell
    const nameCell = ws.getCell(startRow, 2);
    nameCell.value     = `${team.team_name}\n[Ministry: ${team.ministry ?? "—"}]\n[PS: ${psInfo}]`;
    nameCell.font      = { bold: true };
    nameCell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF8E7" } };
    nameCell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    nameCell.border    = bdr;

    // Hindi / Remarks (team-level, merged)
    for (const col of [8, 9]) {
      const c = ws.getCell(startRow, col);
      c.value  = "";
      c.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: bgArgb } };
      c.border = bdr;
      c.alignment = { vertical: "middle", horizontal: "left" };
    }

    // Member rows
    if (members.length === 0) {
      for (let c = 3; c <= 7; c++) {
        const cell = ws.getCell(startRow, c);
        cell.value = c === 3 ? "(no member data)" : "";
        cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: bgArgb } };
        cell.border = bdr;
        cell.alignment = { vertical: "middle", horizontal: "left" };
      }
      ws.getRow(startRow).height = 48;
      rowIdx++;
    } else {
      members.forEach((m, mi) => {
        const r = startRow + mi;
        const deptStr = [m.department, m.year ? `Year ${m.year}` : null, m.section ? `Sec ${m.section}` : null]
          .filter(Boolean).join(" · ");
        const vals = [m.name ?? "—", m.register_no ?? "—", m.phone ?? "—", deptStr || "—", m.gender ?? "—"];
        vals.forEach((v, ci) => {
          const cell = ws.getCell(r, ci + 3);
          cell.value = v;
          cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: bgArgb } };
          cell.border = bdr;
          cell.alignment = { vertical: "middle", horizontal: "left", wrapText: ci === 3 };
        });
        ws.getRow(r).height = 20;
      });
      rowIdx += numRows;
    }
  }

  ws.views = [{ state: "frozen", ySplit: 2 }];
}

app.get("/api/spoc/export-teams/:type", async (req, res) => {
  const { type } = req.params;
  if (!["software", "hardware", "aicte"].includes(type)) {
    return res.status(400).json({ error: "type must be software, hardware, or aicte" });
  }

  try {
    // 1. Fetch all eligible final teams from DB
    let teams = [];
    if (DATABASE_URL) {
      const { rows } = await dbQuery(`
        SELECT ft.id, ft.name AS team_name, ft.ministry, ft.member_ids,
               ft.selected_ps_number, ft.custom_ps_title
        FROM public.spoc_final_teams ft
        WHERE (ft.selected_ps_number IS NOT NULL OR ft.custom_ps_title IS NOT NULL)
          AND array_length(ft.member_ids, 1) = 6
        ORDER BY ft.name
      `);
      teams = rows;
    } else if (supabase) {
      const { data, error } = await supabase
        .from("spoc_final_teams")
        .select("id, name, ministry, member_ids, selected_ps_number, custom_ps_title")
        .not("member_ids", "is", null)
        .order("name");
      if (error) throw new Error(error.message);
      // Filter: must have PS or custom title, and have exactly 6 members
      teams = (data ?? []).filter(
        (t) => (t.selected_ps_number || t.custom_ps_title) && (t.member_ids ?? []).length === 6
      );
      // Map name field
      teams = teams.map((t) => ({ ...t, team_name: t.name }));
    }

    // 2. Fetch member profiles
    const allIds = [...new Set(teams.flatMap((t) => t.member_ids ?? []))];
    const memberMap = {};
    if (allIds.length > 0) {
      if (DATABASE_URL) {
        const placeholders = allIds.map((_, i) => `$${i + 1}`).join(", ");
        const { rows } = await dbQuery(
          `SELECT id, name, phone, register_no, department, year, section, gender
           FROM public.profiles WHERE id IN (${placeholders})`,
          allIds
        );
        for (const m of rows) memberMap[m.id] = m;
      } else if (supabase) {
        const { data } = await supabase
          .from("profiles")
          .select("id, name, phone, register_no, department, year, section, gender")
          .in("id", allIds);
        for (const m of (data ?? [])) memberMap[m.id] = m;
      }
    }

    // 3. Categorise
    const software = [], hardware = [], aicte = [];
    for (const team of teams) {
      const isAicte = (team.ministry ?? "").toLowerCase().includes("aicte");
      if (isAicte) { aicte.push(team); continue; }
      const cat = PS_CATEGORY_MAP[team.selected_ps_number];
      if (cat === "Hardware") hardware.push(team);
      else software.push(team);
    }

    const buckets = { software, hardware, aicte };
    const chosen  = buckets[type];

    if (chosen.length === 0) {
      return res.status(404).json({ error: `No ${type} teams found in the database` });
    }

    // 4. Build workbook
    const { default: ExcelJS } = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    wb.creator = "SIH SPOC Portal";
    wb.created = new Date();

    const sheetLabels = { software: "Software", hardware: "Hardware", aicte: "AICTE — Open Innovation" };
    const sheetNames  = { software: "Software Teams", hardware: "Hardware Teams", aicte: "AICTE Teams" };
    const fileNames   = { software: "software_teams.xlsx", hardware: "hardware_teams.xlsx", aicte: "aicte_teams.xlsx" };

    const ws = wb.addWorksheet(sheetNames[type]);
    buildTeamsSheet(ws, chosen, memberMap, sheetLabels[type]);

    // 5. Stream to client
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${fileNames[type]}"`);
    await wb.xlsx.write(res);
    res.end();

    console.log(`[export-teams] Generated ${fileNames[type]} with ${chosen.length} team(s)`);
  } catch (err) {
    console.error("[/api/spoc/export-teams]", err.message);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🛡  SPOC Backend running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
  console.log(`   DB    : ${DATABASE_URL ? "PostgreSQL (direct)" : supabase ? "Supabase client" : "⚠ not configured"}\n`);
});
