/**
 * AlphaAI Backend — Signal Scorer
 * Computes a 0–100 confluence score for a detected structural zone.
 * Base weights match the spec (max 85 at approach, 100 with 5M BOS).
 * We also add small ICT-style quality bonuses (still capped at 100):
 *  - OTE alignment (optimal trade entry)
 *  - Killzone timing (London/NY sessions)
 *  - Displacement / impulse quality
 *
 * | Factor                           | Points |
 * |----------------------------------|--------|
 * | 4H Order Block in zone           |   20   |
 * | Unfilled FVG nested in zone      |   15   |
 * | Liquidity sweep before entry     |   20   |
 * | Price in premium/discount align  |   10   |
 * | 1D trend aligned with direction  |   10   |
 * | 5M BOS confirmation (Stage 3)    |   15   |
 * | S&D zone coincides with OB       |   10   |
 * | TOTAL (base max approaching)     |   85   |
 * | TOTAL (base max active w/ 5M BOS)|  100   |
 */
import type { StructuralData, OrderBlock } from '../workers/structureScanner';

export interface ScoringResult {
  score:   number;
  factors: ScoringFactor[];
  label:   'Weak' | 'Moderate' | 'Strong' | 'Institutional';
}

export interface ScoringFactor {
  factor: string;
  points: number;
  active: boolean;
}

export interface ScoringInput {
  zoneHigh:     number;
  zoneLow:      number;
  direction:    'LONG' | 'SHORT';
  zoneType:     'OB' | 'FVG' | 'SD' | 'LIQUIDITY';
  structData:   StructuralData;       // 4H data for primary scoring
  htfData?:     StructuralData | null; // 1D data for trend alignment
  /** Whether a liquidity sweep was detected before this signal */
  liquiditySweep?: boolean;
  /** Whether a 5M BOS has confirmed entry (Stage 3 only) */
  fiveMBoS?:    boolean;
  /** The matched OrderBlock (if zoneType === 'OB') for bonus scoring */
  orderBlock?:  OrderBlock | null;
}

// ── Weight table (spec + small ICT bonuses) ─────────────────────────────────
const WEIGHTS: ScoringFactor[] = [
  { factor: '4H Order Block present in zone',      points: 20, active: false },
  { factor: 'Unfilled FVG nested in zone',          points: 15, active: false },
  { factor: 'Liquidity sweep before entry',         points: 20, active: false },
  { factor: 'Price in premium/discount alignment',  points: 10, active: false },
  { factor: '1D trend aligned with direction',      points: 10, active: false },
  { factor: '5M BOS confirmation',                  points: 15, active: false },
  { factor: 'S&D zone coincides with OB',           points: 10, active: false },
  // ICT-style bonuses (small, additive)
  { factor: 'ICT OTE alignment (0.62–0.79)',         points: 5, active: false },
  { factor: 'ICT Killzone timing (London/NY)',       points: 3, active: false },
  { factor: 'Displacement / impulse quality',        points: 4, active: false },
];

