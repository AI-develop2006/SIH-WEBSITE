#!/usr/bin/env node
/**
 * Rebuild aicte_teams.xlsx
 *
 * Highlighting rules for AICTE teams:
 *   PURPLE — team chose an official AICTE ministry PS number (SIH26xxx from AICTE org)
 *   BLUE   — team has a custom PS title that is NOT an official AICTE PS
 *   RED    — team has no PS selected at all
 *
 * For PURPLE teams: PS Number + Title come from sih_problems DB (source of truth).
 * For BLUE teams  : No PS number shown; category inferred from custom title content.
 * For RED teams   : Category = Pending.
 *
 * Columns: S.No | Team Name | Ministry | PS Number | PS Title |
 *          Member Name | Register No | Year | Section | Department |
 *          Phone | Gender | Category
 */
import pg      from "pg";
import ExcelJS from "exceljs";
import dotenv  from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join }  from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, ".env") });

// Category inferred from custom PS title content (BLUE teams only)
// These are teams whose PS is NOT in the AICTE official list.
const CUSTOM_CAT = {
  "a square":      "Hardware",  // Smart Sleep Posture Detection & Alert System → wearable HW
  "ece-final-028": "Hardware",  // Intelligent Multimodal Wearable → wearable HW
  "it003":         "Hardware",  // Embedded Acoustic & Vibration Sensing → embedded HW
  "koro":          "Hardware",  // Upper-Limb Rehabilitation wearable → HW
  "mctrfinal#03":  "Hardware",  // Intelligent Transformer for EV Charging → power HW
  "mechfinal#01":  "Software",  // Multilingual offline emergency app → SW
  "spectra":       "Software",  // Deep Learning Battery SoC Estimation → ML/SW
};

// ARGB colours
const PURPLE_BG = "FFE8D5F5";  // light purple — official AICTE PS
const BLUE_BG   = "FFD6EAF8";  // light blue   — custom non-AICTE PS
const RED_BG    = "FFFFC7CE";  // light red    — no PS

function allBorder(argb) {
  const s = { style: "thin", color: { argb } };
  return { top: s, left: s, bottom: s, right: s };
}

// Columns: S.No | Team Name | Team Members | Register No | Year | Section |
//          Department | Ministry | PS Number | Phone | Gender | Category
const COL_HEADERS = [
  "S.No", "Team Name", "Team Members", "Register No", "Year", "Section",
  "Department", "Ministry", "PS Number", "Phone", "Gender", "Category",
];
const COL_WIDTHS = [5, 28, 28, 16, 6, 8, 38, 34, 38, 14, 8, 18];

