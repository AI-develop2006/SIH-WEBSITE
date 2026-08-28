#!/usr/bin/env node
/**
 * Profile Lookup Script
 * Queries the profiles table with flexible filters passed as CLI args.
 *
 * Usage:
 *   node check-profile.js                              → list all students (first 50)
 *   node check-profile.js --reg 25UAI144               → by register number
 *   node check-profile.js --name "MOHAMED ASIF"        → by name (partial, case-insensitive)
 *   node check-profile.js --dept "AI & DS"             → by department
 *   node check-profile.js --role mentor                → by role
 *   node check-profile.js --reg 25UAI144 --name "ASIF" → combined (AND)
 *   node check-profile.js --limit 100                  → change row limit (default 50)
 */

import pg from "pg";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";
import { existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath   = join(__dirname, ".env");

if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  console.error("❌  .env not found at", envPath);
  process.exit(1);
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌  DATABASE_URL not set in .env");
  process.exit(1);
}

// ─── Parse CLI args ───────────────────────────────────────────────────────────
function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? process.argv[idx + 1] : null;
}

const filterReg   = getArg("--reg");
const filterName  = getArg("--name");
const filterDept  = getArg("--dept");
const filterRole  = getArg("--role");
const filterYear  = getArg("--year");
const filterPhone = getArg("--phone");
const limit       = parseInt(getArg("--limit") ?? "50", 10);

// ─── Build query dynamically ──────────────────────────────────────────────────
const conditions = [];
const params     = [];

if (filterReg) {
  params.push(filterReg.toUpperCase());
  conditions.push(`UPPER(register_no) = $${params.length}`);
}
if (filterName) {
  params.push(`%${filterName}%`);
  conditions.push(`name ILIKE $${params.length}`);
}
if (filterDept) {
  params.push(`%${filterDept}%`);
  conditions.push(`department ILIKE $${params.length}`);
}
if (filterRole) {
  params.push(filterRole.toLowerCase());
  conditions.push(`role = $${params.length}`);
}
if (filterYear) {
  params.push(filterYear);
  conditions.push(`year = $${params.length}`);
}
if (filterPhone) {
  params.push(filterPhone);
  conditions.push(`phone = $${params.length}`);
}

const WHERE = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
params.push(limit);
const LIMIT_PARAM = `$${params.length}`;

const SQL = `
  SELECT
    id,
    name,
    register_no,
    email,
    phone,
    role,
    department,
    year,
    section,
    gender,
    created_at
  FROM public.profiles
  ${WHERE}
  ORDER BY created_at DESC
  LIMIT ${LIMIT_PARAM}
`;

// ─── Connect and run ──────────────────────────────────────────────────────────
const pool = new pg.Pool({
  connectionString: DATABASE_URL.replace(":5432/", ":6543/") +
    (DATABASE_URL.includes("?") ? "&" : "?") + "pgbouncer=true",
  ssl: { rejectUnauthorized: false },
  max: 1,
});

async function run() {
  const client = await pool.connect();
  console.log("✓  Connected to database\n");

  const filterSummary = [
    filterReg   && `register_no = '${filterReg}'`,
    filterName  && `name ILIKE '%${filterName}%'`,
    filterDept  && `department ILIKE '%${filterDept}%'`,
    filterRole  && `role = '${filterRole}'`,
    filterYear  && `year = '${filterYear}'`,
    filterPhone && `phone = '${filterPhone}'`,
  ].filter(Boolean);

  if (filterSummary.length) {
    console.log("▶  Filters applied (AND):");
    filterSummary.forEach((f) => console.log(`   · ${f}`));
  } else {
    console.log("▶  No filters — showing all profiles (first", limit, ")");
  }
  console.log();

  try {
    const { rows } = await client.query(SQL, params);

    if (rows.length === 0) {
      console.log("✗  No profiles found matching the given filters.\n");
    } else {
      console.log(`✓  Found ${rows.length} profile(s):\n`);
      rows.forEach((r, i) => {
        console.log(`  ── #${i + 1} ──────────────────────────────────────`);
        console.log(`  id          : ${r.id}`);
        console.log(`  name        : ${r.name}`);
        console.log(`  register_no : ${r.register_no ?? "—"}`);
        console.log(`  email       : ${r.email}`);
        console.log(`  phone       : ${r.phone ?? "—"}`);
        console.log(`  role        : ${r.role}`);
        console.log(`  department  : ${r.department ?? "—"}`);
        console.log(`  year        : ${r.year ?? "—"}`);
        console.log(`  section     : ${r.section ?? "—"}`);
        console.log(`  gender      : ${r.gender ?? "—"}`);
        console.log(`  created_at  : ${r.created_at}`);
        console.log();
      });
    }
  } catch (err) {
    console.error("❌  Query failed:", err.message);
    if (err.detail) console.error("    Detail:", err.detail);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
