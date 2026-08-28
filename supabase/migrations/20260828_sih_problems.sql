-- ============================================================
-- sih_problems — centralised SIH 2026 problem statement store
-- Upserted by the scraper every 5 hours from sih.gov.in.
-- All three portals (participant/mentor, SPOC, admin) read from
-- GET /api/problems/sih2026 served by the participant_mentor backend.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sih_problems (
  ps_number    TEXT        PRIMARY KEY,          -- e.g. "SIH26001"
  sno          INTEGER     NOT NULL DEFAULT 0,
  organization TEXT        NOT NULL DEFAULT '',
  title        TEXT        NOT NULL DEFAULT '',
  category     TEXT        NOT NULL DEFAULT '',  -- "Software" | "Hardware"
  theme        TEXT        NOT NULL DEFAULT '',
  deadline     TEXT        NOT NULL DEFAULT '20 Sep 2026',
  scraped_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast org-based lookups (ministry → PS filtering)
CREATE INDEX IF NOT EXISTS idx_sih_problems_organization
  ON public.sih_problems (organization);

-- Index for category filtering
CREATE INDEX IF NOT EXISTS idx_sih_problems_category
  ON public.sih_problems (category);

-- Scraper run log — one row per run
CREATE TABLE IF NOT EXISTS public.sih_problems_sync_log (
  id           SERIAL      PRIMARY KEY,
  scraped_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_found  INTEGER     NOT NULL DEFAULT 0,
  added        INTEGER     NOT NULL DEFAULT 0,
  updated      INTEGER     NOT NULL DEFAULT 0,
  unchanged    INTEGER     NOT NULL DEFAULT 0,
  error        TEXT,
  duration_ms  INTEGER
);

COMMENT ON TABLE public.sih_problems
  IS 'Centralised SIH 2026 problem statements, scraped from sih.gov.in every 5 hours.';
