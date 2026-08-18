-- Add ministry column to teams table
-- Stores the ministry/organisation assigned to a team by the mentor
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS ministry text DEFAULT NULL;
