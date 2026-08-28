/**
 * SIH Problem Statement Scraper — Node.js wrapper
 * ================================================
 * Invokes the Python Playwright scraper (scripts/scrape-sih-ps.py),
 * reads the result, upserts all rows into sih_problems table,
 * and writes a sync log entry.
 *
 * Also exposes an in-memory cache so the API endpoint can respond
 * instantly without hitting the DB every request.
 *
 * Scheduler: called from server.js on startup + every 5 hours.
 */

import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Resolve paths
const REPO_ROOT    = resolve(__dirname, "../../..");
const SCRIPT_PATH  = join(REPO_ROOT, "scripts", "scrape-sih-ps.py");
const FALLBACK_JS  = join(__dirname, "../frontend/src/lib/sih2026Problems.js");

// ── In-memory cache ───────────────────────────────────────────────────────────
let _cache       = null;   // array of PS objects
let _cacheTime   = 0;      // epoch ms of last DB fetch
let _scrapeRunning = false;

const CACHE_TTL_MS = 5 * 60 * 60 * 1000; // 5 hours

// ── Fallback: parse existing static JS file ───────────────────────────────────
function loadFallbackJs() {
  try {
    const src = readFileSync(FALLBACK_JS, "utf8");
    const match = src.match(/export const SIH2026_PROBLEMS\s*=\s*\[(.+?)\];/s);
    if (!match) return [];
    const records = [];
    for (const obj of match[1].matchAll(/\{([^}]+)\}/g)) {
      const rec = {};
      for (const kv of obj[1].matchAll(/(\w+)\s*:\s*(?:"((?:[^"\\]|\\.)*)"|(\d+))/g)) {
        rec[kv[1]] = kv[2] !== undefined ? kv[2] : parseInt(kv[3], 10);
      }
      if (rec.psNumber) records.push(rec);
    }
    console.log(`[SIH scraper] Fallback: loaded ${records.length} entries from static JS`);
    return records;
  } catch {
    return [];
  }
}

// ── Run Python scraper, return list of PS objects ─────────────────────────────
function runPythonScraper(timeoutMs = 10 * 60 * 1000) {
  return new Promise((resolve, reject) => {
    if (!existsSync(SCRIPT_PATH)) {
      return reject(new Error(`Scraper not found at ${SCRIPT_PATH}`));
    }
    // Run the Python scraper with --json-stdout flag to get machine-readable output
    execFile(
      "python3",
      [SCRIPT_PATH, "--json-stdout"],
      { timeout: timeoutMs, maxBuffer: 20 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          return reject(new Error(`Python scraper failed: ${err.message}\n${stderr}`));
        }
        try {
          // stdout contains a JSON object: { problems: [...], stats: {...} }
          const output = JSON.parse(stdout.trim());
          resolve(output);
        } catch (parseErr) {
          reject(new Error(`Failed to parse scraper output: ${parseErr.message}\nstdout: ${stdout.slice(0, 500)}`));
        }
      }
    );
  });
}

// ── Upsert PS list into sih_problems table ────────────────────────────────────
async function upsertToDb(dbQuery, problems) {
  const stats = { added: 0, updated: 0, unchanged: 0 };
  const now   = new Date().toISOString();

  for (const p of problems) {
    const result = await dbQuery(
      `INSERT INTO public.sih_problems
         (ps_number, sno, organization, title, category, theme, deadline, scraped_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
       ON CONFLICT (ps_number) DO UPDATE SET
         sno          = EXCLUDED.sno,
         organization = EXCLUDED.organization,
         title        = EXCLUDED.title,
         category     = EXCLUDED.category,
         theme        = EXCLUDED.theme,
         deadline     = EXCLUDED.deadline,
         scraped_at   = EXCLUDED.scraped_at,
         updated_at   = CASE
           WHEN sih_problems.title        != EXCLUDED.title
             OR sih_problems.category     != EXCLUDED.category
             OR sih_problems.theme        != EXCLUDED.theme
             OR sih_problems.organization != EXCLUDED.organization
           THEN EXCLUDED.updated_at
           ELSE sih_problems.updated_at
         END
       RETURNING (xmax = 0) AS is_insert,
                 (updated_at = $8) AS was_updated;`,
      [p.psNumber, p.sno, p.organization, p.title, p.category, p.theme, p.deadline, now]
    );
    const row = result.rows[0];
    if (row?.is_insert) stats.added++;
    else if (row?.was_updated) stats.updated++;
    else stats.unchanged++;
  }
  return stats;
}

