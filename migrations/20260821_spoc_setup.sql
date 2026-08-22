-- ============================================================
-- SPOC Portal — Database Setup
-- Run this in Supabase SQL Editor or via psql
-- ============================================================

-- 1. Add 'spoc' to the role check (if you have a constraint)
--    If profiles.role is a plain TEXT column, skip this.
--    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
--    ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
--      CHECK (role IN ('student', 'mentor', 'admin', 'spoc'));

-- 2. SPOC Final Teams table
CREATE TABLE IF NOT EXISTS public.spoc_final_teams (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  ministry    TEXT,
  member_ids  UUID[] NOT NULL DEFAULT '{}',
  created_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for ministry lookups
CREATE INDEX IF NOT EXISTS idx_spoc_final_teams_ministry ON public.spoc_final_teams(ministry);

-- 3. RLS — SPOC users can read/write their own teams
ALTER TABLE public.spoc_final_teams ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated reads (mentors/admins can view)
CREATE POLICY "spoc_read_all" ON public.spoc_final_teams
  FOR SELECT USING (auth.role() = 'authenticated');

-- Allow SPOC role to insert/update/delete
CREATE POLICY "spoc_write" ON public.spoc_final_teams
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('spoc', 'admin')
    )
  );

-- 4. Create a SPOC user (run separately after creating auth user)
-- UPDATE public.profiles SET role = 'spoc' WHERE email = 'spoc@smvec.ac.in';

-- 5. Updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_spoc_final_teams_updated_at ON public.spoc_final_teams;
CREATE TRIGGER trg_spoc_final_teams_updated_at
  BEFORE UPDATE ON public.spoc_final_teams
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
