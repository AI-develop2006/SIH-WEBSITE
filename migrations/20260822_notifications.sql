-- ============================================================
-- Notifications table — personal per-user notifications
-- Used to notify participants when they are added/removed
-- from a SPOC final six-member team.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,          -- 'spoc_team_added' | 'spoc_team_removed'
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  read        BOOLEAN NOT NULL DEFAULT FALSE,
  metadata    JSONB DEFAULT '{}',     -- { team_name, ministry, team_id }
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_profile_id
  ON public.notifications(profile_id);

CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON public.notifications(profile_id, read)
  WHERE read = FALSE;

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_notifications" ON public.notifications
  FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY "users_update_own_notifications" ON public.notifications
  FOR UPDATE USING (profile_id = auth.uid());

-- Service / backend can insert
CREATE POLICY "backend_insert_notifications" ON public.notifications
  FOR INSERT WITH CHECK (TRUE);

-- Service / backend can delete
CREATE POLICY "backend_delete_notifications" ON public.notifications
  FOR DELETE USING (TRUE);
