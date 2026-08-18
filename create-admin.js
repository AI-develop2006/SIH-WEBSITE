import pg from "pg";
import dotenv from "dotenv";

dotenv.config({ path: "../frontend/.env.local" });

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
            '00000000-0000-0000-0000-000000000000', new_user_id, 'authenticated', 'authenticated', 'smvecsihadmin2026@gmail.com', crypt('sih2026', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"name":"Admin Manager"}', now(), now()
          );
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