// ── Log a sync run ────────────────────────────────────────────────────────────
async function logSync(dbQuery, { total, stats, error, durationMs }) {
  try {
    await dbQuery(
      `INSERT INTO public.sih_problems_sync_log
         (total_found, added, updated, unchanged, error, duration_ms)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [total, stats.added, stats.updated, stats.unchanged, error ?? null, durationMs]
    );
  } catch (e) {
    console.warn("[SIH scraper] Could not write sync log:", e.message);
  }
}

// ── Fetch all PS from DB into cache ──────────────────────────────────────────
export async function loadFromDb(dbQuery) {
  const { rows } = await dbQuery(
    `SELECT ps_number AS "psNumber", sno, organization, title, category, theme, deadline
     FROM public.sih_problems
     ORDER BY sno ASC`
  );
  _cache     = rows;
  _cacheTime = Date.now();
  return rows;
}

// ── Get cached PS list (DB-backed, static JS fallback) ───────────────────────
export async function getProblems(dbQuery) {
  // Return cache if fresh
  if (_cache && Date.now() - _cacheTime < CACHE_TTL_MS) return _cache;

  // Try DB
  try {
    return await loadFromDb(dbQuery);
  } catch {
    // DB unavailable — use static fallback
    if (!_cache) _cache = loadFallbackJs();
    return _cache;
  }
}

// ── Main scrape-and-sync function ─────────────────────────────────────────────
export async function scrapeAndSync(dbQuery) {
  if (_scrapeRunning) {
    console.log("[SIH scraper] Already running, skipping duplicate invocation");
    return { skipped: true };
  }
  _scrapeRunning = true;
  const start = Date.now();

  console.log("[SIH scraper] Starting scrape …");

  let problems = [];
  let stats    = { added: 0, updated: 0, unchanged: 0 };
  let error    = null;

  try {
    // 1. Run Python scraper
    const output = await runPythonScraper();
    problems = output.problems ?? [];
    console.log(`[SIH scraper] Python scraper returned ${problems.length} problems`);

    // 2. Upsert to DB
    stats = await upsertToDb(dbQuery, problems);
    console.log(`[SIH scraper] DB upsert — added: ${stats.added}, updated: ${stats.updated}, unchanged: ${stats.unchanged}`);

    // 3. Refresh in-memory cache
    await loadFromDb(dbQuery);
    console.log(`[SIH scraper] Cache refreshed — ${_cache?.length ?? 0} entries`);

  } catch (err) {
    error = err.message;
    console.error("[SIH scraper] Error during scrape:", err.message);

    // Try to populate cache from DB even if scraper failed
    try {
      await loadFromDb(dbQuery);
    } catch {
      if (!_cache) _cache = loadFallbackJs();
    }
  } finally {
    _scrapeRunning = false;
    const durationMs = Date.now() - start;

    // Log to DB (fire-and-forget)
    logSync(dbQuery, { total: problems.length, stats, error, durationMs }).catch(() => {});

    console.log(`[SIH scraper] Done in ${(durationMs / 1000).toFixed(1)}s`);
  }

  return { problems: problems.length, stats, error };
}

// ── Scheduler (called from server.js once on boot) ───────────────────────────
const INTERVAL_MS = 5 * 60 * 60 * 1000; // 5 hours

export function startScrapeScheduler(dbQuery) {
  // Initial load from DB (don't wait for scrape to serve requests)
  loadFromDb(dbQuery)
    .then((rows) => console.log(`[SIH scraper] Loaded ${rows.length} problems from DB on startup`))
    .catch(() => {
      console.warn("[SIH scraper] DB unavailable on startup, using static fallback");
      _cache = loadFallbackJs();
    });

  // First scrape: run 10 seconds after startup (let server fully boot first)
  setTimeout(() => scrapeAndSync(dbQuery), 10_000);

  // Recurring scrape every 5 hours
  setInterval(() => scrapeAndSync(dbQuery), INTERVAL_MS);

  console.log(`[SIH scraper] Scheduler started — scraping every ${INTERVAL_MS / 3600000}h`);
}
