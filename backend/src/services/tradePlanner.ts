/**
 * AlphaAI Backend — Trade Planner
 * Computes Entry/SL/TP1/TP2/TP3 levels from a structural zone.
 * R:R ratios: TP1 = 1:1, TP2 = 1:2, TP3 = 1:3
 */

export interface TradePlan {
  pair: string;
  direction: 'LONG' | 'SHORT';
  entryZone: { low: number; high: number; lowFormatted: string; highFormatted: string };
  stopLoss: number;
  stopLossFormatted: string;
  stopLossDistancePct: number;
  takeProfit1: { price: number; priceFormatted: string; rr: string };
  takeProfit2: { price: number; priceFormatted: string; rr: string };
  takeProfit3: { price: number; priceFormatted: string; rr: string };
  invalidation: string;
}

/**
 * Compute a full trade plan from a structural zone.
 * @param pair          Trading pair (e.g. 'BTC/USDT')
 * @param direction     'LONG' or 'SHORT'
 * @param zoneHigh      Upper bound of entry zone
 * @param zoneLow       Lower bound of entry zone
 * @param atrMultiplier SL buffer as a multiple of zone width (default 0.3)
 */
export function computeTradePlan(
  pair: string,
  direction: 'LONG' | 'SHORT',
  zoneHigh: number,
  zoneLow: number,
  atrMultiplier = 0.3
): TradePlan {
  const isLong = direction === 'LONG';
  const zoneWidth = zoneHigh - zoneLow;
  const buffer = zoneWidth * atrMultiplier;

  // Stop Loss — beyond zone with buffer
  const stopLoss = isLong ? zoneLow - buffer : zoneHigh + buffer;

  // Entry midpoint for R calculation
  const entryMid = (zoneHigh + zoneLow) / 2;
  const risk = Math.abs(entryMid - stopLoss);

  // Take profits at 1R, 2R, 3R
  const tp1 = isLong ? entryMid + risk * 1 : entryMid - risk * 1;
  const tp2 = isLong ? entryMid + risk * 2 : entryMid - risk * 2;
  const tp3 = isLong ? entryMid + risk * 3 : entryMid - risk * 3;

  const slPct = Math.round((Math.abs(entryMid - stopLoss) / entryMid) * 10000) / 100;

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
    takeProfit1: { price: tp1, priceFormatted: formatPrice(tp1), rr: '1:1' },
    takeProfit2: { price: tp2, priceFormatted: formatPrice(tp2), rr: '1:2' },
    takeProfit3: { price: tp3, priceFormatted: formatPrice(tp3), rr: '1:3' },
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
