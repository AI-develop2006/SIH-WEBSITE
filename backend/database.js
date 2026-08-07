import pg from "pg";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

export async function runMigrations() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.log("[DB Migration] DATABASE_URL environment variable is not defined. Skipping auto-migrations.");
    return;
  }

  console.log("[DB Migration] DATABASE_URL found. Starting auto-migrations...");

  // Instantiate client
  const client = new Client({
    connectionString: dbUrl,
    ssl: {
      rejectUnauthorized: false // Supabase connections require SSL
    }
  });

  try {
    await client.connect();
    console.log("[DB Migration] Connected to PostgreSQL database successfully.");

    // 1. Create tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public._schema_migrations (
        version text primary key,
        run_at timestamptz default now()
      );
    `);

    // 2. Fetch already executed migrations
    const { rows } = await client.query(`SELECT version FROM public._schema_migrations;`);
    const executed = new Set(rows.map(r => r.version));

    // 3. Scan local migrations directory
    const migrationsDir = join(__dirname, "supabase", "migrations");
    if (!fs.existsSync(migrationsDir)) {
      console.log(`[DB Migration] Migrations directory not found at ${migrationsDir}. Skipping.`);
      return;
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith(".sql"))
      .sort(); // sort alphanumerically to run in sequence

    console.log(`[DB Migration] Found ${files.length} local migration files.`);

    // 4. Run pending migrations
    for (const file of files) {
      if (executed.has(file)) {
        console.log(`[DB Migration] Migration ${file} is already applied. Skipping.`);
        continue;
      }

      console.log(`[DB Migration] Running migration ${file}...`);
      const sqlPath = join(migrationsDir, file);
      const sql = fs.readFileSync(sqlPath, "utf8");

      // Execute SQL content
      await client.query(sql);

      // Record migration
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
