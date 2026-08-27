-- SPOC Audit Log
-- Tracks every mutating action performed by the SPOC after login:
--   final team creation, edits (member changes, renames, ministry swaps), and deletions.

CREATE TABLE IF NOT EXISTS public.spoc_audit_log (
  id            BIGSERIAL PRIMARY KEY,
  action        TEXT NOT NULL,           -- 'CREATE_FINAL_TEAM' | 'UPDATE_FINAL_TEAM' | 'DELETE_FINAL_TEAM'
  entity_type   TEXT NOT NULL DEFAULT 'final_team',
  entity_id     TEXT,                    -- final team id (as text for flexibility)
  entity_name   TEXT,                    -- team name at time of action
  details       JSONB,                   -- structured diff / summary (e.g. members added/removed, ministry change)
  ip_address    TEXT,                    -- IP of the SPOC session that performed the action
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast queries: by time and by entity
CREATE INDEX IF NOT EXISTS spoc_audit_log_created_at_idx  ON public.spoc_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS spoc_audit_log_entity_id_idx   ON public.spoc_audit_log (entity_id);

-- RLS: backend-only access (service role), no public reads
ALTER TABLE public.spoc_audit_log ENABLE ROW LEVEL SECURITY;
