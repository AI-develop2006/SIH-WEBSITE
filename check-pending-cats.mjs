import pg from "pg";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
const __dirname = dirname(fileURLToPath(import.meta.url));
const envSrc = readFileSync(join(__dirname, ".env"), "utf8");
for (const line of envSrc.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

// Category hints from the uploaded document (yesterday's snapshot of pending teams)
// teamName (lowercase) -> category
const UPLOADED_CATS = {
  "csefina#01":       "Software",
  "csefinal#14":      "Software",
  "mctrfinal#01":     "Hardware",
  "techspirint":      "Software",
  "mechfinal#01":     "Software",
  "blue vigil":       "Hardware",
  "ece-final-291":    "Software",
  "mechnova":         "Hardware",
  "ece-final-002":    "Software",
  "ece-final-015":    "Hardware",
  "it003":            "Hardware",
  "ece-final-021":    "Hardware",
  "it006":            "Hardware",
  "etta":             "Software",
  "trialveda":        "Software",
  "byte builders":    "Software",
  "ece-final-028":    "Hardware",
  "sih-final-54":     "Hardware",
  "ecomed":           "Software",
  "csefinal#07":      "Software",
  "csefinal#32":      "Software",
  "tech templars":    "Hardware",
  "coderzz":          "Software",
  "sih-final-39":     "Hardware",
  "sharkzz":          "Software",
  "sihfinalteam#007": "Hardware",
  "techstar":         "Hardware",
  "sih-finial#25":    "Hardware",
  "hackerzz":         "Software",
  "code_hunters":     "Software",
  "team agrathon":    "Software",
  "blaze":            "Software",
  "kreonyx":          "Software",
};

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

const { rows: teams } = await client.query(
  `SELECT name, ministry, selected_ps_number, custom_ps_title,
          array_length(member_ids,1) as member_count
   FROM public.spoc_final_teams ORDER BY name`
);

const { rows: psRows } = await client.query(`SELECT ps_number, category FROM public.sih_problems`);
const psDbMap = new Map(psRows.map(r => [r.ps_number, r.category]));
await client.end();

console.log("Cross-reference: uploaded doc vs current DB state\n");
for (const [nameL, uploadCat] of Object.entries(UPLOADED_CATS)) {
  const matching = teams.filter(t => t.name.toLowerCase() === nameL);
  if (!matching.length) { console.log(`  NOT IN DB: ${nameL}`); continue; }
  for (const t of matching) {
    const hasPs = !!t.selected_ps_number || !!t.custom_ps_title;
    const dbCat = t.selected_ps_number ? psDbMap.get(t.selected_ps_number) : null;
    const status = hasPs
      ? `NOW HAS PS: ${t.selected_ps_number ?? "custom"} (DB cat: ${dbCat ?? "AICTE/custom"})`
      : "STILL NO PS";
    const catToUse = hasPs ? (dbCat ?? uploadCat) : uploadCat;
    console.log(`  ${t.name.padEnd(22)} upload=${uploadCat.padEnd(8)} | ${status} => USE: ${catToUse}`);
  }
}
