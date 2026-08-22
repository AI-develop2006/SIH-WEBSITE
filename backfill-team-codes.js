/**
 * backfill-team-codes.js
 *
 * One-time script to assign dept-based team_code values to all existing teams
 * that either have no team_code or have an old SIH2K26#NNN style code.
 *
 * Run with:  node backfill-team-codes.js
 *
 * Uses DATABASE_URL from .env if present, otherwise Supabase REST API.
 */

import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { dbQuery } from "./database.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

if (existsSync(join(__dirname, ".env"))) dotenv.config({ path: join(__dirname, ".env") });
else dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

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

function getDeptCode(deptName) {
  if (!deptName) return "TEAM";
  return DEPT_CODE_MAP[deptName.toLowerCase().trim()]
    ?? deptName.replace(/\s+/g, "").toUpperCase().slice(0, 8);
}

async function run() {
  console.log("=== Team Code Backfill ===\n");

  let teams = [];

  // ── Fetch all teams with member departments ────────────────────────────────
  if (process.env.DATABASE_URL) {
    console.log("Using DATABASE_URL (PostgreSQL direct)...");
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
      LEFT JOIN public.profiles p     ON p.id = tm.member_id
      GROUP BY t.id
      ORDER BY t.id;
    `);
    teams = rows;
  } else if (supabase) {
    console.log("Using Supabase REST API...");
    const { data: teamRows, error: teamsErr } = await supabase
      .from("teams")
      .select("id, name, category, created_by_dept, team_code")
      .order("id");
    if (teamsErr) throw new Error("Failed to fetch teams: " + teamsErr.message);

    const { data: memberRows, error: membersErr } = await supabase
      .from("team_members")
      .select("team_id, profiles(department)");
    if (membersErr) throw new Error("Failed to fetch members: " + membersErr.message);

    const memberDeptMap = {};
    for (const mr of memberRows || []) {
      if (!memberDeptMap[mr.team_id]) memberDeptMap[mr.team_id] = [];
      if (mr.profiles?.department) memberDeptMap[mr.team_id].push(mr.profiles.department);
    }
    teams = (teamRows || []).map((t) => ({
      ...t,
      member_depts: memberDeptMap[t.id] || [],
    }));
  } else {
    console.error("ERROR: Neither DATABASE_URL nor VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY is configured.");
    process.exit(1);
  }

  console.log(`Fetched ${teams.length} total teams.\n`);

  // ── Resolve department for each team ──────────────────────────────────────
  const resolved = teams.map((t) => {
    let dept = t.created_by_dept?.trim() || null;
    if (!dept && t.member_depts?.length > 0) {
      const freq = {};
      for (const d of t.member_depts) freq[d] = (freq[d] || 0) + 1;
      dept = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
    }
    return { ...t, resolved_dept: dept };
  });

  // ── Group by dept, sorted by id (creation order) ──────────────────────────
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

  // ── Build update list ──────────────────────────────────────────────────────
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
        updates.push({
          id: t.id,
          name: t.name,
          old_code: t.team_code ?? "(none)",
          new_code: newCode,
          created_by_dept: dept,
        });
        console.log(`  [UPDATE] "${t.name}" (${t.id}) : ${t.team_code ?? "(none)"} → ${newCode}  [dept: ${dept}]`);
      } else {
        console.log(`  [SKIP]   "${t.name}" (${t.id}) : already has "${t.team_code}"`);
      }
    }
  }

  if (unresolvable.length > 0) {
    console.log(`\n  [UNRESOLVABLE] ${unresolvable.length} team(s) have no dept and no members:`);
    for (const t of unresolvable) {
      console.log(`    - "${t.name}" (id: ${t.id})`);
    }
  }

  if (updates.length === 0) {
    console.log("\nAll teams already have dept-based codes. Nothing to update.");
    process.exit(0);
  }

  console.log(`\nApplying ${updates.length} update(s)...`);

  // ── Apply updates ──────────────────────────────────────────────────────────
  let successCount = 0;
  for (const upd of updates) {
    try {
      if (process.env.DATABASE_URL) {
        await dbQuery(
          `UPDATE public.teams
           SET team_code       = $1,
               created_by_dept = $2
           WHERE id = $3;`,
          [upd.new_code, upd.created_by_dept, upd.id]
        );
      } else if (supabase) {
        const { error } = await supabase
          .from("teams")
          .update({ team_code: upd.new_code, created_by_dept: upd.created_by_dept })
          .eq("id", upd.id);
        if (error) throw new Error(error.message);
      }
      successCount++;
    } catch (err) {
      console.error(`  ERROR updating "${upd.name}" (${upd.id}): ${err.message}`);
    }
  }

  console.log(`\n✓ Done. ${successCount}/${updates.length} teams updated.`);
  if (unresolvable.length > 0) {
    console.log(`  ${unresolvable.length} team(s) skipped — delete them or set their dept manually.`);
  }
  process.exit(0);
}

run().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
