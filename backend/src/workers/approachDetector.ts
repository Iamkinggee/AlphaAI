/**
 * AlphaAI Backend — Stage 2: Approach Detector
 * Runs every 60 seconds via interval.
 * Checks if current price for any watched pair is within 0.5–1.5% of a
 * known structural zone (OB, FVG, S&D). If so, computes confluence score
 * and emits an "approaching" signal with full trade plan.
 */
import { structuralMap } from '../cache/redisClient';
import type { StructuralData } from './structureScanner';

export interface ApproachingSignal {
  pair: string;
  direction: 'LONG' | 'SHORT';
  timeframe: string;
  zoneType: 'OB' | 'FVG' | 'SD' | 'LIQUIDITY';
  zoneHigh: number;
  zoneLow: number;
  currentPrice: number;
  distancePercent: number;
  confluenceScore: number;
  entryZone: { low: number; high: number };
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  detectedAt: number;
}

const MIN_SCORE = 65;
const APPROACH_ZONE_PCT_MIN = 0.005; // 0.5%
const APPROACH_ZONE_PCT_MAX = 0.015; // 1.5%

/**
 * Main entry point for the Approach Detector.
 * @param pairs - Map of pair → current price
 */
export async function runApproachDetector(
  pairs: Record<string, number>
): Promise<ApproachingSignal[]> {
  const approaching: ApproachingSignal[] = [];

  for (const [pair, currentPrice] of Object.entries(pairs)) {
    const structData = await structuralMap.get(pair) as StructuralData | null;
    if (!structData) continue;

    // Check each OB
    for (const ob of structData.orderBlocks ?? []) {
      if (ob.broken) continue;
      const distance = getDistanceToZone(currentPrice, ob.high, ob.low);
      if (distance < APPROACH_ZONE_PCT_MIN || distance > APPROACH_ZONE_PCT_MAX) continue;

      const direction: 'LONG' | 'SHORT' = ob.direction === 'BULLISH' ? 'LONG' : 'SHORT';
      const score = computeConfluenceScore(pair, structData, ob.high, ob.low, direction);

      if (score >= MIN_SCORE) {
        approaching.push(buildSignal(pair, direction, structData.timeframe, 'OB', ob.high, ob.low, currentPrice, distance, score));
      }
    }

    // Check each FVG
    for (const fvg of structData.fairValueGaps ?? []) {
      if (fvg.filled) continue;
      const distance = getDistanceToZone(currentPrice, fvg.high, fvg.low);
      if (distance < APPROACH_ZONE_PCT_MIN || distance > APPROACH_ZONE_PCT_MAX) continue;

      const direction: 'LONG' | 'SHORT' = fvg.direction === 'BULLISH' ? 'LONG' : 'SHORT';
      const score = computeConfluenceScore(pair, structData, fvg.high, fvg.low, direction);

      if (score >= MIN_SCORE) {
        approaching.push(buildSignal(pair, direction, structData.timeframe, 'FVG', fvg.high, fvg.low, currentPrice, distance, score));
      }
    }
  }

  return approaching;
}

function getDistanceToZone(price: number, zoneHigh: number, zoneLow: number): number {
  // Distance to nearest edge of zone
  if (price > zoneHigh) return (price - zoneHigh) / price;
  if (price < zoneLow)  return (zoneLow - price) / price;
  return 0; // Inside zone
}

function computeConfluenceScore(
  _pair: string, data: StructuralData,
  zoneHigh: number, zoneLow: number,
  direction: 'LONG' | 'SHORT'
): number {
  let score = 40; // Base score

  // Bonus: FVG overlap
  const hasFVGOverlap = data.fairValueGaps?.some(
    f => !f.filled && f.high >= zoneLow && f.low <= zoneHigh && f.direction === (direction === 'LONG' ? 'BULLISH' : 'BEARISH')
  );
  if (hasFVGOverlap) score += 15;

  // Bonus: liquidity pool nearby
  const midZone = (zoneHigh + zoneLow) / 2;
  const hasLiquidity = data.liquidityPools?.some(
    p => Math.abs(p.price - midZone) / midZone < 0.02
  );
  if (hasLiquidity) score += 10;

  // Bonus: valid structure (at least 2 swing points)
  if ((data.swingPoints?.length ?? 0) >= 4) score += 10;

  // Bonus: supply/demand confirmation
  const hasSdZone = direction === 'LONG'
    ? data.demandZones?.some(z => z.high >= zoneLow && z.low <= zoneHigh)
    : data.supplyZones?.some(z => z.high >= zoneLow && z.low <= zoneHigh);
  if (hasSdZone) score += 15;

  return Math.min(100, score);
}

function buildSignal(
  pair: string, direction: 'LONG' | 'SHORT', timeframe: string,
  zoneType: 'OB' | 'FVG' | 'SD' | 'LIQUIDITY',
  zoneHigh: number, zoneLow: number,
  currentPrice: number, distance: number, score: number
): ApproachingSignal {
  const isLong = direction === 'LONG';
  const entryZone = { low: zoneLow, high: zoneHigh };
  const stopDistance = isLong ? (zoneLow - zoneLow * 0.003) : (zoneHigh * 1.003 - zoneHigh);
  const stopLoss = isLong ? zoneLow - Math.abs(stopDistance) : zoneHigh + Math.abs(stopDistance);
  const risk = Math.abs((zoneHigh + zoneLow) / 2 - stopLoss);
  const takeProfit1 = isLong ? zoneHigh + risk       : zoneLow - risk;
  const takeProfit2 = isLong ? zoneHigh + risk * 2   : zoneLow - risk * 2;
  const takeProfit3 = isLong ? zoneHigh + risk * 3   : zoneLow - risk * 3;

  return {
    pair, direction, timeframe, zoneType,
    zoneHigh, zoneLow, currentPrice,
    distancePercent: Math.round(distance * 10000) / 100,
    confluenceScore: score,
    entryZone, stopLoss, takeProfit1, takeProfit2, takeProfit3,
    detectedAt: Date.now(),
  };
}
