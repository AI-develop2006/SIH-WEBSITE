/**
 * SPOC Migration — run from participant_mentor/backend/
 * node run-spoc-migration.js
 */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Mirror the same dotenv loading as server.js
if (existsSync(join(__dirname, ".env.local"))) {
  dotenv.config({ path: join(__dirname, ".env.local") });
} else if (existsSync(join(__dirname, ".env"))) {
  dotenv.config({ path: join(__dirname, ".env") });
} else {
  dotenv.config();
}

import pg from "pg";
const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌  DATABASE_URL not set. Check participant_mentor/backend/.env");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const STEPS = [
  {
    name: "Create spoc_final_teams table",
    sql: `
      CREATE TABLE IF NOT EXISTS public.spoc_final_teams (
        id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        name        TEXT        NOT NULL,
        ministry    TEXT,
        member_ids  UUID[]      NOT NULL DEFAULT '{}',
        created_by  UUID,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `,
  },
  {
    name: "Create ministry index",
    sql: `
      CREATE INDEX IF NOT EXISTS idx_spoc_final_teams_ministry
        ON public.spoc_final_teams(ministry);
    `,
  },
  {
    name: "Create updated_at trigger function",
    sql: `
      CREATE OR REPLACE FUNCTION public.spoc_set_updated_at()
      RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END;
      $$;
    `,
  },
  {
    name: "Attach updated_at trigger",
    sql: `
      DROP TRIGGER IF EXISTS trg_spoc_updated_at ON public.spoc_final_teams;
      CREATE TRIGGER trg_spoc_updated_at
        BEFORE UPDATE ON public.spoc_final_teams
        FOR EACH ROW EXECUTE FUNCTION public.spoc_set_updated_at();
    `,
  },
];

async function run() {
  const client = await pool.connect();
  console.log("✓  Connected to database\n");

  try {
    for (const step of STEPS) {
      process.stdout.write(`  ▶  ${step.name}… `);
      await client.query(step.sql);
      console.log("✓");
    }

    // Verify
    console.log("\n📋  Verification:");

    const { rows: tables } = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'spoc_final_teams';
    `);
    console.log(`  ${tables.length > 0 ? "✓" : "✗"}  spoc_final_teams table`);

    const { rows: cols } = await client.query(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'spoc_final_teams'
      ORDER BY ordinal_position;
    `);
    cols.forEach((c) => console.log(`      · ${c.column_name} (${c.data_type})`));

    const { rows: idxs } = await client.query(`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'spoc_final_teams';
    `);
    console.log(`  ✓  Indexes: ${idxs.map((r) => r.indexname).join(", ")}`);

    const { rows: trigs } = await client.query(`
      SELECT trigger_name FROM information_schema.triggers
      WHERE event_object_schema = 'public'
        AND event_object_table   = 'spoc_final_teams';
    `);
    if (trigs.length > 0) console.log(`  ✓  Trigger: ${trigs[0].trigger_name}`);

    console.log("\n🎉  SPOC migration complete — no existing tables modified.\n");
    console.log("    To promote a user to SPOC role, run in Supabase SQL editor:");
    console.log("    UPDATE public.profiles SET role = 'spoc' WHERE email = 'your@email.ac.in';\n");

  } catch (err) {
    console.error(`\n❌  Migration failed: ${err.message}`);
    if (err.detail) console.error(`    Detail: ${err.detail}`);
    if (err.hint)   console.error(`    Hint:   ${err.hint}`);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
