/**
 * update-mentor-passwords.js
 * ──────────────────────────
 * Bulk-resets the Supabase auth password for every account that has
 * role = 'mentor' in public.profiles.
 *
 * Run once from the participant_mentor/backend folder:
 *   node update-mentor-passwords.js
 */

import pg from "pg";
import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

if (existsSync(join(__dirname, ".env.local"))) {
  dotenv.config({ path: join(__dirname, ".env.local") });
} else if (existsSync(join(__dirname, ".env"))) {
  dotenv.config({ path: join(__dirname, ".env") });
} else {
  dotenv.config();
}

const NEW_PASSWORD = "sih_mentor_2o26";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();
  try {
    // Find all auth user IDs whose profile has role = 'mentor'
    const { rows: mentors } = await client.query(`
      SELECT au.id, au.email
      FROM auth.users au
      JOIN public.profiles p ON p.id = au.id
      WHERE p.role = 'mentor';
    `);

    if (mentors.length === 0) {
      console.log("No mentor accounts found.");
      return;
    }

    console.log(`Found ${mentors.length} mentor account(s). Updating passwords…`);

    // Update each mentor's password
    const { rowCount } = await client.query(`
      UPDATE auth.users
      SET encrypted_password = crypt($1, gen_salt('bf')),
          updated_at = now()
      WHERE id IN (
        SELECT au.id
        FROM auth.users au
        JOIN public.profiles p ON p.id = au.id
        WHERE p.role = 'mentor'
      );
    `, [NEW_PASSWORD]);

    console.log(`✓ Password updated for ${rowCount} mentor account(s).`);
    mentors.forEach((m) => console.log(`  • ${m.email}`));
  } catch (err) {
    console.error("Error updating mentor passwords:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
