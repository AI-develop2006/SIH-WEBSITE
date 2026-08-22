#!/usr/bin/env node
/**
 * SPOC Migration Runner
 * Runs additive DDL only — safe to run multiple times.
 * Reads database credentials from SPOC/backend/.env
 */

import pg from "pg";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";
import { existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, ".env");

if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log(`✓  Loaded env from ${envPath}`);
} else {
  // Fallback to participant_mentor backend env
  const fallback = join(__dirname, "../../participant_mentor/backend/.env");
  dotenv.config({ path: fallback });
  console.log(`✓  Loaded env from ${fallback} (fallback)`);
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌  DATABASE_URL not found in .env");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();
  console.log("✓  Connected to database");
  console.log("▶  Running SPOC migration…\n");

  try {
    // 1. Create spoc_final_teams table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.spoc_final_teams (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name        TEXT NOT NULL,
        ministry    TEXT,
        member_ids  UUID[] NOT NULL DEFAULT '{}',
        created_by  UUID,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    console.log("  ✓  spoc_final_teams table");

    // 2. Index
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_spoc_final_teams_ministry
        ON public.spoc_final_teams(ministry);
    `);
    console.log("  ✓  Index on ministry");

    // 3. updated_at trigger function
    await client.query(`
      CREATE OR REPLACE FUNCTION public.spoc_set_updated_at()
      RETURNS TRIGGER LANGUAGE plpgsql AS $func$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END;
      $func$;
    `);
    console.log("  ✓  spoc_set_updated_at() function");

    // 4. Trigger
    await client.query(`
      DROP TRIGGER IF EXISTS trg_spoc_final_teams_updated_at ON public.spoc_final_teams;
      CREATE TRIGGER trg_spoc_final_teams_updated_at
        BEFORE UPDATE ON public.spoc_final_teams
        FOR EACH ROW EXECUTE FUNCTION public.spoc_set_updated_at();
    `);
    console.log("  ✓  updated_at trigger");

    // 5. Extend profiles.role CHECK constraint to include 'spoc'
    const { rows: constraints } = await client.query(`
      SELECT cc.constraint_name, cc.check_clause
      FROM information_schema.constraint_column_usage ccu
      JOIN information_schema.check_constraints cc
        ON cc.constraint_name = ccu.constraint_name
      WHERE ccu.table_schema = 'public'
        AND ccu.table_name   = 'profiles'
        AND ccu.column_name  = 'role'
      LIMIT 1;
    `);

    if (constraints.length > 0) {
      const { constraint_name, check_clause } = constraints[0];
      if (!check_clause.includes("spoc")) {
        await client.query(`ALTER TABLE public.profiles DROP CONSTRAINT "${constraint_name}"`);
        await client.query(`
          ALTER TABLE public.profiles
            ADD CONSTRAINT profiles_role_check
            CHECK (role IN ('student', 'mentor', 'admin', 'spoc'))
        `);
        console.log("  ✓  Extended profiles.role CHECK to include 'spoc'");
      } else {
        console.log("  ✓  profiles.role CHECK already includes 'spoc'");
      }
    } else {
      console.log("  ✓  profiles.role has no CHECK constraint — no changes needed");
    }

    // 6. Final verification
    const { rows: tables } = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'spoc_final_teams';
    `);
    const tableExists = tables.length > 0;
    console.log(`\n  ${tableExists ? "✓" : "✗"}  spoc_final_teams table exists`);

    console.log("\n🎉  SPOC migration completed successfully.");
    console.log("    Next: run  node create-spoc-user.js  to provision the SPOC login.\n");

  } catch (err) {
    console.error("\n❌  Migration failed:", err.message);
    if (err.detail) console.error("    Detail:", err.detail);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
