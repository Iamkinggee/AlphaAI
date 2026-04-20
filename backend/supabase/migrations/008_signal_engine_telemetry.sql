-- 008_signal_engine_telemetry.sql
-- High-impact telemetry and signal quality metadata for performance tuning.

ALTER TABLE public.signals
  ADD COLUMN IF NOT EXISTS confidence_score INTEGER,
  ADD COLUMN IF NOT EXISTS regime_tag TEXT,
  ADD COLUMN IF NOT EXISTS quality_band TEXT,
  ADD COLUMN IF NOT EXISTS stale_after TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS activation_latency_sec INTEGER;

CREATE TABLE IF NOT EXISTS public.signal_outcomes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  signal_id UUID NOT NULL REFERENCES public.signals(id) ON DELETE CASCADE,
  pair TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('LONG', 'SHORT')),
  regime_tag TEXT,
  quality_band TEXT,
  outcome_status TEXT NOT NULL CHECK (outcome_status IN ('TP1_hit', 'TP2_hit', 'TP3_hit', 'stopped', 'expired')),
  entry_price DOUBLE PRECISION NOT NULL,
  exit_price DOUBLE PRECISION NOT NULL,
  r_multiple DOUBLE PRECISION NOT NULL,
  holding_minutes INTEGER,
  detected_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(signal_id, outcome_status)
);

CREATE INDEX IF NOT EXISTS idx_signal_outcomes_pair ON public.signal_outcomes(pair);
CREATE INDEX IF NOT EXISTS idx_signal_outcomes_status ON public.signal_outcomes(outcome_status);
CREATE INDEX IF NOT EXISTS idx_signal_outcomes_regime ON public.signal_outcomes(regime_tag);

ALTER TABLE public.signal_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view signal outcomes" ON public.signal_outcomes
  FOR SELECT USING (true);

