-- 009_backfill_signal_quality_metadata.sql
-- Backfill legacy rows created before telemetry fields were introduced.

UPDATE public.signals
SET
  confidence_score = COALESCE(confidence_score, score),
  regime_tag = COALESCE(regime_tag, 'trend_following'),
  quality_band = COALESCE(
    quality_band,
    CASE
      WHEN COALESCE(score, 0) >= 82 THEN 'A'
      WHEN COALESCE(score, 0) >= 72 THEN 'B'
      ELSE 'C'
    END
  ),
  stale_after = COALESCE(
    stale_after,
    CASE
      WHEN status = 'approaching' THEN COALESCE(detected_at, NOW()) + INTERVAL '24 hours'
      WHEN status = 'active' THEN COALESCE(detected_at, NOW()) + INTERVAL '48 hours'
      ELSE NULL
    END
  ),
  updated_at = NOW()
WHERE
  confidence_score IS NULL
  OR regime_tag IS NULL
  OR quality_band IS NULL
  OR (status IN ('approaching', 'active') AND stale_after IS NULL);

