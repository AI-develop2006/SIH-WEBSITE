#!/usr/bin/env node
/**
 * Build combined final_teams_all.xlsx from:
 *  1. software_teams.xlsx (confirmed software teams)
 *  2. hardware_teams.xlsx (confirmed hardware teams)
 *  3. aicte_teams.xlsx    (confirmed AICTE open innovation teams)
 *  4. DB query            (pending teams from the uploaded list, categorised by the
 *                          "category" column in the uploaded document)
 *
 * Output: final_teams_all.xlsx
 *  - Two sheets: "Software" and "Hardware"
 *  - Same visual format as software_teams / hardware_teams (title row, header row,
 *    merged team-name + S.No + Remarks cells, alternating shading)
 *  - AICTE teams included in whichever category their pending doc specifies
 *  - Columns: S.No | Team Name | Member Name | Register No | Year | Section |
 *             Department | Phone | Gender | Category
 */

import pg        from "pg";
import ExcelJS   from "exceljs";
import XLSX      from "xlsx";
import dotenv    from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join }  from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, ".env") });

// ── Category assigned by the uploaded pending document ────────────────────────
// Keys are lowercased team names; values "Software" | "Hardware" | "Open Innovation"
const PENDING_CATEGORY = {
  "csefina#01":       "Software",
  "csefinal#14":      "Software",
  "techspirint":      "Software",
  "mechfinal#01":     "Software",   // AICTE ministry but doc says software
  "blue vigil":       "Hardware",
  "ecomed":           "Software",
  "mechhanova":       "Hardware",   // alias — won't match but handled via DB
  "mecknova":         "Hardware",
  "mechnova":         "Hardware",
  "ece-final-002":    "Software",
  "ece-final-015":    "Hardware",
  "it003":            "Hardware",   // AICTE ministry
  "ece-final-021":    "Hardware",
  "etta":             "Software",
  "trialveda":        "Software",
  "byte builders":    "Software",
  "ece-final-028":    "Hardware",   // AICTE ministry
  "sih-final-54":     "Hardware",
  "csefinal#07":      "Software",
  "csefinal#32":      "Software",
  "tech templars":    "Hardware",   // AICTE ministry
  "sih-final-39":     "Hardware",
  "sharkzz":          "Software",
  "sihfinalteam#007": "Hardware",
  "techstar":         "Hardware",
  "sih-finial#25":    "Hardware",   // AICTE ministry (open innovation but doc says hardware)
  "hackerzz":         "Software",
  "code_hunters":     "Software",
  "team agrathon":    "Software",
  "blaze":            "Software",
  "kreonyx":          "Software",
};

