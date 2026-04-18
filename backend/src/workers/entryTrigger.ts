/**
 * AlphaAI Backend — Stage 3: Entry Trigger
 * Professional SMC 5M Confirmation — fires at candle close, never before.
 *
 * Confirmation hierarchy (highest to lowest weight):
 *  A. 5M BOS — close beyond recent 5M swing structure  (+15 pts)
 *  B. 5M FVG Fill — price fills a same-direction imbalance (+12 pts)
 *  C. Bullish/Bearish Engulfing candle                   (+10 pts)
 *  D. Pin Bar / Liquidity Sweep Wick (≥2× body, matching direction) (+10 pts)
 *
 * Hard Rules:
 *  - Price MUST have closed inside or at the edge of the entry zone.
 *  - Confirmation candle volume MUST exceed the 20-period average.
 *  - Final score must be ≥ 70.
 *  - NO catch-all zone_entry fallback — confirmation must be explicit.
 */
import type { ApproachingSignal } from './approachDetector';

const MIN_ACTIVATION_SCORE = 70;

export interface ActiveSignal extends ApproachingSignal {
  status:           'active';
  activatedAt:      number;
  confirmationType: '5M_BOS' | 'engulfing' | 'pin_bar' | 'fvg_fill';
  finalScore:       number;
}

export interface Candle5M {
  timestamp: number;
  open:      number;
  high:      number;
  close:     number;
  low:       number;
  volume:    number;
}

/**
 * Main entry point for the Entry Trigger.
 * Called on every 5M candle close for pairs with an open approaching signal.
 */
export async function runEntryTrigger(
  signal:        ApproachingSignal,
  recentCandles: Candle5M[]
): Promise<ActiveSignal | null> {
  if (recentCandles.length < 20) return null;

  const latest = recentCandles[recentCandles.length - 1];

  // ── 1. Entry Zone Check ────────────────────────────────────────────
  // Price must have closed inside the pre-mapped entry zone.
  const { low, high } = { low: signal.entry_low ?? signal.entry_zone_low, high: signal.entry_high ?? signal.entry_zone_high };
  const inZone = latest.close >= low && latest.close <= high;
  if (!inZone) return null;

  // ── 2. Volume Gate — Institutional Participation ───────────────────
  // Confirmation candle volume must exceed the 20-period average.
  const avgVolume = recentCandles.slice(-21, -1).reduce((s, c) => s + c.volume, 0) / 20;
  if (avgVolume <= 0 || latest.volume < avgVolume) {
    // Low volume = no institutional participation — silent reject
    return null;
  }

  // ── 3. SMC Micro-Structure Confirmation ───────────────────────────
  const confirmation = detect5MConfirmation(recentCandles, signal.direction, signal.entryZone);
  if (!confirmation) return null; // No valid SMC pattern — silent reject

  // ── 4. Final Scoring ───────────────────────────────────────────────
  const finalScore = Math.min(100, signal.confluenceScore + confirmation.bonus);
  if (finalScore < MIN_ACTIVATION_SCORE) return null;

  console.log(
    `🔥 [EntryTrigger] ${signal.pair} ACTIVATED` +
    ` — Pattern: ${confirmation.type}` +
    ` — Score: ${finalScore}` +
    ` — Direction: ${signal.direction}` +
    ` — Price: ${latest.close}`
  );

  return {
    ...signal,
    status:           'active',
    activatedAt:      Date.now(),
    confirmationType: confirmation.type,
    finalScore,
  };
}

// ── Confirmation Detection ─────────────────────────────────────────────

interface ConfirmationResult {
  type:  ActiveSignal['confirmationType'];
  bonus: number;
}

/**
 * Detects SMC confirmation patterns on the 5M chart.
 * Returns null if no valid pattern is found (hard reject).
 */
