#!/usr/bin/env node
/**
 * Export student profiles to JSON
 * ================================
 * Exports: name, register_no, email, department, year, section, gender, role
 * Output:  participant_mentor/backend/profiles/user-profiles.json
 *          participant_mentor/backend/profiles/user-profiles-by-dept.json
 *
 * Note: Passwords are hashed by Supabase (bcrypt) and are NOT accessible
 * from the database. This script exports profile metadata only.
 *
 * Usage:
 *   node export-profiles.js               (students only)
 *   node export-profiles.js --all-roles   (include mentors/spoc/admin)
 */

import pg     from "pg";
import fs     from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env from this directory
const envPath = join(__dirname, ".env");
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
else dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌  DATABASE_URL not set in .env");
  process.exit(1);
}

const allRoles   = process.argv.includes("--all-roles");
const outputDir  = join(__dirname, "profiles");
const outputFile = join(outputDir, "user-profiles.json");

async function main() {
  const client = new pg.Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log("✓  Connected to database");

  const roleFilter = allRoles ? "" : `WHERE role = 'student'`;

  const { rows } = await client.query(`
    SELECT
      name,
      register_no,
      email,
      department,
      year,
      section,
      gender,
      role,
      created_at
    FROM public.profiles
    ${roleFilter}
    ORDER BY department, year, section, name
  `);

  await client.end();

  const profiles = rows.map((r) => ({
    name:        r.name        ?? "",
    register_no: r.register_no ?? "",
    email:       r.email       ?? "",
    department:  r.department  ?? "",
    year:        r.year        ?? "",
    section:     r.section     ?? "",
    gender:      r.gender      ?? "",
    role:        r.role        ?? "student",
  }));

  fs.mkdirSync(outputDir, { recursive: true });

  // Flat list
  fs.writeFileSync(outputFile, JSON.stringify(profiles, null, 2), "utf8");

  // Grouped by department
  const grouped = {};
  for (const p of profiles) {
    const key = p.department || "Unknown";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(p);
  }
  const groupedFile = join(outputDir, "user-profiles-by-dept.json");
  fs.writeFileSync(groupedFile, JSON.stringify(grouped, null, 2), "utf8");

  // Summary
  console.log(`\n✓  Exported ${profiles.length} profile(s)`);
  console.log(`   → ${outputFile}`);
  console.log(`   → ${groupedFile}`);
  console.log("\n  Department breakdown:");
  const deptCounts = {};
  for (const p of profiles) {
    const d = p.department || "Unknown";
    deptCounts[d] = (deptCounts[d] || 0) + 1;
  }
  for (const [dept, count] of Object.entries(deptCounts).sort()) {
    console.log(`     ${dept.padEnd(52)} ${count}`);
  }
  console.log();
  console.log("  ⚠  Passwords are NOT included — Supabase stores only bcrypt hashes.");
  console.log("     To reset a password use the admin portal or Supabase dashboard.\n");
}

main().catch((err) => {
  console.error("❌  Error:", err.message);
  process.exit(1);
});
