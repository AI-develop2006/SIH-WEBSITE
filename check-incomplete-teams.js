import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

// Check teams with chosen PS but not exactly 6 members
const { rows } = await client.query(`
  SELECT
    ft.name,
    ft.ministry,
    ft.selected_ps_number,
    ft.custom_ps_title,
    array_length(ft.member_ids, 1) as member_count
  FROM public.spoc_final_teams ft
  WHERE (ft.selected_ps_number IS NOT NULL OR ft.custom_ps_title IS NOT NULL)
    AND (array_length(ft.member_ids, 1) IS NULL OR array_length(ft.member_ids, 1) != 6)
  ORDER BY ft.name
`);

console.log(`Incomplete teams (not exactly 6 members, but have chosen PS):\n`);
rows.forEach((t) => {
  console.log(`  ${t.name.padEnd(30)} | Members: ${t.member_count ?? 0} | Ministry: ${t.ministry || '—'} | PS: ${t.selected_ps_number || t.custom_ps_title || '—'}`);
});
console.log(`\nTotal: ${rows.length} incomplete team(s)`);

await client.end();
