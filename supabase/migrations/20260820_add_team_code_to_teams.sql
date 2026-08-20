-- Add team_code column to teams table
-- Stores the auto-generated department-based team identifier,
-- e.g. "AI&DS#003" or "CSE-SOLO#001", set by the backend on team creation.

ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS team_code text DEFAULT NULL;
