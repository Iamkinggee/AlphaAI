-- 003_journal.sql
-- Personal trade tracking

CREATE TABLE IF NOT EXISTS public.journal (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  signal_id UUID REFERENCES public.signals(id) ON DELETE SET NULL,
  
  pair TEXT NOT NULL,
  direction TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  entry_date TIMESTAMPTZ DEFAULT NOW(),
  exit_date TIMESTAMPTZ,
  
  entry_price FLOAT NOT NULL,
  exit_price FLOAT,
  result TEXT CHECK (result IN ('win', 'loss', 'break_even', 'pending')),
  pnl_percent FLOAT,
  pnl_realized FLOAT,
  rr_achieved FLOAT,
  
  setup_notes TEXT,
  emotions_tag TEXT[] DEFAULT '{}',
  screenshot_url TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_journal_user ON public.journal(user_id);

-- Enable RLS
ALTER TABLE public.journal ENABLE ROW LEVEL SECURITY;

-- Only owners can see their journal
CREATE POLICY "Users can manage their own journal" ON public.journal
  FOR ALL USING (auth.uid() = user_id);
