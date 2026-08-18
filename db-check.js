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

const { Client } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set. Please configure it in backend/.env");
  process.exit(1);
}

async function main() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log("Connected to database!");

    // Check columns in profiles table
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'profiles';
    `);
    console.log("\n--- Profiles Table Columns ---");
    res.rows.forEach(row => {
      console.log(`${row.column_name}: ${row.data_type}`);
    });

    // Check check constraints on profiles table
    const checkRes = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) 
      FROM pg_constraint 
      WHERE conrelid = 'public.profiles'::regclass AND contype = 'c';
    `);
    console.log("\n--- Profiles Check Constraints ---");
    checkRes.rows.forEach(row => {
      console.log(`${row.conname}: ${row.pg_get_constraintdef}`);
    });

  } catch (err) {
    console.error("DB Query failed:", err);
  } finally {
    await client.end();
  }
}

main();
