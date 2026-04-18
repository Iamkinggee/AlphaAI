/**
 * AlphaAI Backend — Trade Planner
 * Computes Entry/SL/TP1/TP2/TP3 levels from structural context.
 * 
 * Rules:
 * - SL: 0.3% beyond the zone's far edge.
 * - TP1: Nearest unmitigated FVG or unswept liquidity level (~1:1.5 - 1:2 RR).
 * - TP2: Next structural level (opposite OB/SD zone or swing point) (~1:3 RR).
 * - TP3: Macro HTF target (HTF premium/discount zone) (~1:5+ RR).
 */
import type { StructuralData } from '../workers/structureScanner';

export interface TradePlan {
  pair:                string;
  direction:           'LONG' | 'SHORT';
  entryZone:           { low: number; high: number; lowFormatted: string; highFormatted: string };
  stopLoss:            number;
  stopLossFormatted:   string;
  stopLossDistancePct: number;
  takeProfit1:         { price: number; priceFormatted: string; rr: string };
  takeProfit2:         { price: number; priceFormatted: string; rr: string };
  takeProfit3:         { price: number; priceFormatted: string; rr: string };
  invalidation:        string;
}

/**
 * Compute a full trade plan from a structural zone and its surroundings.
 */
export function computeTradePlan(
  pair:        string,
  direction:   'LONG' | 'SHORT',
  zoneHigh:    number,
  zoneLow:     number,
  structData:  StructuralData,
  htfData?:    StructuralData | null
): TradePlan | null {
  const isLong = direction === 'LONG';
  const entryMid = (zoneHigh + zoneLow) / 2;

  // ── 1. Stop Loss: 0.3% beyond the far edge ───────────────────────
  const slBuffer = 0.003; // 0.3%
  const stopLoss = isLong 
    ? zoneLow * (1 - slBuffer)
    : zoneHigh * (1 + slBuffer);
  
  const risk = Math.abs(entryMid - stopLoss);
  if (risk <= 0) return null;

  // ── 2. Take Profit 1: Nearest unmitigated FVG or liquidity ────────
  let tp1Price = isLong ? entryMid + risk * 1.5 : entryMid - risk * 1.5;
  
  const fvgs = structData.fairValueGaps?.filter(f => !f.filled && (isLong ? f.low > zoneHigh : f.high < zoneLow)) || [];
  const pools = structData.liquidityPools?.filter(p => !p.swept && (isLong ? p.price > zoneHigh : p.price < zoneLow)) || [];
  
  const targets = [
    ...fvgs.map(f => (isLong ? f.low : f.high)),
    ...pools.map(p => p.price)
  ].sort((a, b) => isLong ? a - b : b - a);

  if (targets.length > 0) {
    // Pick the closest target that gives at least 1:1.2 RR
    const validTarget = targets.find(t => Math.abs(t - entryMid) / risk >= 1.2);
    if (validTarget) tp1Price = validTarget;
  }

  // ── 3. Take Profit 2: Opposite structural level ──────────────────
  let tp2Price = isLong ? entryMid + risk * 3 : entryMid - risk * 3;
  
  const oppositeObs = structData.orderBlocks?.filter(ob => 
    !ob.mitigated && 
    ob.direction === (isLong ? 'BEARISH' : 'BULLISH') &&
    (isLong ? ob.low > tp1Price : ob.high < tp1Price)
  ) || [];
  
  const oppositeSD = (isLong ? structData.supplyZones : structData.demandZones)?.filter(z => 
    z.freshness !== 'retired' &&
    (isLong ? z.low > tp1Price : z.high < tp1Price)
  ) || [];

  const secondaryTargets = [
    ...oppositeObs.map(ob => (isLong ? ob.low : ob.high)),
    ...oppositeSD.map(z => (isLong ? z.low : z.high))
  ].sort((a, b) => isLong ? a - b : b - a);

  if (secondaryTargets.length > 0) {
    const validTarget = secondaryTargets.find(t => Math.abs(t - entryMid) / risk >= 2.5);
    if (validTarget) tp2Price = validTarget;
  }

  // ── 4. Take Profit 3: Macro HTF target ───────────────────────────
  let tp3Price = isLong ? entryMid + risk * 5 : entryMid - risk * 5;
  const htf = htfData || structData; // Fallback to 4H if 1D not provided
  if (htf.equilibrium > 0) {
    // Target the opposite extreme (Premium for longs, Discount for shorts)
    const macroTarget = isLong ? htf.premiumLevel : htf.discountLevel;
    if (Math.abs(macroTarget - entryMid) / risk >= 4) {
      tp3Price = macroTarget;
    }
  }

  // Final R:R Verification
  const rr1 = Math.abs(tp1Price - entryMid) / risk;
  
  const slPct = Math.round((risk / entryMid) * 10000) / 100;

  return {
    pair,
    direction,
    entryZone: {
      low: zoneLow,
      high: zoneHigh,
      lowFormatted: formatPrice(zoneLow),
      highFormatted: formatPrice(zoneHigh),
    },
    stopLoss,
    stopLossFormatted: formatPrice(stopLoss),
    stopLossDistancePct: slPct,
    takeProfit1: { price: tp1Price, priceFormatted: formatPrice(tp1Price), rr: `1:${rr1.toFixed(1)}` },
    takeProfit2: { price: tp2Price, priceFormatted: formatPrice(tp2Price), rr: `1:${(Math.abs(tp2Price - entryMid) / risk).toFixed(1)}` },
    takeProfit3: { price: tp3Price, priceFormatted: formatPrice(tp3Price), rr: `1:${(Math.abs(tp3Price - entryMid) / risk).toFixed(1)}` },
    invalidation: isLong
      ? `SL triggered if price closes below ${formatPrice(stopLoss)}`
      : `SL triggered if price closes above ${formatPrice(stopLoss)}`,
  };
}

function formatPrice(price: number): string {
  if (price >= 1000) return `$${price.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  if (price >= 1)    return `$${price.toFixed(4)}`;
  return `$${price.toPrecision(4)}`;
}