export function computeSignalScore(input: ScoringInput): ScoringResult {
  const { zoneHigh, zoneLow, direction, zoneType, structData, htfData, liquiditySweep, fiveMBoS, orderBlock } = input;
  const factors = WEIGHTS.map(w => ({ ...w }));
  const midZone = (zoneHigh + zoneLow) / 2;

  // ── 1. 4H Order Block present in zone (20 pts) ───────────────────
  const has4HOB = zoneType === 'OB' ||
    structData.orderBlocks?.some(ob =>
      !ob.mitigated &&
      ob.direction === (direction === 'LONG' ? 'BULLISH' : 'BEARISH') &&
      ob.high >= zoneLow && ob.low <= zoneHigh
    );
  if (has4HOB) activate(factors, '4H Order Block present in zone');

  // ── 2. Unfilled FVG nested in zone (15 pts) ──────────────────────
  const hasNestedFVG = structData.fairValueGaps?.some(f =>
    !f.filled &&
    f.direction === (direction === 'LONG' ? 'BULLISH' : 'BEARISH') &&
    f.high >= zoneLow && f.low <= zoneHigh
  );
  if (hasNestedFVG || zoneType === 'FVG') activate(factors, 'Unfilled FVG nested in zone');

  // ── 3. Liquidity sweep before entry (20 pts) ─────────────────────
  // A swept liquidity pool within 1% of the zone mid in the trade direction
  const hasSweep = liquiditySweep ||
    structData.liquidityPools?.some(p => {
      const isRelevant = direction === 'LONG' ? p.type === 'SSL' : p.type === 'BSL';
      return isRelevant && p.swept && Math.abs(p.price - midZone) / midZone < 0.02;
    });
  if (hasSweep) activate(factors, 'Liquidity sweep before entry');

  // ── 4. Premium/Discount alignment (10 pts) ───────────────────────
  const { equilibrium, choch } = structData;
  const inDiscount = equilibrium > 0 && midZone < equilibrium && direction === 'LONG';
  const inPremium  = equilibrium > 0 && midZone > equilibrium && direction === 'SHORT';
  // CHOCH overrides the filter — reversal setups are valid from either side
  if (inDiscount || inPremium || choch) activate(factors, 'Price in premium/discount alignment');

  // ── 5. 1D trend aligned (10 pts) ────────────────────────────────
  if (htfData) {
    const htfAligned = htfData.trend === 'bullish' && direction === 'LONG'
      || htfData.trend === 'bearish' && direction === 'SHORT'
      || (htfData.choch && choch); // Both 1D and 4H CHOCH = high priority reversal
    if (htfAligned) activate(factors, '1D trend aligned with direction');
  }

  // ── 6. 5M BOS confirmation (15 pts — Stage 3 only) ──────────────
  if (fiveMBoS) activate(factors, '5M BOS confirmation');

  // ── 7. S&D zone coincides with OB (10 pts) ─────────────────────
  const hasSDandOB = has4HOB && (
    direction === 'LONG'
      ? structData.demandZones?.some(z => z.high >= zoneLow && z.low <= zoneHigh && z.freshness !== 'retired')
      : structData.supplyZones?.some(z => z.high >= zoneLow && z.low <= zoneHigh && z.freshness !== 'retired')
  );
  if (hasSDandOB) activate(factors, 'S&D zone coincides with OB');

  // ── Bonus: high-quality OB boosts score proportionally ──────────
  let bonusPoints = 0;
  if (orderBlock && !orderBlock.mitigated) {
    if (orderBlock.impulseStrength >= 3) bonusPoints += 2; // Strong impulse away
    if (orderBlock.fvgCount >= 2)        bonusPoints += 2; // Multiple FVGs created
  }

  // ── ICT bonus signals (additive, still capped at 100) ───────────
  const oteAligned = isOteAligned(structData.swingPoints, direction, midZone);
  if (oteAligned) activate(factors, 'ICT OTE alignment (0.62–0.79)');

  const inKillzone = isKillzoneUtc();
  if (inKillzone) activate(factors, 'ICT Killzone timing (London/NY)');

  const displacement = Boolean(orderBlock && !orderBlock.mitigated && orderBlock.impulseStrength >= 3 && orderBlock.fvgCount >= 1);
  if (displacement) activate(factors, 'Displacement / impulse quality');

  const rawScore  = factors.filter(f => f.active).reduce((s, f) => s + f.points, 0);
  const score     = Math.min(100, rawScore + bonusPoints);
  const label: ScoringResult['label'] =
    score >= 85 ? 'Institutional' :
    score >= 70 ? 'Strong' :
    score >= 55 ? 'Moderate' : 'Weak';

  return { score, factors, label };
}

function activate(factors: ScoringFactor[], name: string): void {
  const f = factors.find(x => x.factor === name);
  if (f) f.active = true;
}

function isKillzoneUtc(date: Date = new Date()): boolean {
  const h = date.getUTCHours();
  // London: 07:00–10:00 UTC, NY: 12:00–15:00 UTC (approx)
  return (h >= 7 && h < 10) || (h >= 12 && h < 15);
}

function isOteAligned(
  swingPoints: StructuralData['swingPoints'] | undefined,
  direction: 'LONG' | 'SHORT',
  price: number
): boolean {
  if (!swingPoints || swingPoints.length < 4) return false;

  // Use recent swings to approximate last meaningful range.
  const recent = swingPoints.slice(-10);
  const highs = recent.filter(s => s.type === 'HH' || s.type === 'LH').map(s => s.price);
  const lows  = recent.filter(s => s.type === 'HL' || s.type === 'LL').map(s => s.price);
  const swingHigh = highs.length ? Math.max(...highs) : null;
  const swingLow  = lows.length ? Math.min(...lows) : null;
  if (swingHigh === null || swingLow === null) return false;
  if (swingHigh <= swingLow) return false;

  // OTE zone based on fib retracement 0.62–0.79 of the last range.
  // For LONG: price should be in discounted retracement from high→low.
  if (direction === 'LONG') {
    const oteHigh = swingHigh - (swingHigh - swingLow) * 0.62;
    const oteLow  = swingHigh - (swingHigh - swingLow) * 0.79;
    return price >= oteLow && price <= oteHigh;
  }

  // For SHORT: premium retracement from low→high.
  const oteLow  = swingLow + (swingHigh - swingLow) * 0.62;
  const oteHigh = swingLow + (swingHigh - swingLow) * 0.79;
  return price >= oteLow && price <= oteHigh;
}
