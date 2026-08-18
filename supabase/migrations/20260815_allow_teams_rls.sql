-- Migration to disable RLS restrictions on teams, team_members, and invites tables
ALTER TABLE public.teams DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites DISABLE ROW LEVEL SECURITY;
