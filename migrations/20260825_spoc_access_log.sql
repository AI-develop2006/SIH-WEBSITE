-- SPOC Access Log
-- Tracks every login attempt on the SPOC portal: who tried, when, from where, and whether it succeeded.

CREATE TABLE IF NOT EXISTS public.spoc_access_log (
  id          BIGSERIAL PRIMARY KEY,
  attempted_name TEXT,            -- name entered at login (may be empty / wrong)
  resolved_email TEXT,            -- internal email resolved from the name (null if name not found)
  success     BOOLEAN NOT NULL DEFAULT FALSE,
  failure_reason TEXT,            -- null on success, reason string on failure
  ip_address  TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast time-ordered queries
CREATE INDEX IF NOT EXISTS spoc_access_log_created_at_idx ON public.spoc_access_log (created_at DESC);

-- RLS: only service-role (backend) can insert/read; no public access
ALTER TABLE public.spoc_access_log ENABLE ROW LEVEL SECURITY;
