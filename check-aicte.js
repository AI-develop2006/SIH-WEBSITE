import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

// Check all AICTE teams with valid member count and chosen PS
const { rows } = await client.query(`
  SELECT
    ft.name,
    ft.ministry,
    ft.selected_ps_number,
    ft.custom_ps_title,
    array_length(ft.member_ids, 1) as member_count
  FROM public.spoc_final_teams ft
  WHERE LOWER(ft.ministry) LIKE '%aicte%'
    AND (ft.selected_ps_number IS NOT NULL OR ft.custom_ps_title IS NOT NULL)
    AND array_length(ft.member_ids, 1) = 6
  ORDER BY ft.name
`);

console.log(`Valid AICTE teams (6 members + PS chosen):\n`);
rows.forEach((t, i) => {
  const ps = t.selected_ps_number || t.custom_ps_title || '—';
  console.log(`  ${i+1}. ${t.name.padEnd(30)} | PS: ${ps.substring(0,50)}`);
});
console.log(`\nTotal: ${rows.length} valid AICTE team(s)`);

await client.end();
