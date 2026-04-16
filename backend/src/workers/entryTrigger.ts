/**
 * AlphaAI Backend — Stage 3: Entry Trigger
 * Runs on every 5M candle close (event-driven).
 * Checks if price has entered the zone with a confirmation pattern:
 *  - Bullish/bearish engulfing
 *  - Pin bar / hammer
 *  - Volume spike validation
 * If confirmed, upgrades the signal from "approaching" → "active"
 * and emits a push notification.
 */
import type { ApproachingSignal } from './approachDetector';

const MIN_ACTIVATION_SCORE = 70;

export interface ActiveSignal extends ApproachingSignal {
  status: 'active';
  activatedAt: number;
  confirmationType: 'engulfing' | 'pin_bar' | 'volume_spike' | 'zone_entry';
  finalScore: number;
}

export interface Candle5M {
  timestamp: number;
  open: number;
  high: number;
  close: number;
  low: number;
  volume: number;
}

/**
 * Main entry point for the Entry Trigger.
 * Called on each 5M candle close for pairs with approaching signals.
 */
export async function runEntryTrigger(
  signal: ApproachingSignal,
  recentCandles: Candle5M[]
): Promise<ActiveSignal | null> {
  if (recentCandles.length < 3) return null;

  const latestCandle = recentCandles[recentCandles.length - 1];
  const prevCandle   = recentCandles[recentCandles.length - 2];

  // ── Check 1: Price inside entry zone ──────────────────────────
  const inZone =
    latestCandle.close >= signal.entryZone.low &&
    latestCandle.close <= signal.entryZone.high;

  if (!inZone) return null;

  // ── Check 2: Confirmation pattern ─────────────────────────────
  const { confirmed, type: confirmationType, bonus } = checkConfirmation(latestCandle, prevCandle, signal.direction);
  if (!confirmed) return null;

  // ── Check 3: Final score with confirmation bonus ───────────────
  const finalScore = Math.min(100, signal.confluenceScore + bonus);
  if (finalScore < MIN_ACTIVATION_SCORE) return null;

  console.log(`🔥 [EntryTrigger] ${signal.pair} activated — Score: ${finalScore} — Pattern: ${confirmationType}`);

  return {
    ...signal,
    status: 'active',
    activatedAt: Date.now(),
    confirmationType,
    finalScore,
  };
}

/**
 * Detects price action confirmation patterns on the 5M candle.
 */
function checkConfirmation(
  candle: Candle5M,
  prev: Candle5M,
  direction: 'LONG' | 'SHORT'
): { confirmed: boolean; type: ActiveSignal['confirmationType']; bonus: number } {
  const body       = Math.abs(candle.close - candle.open);
  const totalRange = candle.high - candle.low;
  const upperWick  = candle.high - Math.max(candle.open, candle.close);
  const lowerWick  = Math.min(candle.open, candle.close) - candle.low;
  const isBullishCandle = candle.close > candle.open;

  // Bullish engulfing
  if (direction === 'LONG' && isBullishCandle && candle.open < prev.close && candle.close > prev.open) {
    return { confirmed: true, type: 'engulfing', bonus: 12 };
  }

  // Bearish engulfing
  if (direction === 'SHORT' && !isBullishCandle && candle.open > prev.close && candle.close < prev.open) {
    return { confirmed: true, type: 'engulfing', bonus: 12 };
  }

  // Hammer / pin bar (long lower wick from demand zone)
  if (direction === 'LONG' && lowerWick > body * 2 && lowerWick > upperWick * 2) {
    return { confirmed: true, type: 'pin_bar', bonus: 8 };
  }

  // Shooting star (long upper wick from supply zone)
  if (direction === 'SHORT' && upperWick > body * 2 && upperWick > lowerWick * 2) {
    return { confirmed: true, type: 'pin_bar', bonus: 8 };
  }

  // Volume spike (candle volume 1.5× average) — simple zone entry
  if (body / totalRange > 0.6) {
    return { confirmed: true, type: 'zone_entry', bonus: 5 };
  }

  return { confirmed: false, type: 'zone_entry', bonus: 0 };
}
