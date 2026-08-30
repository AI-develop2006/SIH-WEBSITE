/**
 * Update AICTE teams in aicte_teams.xlsx and final_teams_all.xlsx
 *
 * Rules:
 * - If a team's PS matches an OFFICIAL AICTE PS (from sih.gov.in): 
 *     → Add PS number, correct category, highlight ROW in PURPLE
 * - If a team's PS is custom/not matching any AICTE official PS:
 *     → No PS number, keep/infer category, highlight ROW in BLUE
 *
 * AICTE official PS numbers (from sih.gov.in):
 *   SIH26104 – AI-Powered Real-Time Detection and Prevention of Voice Cloning Impersonation Attacks (Software, Blockchain & Cybersecurity)
 *   SIH26105 – AI-Powered Continuous Cyber Risk Quantification and Investment Optimization Platform (Software, Blockchain & Cybersecurity)
 *   SIH26106 – AI-Powered Email Threat Detection, GeoLocation and Forensic Intelligence Platform (Software, Blockchain & Cybersecurity)
 *   SIH26193 – Student Innovation – Agriculture, FoodTech & Rural Development (Software)
 *   SIH26194 – Student Innovation – Blockchain & Cybersecurity (Software)
 *   SIH26195 – Student Innovation – Clean & Green Technology (Software)
 *   SIH26196 – Student Innovation – Fitness & Sports (Software)
 *   SIH26197 – Student Innovation – Heritage & Culture (Software)
 *   SIH26198 – Student Innovation – MedTech / BioTech / HealthTech (Software)
 *   SIH26199 – Student Innovation – Miscellaneous (Software)
 *   SIH26200 – Student Innovation – Renewable / Sustainable Energy (Software)
 *   SIH26201 – Student Innovation – Robotics and Drones (Software)
 *   SIH26202 – Student Innovation – Smart Automation (Software)
 *   SIH26203 – Student Innovation – Smart Vehicles (Software)
 *   SIH26204 – Student Innovation – Travel & Tourism (Software)
 *   SIH26205 – Student Innovation – Transportation & Logistics (Software)
 *   SIH26206 – Student Innovation – Disaster Management (Software)
 *   SIH26207 – Student Innovation – Smart Education (Software)
 *   SIH26208 – Student Innovation – Toys & Games (Software)
 *   SIH26209 – Student Innovation – Space Technology (Software)
 *   SIH26210 – Student Innovation – Agriculture, FoodTech & Rural Development (Hardware)
 *   SIH26211 – Student Innovation – Blockchain & Cybersecurity (Hardware)
 *   SIH26212 – Student Innovation – Clean & Green Technology (Hardware)
 *   SIH26213 – Student Innovation – Fitness & Sports (Hardware)
 *   SIH26214 – Student Innovation – Heritage & Culture (Hardware)
 *   SIH26215 – Student Innovation – MedTech / BioTech / HealthTech (Hardware)
 *   SIH26216 – Student Innovation – Miscellaneous (Hardware)
 *   SIH26217 – Student Innovation – Renewable / Sustainable Energy (Hardware)
 *   SIH26218 – Student Innovation – Robotics and Drones (Hardware)
 *   SIH26219 – Student Innovation – Smart Automation (Hardware)
 *   SIH26220 – Student Innovation – Smart Vehicles (Hardware)
 *   SIH26221 – Student Innovation – Travel & Tourism (Hardware)
 *   SIH26222 – Student Innovation – Transportation & Logistics (Hardware)
 *   SIH26223 – Student Innovation – Disaster Management (Hardware)
 *   SIH26224 – Student Innovation – Smart Education (Hardware)
 *   SIH26225 – Student Innovation – Toys & Games (Hardware)
 *   SIH26226 – Student Innovation – Space Technology (Hardware)
 */

const XLSX = require('xlsx');
const path = require('path');

