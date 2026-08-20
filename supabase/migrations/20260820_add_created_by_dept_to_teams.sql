-- Add created_by_dept column to teams table
-- This stores the department of the mentor who created the team,
-- enabling department-based ownership checks on the frontend.

ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS created_by_dept text DEFAULT NULL;
