-- SPOC Edit Request System
-- When a SPOC wants to edit a frozen final team, they submit a request.
-- Admin accepts/rejects. On acceptance a short-lived one-time token is issued
-- to the requesting session only.

CREATE TABLE IF NOT EXISTS public.spoc_edit_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       UUID NOT NULL REFERENCES public.spoc_final_teams(id) ON DELETE CASCADE,
  team_name     TEXT NOT NULL,
  spoc_name     TEXT NOT NULL,
  spoc_dept     TEXT NOT NULL,
  reason        TEXT,
  status        TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected | used
  edit_token    TEXT,                              -- one-time token issued on approval
  token_expires TIMESTAMPTZ,                       -- token TTL (30 min from approval)
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS spoc_edit_requests_team_idx   ON public.spoc_edit_requests (team_id);
CREATE INDEX IF NOT EXISTS spoc_edit_requests_status_idx ON public.spoc_edit_requests (status);
CREATE INDEX IF NOT EXISTS spoc_edit_requests_token_idx  ON public.spoc_edit_requests (edit_token)
  WHERE edit_token IS NOT NULL;

-- Also add a `frozen` column to spoc_final_teams (all teams frozen by default after save)
ALTER TABLE public.spoc_final_teams
  ADD COLUMN IF NOT EXISTS frozen BOOLEAN NOT NULL DEFAULT TRUE;

-- RLS: backend service-role only
ALTER TABLE public.spoc_edit_requests ENABLE ROW LEVEL SECURITY;
