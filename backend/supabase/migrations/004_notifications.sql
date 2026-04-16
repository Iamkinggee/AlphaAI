-- 004_notifications.sql
-- In-app notification log

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('approaching', 'active', 'tp_hit', 'stopped', 'expired', 'system')),
  priority TEXT NOT NULL DEFAULT 'standard' CHECK (priority IN ('critical', 'high', 'standard')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  pair TEXT,
  signal_id UUID REFERENCES public.signals(id) ON DELETE SET NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id, read);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own notifications" ON public.notifications
  FOR ALL USING (auth.uid() = user_id);
