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

const ADMIN_EMAIL    = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_NAME     = process.env.ADMIN_NAME || "Admin Manager";

if (!process.env.DATABASE_URL) { console.error("❌  DATABASE_URL missing"); process.exit(1); }
if (!ADMIN_EMAIL)    { console.error("❌  ADMIN_EMAIL missing in .env"); process.exit(1); }
if (!ADMIN_PASSWORD) { console.error("❌  ADMIN_PASSWORD missing in .env"); process.exit(1); }

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function createAdmin() {
  const client = await pool.connect();
  try {
    await client.query(`
      DO $$
      DECLARE
        _email TEXT    := $1;
        _pass  TEXT    := $2;
        _name  TEXT    := $3;
        new_user_id uuid := gen_random_uuid();
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = _email) THEN
          INSERT INTO auth.users (
            instance_id, id, aud, role, email,
            encrypted_password,
            email_confirmed_at, recovery_sent_at, last_sign_in_at,
            raw_app_meta_data, raw_user_meta_data,
            created_at, updated_at
          ) VALUES (
            '00000000-0000-0000-0000-000000000000', new_user_id,
            'authenticated', 'authenticated', _email,
            crypt(_pass, gen_salt('bf')),
            now(), now(), now(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            jsonb_build_object('name', _name),
            now(), now()
          );
        ELSE
          UPDATE auth.users
          SET encrypted_password = crypt(_pass, gen_salt('bf')),
              updated_at = now()
          WHERE email = _email;
        END IF;

        INSERT INTO public.profiles (id, name, email, role, phone, gender, verified)
        SELECT id, _name, _email, 'admin', 'admin-phone-2026', 'Other', true
        FROM auth.users WHERE email = _email
        ON CONFLICT (id) DO UPDATE SET role = 'admin';
      END $$;
    `, [ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME]);

    console.log(`✓  Admin user (${ADMIN_EMAIL}) created/updated successfully.`);
  } catch (err) {
    console.error("Error creating admin user:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

createAdmin();