// ── PS category lookup (same as export-teams-xlsx.js) ─────────────────────────
const PS_CATEGORY = {
  SIH26001:"Software",SIH26002:"Software",SIH26003:"Software",SIH26004:"Hardware",
  SIH26005:"Hardware",SIH26006:"Software",SIH26007:"Hardware",SIH26008:"Hardware",
  SIH26009:"Software",SIH26010:"Hardware",SIH26011:"Software",SIH26012:"Software",
  SIH26013:"Software",SIH26014:"Software",SIH26015:"Software",SIH26016:"Software",
  SIH26017:"Software",SIH26018:"Software",SIH26019:"Software",SIH26020:"Software",
  SIH26021:"Software",SIH26022:"Software",SIH26023:"Software",SIH26024:"Hardware",
  SIH26025:"Hardware",SIH26026:"Hardware",SIH26027:"Software",SIH26028:"Software",
  SIH26029:"Software",SIH26030:"Software",SIH26031:"Software",SIH26032:"Software",
  SIH26033:"Software",SIH26034:"Software",SIH26035:"Software",SIH26036:"Software",
  SIH26037:"Hardware",SIH26038:"Hardware",SIH26039:"Software",SIH26040:"Software",
  SIH26041:"Software",SIH26042:"Software",SIH26043:"Software",SIH26044:"Hardware",
  SIH26045:"Hardware",SIH26046:"Hardware",SIH26047:"Software",SIH26048:"Software",
  SIH26049:"Software",SIH26050:"Software",SIH26051:"Software",SIH26052:"Software",
  SIH26053:"Software",SIH26054:"Software",SIH26055:"Software",SIH26056:"Software",
  SIH26057:"Software",SIH26058:"Software",SIH26059:"Software",SIH26060:"Software",
  SIH26061:"Software",SIH26062:"Software",SIH26063:"Software",SIH26064:"Software",
  SIH26065:"Software",SIH26066:"Software",SIH26067:"Software",SIH26068:"Software",
  SIH26069:"Software",SIH26070:"Software",SIH26071:"Software",SIH26072:"Software",
  SIH26073:"Software",SIH26074:"Software",SIH26075:"Software",SIH26076:"Software",
  SIH26077:"Software",SIH26078:"Software",SIH26079:"Software",SIH26080:"Software",
  SIH26081:"Software",SIH26082:"Software",SIH26083:"Software",SIH26084:"Software",
  SIH26085:"Software",SIH26086:"Hardware",SIH26087:"Hardware",SIH26088:"Hardware",
  SIH26089:"Hardware",SIH26090:"Hardware",SIH26091:"Hardware",SIH26092:"Hardware",
  SIH26093:"Hardware",SIH26094:"Hardware",SIH26095:"Hardware",SIH26096:"Hardware",
  SIH26097:"Hardware",SIH26098:"Hardware",SIH26099:"Hardware",SIH26100:"Hardware",
  SIH26101:"Software",SIH26102:"Software",SIH26103:"Software",SIH26104:"Software",
  SIH26105:"Software",SIH26106:"Software",SIH26107:"Software",SIH26108:"Software",
  SIH26109:"Software",SIH26110:"Software",SIH26111:"Software",SIH26112:"Software",
  SIH26113:"Software",SIH26114:"Software",SIH26115:"Software",SIH26116:"Software",
  SIH26117:"Software",SIH26118:"Hardware",SIH26119:"Hardware",SIH26120:"Hardware",
  SIH26121:"Hardware",SIH26122:"Hardware",SIH26123:"Software",SIH26124:"Software",
  SIH26125:"Software",SIH26126:"Software",SIH26127:"Software",SIH26128:"Software",
  SIH26129:"Software",SIH26130:"Software",SIH26131:"Software",SIH26132:"Software",
  SIH26133:"Software",SIH26134:"Software",SIH26135:"Software",SIH26136:"Software",
  SIH26137:"Software",SIH26138:"Software",SIH26139:"Software",SIH26140:"Software",
  SIH26141:"Software",SIH26142:"Software",SIH26143:"Software",SIH26144:"Software",
  SIH26145:"Software",SIH26146:"Software",SIH26147:"Software",SIH26148:"Software",
  SIH26149:"Software",SIH26150:"Software",SIH26151:"Hardware",SIH26152:"Hardware",
  SIH26153:"Hardware",SIH26154:"Hardware",SIH26155:"Hardware",SIH26156:"Hardware",
  SIH26157:"Hardware",SIH26158:"Hardware",SIH26159:"Hardware",SIH26160:"Hardware",
  SIH26161:"Hardware",SIH26162:"Hardware",SIH26163:"Software",SIH26164:"Software",
  SIH26165:"Software",SIH26166:"Software",SIH26167:"Software",SIH26168:"Software",
  SIH26169:"Software",SIH26170:"Software",SIH26171:"Software",SIH26172:"Software",
  SIH26173:"Software",SIH26174:"Software",SIH26175:"Software",SIH26176:"Software",
  SIH26177:"Software",SIH26178:"Software",SIH26179:"Software",SIH26180:"Software",
  SIH26181:"Hardware",SIH26182:"Hardware",SIH26183:"Hardware",SIH26184:"Hardware",
  SIH26185:"Hardware",SIH26186:"Hardware",SIH26187:"Hardware",SIH26188:"Hardware",
  SIH26189:"Hardware",SIH26190:"Hardware",SIH26191:"Hardware",SIH26192:"Hardware",
  SIH26193:"Hardware",SIH26194:"Software",SIH26195:"Software",SIH26196:"Software",
  SIH26197:"Software",SIH26198:"Software",SIH26199:"Software",SIH26200:"Software",
  SIH26201:"Software",SIH26202:"Software",SIH26203:"Software",SIH26204:"Software",
  SIH26205:"Software",SIH26206:"Software",SIH26207:"Software",SIH26208:"Software",
  SIH26209:"Software",SIH26210:"Software",SIH26211:"Software",SIH26212:"Software",
  SIH26213:"Software",SIH26214:"Software",SIH26215:"Software",SIH26216:"Hardware",
  SIH26217:"Hardware",SIH26218:"Hardware",SIH26219:"Hardware",SIH26220:"Hardware",
  SIH26221:"Hardware",SIH26222:"Hardware",SIH26223:"Hardware",SIH26224:"Hardware",
  SIH26225:"Hardware",SIH26226:"Hardware",SIH26227:"Hardware",SIH26228:"Hardware",
  SIH26229:"Software",
};

