import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

// Check ALL teams with not exactly 6 members (regardless of PS)
const { rows } = await client.query(`
  SELECT
    ft.name,
    ft.ministry,
    ft.selected_ps_number,
    ft.custom_ps_title,
    array_length(ft.member_ids, 1) as member_count
  FROM public.spoc_final_teams ft
  WHERE array_length(ft.member_ids, 1) IS NULL OR array_length(ft.member_ids, 1) != 6
  ORDER BY ft.name
`);

console.log(`All teams with incomplete members (not exactly 6):\n`);
rows.forEach((t) => {
  const hasPs = t.selected_ps_number || t.custom_ps_title;
  console.log(`  ${t.name.padEnd(30)} | Members: ${t.member_count ?? 0} | PS: ${hasPs ? '✓' : '✗'} | Ministry: ${t.ministry || '—'}`);
});
console.log(`\nTotal: ${rows.length} incomplete team(s)`);

await client.end();
