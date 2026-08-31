const pg = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

async function checkPsRequests() {
  if (!connectionString) {
    console.error("Error: DATABASE_URL environment variable is not defined.");
    return;
  }
  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();

    console.log("=== ps_change_requests Table ===");
    const res = await client.query(`SELECT * FROM public.ps_change_requests`);
    console.log(JSON.stringify(res.rows, null, 2));

    console.log("\n=== Joined Query (from SPOC/backend/server.js) ===");
    const joinRes = await client.query(
      `SELECT r.*,
              p.name AS requester_name, p.register_no AS requester_regno, p.department AS requester_dept
       FROM public.ps_change_requests r
       LEFT JOIN public.profiles p ON p.id = r.requested_by
       ORDER BY
         CASE r.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
         r.created_at DESC`
    );
    console.log(JSON.stringify(joinRes.rows, null, 2));

  } catch (err) {
    console.error("Error querying DB:", err);
  } finally {
    await client.end();
  }
}

checkPsRequests();