// ── Parse existing categorised xlsx files ─────────────────────────────────────
function parseTeamsXlsx(filename, defaultCategory) {
  const wb = XLSX.readFile(filename);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const teams = [];
  let cur = null;
  for (let i = 2; i < data.length; i++) {
    const row = data[i];
    if (!row || row.every(c => c === null || c === "")) continue;
    const col1 = row[1];
    if (col1 !== null && col1 !== undefined && String(col1).trim() !== "") {
      const lines    = String(col1).split("\n");
      const teamName = lines[0].trim();
      const mLine    = lines.find(l => l.includes("[Ministry:")) ?? "";
      const pLine    = lines.find(l => l.includes("[PS:"))       ?? "";
      const ministry = mLine.replace("[Ministry:", "").replace("]", "").trim();
      const psInfo   = pLine.replace("[PS:", "").replace("]", "").trim();
      // Derive category from PS number if possible
      const psMatch  = psInfo.match(/SIH\d+/);
      const cat      = psMatch ? (PS_CATEGORY[psMatch[0]] ?? defaultCategory) : defaultCategory;
      cur = { teamName, ministry, psInfo, category: cat, members: [], source: "confirmed" };
      teams.push(cur);
    }
    const m = row[2];
    if (m && String(m).trim() && String(m).trim() !== "(no member data)" && cur) {
      const dys     = row[5] ? String(row[5]).trim() : "";
      const parts   = dys.split(" · ");
      const dept    = parts[0] ?? "";
      const year    = (parts[1] ?? "").replace("Year ", "");
      const section = (parts[2] ?? "").replace("Sec ", "");
      cur.members.push({
        name:    String(m).trim(),
        regNo:   row[3] ? String(row[3]).trim() : "",
        phone:   row[4] ? String(row[4]).trim() : "",
        dept, year, section,
        gender:  row[6] ? String(row[6]).trim() : "",
      });
    }
  }
  return teams;
}

// ── Fetch pending teams from DB ───────────────────────────────────────────────
async function fetchPendingTeams() {
  const pendingTeamNames = Object.keys(PENDING_CATEGORY);

  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log("✓  Connected to database");

  // Build LOWER(name) = ANY(...) query
  const params = pendingTeamNames.map((_, i) => `$${i + 1}`).join(", ");
  const { rows: dbTeams } = await client.query(
    `SELECT id, name, ministry, member_ids, selected_ps_number, custom_ps_title
     FROM public.spoc_final_teams
     WHERE LOWER(name) IN (${params})`,
    pendingTeamNames.map(n => n.toLowerCase())
  );

  const allIds = [...new Set(dbTeams.flatMap(t => t.member_ids ?? []))];
  const memberMap = {};
  if (allIds.length) {
    const ph = allIds.map((_, i) => `$${i + 1}`).join(", ");
    const { rows: members } = await client.query(
      `SELECT id, name, phone, register_no, department, year, section, gender
       FROM public.profiles WHERE id IN (${ph})`,
      allIds
    );
    for (const m of members) memberMap[m.id] = m;
  }
  await client.end();

  return dbTeams.map(t => {
    const cat = PENDING_CATEGORY[t.name.toLowerCase()] ?? "Unknown";
    // Derive PS info string
    let psInfo = "Pending";
    if (t.selected_ps_number) {
      psInfo = `${t.selected_ps_number} (${PS_CATEGORY[t.selected_ps_number] ?? "?"})`;
    } else if (t.custom_ps_title) {
      psInfo = "AICTE Open Innovation";
    }
    const members = (t.member_ids ?? [])
      .map(id => memberMap[id])
      .filter(Boolean)
      .map(m => ({
        name:    m.name    ?? "",
        regNo:   m.register_no ?? "",
        phone:   m.phone   ?? "",
        dept:    m.department ?? "",
        year:    m.year    ?? "",
        section: m.section ?? "",
        gender:  m.gender  ?? "",
      }));
    return { teamName: t.name, ministry: t.ministry ?? "", psInfo, category: cat, members, source: "pending" };
  });
}

// ── Build one worksheet ───────────────────────────────────────────────────────
const COL_HEADERS = ["S.No","Team Name","Ministry","PS Number","Member Name","Register No","Year","Section","Department","Phone","Gender","Category"];
const COL_WIDTHS  = [5, 28, 34, 22, 28, 16, 6, 8, 38, 14, 8, 12];

