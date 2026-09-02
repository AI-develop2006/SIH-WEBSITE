-- ============================================================
-- Add is_shortlisted flag to spoc_final_teams
-- Marks teams shortlisted in the SIH Internal Hackathon Top 50
-- ============================================================

ALTER TABLE public.spoc_final_teams
  ADD COLUMN IF NOT EXISTS is_shortlisted BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_spoc_final_teams_shortlisted
  ON public.spoc_final_teams(is_shortlisted)
  WHERE is_shortlisted = TRUE;
