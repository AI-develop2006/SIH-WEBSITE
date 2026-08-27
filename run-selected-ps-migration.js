#!/usr/bin/env node
/**
 * Migration: add selected_ps_number column to spoc_final_teams
 */
import pg from "pg";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";
import { existsSync, readFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath   = join(__dirname, ".env");
if (existsSync(envPath)) dotenv.config({ path: envPath });
else dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("❌  DATABASE_URL not set"); process.exit(1); }

const pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

const sql = readFileSync(join(__dirname, "migrations/20260827_selected_ps.sql"), "utf8");

const client = await pool.connect();
try {
  await client.query(sql);
  console.log("✓  selected_ps_number column added (or already existed).");
} catch (err) {
  console.error("❌  Migration failed:", err.message);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
