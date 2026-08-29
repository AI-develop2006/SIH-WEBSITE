import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

// Show exact ministry text for potential AICTE teams
const { rows } = await client.query(`
  SELECT
    ft.name,
    ft.ministry,
    ft.selected_ps_number,
    ft.custom_ps_title,
    array_length(ft.member_ids, 1) as member_count
  FROM public.spoc_final_teams ft
  WHERE (ft.selected_ps_number IS NOT NULL OR ft.custom_ps_title IS NOT NULL)
    AND array_length(ft.member_ids, 1) = 6
    AND (LOWER(ft.ministry) LIKE '%aicte%' 
         OR ft.name IN ('A Square', 'ARC FORGE', 'ECE-FINAL-018', 'KORO', 'MCTRFINAL#03', 'SIH#IT012', 'SPECTRA'))
  ORDER BY ft.name
`);

console.log(`Potential AICTE teams:\n`);
rows.forEach((t, i) => {
  console.log(`  ${i+1}. ${t.name.padEnd(20)} | Ministry: "${t.ministry}"`);
});
console.log(`\nTotal: ${rows.length}`);

await client.end();