function buildSheet(ws, teams) {
  // Title row
  ws.mergeCells(1, 1, 1, COL_HEADERS.length);
  const title     = ws.getCell(1, 1);
  title.value     = "SIH 2026 — Final Teams (AICTE — Open Innovation)";
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

    // Merge span cols for this team: 1=S.No, 2=Team Name, 8=Ministry, 9=PS Number, 12=Category
    if (numRows > 1) {
      for (const col of [1, 2, 8, 9, 12]) ws.mergeCells(startRow, col, endRow, col);
    }

    // Col 1 — S.No
    const snoCell      = ws.getCell(startRow, 1);
    snoCell.value      = sno++;
    snoCell.font       = { bold: true };
    snoCell.fill       = { type: "pattern", pattern: "solid", fgColor: { argb: bgArgb } };
    snoCell.alignment  = { vertical: "middle", horizontal: "center" };
    snoCell.border     = bdr;

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
    const psLabel      = team.psNumber ?? "Open Innovation";
    if (team.psTitle) {
      psCell.value = { richText: [
        { text: psLabel, font: { bold: true, size: 10 } },
        { text: "\n" + team.psTitle, font: { bold: false, size: 9, italic: true, color: { argb: "FF444444" } } },
      ]};
    } else {
      psCell.value = psLabel;
    }
    psCell.fill        = { type: "pattern", pattern: "solid", fgColor: { argb: bgArgb } };
    psCell.alignment   = { vertical: "middle", horizontal: "center", wrapText: true };
    psCell.font        = { bold: true };
    psCell.border      = bdr;

    // Col 12 — Category
    const catCell      = ws.getCell(startRow, 12);
    catCell.value      = team.category ?? "Open Innovation";
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

    // Member rows — cols 3, 4, 5, 6, 7, 10, 11
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
          const alignHoriz = [5, 6, 11].includes(col) ? "center" : "left";
          cell.alignment  = { vertical: "middle", horizontal: alignHoriz, wrapText: col === 7 };
        });
        ws.getRow(r).height = 18;
      });
      rowIdx += numRows;
    }
  }

  ws.views = [{ state: "frozen", ySplit: 2 }];
}
    nameCell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    nameCell.border    = bdr;

    // Col 3 — Ministry
    const minCell      = ws.getCell(startRow, 3);
    minCell.value      = team.ministry;
    minCell.fill       = { type: "pattern", pattern: "solid", fgColor: { argb: rowBg } };
    minCell.alignment  = { vertical: "middle", horizontal: "left", wrapText: true };
    minCell.border     = bdr;

    // Col 4 — PS Number (only for official AICTE PS teams)
    const psNumCell    = ws.getCell(startRow, 4);
    psNumCell.value    = team.psType === "official" ? team.psNumber : "—";
    psNumCell.font     = { bold: team.psType === "official", color: { argb: team.psType === "official" ? "FF4A0080" : "FF888888" } };
    psNumCell.fill     = { type: "pattern", pattern: "solid", fgColor: { argb: rowBg } };
    psNumCell.alignment= { vertical: "middle", horizontal: "center" };
    psNumCell.border   = bdr;

    // Col 5 — PS Title / Custom title
    const psTitleCell    = ws.getCell(startRow, 5);
    psTitleCell.value    = team.psTitle ?? (team.psType === "none" ? "⚠ No PS Selected" : "");
    psTitleCell.font     = {
      italic: team.psType === "custom",
      color: { argb: team.psType === "none" ? "FF9C0006" : "FF000000" },
    };
    psTitleCell.fill     = { type: "pattern", pattern: "solid", fgColor: { argb: rowBg } };
    psTitleCell.alignment= { vertical: "middle", horizontal: "left", wrapText: true };
    psTitleCell.border   = bdr;

    // Col 13 — Category
    const catCell      = ws.getCell(startRow, 13);
    catCell.value      = team.category ?? "Pending";
    catCell.font       = { bold: true };
    catCell.fill       = {
      type: "pattern", pattern: "solid",
      fgColor: { argb:
        team.category === "Software" ? "FFdbeafe" :
        team.category === "Hardware" ? "FFffedd5" : "FFF3F4F6" },
    };
    catCell.alignment  = { vertical: "middle", horizontal: "center" };
    catCell.border     = bdr;

    // Member rows — cols 6–12
    // 6=MemberName, 7=RegNo, 8=Year, 9=Section, 10=Dept, 11=Phone, 12=Gender
    if (team.members.length === 0) {
      const emptyCols = [6, 7, 8, 9, 10, 11, 12];
      emptyCols.forEach((col, ci) => {
        const cell     = ws.getCell(startRow, col);
        cell.value     = ci === 0 ? "(no member data)" : "";
        cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: rowBg } };
        cell.border    = bdr;
        cell.alignment = { vertical: "middle" };
      });
      ws.getRow(startRow).height = 48;
      rowIdx++;
    } else {
      team.members.forEach((m, mi) => {
        const r = startRow + mi;
        const cells = [
          [6,  m.name],
          [7,  m.regNo],
          [8,  m.year],
          [9,  m.section],
          [10, m.dept],
          [11, m.phone],
          [12, m.gender],
        ];
        cells.forEach(([col, val]) => {
          const cell     = ws.getCell(r, col);
          cell.value     = val ?? "";
          cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: rowBg } };
          cell.border    = bdr;
          cell.alignment = { vertical: "middle", horizontal: "left", wrapText: col === 10 };
        });
        ws.getRow(r).height = 18;
      });
      rowIdx += numRows;
    }
  }

  ws.views = [{ state: "frozen", ySplit: 3 }];
}