// ─────────────────────────────────────────────────────────────────
// Official AICTE Problem Statements (from sih.gov.in)
// ─────────────────────────────────────────────────────────────────
const AICTE_OFFICIAL_PS = {
  'SIH26104': {
    title: 'AI-Powered Real-Time Detection and Prevention of Voice Cloning Impersonation Attacks',
    category: 'Software',
    org: 'All India Council for Technical Education (AICTE)',
    dept: 'Cyber Security Cell'
  },
  'SIH26105': {
    title: 'AI-Powered Continuous Cyber Risk Quantification and Investment Optimization Platform',
    category: 'Software',
    org: 'All India Council for Technical Education (AICTE)',
    dept: 'Cyber Security Cell'
  },
  'SIH26106': {
    title: 'AI-Powered Email Threat Detection, GeoLocation and Forensic Intelligence Platform',
    category: 'Software',
    org: 'All India Council for Technical Education (AICTE)',
    dept: 'Cyber Security Cell'
  },
  // Student Innovation – Software
  'SIH26193': { title: 'Student Innovation – Agriculture, FoodTech & Rural Development', category: 'Software', org: 'AICTE', dept: 'AICTE, MIC-Student Innovation' },
  'SIH26194': { title: 'Student Innovation – Blockchain & Cybersecurity', category: 'Software', org: 'AICTE', dept: 'AICTE, MIC-Student Innovation' },
  'SIH26195': { title: 'Student Innovation – Clean & Green Technology', category: 'Software', org: 'AICTE', dept: 'AICTE, MIC-Student Innovation' },
  'SIH26196': { title: 'Student Innovation – Fitness & Sports', category: 'Software', org: 'AICTE', dept: 'AICTE, MIC-Student Innovation' },
  'SIH26197': { title: 'Student Innovation – Heritage & Culture', category: 'Software', org: 'AICTE', dept: 'AICTE, MIC-Student Innovation' },
  'SIH26198': { title: 'Student Innovation – MedTech / BioTech / HealthTech', category: 'Software', org: 'AICTE', dept: 'AICTE, MIC-Student Innovation' },
  'SIH26199': { title: 'Student Innovation – Miscellaneous', category: 'Software', org: 'AICTE', dept: 'AICTE, MIC-Student Innovation' },
  'SIH26200': { title: 'Student Innovation – Renewable / Sustainable Energy', category: 'Software', org: 'AICTE', dept: 'AICTE, MIC-Student Innovation' },
  'SIH26201': { title: 'Student Innovation – Robotics and Drones', category: 'Software', org: 'AICTE', dept: 'AICTE, MIC-Student Innovation' },
  'SIH26202': { title: 'Student Innovation – Smart Automation', category: 'Software', org: 'AICTE', dept: 'AICTE, MIC-Student Innovation' },
  'SIH26203': { title: 'Student Innovation – Smart Vehicles', category: 'Software', org: 'AICTE', dept: 'AICTE, MIC-Student Innovation' },
  'SIH26204': { title: 'Student Innovation – Travel & Tourism', category: 'Software', org: 'AICTE', dept: 'AICTE, MIC-Student Innovation' },
  'SIH26205': { title: 'Student Innovation – Transportation & Logistics', category: 'Software', org: 'AICTE', dept: 'AICTE, MIC-Student Innovation' },
  'SIH26206': { title: 'Student Innovation – Disaster Management', category: 'Software', org: 'AICTE', dept: 'AICTE, MIC-Student Innovation' },
  'SIH26207': { title: 'Student Innovation – Smart Education', category: 'Software', org: 'AICTE', dept: 'AICTE, MIC-Student Innovation' },
  'SIH26208': { title: 'Student Innovation – Toys & Games', category: 'Software', org: 'AICTE', dept: 'AICTE, MIC-Student Innovation' },
  'SIH26209': { title: 'Student Innovation – Space Technology', category: 'Software', org: 'AICTE', dept: 'AICTE, MIC-Student Innovation' },
  // Student Innovation – Hardware
  'SIH26210': { title: 'Student Innovation – Agriculture, FoodTech & Rural Development', category: 'Hardware', org: 'AICTE', dept: 'AICTE, MIC-Student Innovation' },
  'SIH26211': { title: 'Student Innovation – Blockchain & Cybersecurity', category: 'Hardware', org: 'AICTE', dept: 'AICTE, MIC-Student Innovation' },
  'SIH26212': { title: 'Student Innovation – Clean & Green Technology', category: 'Hardware', org: 'AICTE', dept: 'AICTE, MIC-Student Innovation' },
  'SIH26213': { title: 'Student Innovation – Fitness & Sports', category: 'Hardware', org: 'AICTE', dept: 'AICTE, MIC-Student Innovation' },
  'SIH26214': { title: 'Student Innovation – Heritage & Culture', category: 'Hardware', org: 'AICTE', dept: 'AICTE, MIC-Student Innovation' },
  'SIH26215': { title: 'Student Innovation – MedTech / BioTech / HealthTech', category: 'Hardware', org: 'AICTE', dept: 'AICTE, MIC-Student Innovation' },
  'SIH26216': { title: 'Student Innovation – Miscellaneous', category: 'Hardware', org: 'AICTE', dept: 'AICTE, MIC-Student Innovation' },
  'SIH26217': { title: 'Student Innovation – Renewable / Sustainable Energy', category: 'Hardware', org: 'AICTE', dept: 'AICTE, MIC-Student Innovation' },
  'SIH26218': { title: 'Student Innovation – Robotics and Drones', category: 'Hardware', org: 'AICTE', dept: 'AICTE, MIC-Student Innovation' },
  'SIH26219': { title: 'Student Innovation – Smart Automation', category: 'Hardware', org: 'AICTE', dept: 'AICTE, MIC-Student Innovation' },
  'SIH26220': { title: 'Student Innovation – Smart Vehicles', category: 'Hardware', org: 'AICTE', dept: 'AICTE, MIC-Student Innovation' },
  'SIH26221': { title: 'Student Innovation – Travel & Tourism', category: 'Hardware', org: 'AICTE', dept: 'AICTE, MIC-Student Innovation' },
  'SIH26222': { title: 'Student Innovation – Transportation & Logistics', category: 'Hardware', org: 'AICTE', dept: 'AICTE, MIC-Student Innovation' },
  'SIH26223': { title: 'Student Innovation – Disaster Management', category: 'Hardware', org: 'AICTE', dept: 'AICTE, MIC-Student Innovation' },
  'SIH26224': { title: 'Student Innovation – Smart Education', category: 'Hardware', org: 'AICTE', dept: 'AICTE, MIC-Student Innovation' },
  'SIH26225': { title: 'Student Innovation – Toys & Games', category: 'Hardware', org: 'AICTE', dept: 'AICTE, MIC-Student Innovation' },
  'SIH26226': { title: 'Student Innovation – Space Technology', category: 'Hardware', org: 'AICTE', dept: 'AICTE, MIC-Student Innovation' },
};

