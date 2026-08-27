-- ============================================================
-- Add selected_ps_number column to spoc_final_teams
-- Stores the PS number (e.g. "SIH26001") the team has chosen to work on.
-- Safe to run multiple times (IF NOT EXISTS).
-- ============================================================

ALTER TABLE public.spoc_final_teams
  ADD COLUMN IF NOT EXISTS selected_ps_number TEXT DEFAULT NULL;

COMMENT ON COLUMN public.spoc_final_teams.selected_ps_number
  IS 'The SIH 2026 PS number (e.g. SIH26042) that the team has chosen to work on.';
