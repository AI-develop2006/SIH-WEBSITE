#!/usr/bin/env node
/**
 * Build combined final_teams_all.xlsx from the database.
 *
 * All team data (members, PS selections, categories) comes from the DB —
 * no hard-coded JS lookup tables, no manual xlsx parsing.
 *
 * PS categories are read from the sih_problems table (scraped from sih.gov.in),
 * so they are always authoritative and up-to-date.
 *
 * Output: final_teams_all.xlsx
 *   Single sheet "All Teams" — all teams combined (Software, Hardware, AICTE, Pending)
 *
 * Columns: S.No | Team Name | Team Members | Register No | Year | Section |
 *          Department | Ministry | PS Number | Phone | Gender | Category
 *
 * Usage:
 *   node build-combined-final.mjs
 */

import pg       from "pg";
import ExcelJS  from "exceljs";
import dotenv   from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join }  from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, ".env") });

// ── Fallback category for teams with no PS selected ───────────────────────────
// Sourced from the institution's internal roster (uploaded doc, 30-Aug-2026).
// Used ONLY when a team has no selected_ps_number and no custom_ps_title.
// If a team has since chosen a PS, the DB category takes priority (see getCategory).
const PENDING_FALLBACK_CAT = {
  "techspirint":     "Software",
  "mechnova":        "Hardware",
  "ece-final-002":   "Software",
  "ece-final-021":   "Hardware",
  "etta":            "Software",
  "trialveda":       "Software",
  "byte builders":   "Software",
  "csefinal#32":     "Software",
  "tech templars":   "Hardware",
  "hackerzz":        "Software",
  "blaze":           "Software",
  "kreonyx":         "Software",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function allBorder(argb) {
  const s = { style: "thin", color: { argb } };
  return { top: s, left: s, bottom: s, right: s };
}

// Column order: S.No | Team Name | Team Members | Register No | Year | Section |
//               Department | Ministry | PS Number | Phone | Gender | Category
const COL_HEADERS = [
  "S.No", "Team Name", "Team Members", "Register No", "Year", "Section",
  "Department", "Ministry", "PS Number", "Phone", "Gender", "Category",
];
const COL_WIDTHS = [5, 28, 28, 16, 6, 8, 38, 34, 38, 14, 8, 18];

function buildSheet(ws, teams, label) {
  // ── Title row ──────────────────────────────────────────────────────────────
  ws.mergeCells(1, 1, 1, COL_HEADERS.length);
  const title      = ws.getCell(1, 1);
  title.value      = `SIH 2026 — Final Teams (${label})`;
  title.font       = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  title.fill       = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A2744" } };
  title.alignment  = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 28;

  // ── Header row ─────────────────────────────────────────────────────────────
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

    // ── Highlight rules ────────────────────────────────────────────────────
    // RED   : incomplete team (fewer than 6 members)
    // YELLOW: no PS selected (and not incomplete)
    // These override the default name-cell colour.
    const memberCount  = team.rawMemberCount;
    const hasPs        = team.psLabel !== "Pending";
    const isIncomplete = memberCount < 6;
    const isNoPsOnly   = !hasPs && !isIncomplete; // 6 members but no PS

    const nameBgArgb = isIncomplete ? "FFFFC7CE"   // red   (#FFC7CE)
                     : isNoPsOnly   ? "FFFFFF00"   // yellow (#FFFF00)
                     : "FFEFF8FF";                 // default blue-tint

    // Cols that span all member rows for this team:
    // 1=S.No, 2=Team Name, 8=Ministry, 9=PS Number, 12=Category
    if (numRows > 1) {
      for (const col of [1, 2, 8, 9, 12]) ws.mergeCells(startRow, col, endRow, col);
    }

    // Col 1 — S.No
    const snoCell      = ws.getCell(startRow, 1);
    snoCell.value      = sno++;
    snoCell.font       = { bold: true };
    snoCell.fill       = { type: "pattern", pattern: "solid", fgColor: { argb: nameBgArgb } };
    snoCell.alignment  = { vertical: "middle", horizontal: "center" };
    snoCell.border     = bdr;

    // Col 2 — Team Name
    const nameCell     = ws.getCell(startRow, 2);
    nameCell.value     = team.teamName;
    nameCell.font      = { bold: true, color: { argb: isIncomplete ? "FF9C0006" : "FF000000" } };
    nameCell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: nameBgArgb } };
    nameCell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    nameCell.border    = bdr;

    // Col 8 — Ministry
    const minCell      = ws.getCell(startRow, 8);
    minCell.value      = team.ministry;
    minCell.fill       = { type: "pattern", pattern: "solid", fgColor: { argb: bgArgb } };
    minCell.alignment  = { vertical: "middle", horizontal: "left", wrapText: true };
    minCell.border     = bdr;

    // Col 9 — PS Number + PS Title (second line)
    const psCell       = ws.getCell(startRow, 9);
    if (team.psTitle) {
      psCell.value = { richText: [
        { text: team.psLabel, font: { bold: true, size: 10 } },
        { text: "\n" + team.psTitle, font: { bold: false, size: 9, italic: true, color: { argb: "FF444444" } } },
      ]};
    } else {
      psCell.value = team.psLabel;
    }
    psCell.fill        = { type: "pattern", pattern: "solid", fgColor: { argb: bgArgb } };
    psCell.alignment   = { vertical: "middle", horizontal: "center", wrapText: true };
    psCell.font        = { bold: team.psLabel !== "Pending" };
    psCell.border      = bdr;

    // Col 12 — Category
    const catCell      = ws.getCell(startRow, 12);
    catCell.value      = team.category;
    catCell.font       = { bold: true };
    catCell.fill       = {
      type: "pattern", pattern: "solid",
      fgColor: { argb:
        team.category === "Software"        ? "FFdbeafe" :
        team.category === "Hardware"        ? "FFffedd5" :
        team.category === "Open Innovation" ? "FFfef3c7" : "FFF3F4F6" },
    };
    catCell.alignment  = { vertical: "middle", horizontal: "center" };
    catCell.border     = bdr;

    // Member rows — cols 3–7, 10–11
    // 3=Team Members(name), 4=Register No, 5=Year, 6=Section, 7=Department,
    // 10=Phone, 11=Gender
    if (team.members.length === 0) {
      const emptyVals = ["(no member data)", "", "", "", "", "", ""];
      const emptyCols = [3, 4, 5, 6, 7, 10, 11];
      emptyCols.forEach((col, ci) => {
        const cell      = ws.getCell(startRow, col);
        cell.value      = emptyVals[ci];
        cell.fill       = { type: "pattern", pattern: "solid", fgColor: { argb: bgArgb } };
        cell.border     = bdr;
        cell.alignment  = { vertical: "middle" };
      });
      ws.getRow(startRow).height = 48;
      rowIdx++;
    } else {
      team.members.forEach((m, mi) => {
        const r = startRow + mi;
        // col → value mapping
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
          const cell      = ws.getCell(r, col);
          cell.value      = val ?? "";
          cell.fill       = { type: "pattern", pattern: "solid", fgColor: { argb: bgArgb } };
          cell.border     = bdr;
          cell.alignment  = { vertical: "middle", horizontal: "left", wrapText: col === 7 };
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
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log("✓  Connected to database");

  // ── Load PS categories from sih_problems (DB = source of truth) ───────────
  const { rows: psRows } = await client.query(
    `SELECT ps_number, category, title, organization
     FROM public.sih_problems
     ORDER BY sno`
  );
  const psMap = new Map(psRows.map(r => [r.ps_number, r]));
  console.log(`✓  Loaded ${psRows.length} PS records from sih_problems`);

  // ── Load all final teams ──────────────────────────────────────────────────
  const { rows: dbTeams } = await client.query(
    `SELECT id, name, ministry, member_ids, selected_ps_number, custom_ps_title
     FROM public.spoc_final_teams
     ORDER BY name`
  );
  console.log(`✓  Loaded ${dbTeams.length} final teams`);

  // ── Resolve member profiles ───────────────────────────────────────────────
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
  console.log(`✓  Resolved ${Object.keys(memberMap).length} member profiles`);

  await client.end();

  // ── Custom PS category assignments for AICTE open-innovation teams ──────────
  // Teams with no official SIH PS — category inferred from their custom title.
  const AICTE_CUSTOM_CAT = {
    "a square":      "Hardware",  // Smart Sleep Posture Detection → wearable device
    "ece-final-018": "Hardware",  // references SIH26224 (Hardware on website)
    "ece-final-028": "Hardware",  // Intelligent Multimodal Wearable → HW device
    "it003":         "Hardware",  // Embedded Acoustic & Vibration Sensing → embedded HW
    "koro":          "Hardware",  // Upper-Limb Rehabilitation wearable → HW device
    "mctrfinal#03":  "Hardware",  // Intelligent Transformer for EV Charging → power HW
    "mechfinal#01":  "Software",  // Multilingual offline emergency app → Software
    "sih-finial#25": "Hardware",  // references SIH26222 (Hardware on website)
    "spectra":       "Software",  // Deep Learning Battery SoC Estimation → ML/Software
  };

  // ── Determine category for each team ─────────────────────────────────────
  // Priority:
  //   1. AICTE ministry + selected_ps_number → use sih_problems category
  //   2. AICTE ministry + custom_ps_title    → use AICTE_CUSTOM_CAT inference
  //   3. AICTE ministry + no PS at all       → "Open Innovation" (unknown)
  //   4. Non-AICTE + selected_ps_number      → category from sih_problems
  //   5. Non-AICTE + no PS                   → "Pending"
  function getCategory(t) {
    const isAicte = t.ministry?.toLowerCase().includes("aicte");
    if (t.selected_ps_number) {
      const ps = psMap.get(t.selected_ps_number);
      if (ps) return ps.category; // "Software" | "Hardware"
    }
    if (isAicte) {
      if (t.custom_ps_title) {
        return AICTE_CUSTOM_CAT[t.name.toLowerCase()] ?? "Open Innovation";
      }
      // AICTE team with no PS yet — check fallback map for hardware category hint
      return PENDING_FALLBACK_CAT[t.name.toLowerCase()] ?? "Open Innovation";
    }
    // Non-AICTE with no PS — use fallback from uploaded roster if available
    return PENDING_FALLBACK_CAT[t.name.toLowerCase()] ?? "Pending";
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
    return (t.member_ids ?? [])
      .map(id => memberMap[id])
      .filter(Boolean)
      .map(m => ({
        name:    m.name         ?? "",
        regNo:   m.register_no  ?? "",
        phone:   m.phone        ?? "",
        dept:    m.department   ?? "",
        year:    m.year         ?? "",
        section: m.section      ?? "",
        gender:  m.gender       ?? "",
      }));
  }

  const swTeams      = [];
  const hwTeams      = [];
  const aicTeams     = [];
  const pendingTeams = [];

  for (const t of dbTeams) {
    const isAicte = t.ministry?.toLowerCase().includes("aicte");
    const cat     = getCategory(t);
    const team    = {
      teamName:       t.name,
      ministry:       t.ministry ?? "",
      psLabel:        getPsLabel(t),
      psTitle:        getPsTitle(t),
      category:       cat,
      members:        getMembers(t),
      rawMemberCount: (t.member_ids ?? []).length,
    };
    // AICTE teams always go to the AICTE sheet regardless of SW/HW sub-category.
    // Non-AICTE teams with no PS go to Pending sheet — even if we have a fallback
    // category hint, they stay pending until they officially select a PS.
    if      (isAicte)               aicTeams.push(team);
    else if (t.selected_ps_number || t.custom_ps_title) {
      // Has an actual PS selection — route to correct sheet
      if      (cat === "Software")  swTeams.push(team);
      else if (cat === "Hardware")  hwTeams.push(team);
      else                          pendingTeams.push(team);
    } else {
      // No PS yet — goes to Pending sheet but category column shows fallback hint
      pendingTeams.push(team);
    }  }

  // Sort each bucket alphabetically by team name
  for (const arr of [swTeams, hwTeams, aicTeams, pendingTeams]) {
    arr.sort((a, b) => a.teamName.localeCompare(b.teamName));
  }

  // Combine all into one list: Software → Hardware → AICTE → Pending
  const allTeams = [...swTeams, ...hwTeams, ...aicTeams, ...pendingTeams];

  console.log(`\nFinal counts:`);
  console.log(`  Software        : ${swTeams.length}`);
  console.log(`  Hardware        : ${hwTeams.length}`);
  console.log(`  Open Innovation : ${aicTeams.length}`);
  console.log(`  Pending (no PS) : ${pendingTeams.length}`);
  console.log(`  Total           : ${allTeams.length}`);
  if (pendingTeams.length) {
    console.log(`  Pending teams   : ${pendingTeams.map(t => t.teamName).join(", ")}`);
  }

  // ── Build workbook ────────────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook();
  wb.creator = "SIH SPOC Portal";
  wb.created = new Date();

  buildSheet(wb.addWorksheet("All Teams"), allTeams, "All");

  const outPath = join(__dirname, "final_teams_all.xlsx");
  await wb.xlsx.writeFile(outPath);

  console.log(`\n✓  Written → ${outPath}`);
  console.log(`   Total teams in single sheet: ${allTeams.length}`);
}

main().catch(err => { console.error("❌", err.message); process.exit(1); });
