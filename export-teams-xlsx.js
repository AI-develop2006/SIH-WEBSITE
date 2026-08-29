#!/usr/bin/env node
/**
 * Export SIH 2026 Final Teams → two XLSX files
 * ─────────────────────────────────────────────
 *  software_teams.xlsx  – teams whose chosen PS is Software category
 *  hardware_teams.xlsx  – teams whose chosen PS is Hardware category
 *
 *  AICTE (Open Innovation) teams: placed in either sheet depending on
 *  whether we can infer category from the custom PS title. Since there
 *  is no official category for custom AICTE PS, AICTE teams are appended
 *  at the END of the software sheet (convention for Open Innovation).
 *  If you want them in hardware, adjust AICTE_DEFAULT_SHEET below.
 *
 *  Columns per team:
 *    S.No | Team Name | Member 1 Name | Member 1 Phone | ... (vertically)
 *    (each member on its own row, team spans rows via row merging)
 *    + Hindi Proficiency | Remarks
 *
 * Usage:
 *   node export-teams-xlsx.js
 *
 * Output files are written next to this script.
 */

import pg       from "pg";
import ExcelJS  from "exceljs";
import fs       from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import dotenv   from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, ".env") });

// ── Config ────────────────────────────────────────────────────────────────────
const DATABASE_URL       = process.env.DATABASE_URL;
const AICTE_DEFAULT_SHEET = "software"; // where AICTE teams go if no category inferred

// SIH 2026 PS dataset — category lookup (psNumber → category)
// Inlined here so the script is self-contained (no frontend import needed).
// Full 229-entry dataset from sih2026Problems.js
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

// ── Database query ────────────────────────────────────────────────────────────
async function fetchTeams() {
  const client = new pg.Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log("✓  Connected to database");

  // Fetch all final teams that have chosen a PS (or have a custom AICTE title)
  // AND have exactly 6 members (valid team size)
  const { rows: teams } = await client.query(`
    SELECT
      ft.id,
      ft.name         AS team_name,
      ft.ministry,
      ft.member_ids,
      ft.selected_ps_number,
      ft.custom_ps_title
    FROM public.spoc_final_teams ft
    WHERE (ft.selected_ps_number IS NOT NULL OR ft.custom_ps_title IS NOT NULL)
      AND array_length(ft.member_ids, 1) = 6
    ORDER BY ft.name
  `);

  if (teams.length === 0) {
    await client.end();
    console.log("⚠  No teams with a chosen PS found in the database.");
    process.exit(0);
  }

  // Collect all member UUIDs across all teams
  const allMemberIds = [...new Set(teams.flatMap((t) => t.member_ids ?? []))];

  let memberMap = {};
  if (allMemberIds.length > 0) {
    const placeholders = allMemberIds.map((_, i) => `$${i + 1}`).join(", ");
    const { rows: members } = await client.query(
      `SELECT id, name, phone, register_no, department, year, section, gender
       FROM public.profiles
       WHERE id IN (${placeholders})`,
      allMemberIds
    );
    for (const m of members) {
      memberMap[m.id] = m;
    }
  }

  await client.end();
  return { teams, memberMap };
}

// ── XLSX builder ──────────────────────────────────────────────────────────────
const HEADER_ROW = ["S.No", "Team Name", "Member Name", "Register No", "Phone", "Department / Year / Sec", "Gender", "Hindi Proficiency", "Remarks"];
// Column widths
const COL_WIDTHS = [6, 28, 28, 16, 14, 26, 10, 20, 30];