function detect5MConfirmation(
  candles:   Candle5M[],
  direction: 'LONG' | 'SHORT',
  zone:      { low: number; high: number }
): ConfirmationResult | null {
  const latest   = candles[candles.length - 1];
  const prev     = candles[candles.length - 2];
  const isBullishCandle = latest.close > latest.open;

  // ── A. 5M BOS (Highest Weight — +15) ──────────────────────────────
  // Latest 5M candle closed beyond the most recent confirmed 5M swing.
  const swings = detectRecent5MSwings(candles.slice(-10, -1));
  if (direction === 'LONG' && swings.high !== null && latest.close > swings.high) {
    return { type: '5M_BOS', bonus: 15 };
  }
  if (direction === 'SHORT' && swings.low !== null && latest.close < swings.low) {
    return { type: '5M_BOS', bonus: 15 };
  }

  // ── B. 5M FVG Fill (+12) ───────────────────────────────────────────
  // Price filled a same-direction imbalance created in the last 5 candles.
  const recentFVG = detect5MFVG(candles.slice(-6, -1));
  if (recentFVG && recentFVG.direction === direction) {
    const insideFVG = latest.close >= recentFVG.low && latest.close <= recentFVG.high;
    if (insideFVG) return { type: 'fvg_fill', bonus: 12 };
  }

  // ── C. Bullish / Bearish Engulfing (+10) ───────────────────────────
  const body     = Math.abs(latest.close - latest.open);
  const prevBody = Math.abs(prev.close - prev.open);

  if (direction === 'LONG' && isBullishCandle && body > prevBody && latest.close > prev.high) {
    return { type: 'engulfing', bonus: 10 };
  }
  if (direction === 'SHORT' && !isBullishCandle && body > prevBody && latest.close < prev.low) {
    return { type: 'engulfing', bonus: 10 };
  }

  // ── D. Pin Bar / Liquidity Sweep Wick (+10) ────────────────────────
  // A strong wick into the zone followed by a rejection body.
  const lowerWick = Math.min(latest.open, latest.close) - latest.low;
  const upperWick = latest.high - Math.max(latest.open, latest.close);

  if (direction === 'LONG') {
    // Long pin bar: lower wick at least 2× the body AND dominates upper wick
    if (body > 0 && lowerWick >= body * 2 && lowerWick > upperWick * 1.5) {
      return { type: 'pin_bar', bonus: 10 };
    }
  }
  if (direction === 'SHORT') {
    // Short pin bar: upper wick at least 2× the body AND dominates lower wick
    if (body > 0 && upperWick >= body * 2 && upperWick > lowerWick * 1.5) {
      return { type: 'pin_bar', bonus: 10 };
    }
  }

  // No valid SMC pattern — hard reject
  return null;
}

// ── 5M Structural Helpers ──────────────────────────────────────────────

function detectRecent5MSwings(
  candles: Candle5M[]
): { high: number | null; low: number | null } {
  let high: number | null = null;
  let low:  number | null = null;

  for (let i = 1; i < candles.length - 1; i++) {
    const c = candles[i];
    if (c.high > candles[i - 1].high && c.high > candles[i + 1].high) {
      if (high === null || c.high > high) high = c.high;
    }
    if (c.low < candles[i - 1].low && c.low < candles[i + 1].low) {
      if (low === null || c.low < low) low = c.low;
    }
  }
  return { high, low };
}

function detect5MFVG(
  candles: Candle5M[]
): { direction: 'LONG' | 'SHORT'; low: number; high: number } | null {
  for (let i = 1; i < candles.length - 1; i++) {
    const prev = candles[i - 1];
    const next = candles[i + 1];
    // Bullish FVG: gap up — high of i-1 < low of i+1
    if (prev.high < next.low && (next.low - prev.high) / prev.high > 0.001) {
      return { direction: 'LONG', low: prev.high, high: next.low };
    }
    // Bearish FVG: gap down — low of i-1 > high of i+1
    if (prev.low > next.high && (prev.low - next.high) / next.high > 0.001) {
      return { direction: 'SHORT', low: next.high, high: prev.low };
    }
  }
  return null;
}
