#!/usr/bin/env node
/**
 * Audit Log Migration — creates spoc_audit_log table
 */
import pg from "pg";
import dotenv from "dotenv";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, ".env") });

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

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.spoc_audit_log (
        id            BIGSERIAL PRIMARY KEY,
        action        TEXT NOT NULL,
        entity_type   TEXT NOT NULL DEFAULT 'final_team',
        entity_id     TEXT,
        entity_name   TEXT,
        details       JSONB,
        ip_address    TEXT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    console.log("✓  Table spoc_audit_log ready");

    await client.query(`
      CREATE INDEX IF NOT EXISTS spoc_audit_log_created_at_idx
        ON public.spoc_audit_log (created_at DESC);
    `);
    console.log("✓  Index on created_at");

    await client.query(`
      CREATE INDEX IF NOT EXISTS spoc_audit_log_entity_id_idx
        ON public.spoc_audit_log (entity_id);
    `);
    console.log("✓  Index on entity_id");

    await client.query(
      `ALTER TABLE public.spoc_audit_log ENABLE ROW LEVEL SECURITY;`
    );
    console.log("✓  RLS enabled");

    // Verify columns
    const { rows } = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'spoc_audit_log'
      ORDER BY ordinal_position;
    `);
    console.log("\n  Columns:");
    rows.forEach((r) => console.log(`    ${r.column_name}  (${r.data_type})`));

    console.log("\n🎉  spoc_audit_log migration complete.\n");
  } catch (err) {
    console.error("❌  Migration failed:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