async function main() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log("✓ Connected to database");

  // Load ALL PS from sih_problems — AICTE ones will be identified by organization
  const { rows: psRows } = await client.query(
    `SELECT ps_number, title, category, organization FROM public.sih_problems`
  );
  // Map of ps_number → { title, category, isAicte }
  const psMap = new Map(psRows.map(r => [r.ps_number, {
    title:   r.title,
    category: r.category,
    isAicte: r.organization?.toLowerCase().includes("aicte") ?? false,
  }]));

  // The 4 teams whose custom_ps_title embeds an AICTE PS number
  // ECE-FINAL-018 → SIH26224, SIH-FINIAL#25 → SIH26222
  const EMBEDDED_PS = {
    "ece-final-018": "SIH26224",
    "sih-finial#25": "SIH26222",
  };

  // Load AICTE teams
  const { rows: aicteTeams } = await client.query(`
    SELECT name, ministry, member_ids, selected_ps_number, custom_ps_title
    FROM public.spoc_final_teams
    WHERE LOWER(ministry) LIKE '%aicte%'
    ORDER BY name
  `);
  console.log(`✓ Loaded ${aicteTeams.length} AICTE teams`);

  // Resolve members
  const allIds = [...new Set(aicteTeams.flatMap(t => t.member_ids ?? []))];
  const memberMap = {};
  if (allIds.length) {
    const ph = allIds.map((_, i) => `$${i + 1}`).join(", ");
    const { rows: members } = await client.query(
      `SELECT id, name, phone, register_no, department, year, section, gender
       FROM public.profiles WHERE id IN (${ph})`, allIds
    );
    for (const m of members) memberMap[m.id] = m;
  }
  await client.end();

  const teamObjects = aicteTeams.map(t => {
    const nameL = t.name.toLowerCase().trim();
    const members = (t.member_ids ?? [])
      .map(id => memberMap[id]).filter(Boolean)
      .map(m => ({
        name: m.name ?? "", regNo: m.register_no ?? "",
        phone: m.phone ?? "", dept: m.department ?? "",
        year: m.year ?? "", section: m.section ?? "", gender: m.gender ?? "",
      }));

    // Case 1: has an official selected_ps_number
    if (t.selected_ps_number) {
      const ps = psMap.get(t.selected_ps_number);
      if (ps?.isAicte) {
        // Official AICTE PS → PURPLE
        return {
          teamName: t.name, ministry: t.ministry ?? "",
          psType: "official", psNumber: t.selected_ps_number,
          psTitle: ps.title, category: ps.category, members,
        };
      } else {
        // Official PS but NOT from AICTE org → BLUE (non-AICTE PS chosen)
        return {
          teamName: t.name, ministry: t.ministry ?? "",
          psType: "custom", psNumber: null,
          psTitle: ps ? `${t.selected_ps_number} — ${ps.title}` : t.selected_ps_number,
          category: ps?.category ?? CUSTOM_CAT[nameL] ?? null, members,
        };
      }
    }

    // Case 2: custom_ps_title that embeds an AICTE PS number
    const embeddedNum = EMBEDDED_PS[nameL];
    if (embeddedNum) {
      const ps = psMap.get(embeddedNum);
      if (ps?.isAicte) {
        return {
          teamName: t.name, ministry: t.ministry ?? "",
          psType: "official", psNumber: embeddedNum,
          psTitle: ps.title, category: ps.category, members,
        };
      }
    }

    // Case 3: custom title with no AICTE PS match → BLUE
    if (t.custom_ps_title) {
      return {
        teamName: t.name, ministry: t.ministry ?? "",
        psType: "custom", psNumber: null,
        psTitle: t.custom_ps_title.trim(),
        category: CUSTOM_CAT[nameL] ?? null, members,
      };
    }

    // Case 4: nothing at all → RED
    return {
      teamName: t.name, ministry: t.ministry ?? "",
      psType: "none", psNumber: null, psTitle: null,
      category: null, members,
    };
  }).sort((a, b) => {
    // Sort: official first, then custom, then none
    const order = { official: 0, custom: 1, none: 2 };
    return (order[a.psType] - order[b.psType]) || a.teamName.localeCompare(b.teamName);
  });

  // Summary
  const official = teamObjects.filter(t => t.psType === "official");
  const custom   = teamObjects.filter(t => t.psType === "custom");
  const none     = teamObjects.filter(t => t.psType === "none");

  console.log(`\n=== AICTE Teams Summary ===`);
  console.log(`  🟣 Official AICTE PS (purple) : ${official.length}`);
  official.forEach(t => console.log(`     ${t.teamName} → ${t.psNumber} | ${t.category} | ${t.psTitle?.substring(0,60)}`));
  console.log(`  🔵 Custom PS (blue)           : ${custom.length}`);
  custom.forEach(t => console.log(`     ${t.teamName} → ${t.category ?? "Unknown"} | ${t.psTitle?.substring(0,60)}`));
  console.log(`  🔴 No PS (red)                : ${none.length}`);
  none.forEach(t => console.log(`     ${t.teamName}`));

  const wb = new ExcelJS.Workbook();
  wb.creator = "SIH SPOC Portal";
  wb.created = new Date();
  buildSheet(wb.addWorksheet("AICTE Teams"), teamObjects);

  const outPath = join(__dirname, "aicte_teams.xlsx");
  await wb.xlsx.writeFile(outPath);
  console.log(`\n✓ Written → aicte_teams.xlsx (${teamObjects.length} teams)`);
}

main().catch(err => { console.error("❌", err.message); process.exit(1); });
