import pg from "pg";

const { Client } = pg;
const connectionString = "postgresql://postgres:sihsmvec%40123@db.dhwosgynnnqepvelmjqj.supabase.co:5432/postgres"; // url-encode the '@' character in password to prevent parser issues

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
