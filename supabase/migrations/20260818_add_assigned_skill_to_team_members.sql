-- Add assigned_skill column to team_members table
-- Stores the mentor-assigned skill/domain role for each member in a team
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS assigned_skill text DEFAULT NULL;
