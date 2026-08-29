-- ============================================================
-- Add custom_ps_title column to spoc_final_teams
-- Used by AICTE (Open Innovation) teams who write their own
-- problem statement instead of picking from the official list.
-- Safe to run multiple times (IF NOT EXISTS).
-- ============================================================

ALTER TABLE public.spoc_final_teams
  ADD COLUMN IF NOT EXISTS custom_ps_title TEXT DEFAULT NULL;

COMMENT ON COLUMN public.spoc_final_teams.custom_ps_title
  IS 'Custom problem statement title written by the team (used for AICTE / Open Innovation teams only).';
