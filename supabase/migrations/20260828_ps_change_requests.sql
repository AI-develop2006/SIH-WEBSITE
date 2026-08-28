-- ============================================================
-- ps_change_requests — teams request a PS change after locking
-- The SPOC reviews the reason, views old vs new PS, and approves/rejects.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ps_change_requests (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id         UUID        NOT NULL REFERENCES public.spoc_final_teams(id) ON DELETE CASCADE,
  team_name       TEXT        NOT NULL DEFAULT '',
  requested_by    UUID        NOT NULL,              -- profile id of the member who submitted
  current_ps      TEXT,                              -- current locked PS number (NULL for custom)
  current_custom  TEXT,                              -- current custom title (for AICTE teams)
  new_ps          TEXT,                              -- requested new PS number (NULL for AICTE)
  new_custom      TEXT,                              -- requested new custom title (for AICTE)
  reason          TEXT        NOT NULL DEFAULT '',
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','approved','rejected')),
  reviewed_by     UUID,                              -- SPOC profile id (nullable until reviewed)
  review_note     TEXT,                              -- optional note from SPOC
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ps_change_requests_team_id
  ON public.ps_change_requests (team_id);

CREATE INDEX IF NOT EXISTS idx_ps_change_requests_status
  ON public.ps_change_requests (status);

COMMENT ON TABLE public.ps_change_requests
  IS 'Requests from teams to change their locked problem statement. SPOC approves or rejects.';