// Colors
const PURPLE = 'FF7B2FBE'; // Purple fill (ARGB)
const BLUE   = 'FF4472C4'; // Blue fill  (ARGB)

// ─────────────────────────────────────────────────────────────────
// Helper: match a team's PS text to an official AICTE PS
// Returns { psNumber, title, category } or null
// ─────────────────────────────────────────────────────────────────
function matchOfficialAICTEPs(psText) {
  if (!psText) return null;
  const clean = String(psText).trim();

  // 1. Direct PS number match (e.g. "SIH26105")
  const directMatch = clean.match(/SIH26(\d+)/i);
  if (directMatch) {
    const psNum = 'SIH26' + directMatch[1];
    if (AICTE_OFFICIAL_PS[psNum]) {
      return { psNumber: psNum, ...AICTE_OFFICIAL_PS[psNum] };
    }
    // PS number found but NOT in AICTE official list → not an AICTE PS
    return null;
  }

  // 2. Title substring match against official AICTE PS titles
  for (const [psNum, ps] of Object.entries(AICTE_OFFICIAL_PS)) {
    // Exact title match (case-insensitive)
    if (clean.toLowerCase().includes(ps.title.toLowerCase().substring(0, 30))) {
      return { psNumber: psNum, ...ps };
    }
    // Also check if the official title appears inside the PS text
    if (ps.title.toLowerCase().split(' ').slice(0, 5).every(word => 
        word.length > 3 && clean.toLowerCase().includes(word.toLowerCase()))) {
      return { psNumber: psNum, ...ps };
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────
// Per-team decisions based on actual data
// ─────────────────────────────────────────────────────────────────
// After manual analysis of what each team actually chose vs. official AICTE PS list:
//
// PURPLE (official AICTE PS match):
//   - ARC FORGE → SIH26105 (exact PS number, is AICTE official) ✓
//   - ECE-FINAL-018 → SIH26224 (PS number found, is AICTE official) ✓
//   - SIH-FINIAL#25 → SIH26222 (PS number found, is AICTE official) ✓
//
// BLUE (not an official AICTE PS):
//   - A Square → "Smart Sleep Posture Detection And Alert System" – custom/not AICTE PS
//   - ECE-FINAL-028 → "An Intelligent Multimodal Wearable..." – custom
//   - it003 → "A Low-Cost Embedded Acoustic..." – custom
//   - KORO → "Lack of Accessible, Personalized..." – custom
//   - MCTRFINAL#03 → "Intelligent Transformer Capacity for EV Charging..." – custom
//   - MECHFINAL#01 → "Access to emergency medical help..." – custom
//   - SIH#IT012 → "MediSphere: AI-Driven Emergency Response..." – custom
//   - SPECTRA → "Deep Learning-Based Real-Time Battery SoC..." – custom
//   - TECH TEMPLARS → "Pending" – custom/open innovation

const TEAM_DECISIONS = {
  // Teams with official AICTE PS → PURPLE
  'ARC FORGE': {
    match: true,
    psNumber: 'SIH26105',
    title: 'AI-Powered Continuous Cyber Risk Quantification and Investment Optimization Platform',
    category: 'Software',
    color: PURPLE
  },
  'ECE-FINAL-018': {
    match: true,
    psNumber: 'SIH26224',
    title: 'Student Innovation – Smart Education (Hardware)',
    category: 'Hardware',
    color: PURPLE
  },
  'SIH-FINIAL#25': {
    match: true,
    psNumber: 'SIH26222',
    title: 'Student Innovation – Transportation & Logistics (Hardware)',
    category: 'Hardware',
    color: PURPLE
  },
  // Teams with custom PS → BLUE
  'A Square': { match: false, category: 'Hardware', color: BLUE },
  'ECE-FINAL-028': { match: false, category: 'Hardware', color: BLUE },
  'it003': { match: false, category: 'Hardware', color: BLUE },
  'KORO': { match: false, category: 'Hardware', color: BLUE },
  'MCTRFINAL#03': { match: false, category: 'Hardware', color: BLUE },
  'MECHFINAL#01': { match: false, category: 'Software', color: BLUE },
  'SIH#IT012': { match: false, category: 'Software', color: BLUE },
  'SPECTRA': { match: false, category: 'Software', color: BLUE },
  'TECH TEMPLARS': { match: false, category: 'Open Innovation', color: BLUE },
};

// ─────────────────────────────────────────────────────────────────
// Helper: apply fill colour to every cell in a row
// ─────────────────────────────────────────────────────────────────
function colorRow(ws, rowIdx, numCols, argbColor) {
  for (let c = 0; c < numCols; c++) {
    const addr = XLSX.utils.encode_cell({ r: rowIdx, c });
    if (!ws[addr]) ws[addr] = { t: 'z', v: '' };
    ws[addr].s = {
      fill: {
        patternType: 'solid',
        fgColor: { argb: argbColor },
        bgColor: { indexed: 64 }
      }
    };
  }
}

// ─────────────────────────────────────────────────────────────────
// Process aicte_teams.xlsx
// ─────────────────────────────────────────────────────────────────
function processAicteTeams() {
  const filePath = path.join(__dirname, 'aicte_teams.xlsx');
  const wb = XLSX.readFile(filePath, { cellStyles: true });
  const wsName = wb.SheetNames[0];
  const ws = wb.Sheets[wsName];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
  const range = XLSX.utils.decode_range(ws['!ref']);
  const numCols = range.e.c + 1;

  let changes = [];

  data.forEach((row, rIdx) => {
    if (!row[0] || isNaN(parseInt(row[0]))) return; // skip non-team rows

    const teamName = String(row[1] || '').trim();
    const decision = TEAM_DECISIONS[teamName];

    if (!decision) {
      console.warn(`  [WARN] Team not found in decisions: "${teamName}"`);
      return;
    }

    // Update Category column (index 11)
    const catAddr = XLSX.utils.encode_cell({ r: rIdx, c: 11 });
    const oldCat = row[11] || '';
    if (oldCat !== decision.category) {
      ws[catAddr] = { t: 's', v: decision.category };
      changes.push(`  ${teamName}: Category ${oldCat} → ${decision.category}`);
    }

    // Update PS Number (index 3) to include PS number prefix for official matches
    if (decision.match) {
      const psAddr = XLSX.utils.encode_cell({ r: rIdx, c: 3 });
      const oldPs = row[3] || '';
      const newPs = `${decision.psNumber} – ${decision.title}`;
      ws[psAddr] = { t: 's', v: newPs };
      changes.push(`  ${teamName}: PS updated to "${newPs}"`);
    }

    // Apply row color to all member rows for this team
    // Find all rows belonging to this team (until next team or end)
    colorRow(ws, rIdx, numCols, decision.color);
    // Color member rows below this (rows without S.No)
    let nextRow = rIdx + 1;
    while (nextRow < data.length && (!data[nextRow][0] || isNaN(parseInt(data[nextRow][0])))) {
      // Only color rows that have some content (member rows)
      if (data[nextRow].some(cell => cell && String(cell).trim())) {
        colorRow(ws, nextRow, numCols, decision.color);
      }
      nextRow++;
    }
  });

  // Write file
  XLSX.writeFile(wb, filePath, { bookSST: false, type: 'binary', cellStyles: true });
  console.log(`\naicte_teams.xlsx updated. Changes:`);
  changes.forEach(c => console.log(c));
  return changes;
}

// ─────────────────────────────────────────────────────────────────
// Process final_teams_all.xlsx
// ─────────────────────────────────────────────────────────────────
function processFinalTeams() {
  const filePath = path.join(__dirname, 'final_teams_all.xlsx');
  const wb = XLSX.readFile(filePath, { cellStyles: true });
  const wsName = wb.SheetNames[0];
  const ws = wb.Sheets[wsName];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
  const range = XLSX.utils.decode_range(ws['!ref']);
  const numCols = range.e.c + 1;

  // In final_teams_all.xlsx:
  // Col indices: 0=S.No, 1=Team Name, 2=Team Members, 3=Register No,
  //              4=Year, 5=Section, 6=Department, 7=Ministry, 8=PS Number, 9=Phone, 10=Gender, 11=Category

  let changes = [];

  data.forEach((row, rIdx) => {
    if (!row[0] || isNaN(parseInt(row[0]))) return;
    if (String(row[7] || '').trim() !== 'AICTE') return; // Only AICTE rows

    const teamName = String(row[1] || '').trim();
    const decision = TEAM_DECISIONS[teamName];

    if (!decision) {
      console.warn(`  [WARN] AICTE team not found in decisions: "${teamName}"`);
      return;
    }

    // Update Category (col 11)
    const catAddr = XLSX.utils.encode_cell({ r: rIdx, c: 11 });
    const oldCat = row[11] || '';
    if (oldCat !== decision.category) {
      ws[catAddr] = { t: 's', v: decision.category };
      changes.push(`  ${teamName}: Category ${oldCat} → ${decision.category}`);
    }

    // Update PS Number (col 8) for official AICTE matches
    if (decision.match) {
      const psAddr = XLSX.utils.encode_cell({ r: rIdx, c: 8 });
      const currentPs = row[8] || '';
      // Prepend PS number if not already there
      if (!currentPs.includes(decision.psNumber)) {
        const newPs = `${decision.psNumber} – ${decision.title}\n${currentPs}`;
        ws[psAddr] = { t: 's', v: newPs };
        changes.push(`  ${teamName}: PS number ${decision.psNumber} prepended`);
      }
    }

    // Apply color to this row
    colorRow(ws, rIdx, numCols, decision.color);

    // Color member rows below (rows with same team, no S.No)
    let nextRow = rIdx + 1;
    while (nextRow < data.length && (!data[nextRow][0] || isNaN(parseInt(data[nextRow][0])))) {
      if (data[nextRow].some(cell => cell && String(cell).trim())) {
        colorRow(ws, nextRow, numCols, decision.color);
      }
      nextRow++;
    }
  });

  XLSX.writeFile(wb, filePath, { bookSST: false, type: 'binary', cellStyles: true });
  console.log(`\nfinal_teams_all.xlsx updated. Changes:`);
  changes.forEach(c => console.log(c));
  return changes;
}

// ─────────────────────────────────────────────────────────────────
// Run
// ─────────────────────────────────────────────────────────────────
console.log('=== Updating AICTE teams in Excel files ===\n');
console.log('Classification:');
console.log('  PURPLE → Teams with official AICTE PS (sih.gov.in)');
console.log('  BLUE   → Teams with custom PS not on AICTE official list\n');

try {
  processAicteTeams();
  processFinalTeams();
  console.log('\n✓ Done! Both files updated successfully.');
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
