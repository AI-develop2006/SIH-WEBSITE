/**
 * Update AICTE teams in aicte_teams.xlsx and final_teams_all.xlsx using ExcelJS
 * 
 * PURPLE (#7B2FBE) → Teams whose chosen PS matches an official AICTE ministry PS
 *   - Also update PS cell to include PS number + title
 *   - Category updated per official AICTE data
 *
 * BLUE (#4472C4) → Teams whose chosen PS is NOT in the official AICTE list
 *   - Category based on their custom PS
 *   - No PS number prefix
 */

const ExcelJS = require('exceljs');
const path = require('path');

// ─────────────────────────────────────────────────────────────────
// Colour constants (ARGB format for ExcelJS)
// ─────────────────────────────────────────────────────────────────
const COLOR_PURPLE = 'FF7B2FBE'; // Purple  – official AICTE PS
const COLOR_BLUE   = 'FF4472C4'; // Blue    – custom PS (not official AICTE)
const COLOR_WHITE  = 'FFFFFFFF'; // For text on coloured bg

// ─────────────────────────────────────────────────────────────────
// Team decisions based on official sih.gov.in AICTE data
// ─────────────────────────────────────────────────────────────────
// Official AICTE PS from sih.gov.in (org = AICTE):
//   SIH26104 – Cyber Security Cell
//   SIH26105 – Cyber Security Cell
//   SIH26106 – Cyber Security Cell
//   SIH26193–SIH26226 – Student Innovation (MIC)
//
// 3 teams matched official AICTE PS:
//   ARC FORGE      → SIH26105 (exact PS number, official AICTE Cyber Security)
//   ECE-FINAL-018  → SIH26224 (contains "SIH26224", official AICTE Student Innovation – Smart Education Hardware)
//   SIH-FINIAL#25  → SIH26222 (contains "26222", official AICTE Student Innovation – Transportation & Logistics Hardware)
//
// 9 teams chose custom / non-AICTE PS:
//   A Square, ECE-FINAL-028, it003, KORO, MCTRFINAL#03,
//   MECHFINAL#01, SIH#IT012, SPECTRA, TECH TEMPLARS

const DECISIONS = {
  // ── OFFICIAL AICTE PS ──────────────────────────────────────────
  'ARC FORGE': {
    official: true,
    psNumber: 'SIH26105',
    psTitle: 'AI-Powered Continuous Cyber Risk Quantification and Investment Optimization Platform',
    category: 'Software',
    color: COLOR_PURPLE
  },
  'ECE-FINAL-018': {
    official: true,
    psNumber: 'SIH26224',
    psTitle: 'Student Innovation – Smart Education (Hardware)',
    category: 'Hardware',
    color: COLOR_PURPLE
  },
  'SIH-FINIAL#25': {
    official: true,
    psNumber: 'SIH26222',
    psTitle: 'Student Innovation – Transportation & Logistics (Hardware)',
    category: 'Hardware',
    color: COLOR_PURPLE
  },
  // ── CUSTOM / NON-AICTE PS ──────────────────────────────────────
  'A Square': {
    official: false,
    category: 'Hardware',   // Smart Sleep Posture Device → Hardware
    color: COLOR_BLUE
  },
  'ECE-FINAL-028': {
    official: false,
    category: 'Hardware',   // Multimodal Wearable → Hardware
    color: COLOR_BLUE
  },
  'it003': {
    official: false,
    category: 'Hardware',   // Acoustic/Vibration grain sensor → Hardware
    color: COLOR_BLUE
  },
  'KORO': {
    official: false,
    category: 'Hardware',   // Rehab wearable → Hardware
    color: COLOR_BLUE
  },
  'MCTRFINAL#03': {
    official: false,
    category: 'Hardware',   // EV transformer → Hardware
    color: COLOR_BLUE
  },
  'MECHFINAL#01': {
    official: false,
    category: 'Software',   // Emergency medical app → Software
    color: COLOR_BLUE
  },
  'SIH#IT012': {
    official: false,
    category: 'Software',   // MediSphere app → Software
    color: COLOR_BLUE
  },
  'SPECTRA': {
    official: false,
    category: 'Software',   // Deep learning battery SoC → Software
    color: COLOR_BLUE
  },
  'TECH TEMPLARS': {
    official: false,
    category: 'Open Innovation',
    color: COLOR_BLUE
  },
};

// ─────────────────────────────────────────────────────────────────
// Helper: fill a row with a background colour
// ─────────────────────────────────────────────────────────────────
function fillRow(row, argbColor) {
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: argbColor }
    };
    // White text on darker backgrounds for readability
    if (argbColor !== 'FFFFFFFF') {
      cell.font = Object.assign({}, cell.font || {}, { color: { argb: COLOR_WHITE } });
    }
  });
}

