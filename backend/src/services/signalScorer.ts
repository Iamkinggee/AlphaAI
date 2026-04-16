/**
 * AlphaAI Backend — Signal Scorer
 * Computes a 0–100 confluence score for any detected structural zone.
 * Called by both Stage 2 (approaching score) and Stage 3 (activation score).
 *
 * Scoring weights match the frontend constants/scoring.ts exactly.
 */
import type { StructuralData } from '../workers/structureScanner';

export interface ScoringResult {
  score: number;
  factors: ScoringFactor[];
  label: 'Weak' | 'Moderate' | 'Strong' | 'Institutional';
}

export interface ScoringFactor {
  factor: string;
  points: number;
  active: boolean;
}

// ── Confluence Weight Table ─────────────────────────────────────────
const WEIGHTS: ScoringFactor[] = [
  { factor: 'Order Block (OB)',            points: 20, active: false },
  { factor: 'Fair Value Gap (FVG)',         points: 15, active: false },
  { factor: 'Supply/Demand Zone',          points: 15, active: false },
  { factor: 'Liquidity Pool Nearby',       points: 10, active: false },
  { factor: 'Swing Structure Alignment',   points: 10, active: false },
  { factor: 'BOS/CHoCH Confirmation',      points: 10, active: false },
  { factor: 'Premium/Discount Level',      points: 10, active: false },
  { factor: 'Volume Profile',              points:  5, active: false },
  { factor: 'Higher Timeframe Alignment',  points:  5, active: false },
];

export function computeSignalScore(
  zoneHigh: number,
  zoneLow: number,
  direction: 'LONG' | 'SHORT',
  zoneType: 'OB' | 'FVG' | 'SD' | 'LIQUIDITY',
  structData: StructuralData,
): ScoringResult {
  const factors: ScoringFactor[] = WEIGHTS.map(w => ({ ...w }));
  const midZone = (zoneHigh + zoneLow) / 2;

  // ── OB check
  if (zoneType === 'OB') {
    activate(factors, 'Order Block (OB)');
  }

  // ── FVG overlap
  const hasFVG = structData.fairValueGaps?.some(
    f => !f.filled && f.high >= zoneLow && f.low <= zoneHigh
      && f.direction === (direction === 'LONG' ? 'BULLISH' : 'BEARISH')
  );
  if (hasFVG || zoneType === 'FVG') activate(factors, 'Fair Value Gap (FVG)');

  // ── S&D overlap
  const hasSD = direction === 'LONG'
    ? structData.demandZones?.some(z => z.high >= zoneLow && z.low <= zoneHigh)
    : structData.supplyZones?.some(z => z.high >= zoneLow && z.low <= zoneHigh);
  if (hasSD || zoneType === 'SD') activate(factors, 'Supply/Demand Zone');

  // ── Liquidity pool proximity (within 2%)
  const hasLiquidity = structData.liquidityPools?.some(
    p => !p.swept && Math.abs(p.price - midZone) / midZone < 0.02
  );
  if (hasLiquidity) activate(factors, 'Liquidity Pool Nearby');

  // ── Swing structure (need at least 4 swings)
  if ((structData.swingPoints?.length ?? 0) >= 4) {
    activate(factors, 'Swing Structure Alignment');
  }

  // ── Premium/Discount (zone near 50% of swing range)
  const swingHighs = structData.swingPoints?.filter(s => s.type === 'HH');
  const swingLows  = structData.swingPoints?.filter(s => s.type === 'LL');
  if (swingHighs?.length && swingLows?.length) {
    const rangeHigh = Math.max(...swingHighs.map(s => s.price));
    const rangeLow  = Math.min(...swingLows.map(s => s.price));
    const equilibrium = (rangeHigh + rangeLow) / 2;
    const inDiscount = midZone < equilibrium && direction === 'LONG';
    const inPremium  = midZone > equilibrium && direction === 'SHORT';
    if (inDiscount || inPremium) activate(factors, 'Premium/Discount Level');
  }

  const score = Math.min(100, factors.filter(f => f.active).reduce((sum, f) => sum + f.points, 0));

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