function buildSheet(ws, teams, label) {
  // Title row
  ws.mergeCells(1, 1, 1, COL_HEADERS.length);
  const title = ws.getCell(1, 1);
  title.value     = `SIH 2026 — Final Teams (${label})`;
  title.font      = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  title.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A2744" } };
  title.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 28;

  // Header row
  const hdr = ws.getRow(2);
  hdr.values = COL_HEADERS;
  hdr.eachCell(cell => {
    cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3864" } };
    cell.font      = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.border    = allBorder("FF4472C4");
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  hdr.height = 22;

  COL_WIDTHS.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  let rowIdx = 3;
  let sno    = 1;

  for (const team of teams) {
    const numRows  = Math.max(team.members.length, 1);
    const startRow = rowIdx;
    const endRow   = rowIdx + numRows - 1;
    const bgArgb   = sno % 2 === 0 ? "FFF2F2F2" : "FFFFFFFF";
    const bdr      = allBorder("FFBFBFBF");

    // Cols that span all member rows for this team:
    // 1:S.No  2:Team Name  3:Ministry  4:PS Number  12:Category
    const mergeCols = [1, 2, 3, 4, 12];
    if (numRows > 1) {
      for (const col of mergeCols) ws.mergeCells(startRow, col, endRow, col);
    }

    // ── S.No ──────────────────────────────────────────────────────────────────
    const snoCell     = ws.getCell(startRow, 1);
    snoCell.value     = sno++;
    snoCell.font      = { bold: true };
    snoCell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: bgArgb } };
    snoCell.alignment = { vertical: "middle", horizontal: "center" };
    snoCell.border    = bdr;

    // ── Team Name ─────────────────────────────────────────────────────────────
    const isPending   = team.source === "pending";
    const nameCell    = ws.getCell(startRow, 2);
    nameCell.value    = team.teamName;
    nameCell.font     = { bold: true };
    nameCell.fill     = { type: "pattern", pattern: "solid",
      fgColor: { argb: isPending ? "FFFFF8E7" : "FFEFF8FF" } };
    nameCell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    nameCell.border   = bdr;

    // ── Ministry ──────────────────────────────────────────────────────────────
    const minCell     = ws.getCell(startRow, 3);
    minCell.value     = team.ministry;
    minCell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: bgArgb } };
    minCell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    minCell.border    = bdr;

    // ── PS Number ─────────────────────────────────────────────────────────────
    const psCell      = ws.getCell(startRow, 4);
    const psNum       = team.psInfo.match(/SIH\d+/)?.[0]
      ?? (team.psInfo === "AICTE Open Innovation" ? "Open Innovation" : team.psInfo);
    psCell.value      = psNum;
    psCell.fill       = { type: "pattern", pattern: "solid", fgColor: { argb: bgArgb } };
    psCell.alignment  = { vertical: "middle", horizontal: "center" };
    psCell.font       = { bold: psNum !== "Pending" };
    psCell.border     = bdr;

    // ── Category ──────────────────────────────────────────────────────────────
    const catCell     = ws.getCell(startRow, 12);
    catCell.value     = team.category;
    catCell.font      = { bold: true };
    catCell.fill      = { type: "pattern", pattern: "solid",
      fgColor: { argb:
        team.category === "Software"         ? "FFdbeafe" :
        team.category === "Hardware"         ? "FFffedd5" :
        team.category === "Open Innovation"  ? "FFfef3c7" : "FFF3F4F6" } };
    catCell.alignment = { vertical: "middle", horizontal: "center" };
    catCell.border    = bdr;

    // ── Member rows (cols 5–11) ───────────────────────────────────────────────
    if (team.members.length === 0) {
      // No member data — write placeholder across member cols
      for (let c = 5; c <= 11; c++) {
        const cell     = ws.getCell(startRow, c);
        cell.value     = c === 5 ? "(no member data)" : "";
        cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: bgArgb } };
        cell.border    = bdr;
        cell.alignment = { vertical: "middle" };
      }
      ws.getRow(startRow).height = 48;
      rowIdx++;
    } else {
      team.members.forEach((m, mi) => {
        const r = startRow + mi;
        // col: 5=Member Name  6=Register No  7=Year  8=Section  9=Department  10=Phone  11=Gender
        const vals = [m.name, m.regNo, m.year, m.section, m.dept, m.phone, m.gender];
        vals.forEach((v, ci) => {
          const cell      = ws.getCell(r, ci + 5);
          cell.value      = v ?? "";
          cell.fill       = { type: "pattern", pattern: "solid", fgColor: { argb: bgArgb } };
          cell.border     = bdr;
          cell.alignment  = {
            vertical: "middle", horizontal: "left",
            wrapText: ci === 4, // Department column wraps
          };
        });
        ws.getRow(r).height = 18;
      });
      rowIdx += numRows;
    }
  }

  ws.views = [{ state: "frozen", ySplit: 2 }];
}

