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
 * Required env vars: DATABASE_URL, SPOC_EMAIL, SPOC_PASSWORD, SPOC_NAME
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
const SPOC_EMAIL    = process.env.SPOC_EMAIL || "";
const SPOC_PASSWORD = process.env.SPOC_PASSWORD || "";
const SPOC_NAME     = process.env.SPOC_NAME || "SPOC";

if (!DATABASE_URL)  { console.error("❌  DATABASE_URL missing"); process.exit(1); }
if (!SPOC_EMAIL)    { console.error("❌  SPOC_EMAIL missing in .env"); process.exit(1); }
if (!SPOC_PASSWORD) { console.error("❌  SPOC_PASSWORD missing"); process.exit(1); }

console.log("\n🔧  SPOC User Provisioning (SQL mode)");
console.log(`    Email    : ${SPOC_EMAIL}`);
console.log(`    Name     : ${SPOC_NAME}\n`);

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();
  try {
    // 1. Check if auth user already exists (by target email or by SPOC profile role)
    let userId;
    const { rows: byEmail } = await client.query(
      `SELECT id FROM auth.users WHERE email = $1 LIMIT 1`,
      [SPOC_EMAIL]
    );

    if (byEmail.length > 0) {
      userId = byEmail[0].id;
      console.log(`ℹ  Auth user already exists with this email: ${userId}`);
    } else {
      // Check if a SPOC profile already exists (old phone-derived email)
      const { rows: byRole } = await client.query(
        `SELECT p.id FROM public.profiles p
         JOIN auth.users u ON u.id = p.id
         WHERE p.role = 'spoc' LIMIT 1`
      );
      if (byRole.length > 0) {
        userId = byRole[0].id;
        console.log(`ℹ  Found existing SPOC user (migrating email): ${userId}`);
      }
    }

    if (userId) {
      // Update existing user — also migrate email if it changed
      await client.query(
        `UPDATE auth.users
         SET email              = $1,
             encrypted_password = crypt($2, gen_salt('bf')),
             updated_at         = now(),
             email_confirmed_at = COALESCE(email_confirmed_at, now()),
             raw_user_meta_data = raw_user_meta_data || $3::jsonb
         WHERE id = $4`,
        [SPOC_EMAIL, SPOC_PASSWORD, JSON.stringify({ name: SPOC_NAME, role: "spoc" }), userId]
      );
      console.log("✓  Auth user updated (email + password)");
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
          JSON.stringify({ name: SPOC_NAME, role: "spoc" }),
        ]
      );
      console.log(`✓  Created auth user: ${userId}`);
    }

    // 3. Upsert profiles row — handle phone UK constraint by checking existence first
    const { rows: existingProfile } = await client.query(
      `SELECT id FROM public.profiles WHERE id = $1 LIMIT 1`,
      [userId]
    );
    if (existingProfile.length > 0) {
      await client.query(
        `UPDATE public.profiles
         SET name = $1, role = 'spoc', email = $2
         WHERE id = $3`,
        [SPOC_NAME, SPOC_EMAIL, userId]
      );
    } else {
      // Insert without phone to avoid unique constraint on other rows
      await client.query(
        `INSERT INTO public.profiles (id, name, email, phone, role, languages, domain_interests)
         VALUES ($1, $2, $3, NULL, 'spoc', '{}', '{}')`,
        [userId, SPOC_NAME, SPOC_EMAIL]
      );
    }
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
      console.log(`    Email    → ${SPOC_EMAIL}`);
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
