-- 010_align_signals_schema_with_runtime.sql
-- Aligns `public.signals` with the runtime expectations (status values + commonly used columns/indexes).
-- Safe to run multiple times.

-- ── Columns the runtime reads/writes ────────────────────────────────────
ALTER TABLE public.signals
  ADD COLUMN IF NOT EXISTS setup_type    TEXT,
  ADD COLUMN IF NOT EXISTS confluence    TEXT,
  ADD COLUMN IF NOT EXISTS distance_pct  NUMERIC(8,4)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_pnl   NUMERIC(10,4),
  ADD COLUMN IF NOT EXISTS current_price NUMERIC(20,8),
  ADD COLUMN IF NOT EXISTS activated_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS expires_at    TIMESTAMPTZ   NOT NULL DEFAULT (NOW() + INTERVAL '48 hours'),
  ADD COLUMN IF NOT EXISTS detected_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW();

-- Ensure entry zone columns exist even if older schema used entry_low/high.
ALTER TABLE public.signals
  ADD COLUMN IF NOT EXISTS entry_zone_low  NUMERIC(20,8),
  ADD COLUMN IF NOT EXISTS entry_zone_high NUMERIC(20,8);

-- Backfill entry zone columns from legacy columns if needed.
UPDATE public.signals
SET
  entry_zone_low  = COALESCE(entry_zone_low,  entry_low),
  entry_zone_high = COALESCE(entry_zone_high, entry_high)
WHERE
  (entry_zone_low IS NULL OR entry_zone_high IS NULL)
  AND (entry_low IS NOT NULL OR entry_high IS NOT NULL);

-- ── Status normalization ────────────────────────────────────────────────
-- Legacy migration allowed SL_hit; runtime uses "stopped".
UPDATE public.signals
SET
  status = 'stopped',
  updated_at = NOW(),
  closed_at = COALESCE(closed_at, NOW())
WHERE status = 'SL_hit';

-- Drop and recreate status check constraint to match runtime.
ALTER TABLE public.signals DROP CONSTRAINT IF EXISTS signals_status_check;
ALTER TABLE public.signals
  ADD CONSTRAINT signals_status_check
  CHECK (status IN ('pending','approaching','active','TP1_hit','TP2_hit','TP3_hit','stopped','expired'));

-- Ensure direction constraint is correct.
ALTER TABLE public.signals DROP CONSTRAINT IF EXISTS signals_direction_check;
ALTER TABLE public.signals
  ADD CONSTRAINT signals_direction_check
  CHECK (direction IN ('LONG','SHORT'));

-- ── Indexes used by hot paths ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS signals_status_idx      ON public.signals (status);
CREATE INDEX IF NOT EXISTS signals_pair_idx        ON public.signals (pair);
CREATE INDEX IF NOT EXISTS signals_timeframe_idx   ON public.signals (timeframe);
CREATE INDEX IF NOT EXISTS signals_detected_at_idx ON public.signals (detected_at DESC);
CREATE INDEX IF NOT EXISTS signals_updated_at_idx  ON public.signals (updated_at DESC);

-- Unique partial index for upserts: one approaching/active per (pair, direction, timeframe).
DROP INDEX IF EXISTS signals_pair_direction_timeframe_idx;
CREATE UNIQUE INDEX signals_pair_direction_timeframe_idx
  ON public.signals (pair, direction, timeframe)
  WHERE status IN ('approaching', 'active');

-- ── updated_at trigger ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS signals_updated_at ON public.signals;
CREATE TRIGGER signals_updated_at
  BEFORE UPDATE ON public.signals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Backfill closed_at for terminal signals ─────────────────────────────
UPDATE public.signals
  SET closed_at = COALESCE(closed_at, updated_at, NOW())
  WHERE status IN ('stopped', 'expired', 'TP3_hit')
    AND closed_at IS NULL;