function allBorder(argb) {
  const s = { style: "thin", color: { argb } };
  return { top: s, left: s, bottom: s, right: s };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  // 1. Load confirmed files
  console.log("Reading existing xlsx files…");
  const swConfirmed  = parseTeamsXlsx(join(__dirname, "software_teams.xlsx"), "Software");
  const hwConfirmed  = parseTeamsXlsx(join(__dirname, "hardware_teams.xlsx"), "Hardware");
  const aicConfirmed = parseTeamsXlsx(join(__dirname, "aicte_teams.xlsx"),    "Open Innovation");
  console.log(`  SW: ${swConfirmed.length} | HW: ${hwConfirmed.length} | AICTE: ${aicConfirmed.length}`);

  // 2. Fetch pending teams from DB
  console.log("Fetching pending teams from database…");
  const pendingTeams = await fetchPendingTeams();
  console.log(`  Pending teams fetched: ${pendingTeams.length}`);

  // 3. Build a set of already-confirmed team names so we don't double-count
  const confirmedSet = new Set([
    ...swConfirmed.map(t  => t.teamName.toLowerCase()),
    ...hwConfirmed.map(t  => t.teamName.toLowerCase()),
    ...aicConfirmed.map(t => t.teamName.toLowerCase()),
  ]);

  // 4. Separate pending into software / hardware, skip already-confirmed
  const pendingSw  = [];
  const pendingHw  = [];
  const noCategory = [];
  const skipped    = [];
  const incomplete = []; // < 6 members

  for (const t of pendingTeams) {
    if (confirmedSet.has(t.teamName.toLowerCase())) {
      skipped.push(t);
      continue;
    }
    if (t.members.length < 6) {
      incomplete.push(t);
      // Still include even if incomplete — just note it
    }
    if (t.category === "Software") pendingSw.push(t);
    else if (t.category === "Hardware") pendingHw.push(t);
    else noCategory.push(t);
  }

  // 5. Merge: confirmed + pending, sorted by team name
  const allSw = [
    ...swConfirmed,
    ...pendingSw,
  ].sort((a, b) => a.teamName.localeCompare(b.teamName));

  const allHw = [
    ...hwConfirmed,
    ...pendingHw,
  ].sort((a, b) => a.teamName.localeCompare(b.teamName));

  // AICTE teams (from pending doc, those assigned AICTE that weren't confirmed)
  // They're already included in pendingSw / pendingHw per the doc's category column
  // The aicConfirmed (7 teams) are not in the pending list — include them separately
  // as a third sheet for reference
  const allAicte = [...aicConfirmed].sort((a, b) => a.teamName.localeCompare(b.teamName));

  console.log(`\nFinal counts:`);
  console.log(`  Software : ${allSw.length} (${swConfirmed.length} confirmed + ${pendingSw.length} pending)`);
  console.log(`  Hardware : ${allHw.length} (${hwConfirmed.length} confirmed + ${pendingHw.length} pending)`);
  console.log(`  AICTE    : ${allAicte.length} confirmed (separate sheet)`);
  console.log(`  Skipped (already confirmed): ${skipped.map(t => t.teamName).join(", ")}`);
  if (incomplete.length) console.log(`  Incomplete (<6 members)   : ${incomplete.map(t => `${t.teamName} (${t.members.length})`).join(", ")}`);

  // 6. Report no-category teams
  if (noCategory.length) {
    console.log("\n⚠  TEAMS WITH NO CATEGORY ASSIGNED:");
    noCategory.forEach(t => console.log(`   ${t.teamName} | Ministry: ${t.ministry}`));
  } else {
    console.log("\n✓  All teams have a category assigned.");
  }

  // 7. Build workbook
  const wb = new ExcelJS.Workbook();
  wb.creator = "SIH SPOC Portal";
  wb.created = new Date();

  const wsSw  = wb.addWorksheet("Software Teams");
  const wsHw  = wb.addWorksheet("Hardware Teams");
  const wsAic = wb.addWorksheet("AICTE Teams");

  buildSheet(wsSw,  allSw,    "Software");
  buildSheet(wsHw,  allHw,    "Hardware");
  buildSheet(wsAic, allAicte, "AICTE — Open Innovation");

  const outPath = join(__dirname, "final_teams_all.xlsx");
  await wb.xlsx.writeFile(outPath);
  console.log(`\n✓  Written → ${outPath}`);
  console.log(`   Software sheet : ${allSw.length} teams`);
  console.log(`   Hardware sheet : ${allHw.length} teams`);
  console.log(`   AICTE sheet    : ${allAicte.length} teams`);
}

main().catch(err => { console.error("❌", err); process.exit(1); });
