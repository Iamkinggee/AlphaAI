-- AlphaAI — Schema Migration / Repair
-- Run this if the signals table already existed without all columns.
-- Safe to run multiple times (uses IF NOT EXISTS / DO blocks).
-- =========================================================================

-- ── Add missing columns to existing signals table ────────────────────────
ALTER TABLE public.signals
  ADD COLUMN IF NOT EXISTS setup_type    TEXT,
  ADD COLUMN IF NOT EXISTS confluence    TEXT,
  ADD COLUMN IF NOT EXISTS distance_pct  NUMERIC(8,4)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_pnl   NUMERIC(10,4),
  ADD COLUMN IF NOT EXISTS activated_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_at     TIMESTAMPTZ, -- Terminal state timestamp (stopped, TP3, expired)
  ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS expires_at    TIMESTAMPTZ   NOT NULL DEFAULT (NOW() + INTERVAL '48 hours'),
  ADD COLUMN IF NOT EXISTS detected_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW();

-- Rename columns if they exist under old names (safe no-ops if already correct)
DO $$
BEGIN
  -- entry_zone_low
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='signals' AND column_name='entry_zone_low') THEN
    ALTER TABLE public.signals ADD COLUMN entry_zone_low NUMERIC(20,8) NOT NULL DEFAULT 0;
  END IF;
  -- entry_zone_high
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='signals' AND column_name='entry_zone_high') THEN
    ALTER TABLE public.signals ADD COLUMN entry_zone_high NUMERIC(20,8) NOT NULL DEFAULT 0;
  END IF;
  -- stop_loss
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='signals' AND column_name='stop_loss') THEN
    ALTER TABLE public.signals ADD COLUMN stop_loss NUMERIC(20,8) NOT NULL DEFAULT 0;
  END IF;
  -- take_profit_1
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='signals' AND column_name='take_profit_1') THEN
    ALTER TABLE public.signals ADD COLUMN take_profit_1 NUMERIC(20,8) NOT NULL DEFAULT 0;
  END IF;
  -- take_profit_2
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='signals' AND column_name='take_profit_2') THEN
    ALTER TABLE public.signals ADD COLUMN take_profit_2 NUMERIC(20,8) NOT NULL DEFAULT 0;
  END IF;
  -- take_profit_3
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='signals' AND column_name='take_profit_3') THEN
    ALTER TABLE public.signals ADD COLUMN take_profit_3 NUMERIC(20,8) NOT NULL DEFAULT 0;
  END IF;
END $$;

-- ── Ensure correct status CHECK constraint ────────────────────────────────
-- Drop old constraint if it exists with wrong values, recreate it
ALTER TABLE public.signals DROP CONSTRAINT IF EXISTS signals_status_check;
ALTER TABLE public.signals
  ADD CONSTRAINT signals_status_check
  CHECK (status IN ('approaching','active','TP1_hit','TP2_hit','TP3_hit','stopped','expired','pending'));

-- Ensure direction constraint
ALTER TABLE public.signals DROP CONSTRAINT IF EXISTS signals_direction_check;
ALTER TABLE public.signals
  ADD CONSTRAINT signals_direction_check
  CHECK (direction IN ('LONG','SHORT'));

-- ── Unique index for upsert (pair + direction + timeframe) ────────────────
DROP INDEX IF EXISTS signals_pair_direction_timeframe_idx;
CREATE UNIQUE INDEX signals_pair_direction_timeframe_idx
  ON public.signals (pair, direction, timeframe)
  WHERE status IN ('approaching', 'active');

-- ── Performance indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS signals_status_idx       ON public.signals (status);
CREATE INDEX IF NOT EXISTS signals_pair_idx         ON public.signals (pair);
CREATE INDEX IF NOT EXISTS signals_detected_at_idx  ON public.signals (detected_at DESC);
CREATE INDEX IF NOT EXISTS signals_score_idx        ON public.signals (score DESC);

-- ── Auto-update updated_at trigger ───────────────────────────────────────
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

-- ── RLS Policies ─────────────────────────────────────────────────────────
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "signals_read_all"      ON public.signals;
DROP POLICY IF EXISTS "signals_write_service" ON public.signals;

CREATE POLICY "signals_read_all"
  ON public.signals FOR SELECT
  USING (true);

CREATE POLICY "signals_write_service"
  ON public.signals FOR ALL
  USING (auth.role() = 'service_role');

-- ── Other tables (safe if already exist) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  signal_id   UUID REFERENCES public.signals(id) ON DELETE SET NULL,
  pair        TEXT NOT NULL,
  direction   TEXT NOT NULL CHECK (direction IN ('LONG','SHORT')),
  timeframe   TEXT NOT NULL,
  entry_price NUMERIC(20,8),
  exit_price  NUMERIC(20,8),
  pnl_pct     NUMERIC(10,4),
  pnl_raw     NUMERIC(20,8),
  risk_pct    NUMERIC(8,4) DEFAULT 1.0,
  outcome     TEXT CHECK (outcome IN ('win','loss','breakeven','open')),
  notes       TEXT,
  tags        TEXT[],
  screenshot_url TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "journal_own" ON public.journal_entries;
CREATE POLICY "journal_own" ON public.journal_entries FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.watchlist (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  pair     TEXT NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, pair)
);
ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "watchlist_own" ON public.watchlist;
CREATE POLICY "watchlist_own" ON public.watchlist FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url   TEXT,
  tier         TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free','pro','institutional')),
  risk_pct     NUMERIC(5,2) DEFAULT 1.0,
  min_score    INTEGER DEFAULT 70,
  theme        TEXT DEFAULT 'dark',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_own" ON public.profiles;
CREATE POLICY "profiles_own" ON public.profiles FOR ALL USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  ) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================================
-- Done. Signals will start appearing within 60 seconds.
-- =========================================================================

-- ── Backfill closed_at for existing terminal signals ─────────────────────
-- Signals that resolved before the closed_at column was added have NULL.
-- Setting closed_at = updated_at makes the 4-hour cooldown guard work
-- immediately without waiting for new resolutions to occur.
UPDATE public.signals
  SET closed_at = updated_at
  WHERE status IN ('stopped', 'expired', 'TP3_hit')
    AND closed_at IS NULL
    AND updated_at IS NOT NULL;
