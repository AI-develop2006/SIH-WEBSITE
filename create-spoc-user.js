#!/usr/bin/env node
/**
 * SPOC User Provisioning Script
 * ──────────────────────────────
 * Creates the SPOC Supabase auth account and profiles row using only
 * DATABASE_URL (no service-role key required).
 *
 * Run from SPOC/backend/:
 *   node create-spoc-user.js
 *
 * Reads from SPOC/backend/.env
 */

import pg from "pg";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";
import { existsSync } from "fs";
import crypto from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, ".env");

if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log(`✓  Loaded env from ${envPath}`);
} else {
  console.error("❌  SPOC/backend/.env not found. Create it from .env.example.");
  process.exit(1);
}

const DATABASE_URL  = process.env.DATABASE_URL;
const SPOC_PHONE    = (process.env.SPOC_PHONE || "").replace(/\D/g, "");
const SPOC_PASSWORD = process.env.SPOC_PASSWORD || "";
const SPOC_NAME     = process.env.SPOC_NAME || "SPOC";

if (!DATABASE_URL) { console.error("❌  DATABASE_URL missing"); process.exit(1); }
if (!SPOC_PHONE || SPOC_PHONE.length < 10) { console.error("❌  SPOC_PHONE invalid"); process.exit(1); }
if (!SPOC_PASSWORD) { console.error("❌  SPOC_PASSWORD missing"); process.exit(1); }

// Internal email derived from phone — never shown to user
const SPOC_EMAIL = `${SPOC_PHONE}@spoc.smvec.ac.in`;

console.log("\n🔧  SPOC User Provisioning (SQL mode)");
console.log(`    Phone    : ${SPOC_PHONE}`);
console.log(`    Email    : ${SPOC_EMAIL}  (internal — not visible to user)`);
console.log(`    Name     : ${SPOC_NAME}\n`);

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();
  try {
    // 1. Check if auth user already exists
    const { rows: existing } = await client.query(
      `SELECT id FROM auth.users WHERE email = $1 LIMIT 1`,
      [SPOC_EMAIL]
    );

    let userId;

    if (existing.length > 0) {
      userId = existing[0].id;
      console.log(`ℹ  Auth user already exists: ${userId}`);

      // Update the password hash
      const salt = crypto.randomBytes(16).toString("hex");
      const hash = crypto.createHmac("sha256", salt).update(SPOC_PASSWORD).digest("hex");
      // Supabase stores bcrypt — update via the auth.users encrypted_password
      // We use a raw Supabase-compatible approach: update via auth.users directly
      await client.query(
        `UPDATE auth.users
         SET encrypted_password = crypt($1, gen_salt('bf')),
             updated_at         = now(),
             email_confirmed_at = COALESCE(email_confirmed_at, now()),
             raw_user_meta_data = raw_user_meta_data || $2::jsonb
         WHERE id = $3`,
        [SPOC_PASSWORD, JSON.stringify({ name: SPOC_NAME, role: "spoc" }), userId]
      );
      console.log("✓  Password updated");
    } else {
      // 2. Create new auth user
      userId = crypto.randomUUID();
      await client.query(
        `INSERT INTO auth.users (
          id, instance_id, aud, role, email,
          encrypted_password,
          email_confirmed_at,
          recovery_sent_at,
          last_sign_in_at,
          raw_app_meta_data,
          raw_user_meta_data,
          created_at, updated_at,
          confirmation_token, recovery_token,
          email_change_token_new, email_change
        ) VALUES (
          $1,
          '00000000-0000-0000-0000-000000000000',
          'authenticated',
          'authenticated',
          $2,
          crypt($3, gen_salt('bf')),
          now(), now(), now(),
          '{"provider":"email","providers":["email"]}'::jsonb,
          $4::jsonb,
          now(), now(),
          '', '', '', ''
        )`,
        [
          userId,
          SPOC_EMAIL,
          SPOC_PASSWORD,
          // Do NOT include phone here — the handle_new_user() trigger reads
          // raw_user_meta_data to populate profiles, and profiles.phone has a
          // unique constraint. Phone is only used for login UI derivation.
          JSON.stringify({ name: SPOC_NAME, role: "spoc" }),
        ]
      );
      console.log(`✓  Created auth user: ${userId}`);
    }

    // 3. Upsert profiles row — phone stored as null to avoid UK conflicts
    //    The SPOC user is identified by their auth user id, not phone in profiles
    await client.query(
      `INSERT INTO public.profiles (
        id, name, email, phone, role,
        languages, domain_interests
      ) VALUES ($1, $2, $3, NULL, 'spoc', '{}', '{}')
      ON CONFLICT (id) DO UPDATE
        SET name  = EXCLUDED.name,
            role  = 'spoc',
            email = EXCLUDED.email`,
      [userId, SPOC_NAME, SPOC_EMAIL]
    );
    console.log("✓  Profile row upserted (role = 'spoc')");

    // 4. Verify
    const { rows: profileRows } = await client.query(
      `SELECT id, name, email, role FROM public.profiles WHERE id = $1`,
      [userId]
    );
    const profile = profileRows[0];

    if (profile?.role === "spoc") {
      console.log("\n🎉  SPOC user is ready!");
      console.log(`    Name     : ${profile.name}`);
      console.log(`    Auth ID  : ${profile.id}`);
      console.log(`    Role     : ${profile.role}`);
      console.log(`\n    Login at the SPOC portal:`);
      console.log(`    Phone    → ${SPOC_PHONE}`);
      console.log(`    Password → (SPOC_PASSWORD in SPOC/backend/.env)\n`);
    } else {
      console.warn("⚠  Profile created but role check failed — verify in Supabase.");
    }
  } catch (err) {
    console.error("\n❌  Provisioning failed:", err.message);
    if (err.detail) console.error("    Detail:", err.detail);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
