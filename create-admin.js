import pg from "pg";
import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env from the backend folder — same priority order as server.js
if (existsSync(join(__dirname, ".env.local"))) {
  dotenv.config({ path: join(__dirname, ".env.local") });
} else if (existsSync(join(__dirname, ".env"))) {
  dotenv.config({ path: join(__dirname, ".env") });
} else {
  dotenv.config();
}

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function createAdmin() {
  const client = await pool.connect();
  try {
    const query = `
      DO $$
      DECLARE
        new_user_id uuid := gen_random_uuid();
      BEGIN
        -- Insert into auth.users if not exists
        IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'smvecsihadmin2026@gmail.com') THEN
          INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
          ) VALUES (
            '00000000-0000-0000-0000-000000000000', new_user_id, 'authenticated', 'authenticated', 'smvecsihadmin2026@gmail.com', crypt('sih_20206_', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"name":"Admin Manager"}', now(), now()
          );
        ELSE
          -- Account already exists — update the password
          UPDATE auth.users
          SET encrypted_password = crypt('sih_20206_', gen_salt('bf')),
              updated_at = now()
          WHERE email = 'smvecsihadmin2026@gmail.com';
        END IF;

        -- We insert into profiles, but in many Supabase setups there's a trigger on auth.users to create a profile automatically.
        -- So we use ON CONFLICT (id) DO UPDATE
        INSERT INTO public.profiles (id, name, email, role, phone, gender, verified)
        SELECT id, 'Admin Manager', 'smvecsihadmin2026@gmail.com', 'admin', 'admin-phone-2026', 'Other', true
        FROM auth.users WHERE email = 'smvecsihadmin2026@gmail.com'
        ON CONFLICT (id) DO UPDATE SET role = 'admin';
      END $$;
    `;
    await client.query(query);
    console.log("Admin user created/updated successfully.");
  } catch (err) {
    console.error("Error creating admin user:", err);
  } finally {
    client.release();
    pool.end();
  }
}

createAdmin();
