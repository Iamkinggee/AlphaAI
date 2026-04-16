-- 002_signals.sql
-- Core signal repository

CREATE TABLE IF NOT EXISTS public.signals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pair TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('LONG', 'SHORT')),
  timeframe TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approaching', 'active', 'TP1_hit', 'TP2_hit', 'TP3_hit', 'SL_hit', 'expired')),
  setup_type TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  
  -- Price levels
  entry_low FLOAT NOT NULL,
  entry_high FLOAT NOT NULL,
  stop_loss FLOAT NOT NULL,
  take_profit1 FLOAT NOT NULL,
  take_profit2 FLOAT NOT NULL,
  take_profit3 FLOAT,
  
  -- Extra metadata
  confluence_factors JSONB DEFAULT '[]',
  chart_snapshot_url TEXT,
  current_pnl FLOAT,
  current_price FLOAT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_signals_pair ON public.signals(pair);
CREATE INDEX IF NOT EXISTS idx_signals_status ON public.signals(status);

-- Enable RLS
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;

-- Everyone can view signals (or maybe restrict to certain tiers)
CREATE POLICY "Public can view signals" ON public.signals
  FOR SELECT USING (true);