function styleHeader(row) {
  row.eachCell((cell) => {
    cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3864" } };
    cell.font   = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.border = {
      top:    { style: "thin", color: { argb: "FF4472C4" } },
      left:   { style: "thin", color: { argb: "FF4472C4" } },
      bottom: { style: "thin", color: { argb: "FF4472C4" } },
      right:  { style: "thin", color: { argb: "FF4472C4" } },
    };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  row.height = 22;
}

function borderCell(cell, isMerged = false) {
  cell.border = {
    top:    { style: "thin", color: { argb: "FFBFBFBF" } },
    left:   { style: "thin", color: { argb: "FFBFBFBF" } },
    bottom: { style: "thin", color: { argb: "FFBFBFBF" } },
    right:  { style: "thin", color: { argb: "FFBFBFBF" } },
  };
  cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
}

function addTeamsToSheet(ws, teamsForSheet, memberMap, label) {
  // Title row
  ws.mergeCells(1, 1, 1, HEADER_ROW.length);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = `SIH 2026 — Final Teams (${label})`;
  titleCell.font  = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  titleCell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2E4057" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 28;

  // Header row
  const hdr = ws.getRow(2);
  hdr.values = HEADER_ROW;
  styleHeader(hdr);
  ws.getRow(2).height = 22;

  // Column widths
  COL_WIDTHS.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  let rowIdx = 3;
  let sno    = 1;

  for (const team of teamsForSheet) {
    const members = (team.member_ids ?? [])
      .map((id) => memberMap[id])
      .filter(Boolean);

    const psInfo = team.selected_ps_number
      ? `${team.selected_ps_number} (${PS_CATEGORY[team.selected_ps_number] ?? "Unknown"})`
      : `AICTE Open Innovation`;

    const numRows = Math.max(members.length, 1);
    const startRow = rowIdx;
    const endRow   = rowIdx + numRows - 1;

    // Alternate row shading per team
    const bgColor = sno % 2 === 0 ? "FFF2F2F2" : "FFFFFFFF";

    // Team-level merged cells: S.No, Team Name, Hindi Proficiency, Remarks
    // (cols 1, 2, 8, 9)
    const mergeCols = [1, 2, 8, 9];
    if (numRows > 1) {
      for (const col of mergeCols) {
        ws.mergeCells(startRow, col, endRow, col);
      }
    }

    // Fill team-level cells
    const snoCell  = ws.getCell(startRow, 1);
    snoCell.value  = sno++;
    snoCell.font   = { bold: true };
    snoCell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
    snoCell.alignment = { vertical: "middle", horizontal: "center" };
    borderCell(snoCell);

    const nameCell  = ws.getCell(startRow, 2);
    nameCell.value  = `${team.team_name}\n[Ministry: ${team.ministry ?? "—"}]\n[PS: ${psInfo}]`;
    nameCell.font   = { bold: true };
    nameCell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
    nameCell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    borderCell(nameCell);

    const hindiCell = ws.getCell(startRow, 8);
    hindiCell.value = "";
    hindiCell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
    borderCell(hindiCell);

    const remCell   = ws.getCell(startRow, 9);
    remCell.value   = "";
    remCell.fill    = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
    borderCell(remCell);

    // Member rows
    if (members.length === 0) {
      // No member data found
      for (let c = 3; c <= 7; c++) {
        const cell = ws.getCell(startRow, c);
        cell.value = c === 3 ? "(no member data)" : "";
        cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
        borderCell(cell);
      }
      ws.getRow(startRow).height = 48;
      rowIdx++;
    } else {
      members.forEach((m, mi) => {
        const r = startRow + mi;
        const deptYearSec = [m.department, m.year ? `Year ${m.year}` : null, m.section ? `Sec ${m.section}` : null]
          .filter(Boolean).join(" · ");

        const vals = [
          m.name         ?? "—",
          m.register_no  ?? "—",
          m.phone        ?? "—",
          deptYearSec    || "—",
          m.gender       ?? "—",
        ];

        vals.forEach((v, ci) => {
          const cell  = ws.getCell(r, ci + 3); // cols 3–7
          cell.value  = v;
          cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
          borderCell(cell);
        });

        ws.getRow(r).height = 20;
      });
      rowIdx += numRows;
    }
  }

  // Freeze header rows
  ws.views = [{ state: "frozen", ySplit: 2 }];
}

// ── Categorise teams ──────────────────────────────────────────────────────────
function categoriseTeams(teams) {
  const software = [];
  const hardware = [];
  const aicte    = [];

  for (const team of teams) {
    const ministry = (team.ministry ?? "").toLowerCase();
    const isAicte  = ministry.includes("aicte");

    if (isAicte) {
      aicte.push(team);
      continue;
    }

    if (team.selected_ps_number) {
      const cat = PS_CATEGORY[team.selected_ps_number];
      if (cat === "Hardware") {
        hardware.push(team);
      } else {
        // Software (or unknown — default software)
        software.push(team);
      }
    } else if (team.custom_ps_title) {
      // Non-AICTE with custom title → shouldn't normally happen, treat as software
      software.push(team);
    }
  }

  // AICTE teams go into their own sheet — excluded from software & hardware
  return { software, hardware, aicte };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (!DATABASE_URL) {
    console.error("❌  DATABASE_URL not set in .env");
    process.exit(1);
  }

  const { teams, memberMap } = await fetchTeams();
  console.log(`✓  Fetched ${teams.length} team(s) with a chosen PS`);

  const { software, hardware } = categoriseTeams(teams);

  console.log(`   Software teams : ${software.length}`);
  console.log(`   Hardware teams : ${hardware.length}`);

  // ── Verification dump ────────────────────────────────────────────────────────
  console.log("\n──────────── Verification ────────────────────────────────────────────");
  console.log("SOFTWARE teams:");
  software.forEach((t, i) => {
    const ministry = (t.ministry ?? "").toLowerCase();
    const isAicte  = ministry.includes("aicte");
    const cat      = isAicte ? "AICTE (custom)" : (PS_CATEGORY[t.selected_ps_number] ?? "Unknown");
    console.log(`  ${i+1}. ${t.team_name} | PS: ${t.selected_ps_number ?? "custom"} | Category: ${cat} | Ministry: ${t.ministry}`);
  });
  console.log("\nHARDWARE teams:");
  hardware.forEach((t, i) => {
    const cat = PS_CATEGORY[t.selected_ps_number] ?? "Unknown";
    console.log(`  ${i+1}. ${t.team_name} | PS: ${t.selected_ps_number} | Category: ${cat} | Ministry: ${t.ministry}`);
  });
  console.log("──────────────────────────────────────────────────────────────────────\n");

  const outDir = __dirname;

  // ── AICTE XLSX ───────────────────────────────────────────────────────────
  const aicteTeams = teams.filter((t) => (t.ministry ?? "").toLowerCase().includes("aicte"));
  console.log(`   AICTE teams     : ${aicteTeams.length}`);
  if (aicteTeams.length > 0) {
    const wb0 = new ExcelJS.Workbook();
    wb0.creator = "SIH Portal";
    wb0.created = new Date();
    const ws0 = wb0.addWorksheet("AICTE Teams");
    addTeamsToSheet(ws0, aicteTeams, memberMap, "AICTE — Open Innovation");
    const outPath0 = join(outDir, "aicte_teams.xlsx");
    await wb0.xlsx.writeFile(outPath0);
    console.log(`✓  aicte_teams.xlsx written → ${outPath0}`);
  } else {
    console.log("⚠  No AICTE teams found — skipping aicte_teams.xlsx");
  }

  // ── Software XLSX ─────────────────────────────────────────────────────────
  if (software.length > 0) {
    const wb1 = new ExcelJS.Workbook();
    wb1.creator  = "SIH Portal";
    wb1.created  = new Date();
    const ws1 = wb1.addWorksheet("Software Teams");
    addTeamsToSheet(ws1, software, memberMap, "Software");
    const outPath1 = join(outDir, "software_teams.xlsx");
    await wb1.xlsx.writeFile(outPath1);
    console.log(`✓  software_teams.xlsx written → ${outPath1}`);
  } else {
    console.log("⚠  No software teams found — skipping software_teams.xlsx");
  }

  // ── Hardware XLSX ─────────────────────────────────────────────────────────
  if (hardware.length > 0) {
    const wb2 = new ExcelJS.Workbook();
    wb2.creator  = "SIH Portal";
    wb2.created  = new Date();
    const ws2 = wb2.addWorksheet("Hardware Teams");
    addTeamsToSheet(ws2, hardware, memberMap, "Hardware");
    const outPath2 = join(outDir, "hardware_teams.xlsx");
    await wb2.xlsx.writeFile(outPath2);
    console.log(`✓  hardware_teams.xlsx written → ${outPath2}`);
  } else {
    console.log("⚠  No hardware teams found — skipping hardware_teams.xlsx");
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("❌  Error:", err);
  process.exit(1);
});
