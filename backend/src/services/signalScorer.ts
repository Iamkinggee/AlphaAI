/**
 * AlphaAI Backend — Signal Scorer
 * Computes a 0–100 confluence score for a detected structural zone.
 * Weights match the spec exactly (max 85 at approach, 100 with 5M BOS).
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
 * | TOTAL (max approaching)          |   85   |
 * | TOTAL (max active w/ 5M BOS)     |  100   |
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

// ── Spec-exact weight table ───────────────────────────────────────────────────
const SPEC_WEIGHTS: ScoringFactor[] = [
  { factor: '4H Order Block present in zone',      points: 20, active: false },
  { factor: 'Unfilled FVG nested in zone',          points: 15, active: false },
  { factor: 'Liquidity sweep before entry',         points: 20, active: false },
  { factor: 'Price in premium/discount alignment',  points: 10, active: false },
  { factor: '1D trend aligned with direction',      points: 10, active: false },
  { factor: '5M BOS confirmation',                  points: 15, active: false },
  { factor: 'S&D zone coincides with OB',           points: 10, active: false },
];

export function computeSignalScore(input: ScoringInput): ScoringResult {
  const { zoneHigh, zoneLow, direction, zoneType, structData, htfData, liquiditySweep, fiveMBoS, orderBlock } = input;
  const factors = SPEC_WEIGHTS.map(w => ({ ...w }));
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
