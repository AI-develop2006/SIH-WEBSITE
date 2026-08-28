import pg from "pg";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import dns from "node:dns";

if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}

const { Client, Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

let poolInstance = null;

export function getPool() {
  if (!poolInstance && process.env.DATABASE_URL) {
    poolInstance = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
  }
  return poolInstance;
}

export async function dbQuery(text, params) {
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL not configured");
  return pool.query(text, params);
}

export async function runMigrations() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.log("[DB Migration] DATABASE_URL environment variable is not defined. Skipping auto-migrations.");
    return;
  }

  console.log("[DB Migration] DATABASE_URL found. Starting auto-migrations...");

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("[DB Migration] Connected to PostgreSQL database successfully.");

    await client.query(`
      CREATE TABLE IF NOT EXISTS public._schema_migrations (
        version text primary key,
        run_at timestamptz default now()
      );
      ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS category text DEFAULT 'Pairs';
      ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS assigned_skill text DEFAULT NULL;
      ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS ministry text DEFAULT NULL;
      ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS created_by_dept text DEFAULT NULL;
      ALTER TABLE public.spoc_final_teams ADD COLUMN IF NOT EXISTS selected_ps_number text DEFAULT NULL;
      ALTER TABLE public.spoc_final_teams ADD COLUMN IF NOT EXISTS custom_ps_title text DEFAULT NULL;
    `);

    const { rows } = await client.query(`SELECT version FROM public._schema_migrations;`);
    const executed = new Set(rows.map(r => r.version));

    const migrationsDir = join(__dirname, "supabase", "migrations");
    if (!fs.existsSync(migrationsDir)) {
      console.log(`[DB Migration] Migrations directory not found at ${migrationsDir}. Skipping.`);
      return;
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith(".sql"))
      .sort();

    console.log(`[DB Migration] Found ${files.length} local migration files.`);

    for (const file of files) {
      if (executed.has(file)) {
        console.log(`[DB Migration] Migration ${file} is already applied. Skipping.`);
        continue;
      }

      console.log(`[DB Migration] Running migration ${file}...`);
      const sqlPath = join(migrationsDir, file);
      const sql = fs.readFileSync(sqlPath, "utf8");

      await client.query(sql);

      await client.query(`INSERT INTO public._schema_migrations (version) VALUES ($1);`, [file]);
      console.log(`[DB Migration] Migration ${file} completed successfully.`);
    }

    console.log("[DB Migration] All migrations are up to date.");
  } catch (error) {
    console.error("[DB Migration] Migration failed with error:", error);
    throw error;
  } finally {
    try {
      await client.end();
      console.log("[DB Migration] Database client connection closed.");
    } catch (err) {
      console.error("[DB Migration] Error closing database client connection:", err);
    }
  }
}
