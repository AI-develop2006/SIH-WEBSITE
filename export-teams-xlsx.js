#!/usr/bin/env node
/**
 * Export SIH 2026 Final Teams → categorised XLSX files
 * ──────────────────────────────────────────────────────
 *  final_teams_all.xlsx         – all teams combined
 *  software_teams.xlsx          – teams whose chosen PS is Software
 *  hardware_teams.xlsx          – teams whose chosen PS is Hardware
 *  aicte_teams.xlsx             – AICTE / Open Innovation teams
 *
 * Exact 12 Columns matching institutional specification & template image:
 * S.No | Team Name | Team Members | Register No | Year | Section |
 * Department | Ministry | PS Number | Phone | Gender | Category
 */

import pg      from "pg";
import ExcelJS from "exceljs";
import dotenv  from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join }  from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, ".env") });

const DATABASE_URL = process.env.DATABASE_URL;

// ── Helpers ───────────────────────────────────────────────────────────────────
function allBorder(argb) {
  const s = { style: "thin", color: { argb } };
  return { top: s, left: s, bottom: s, right: s };
}

const COL_HEADERS = [
  "S.No", "Team Name", "Team Members", "Register No", "Year", "Section",
  "Department", "Ministry", "PS Number", "Phone", "Gender", "Category",
];
const COL_WIDTHS = [5, 28, 28, 16, 6, 8, 38, 34, 38, 14, 8, 18];