// ─────────────────────────────────────────────────────────────────
// Process aicte_teams.xlsx
// Columns (1-based): S.No, Team Name, Ministry, PS Number, Member Name,
//                    Register No, Year, Section, Department, Phone, Gender, Category
// ─────────────────────────────────────────────────────────────────
async function processAicteTeams() {
  const filePath = path.join(__dirname, 'aicte_teams.xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const ws = workbook.worksheets[0];

  // Track which teams we've seen so we can color their member rows too
  let currentTeam = null;
  let currentColor = null;
  let changes = [];

  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const sno = row.getCell(1).value;
    // Header rows and title row → skip
    if (rowNumber <= 2) return;

    if (sno !== null && sno !== undefined && !isNaN(Number(sno))) {
      // This is a team's first row
      const teamName = String(row.getCell(2).value || '').trim();
      const decision = DECISIONS[teamName];

      if (!decision) {
        console.warn(`  [WARN] No decision for team: "${teamName}"`);
        currentTeam = null;
        currentColor = null;
        return;
      }

      currentTeam = teamName;
      currentColor = decision.color;

      // ── Update Category (col 12) ──────────────────────────────
      const catCell = row.getCell(12);
      const oldCat = String(catCell.value || '').trim();
      if (oldCat !== decision.category) {
        catCell.value = decision.category;
        changes.push(`  ${teamName}: Category "${oldCat}" → "${decision.category}"`);
      }

      // ── Update PS Number (col 4) for official matches ─────────
      if (decision.official) {
        const psCell = row.getCell(4);
        const oldPs = String(psCell.value || '').trim();
        const newPs = `${decision.psNumber} – ${decision.psTitle}`;
        if (!oldPs.startsWith(decision.psNumber)) {
          psCell.value = newPs;
          changes.push(`  ${teamName}: PS → "${newPs}"`);
        }
      }

      // ── Colour this row ───────────────────────────────────────
      fillRow(row, decision.color);

    } else {
      // Member row (no S.No) – colour with last team's colour
      if (currentColor && row.values.some(v => v !== null && v !== undefined && String(v).trim())) {
        fillRow(row, currentColor);
      }
    }
  });

  await workbook.xlsx.writeFile(filePath);
  console.log('\n[aicte_teams.xlsx] Changes applied:');
  if (changes.length === 0) console.log('  (no content changes, colors applied)');
  else changes.forEach(c => console.log(c));
}

// ─────────────────────────────────────────────────────────────────
// Process final_teams_all.xlsx
// Columns (1-based): S.No, Team Name, Team Members, Register No,
//                    Year, Section, Department, Ministry, PS Number,
//                    Phone, Gender, Category
// ─────────────────────────────────────────────────────────────────
async function processFinalTeams() {
  const filePath = path.join(__dirname, 'final_teams_all.xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const ws = workbook.worksheets[0];

  let currentTeam = null;
  let currentColor = null;
  let isAICTE = false;
  let changes = [];

  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= 2) return; // title and header rows

    const sno = row.getCell(1).value;

    if (sno !== null && sno !== undefined && !isNaN(Number(sno))) {
      // First row of a team
      const teamName = String(row.getCell(2).value || '').trim();
      const ministry = String(row.getCell(8).value || '').trim();

      isAICTE = (ministry === 'AICTE');

      if (!isAICTE) {
        currentTeam = null;
        currentColor = null;
        return;
      }

      const decision = DECISIONS[teamName];
      if (!decision) {
        console.warn(`  [WARN] No decision for AICTE team: "${teamName}"`);
        currentTeam = null;
        currentColor = null;
        isAICTE = false;
        return;
      }

      currentTeam = teamName;
      currentColor = decision.color;

      // ── Update Category (col 12) ──────────────────────────────
      const catCell = row.getCell(12);
      const oldCat = String(catCell.value || '').trim();
      if (oldCat !== decision.category) {
        catCell.value = decision.category;
        changes.push(`  ${teamName}: Category "${oldCat}" → "${decision.category}"`);
      }

      // ── Update PS Number (col 9) for official matches ─────────
      if (decision.official) {
        const psCell = row.getCell(9);
        const oldPs = String(psCell.value || '').trim();
        if (!oldPs.startsWith(decision.psNumber)) {
          const newPs = `${decision.psNumber} – ${decision.psTitle}\n${oldPs}`;
          psCell.value = newPs;
          changes.push(`  ${teamName}: PS prefixed with ${decision.psNumber}`);
        }
      }

      // ── Colour this row ───────────────────────────────────────
      fillRow(row, decision.color);

    } else {
      // Member row
      if (isAICTE && currentColor && row.values.some(v => v !== null && v !== undefined && String(v).trim())) {
        fillRow(row, currentColor);
      }
    }
  });

  await workbook.xlsx.writeFile(filePath);
  console.log('\n[final_teams_all.xlsx] Changes applied:');
  if (changes.length === 0) console.log('  (no content changes, colors applied to AICTE rows)');
  else changes.forEach(c => console.log(c));
}

// ─────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────
(async () => {
  console.log('=== Updating AICTE teams ===');
  console.log('PURPLE (#7B2FBE) → official AICTE PS from sih.gov.in');
  console.log('BLUE   (#4472C4) → custom / non-AICTE PS\n');

  try {
    await processAicteTeams();
    await processFinalTeams();
    console.log('\n✓ Both files updated successfully!');
    console.log('');
    console.log('Summary of PURPLE teams (official AICTE PS):');
    console.log('  • ARC FORGE     → SIH26105 – AI-Powered Continuous Cyber Risk Quantification... (Software)');
    console.log('  • ECE-FINAL-018 → SIH26224 – Student Innovation – Smart Education (Hardware)');
    console.log('  • SIH-FINIAL#25 → SIH26222 – Student Innovation – Transportation & Logistics (Hardware)');
    console.log('');
    console.log('Summary of BLUE teams (custom PS, not official AICTE):');
    console.log('  • A Square, ECE-FINAL-028, it003, KORO, MCTRFINAL#03,');
    console.log('    MECHFINAL#01, SIH#IT012, SPECTRA, TECH TEMPLARS');
  } catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
})();