function buildSheet(ws, teams, label) {
  // Title row
  ws.mergeCells(1, 1, 1, COL_HEADERS.length);
  const title     = ws.getCell(1, 1);
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

  const bdr = allBorder("FFBFBFBF");
  let rowIdx = 3;
  let sno    = 1;

  for (const team of teams) {
    const numRows  = Math.max(team.members.length, 1);
    const startRow = rowIdx;
    const endRow   = rowIdx + numRows - 1;
    const bgArgb   = sno % 2 === 0 ? "FFF2F2F2" : "FFFFFFFF";

    // Merge team-level columns across member rows: 1=S.No, 2=Team Name, 8=Ministry, 9=PS Number, 12=Category
    if (numRows > 1) {
      for (const col of [1, 2, 8, 9, 12]) ws.mergeCells(startRow, col, endRow, col);
    }

    // Col 1 — S.No
    const snoCell     = ws.getCell(startRow, 1);
    snoCell.value     = sno++;
    snoCell.font      = { bold: true };
    snoCell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: bgArgb } };
    snoCell.alignment = { vertical: "middle", horizontal: "center" };
    snoCell.border    = bdr;

    // Col 2 — Team Name
    const nameCell     = ws.getCell(startRow, 2);
    nameCell.value     = team.teamName;
    nameCell.font      = { bold: true };
    nameCell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: bgArgb } };
    nameCell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    nameCell.border    = bdr;

    // Col 8 — Ministry
    const minCell      = ws.getCell(startRow, 8);
    minCell.value      = team.ministry ?? "";
    minCell.fill       = { type: "pattern", pattern: "solid", fgColor: { argb: bgArgb } };
    minCell.alignment  = { vertical: "middle", horizontal: "left", wrapText: true };
    minCell.border     = bdr;

    // Col 9 — PS Number + PS Title description
    const psCell       = ws.getCell(startRow, 9);
    if (team.psTitle) {
      psCell.value = { richText: [
        { text: team.psLabel ?? "", font: { bold: true, size: 10 } },
        { text: "\n" + team.psTitle, font: { bold: false, size: 9, italic: true, color: { argb: "FF444444" } } },
      ]};
    } else {
      psCell.value = team.psLabel ?? "";
    }
    psCell.fill        = { type: "pattern", pattern: "solid", fgColor: { argb: bgArgb } };
    psCell.alignment   = { vertical: "middle", horizontal: "center", wrapText: true };
    psCell.font        = { bold: team.psLabel !== "Pending" };
    psCell.border      = bdr;

    // Col 12 — Category
    const catCell      = ws.getCell(startRow, 12);
    catCell.value      = team.category ?? "";
    catCell.font       = { bold: true };
    catCell.fill       = {
      type: "pattern", pattern: "solid",
      fgColor: { argb:
        team.category === "Software"        ? "FFDBEAFE" :
        team.category === "Hardware"        ? "FFFFEDD5" :
        team.category === "Open Innovation" ? "FFFEF3C7" : "FFF3F4F6" },
    };
    catCell.alignment  = { vertical: "middle", horizontal: "center" };
    catCell.border     = bdr;

    // Member rows (cols 3, 4, 5, 6, 7, 10, 11)
    if (team.members.length === 0) {
      const emptyVals = ["(no member data)", "", "", "", "", "", ""];
      const emptyCols = [3, 4, 5, 6, 7, 10, 11];
      emptyCols.forEach((col, ci) => {
        const cell     = ws.getCell(startRow, col);
        cell.value     = emptyVals[ci];
        cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: bgArgb } };
        cell.border    = bdr;
        cell.alignment = { vertical: "middle" };
      });
      ws.getRow(startRow).height = 48;
      rowIdx++;
    } else {
      team.members.forEach((m, mi) => {
        const r    = startRow + mi;
        const cells = [
          [3,  m.name],    // Team Members
          [4,  m.regNo],   // Register No
          [5,  m.year],    // Year
          [6,  m.section], // Section
          [7,  m.dept],    // Department
          [10, m.phone],   // Phone
          [11, m.gender],  // Gender
        ];
        cells.forEach(([col, val]) => {
          const cell     = ws.getCell(r, col);
          cell.value     = val ?? "";
          cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: bgArgb } };
          cell.border    = bdr;
          const alignHoriz = [5, 6, 11].includes(col) ? "center" : "left";
          cell.alignment = { vertical: "middle", horizontal: alignHoriz, wrapText: col === 7 };
        });
        ws.getRow(r).height = 18;
      });
      rowIdx += numRows;
    }
  }

  ws.views = [{ state: "frozen", ySplit: 2 }];
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (!DATABASE_URL) {
    console.error("❌  DATABASE_URL not set in .env");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log("✓  Connected to database");

  // ── Load PS records from DB (source of truth) ────────────────────────────
  const { rows: psRows } = await client.query(
    `SELECT ps_number, category, title, organization FROM public.sih_problems`
  );
  const psMap = new Map(psRows.map(r => [r.ps_number, r]));
  console.log(`✓  Loaded ${psRows.length} PS categories from sih_problems`);

  // ── Load all final teams ──────────────────────────────────────────────────
  const { rows: dbTeams } = await client.query(
    `SELECT name, ministry, member_ids, selected_ps_number, custom_ps_title
     FROM public.spoc_final_teams ORDER BY name`
  );
  console.log(`✓  Loaded ${dbTeams.length} final teams`);

  // ── Resolve members ───────────────────────────────────────────────────────
  const allIds = [...new Set(dbTeams.flatMap(t => t.member_ids ?? []))];
  const memberMap = {};
  if (allIds.length) {
    const ph = allIds.map((_, i) => `$${i + 1}`).join(", ");
    const { rows: members } = await client.query(
      `SELECT id, name, phone, register_no, department, year, section, gender
       FROM public.profiles WHERE id IN (${ph})`, allIds
    );
    for (const m of members) memberMap[m.id] = m;
  }
  console.log(`✓  Resolved ${Object.keys(memberMap).length} member profiles`);

  await client.end();

  // ── Custom category for AICTE open-innovation teams ─────────────────────
  const AICTE_CUSTOM_CAT = {
    "a square":      "Hardware",
    "ece-final-018": "Hardware",
    "ece-final-028": "Hardware",
    "it003":         "Hardware",
    "koro":          "Hardware",
    "mctrfinal#03":  "Hardware",
    "mechfinal#01":  "Software",
    "sih-finial#25": "Hardware",
    "spectra":       "Software",
  };

  // ── Determine category ────────────────────────────────────────────────────
  function getCategory(t) {
    const isAicte = t.ministry?.toLowerCase().includes("aicte");
    if (t.selected_ps_number) return psMap.get(t.selected_ps_number)?.category ?? "Software";
    if (isAicte && t.custom_ps_title) return AICTE_CUSTOM_CAT[t.name.toLowerCase()] ?? "Open Innovation";
    if (isAicte) return "Open Innovation";
    return "Pending";
  }

  function getPsLabel(t) {
    if (t.custom_ps_title) return "Open Innovation";
    if (t.selected_ps_number) return t.selected_ps_number;
    return "Pending";
  }

  function getPsTitle(t) {
    if (t.custom_ps_title) return t.custom_ps_title;
    if (t.selected_ps_number) {
      const ps = psMap.get(t.selected_ps_number);
      return ps?.title ?? "";
    }
    return "";
  }

  function getMembers(t) {
    return (t.member_ids ?? []).map(id => memberMap[id]).filter(Boolean).map(m => ({
      name:    m.name         ?? "",
      regNo:   m.register_no  ?? "",
      phone:   m.phone        ?? "",
      dept:    m.department   ?? "",
      year:    m.year         ?? "",
      section: m.section      ?? "",
      gender:  m.gender       ?? "",
    }));
  }

  const swTeams   = [];
  const hwTeams   = [];
  const aicTeams  = [];
  const allTeams  = [];

  for (const t of dbTeams) {
    const isAicte = t.ministry?.toLowerCase().includes("aicte");
    const cat  = getCategory(t);
    const team = {
      teamName: t.name,
      ministry: t.ministry ?? "",
      psLabel:  getPsLabel(t),
      psTitle:  getPsTitle(t),
      category: cat,
      members:  getMembers(t),
    };
    allTeams.push(team);
    if      (isAicte)            aicTeams.push(team);
    else if (cat === "Software") swTeams.push(team);
    else if (cat === "Hardware") hwTeams.push(team);
  }

  for (const arr of [swTeams, hwTeams, aicTeams, allTeams]) {
    arr.sort((a, b) => a.teamName.localeCompare(b.teamName));
  }

  console.log(`\n📊 Counts: All=${allTeams.length} | Software=${swTeams.length} | Hardware=${hwTeams.length} | AICTE=${aicTeams.length}`);

  // ── Write xlsx files ──────────────────────────────────────────────────────
  async function writeXlsx(teams, filename, sheetLabel) {
    const wb = new ExcelJS.Workbook();
    wb.creator = "SIH SPOC Portal";
    wb.created = new Date();
    buildSheet(wb.addWorksheet(sheetLabel), teams, sheetLabel);
    const outPath = join(__dirname, filename);
    await wb.xlsx.writeFile(outPath);
    console.log(`✓  ${filename} written (${teams.length} teams)`);
  }

  await writeXlsx(allTeams, "final_teams_all.xlsx", "All");
  await writeXlsx(swTeams,  "software_teams.xlsx",  "Software");
  await writeXlsx(hwTeams,  "hardware_teams.xlsx",  "Hardware");
  await writeXlsx(aicTeams, "aicte_teams.xlsx",     "AICTE — Open Innovation");

  console.log("\n✓  All 4 excel files exported successfully.");
}

main().catch(err => { console.error("❌", err.message); process.exit(1); });

