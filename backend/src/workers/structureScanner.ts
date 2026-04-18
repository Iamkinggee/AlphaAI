/**
 * AlphaAI Backend — Stage 1: Structure Scanner
 * Professional SMC (Smart Money Concepts) detection engine.
 * Runs on every 1H / 4H / 1D candle close.
 *
 * Detects:
 *  - Swing points with ZigZag algorithm (min 1.5% sensitivity on 4H)
 *  - BOS (Break of Structure) and CHOCH (Change of Character)
 *  - Order Blocks (last bearish candle before BOS impulse, scored by impulse strength)
 *  - Fair Value Gaps (imbalances, with mitigation tracking)
 *  - Supply & Demand Zones (tight consolidation + strong departure velocity)
 *  - Liquidity Pools (equal highs/lows ±0.1%, buy-side / sell-side)
 *  - Premium / Discount model (equilibrium of swing range)
 */
import { structuralMap } from '../cache/redisClient';

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface SwingPoint {
  index:     number;
  price:     number;
  type:      'HH' | 'HL' | 'LH' | 'LL';
  timestamp: number;
}

export interface BosEvent {
  type:      'BOS' | 'CHOCH';
  direction: 'BULLISH' | 'BEARISH';
  level:     number;
  timestamp: number;
  confirmed: boolean;
}

export interface OrderBlock {
  id:              string;
  direction:       'BULLISH' | 'BEARISH';
  high:            number;
  low:             number;
  open:            number;
  close:           number;
  timestamp:       number;
  timeframe:       string;
  broken:          boolean;
  mitigated:       boolean;
  impulseStrength: number;
  fvgCount:        number;
  htfAligned:      boolean;
}

export interface FairValueGap {
  id:              string;
  direction:       'BULLISH' | 'BEARISH';
  high:            number;
  low:             number;
  timestamp:       number;
  filled:          boolean;
  partiallyFilled: boolean;
}

export interface SupplyDemandZone {
  high:              number;
  low:               number;
  strength:          number;
  touchCount:        number;
  freshness:         'fresh' | 'tested' | 'weakening' | 'retired';
  departureVelocity: number;
  type:              'supply' | 'demand';
}

export interface LiquidityPool {
  price:  number;
  type:   'BSL' | 'SSL';
  swept:  boolean;
  count:  number;
}

export interface StructuralData {
  pair:           string;
  timeframe:      string;
  lastUpdated:    number;
  trend:          'bullish' | 'bearish' | 'ranging';
  choch:          boolean;
  swingPoints:    SwingPoint[];
  bosEvents:      BosEvent[];
  orderBlocks:    OrderBlock[];
  fairValueGaps:  FairValueGap[];
  supplyZones:    SupplyDemandZone[];
  demandZones:    SupplyDemandZone[];
  liquidityPools: LiquidityPool[];
  equilibrium:    number;
  premiumLevel:   number;
  discountLevel:  number;
}

// Candle format: [timestamp, open, high, low, close, volume]
type Candle = number[];

const MIN_SWING_PCT = 0.015; // 1.5% minimum swing per spec

// ── Main Entry Point ──────────────────────────────────────────────────────────

export async function runStructureScanner(
  pair: string,
  timeframe: string,
  candles: Candle[]
): Promise<StructuralData> {
  console.log(`🔬 [StructureScanner] Scanning ${pair} ${timeframe} — ${candles.length} candles`);

  if (candles.length < 20) {
    console.warn(`⚠️  [StructureScanner] Insufficient candles for ${pair} ${timeframe}`);
    const empty = emptyStructuralData(pair, timeframe);
    await structuralMap.set(pair, empty as unknown as Record<string, unknown>);
    return empty;
  }

  const swingPoints  = detectSwings(candles, MIN_SWING_PCT);
  const { bosEvents, trend, choch } = detectBosChoch(swingPoints, candles);
  const fairValueGaps = detectFVGs(candles);
  const orderBlocks   = detectOrderBlocks(candles, bosEvents, fairValueGaps, timeframe);
  const { supplyZones, demandZones } = detectSupplyDemand(candles);
  const liquidityPools = detectLiquidityPools(candles);
  const { equilibrium, premiumLevel, discountLevel } = computePremiumDiscount(swingPoints);

  const currentPrice = candles[candles.length - 1][4];
  updateMitigations(orderBlocks, fairValueGaps, liquidityPools, currentPrice);
  updateZoneTouchCounts(supplyZones, demandZones, candles);

  const data: StructuralData = {
    pair, timeframe, lastUpdated: Date.now(),
    trend, choch, swingPoints, bosEvents, orderBlocks, fairValueGaps,
    supplyZones, demandZones, liquidityPools,
    equilibrium, premiumLevel, discountLevel,
  };

  await structuralMap.set(pair, data as unknown as Record<string, unknown>);
  console.log(
    `✅ [StructureScanner] ${pair} ${timeframe} — Trend: ${trend}${choch ? ' ⚡CHOCH' : ''} | ` +
    `OBs: ${orderBlocks.filter(o => !o.mitigated).length} active | ` +
    `FVGs: ${fairValueGaps.filter(f => !f.filled).length} unfilled`
  );
  return data;
}

// ── Swing Detection ───────────────────────────────────────────────────────────

function detectSwings(candles: Candle[], minSwingPct: number): SwingPoint[] {
  if (candles.length < 10) return [];

  const swings: SwingPoint[] = [];
  type Dir = 'up' | 'down';
  let direction: Dir | null = null;
  let extremeHighIdx = 0;
  let extremeLowIdx  = 0;
  let extremeHigh    = candles[0][2];
  let extremeLow     = candles[0][3];

  const addHigh = (idx: number) => {
    const prevHigh = [...swings].reverse().find(s => s.type === 'HH' || s.type === 'LH');
    swings.push({
      index: idx, price: candles[idx][2],
      type:  prevHigh && candles[idx][2] > prevHigh.price ? 'HH' : 'LH',
      timestamp: candles[idx][0],
    });
  };

  const addLow = (idx: number) => {
    const prevLow = [...swings].reverse().find(s => s.type === 'HL' || s.type === 'LL');
    swings.push({
      index: idx, price: candles[idx][3],
      type:  prevLow && candles[idx][3] > prevLow.price ? 'HL' : 'LL',
      timestamp: candles[idx][0],
    });
  };

  for (let i = 1; i < candles.length; i++) {
    const high = candles[i][2];
    const low  = candles[i][3];

    if (direction === null) {
      if (high > extremeHigh)      { direction = 'up';   extremeHigh = high; extremeHighIdx = i; }
      else if (low < extremeLow)   { direction = 'down'; extremeLow  = low;  extremeLowIdx  = i; }
      continue;
    }

    if (direction === 'up') {
      if (high >= extremeHigh)     { extremeHigh = high; extremeHighIdx = i; }
      else if (extremeHigh > 0 && (extremeHigh - low) / extremeHigh >= minSwingPct) {
        addHigh(extremeHighIdx);
        direction = 'down'; extremeLow = low; extremeLowIdx = i;
      }
    } else {
      if (low <= extremeLow)       { extremeLow = low; extremeLowIdx = i; }
      else if (extremeLow > 0 && (high - extremeLow) / extremeLow >= minSwingPct) {
        addLow(extremeLowIdx);
        direction = 'up'; extremeHigh = high; extremeHighIdx = i;
      }
    }
  }

  return swings.slice(-20);
}

// ── BOS / CHOCH ───────────────────────────────────────────────────────────────

function detectBosChoch(
  swings:  SwingPoint[],
  candles: Candle[]
): { bosEvents: BosEvent[]; trend: 'bullish' | 'bearish' | 'ranging'; choch: boolean } {
  const bosEvents: BosEvent[] = [];
  if (swings.length < 4) return { bosEvents: [], trend: 'ranging', choch: false };

  const recent = swings.slice(-5);
  let trend: 'bullish' | 'bearish' | 'ranging' = 'ranging';
  if (recent.some(s => s.type === 'HH') && recent.some(s => s.type === 'HL')) trend = 'bullish';
  else if (recent.some(s => s.type === 'LH') && recent.some(s => s.type === 'LL')) trend = 'bearish';

  let choch = false;
  const seenLevels = new Set<string>();
  let lastBosDir: 'BULLISH' | 'BEARISH' | null = null;

  for (let i = 1; i < candles.length; i++) {
    const close = candles[i][4];
    const ts    = candles[i][0];
    const prevHighs = swings.filter(s => s.index < i && (s.type === 'HH' || s.type === 'LH'));
    const prevLows  = swings.filter(s => s.index < i && (s.type === 'HL' || s.type === 'LL'));
    const lastHigh  = prevHighs[prevHighs.length - 1];
    const lastLow   = prevLows[prevLows.length  - 1];

    if (lastHigh && close > lastHigh.price) {
      const key = `bull_${lastHigh.price.toFixed(4)}`;
      if (!seenLevels.has(key)) {
        seenLevels.add(key);
        const isCHOCH = trend === 'bearish' && lastBosDir !== 'BULLISH';
        bosEvents.push({ type: isCHOCH ? 'CHOCH' : 'BOS', direction: 'BULLISH', level: lastHigh.price, timestamp: ts, confirmed: true });
        if (isCHOCH) choch = true;
        lastBosDir = 'BULLISH';
      }
    }
    if (lastLow && close < lastLow.price) {
      const key = `bear_${lastLow.price.toFixed(4)}`;
      if (!seenLevels.has(key)) {
        seenLevels.add(key);
        const isCHOCH = trend === 'bullish' && lastBosDir !== 'BEARISH';
        bosEvents.push({ type: isCHOCH ? 'CHOCH' : 'BOS', direction: 'BEARISH', level: lastLow.price, timestamp: ts, confirmed: true });
        if (isCHOCH) choch = true;
        lastBosDir = 'BEARISH';
      }
    }
  }

  return { bosEvents: bosEvents.slice(-12), trend, choch };
}

// ── Order Block Detection ─────────────────────────────────────────────────────

function detectOrderBlocks(
  candles:  Candle[],
  bosEvents: BosEvent[],
  fvgs:     FairValueGap[],
  timeframe: string
): OrderBlock[] {
  const obs: OrderBlock[] = [];

  for (const bos of bosEvents) {
    const bosIdx = candles.findIndex(c => c[0] === bos.timestamp);
    if (bosIdx < 5) continue;

    if (bos.direction === 'BULLISH') {
      // Find start of the bullish impulse
      let impulseStart = bosIdx;
      for (let j = bosIdx - 1; j >= Math.max(0, bosIdx - 30); j--) {
        if (candles[j][4] < candles[j][1]) { impulseStart = j + 1; break; }
        impulseStart = j;
      }
      // Walk backward to find ≤3 bearish candles (the OB cluster)
      let obIdx = -1; let cluster = 0;
      for (let j = impulseStart - 1; j >= Math.max(0, impulseStart - 5) && cluster < 3; j--) {
        if (candles[j][4] < candles[j][1]) { obIdx = j; cluster++; } else if (cluster > 0) break;
      }
      if (obIdx < 0) continue;
      const ob = candles[obIdx];
      const impulseHigh     = Math.max(...candles.slice(obIdx, bosIdx + 1).map(c => c[2]));
      const impulseStrength = ob[3] > 0 ? ((impulseHigh - ob[3]) / ob[3]) * 100 : 0;
      const fvgCount        = fvgs.filter(f => f.direction === 'BULLISH' && f.timestamp >= ob[0] && f.timestamp <= bos.timestamp).length;
      obs.push({ id: `ob_bull_${ob[0]}_${timeframe}`, direction: 'BULLISH', high: ob[2], low: ob[3], open: ob[1], close: ob[4], timestamp: ob[0], timeframe, broken: false, mitigated: false, impulseStrength, fvgCount, htfAligned: false });

    } else {
      let impulseStart = bosIdx;
      for (let j = bosIdx - 1; j >= Math.max(0, bosIdx - 30); j--) {
        if (candles[j][4] > candles[j][1]) { impulseStart = j + 1; break; }
        impulseStart = j;
      }
      let obIdx = -1; let cluster = 0;
      for (let j = impulseStart - 1; j >= Math.max(0, impulseStart - 5) && cluster < 3; j--) {
        if (candles[j][4] > candles[j][1]) { obIdx = j; cluster++; } else if (cluster > 0) break;
      }
      if (obIdx < 0) continue;
      const ob = candles[obIdx];
      const impulseLow      = Math.min(...candles.slice(obIdx, bosIdx + 1).map(c => c[3]));
      const impulseStrength = ob[2] > 0 ? ((ob[2] - impulseLow) / ob[2]) * 100 : 0;
      const fvgCount        = fvgs.filter(f => f.direction === 'BEARISH' && f.timestamp >= ob[0] && f.timestamp <= bos.timestamp).length;
      obs.push({ id: `ob_bear_${ob[0]}_${timeframe}`, direction: 'BEARISH', high: ob[2], low: ob[3], open: ob[1], close: ob[4], timestamp: ob[0], timeframe, broken: false, mitigated: false, impulseStrength, fvgCount, htfAligned: false });
    }
  }

  // Deduplicate by midpoint proximity (0.3%)
  const deduped: OrderBlock[] = [];
  for (const ob of obs) {
    const mid = (ob.high + ob.low) / 2;
    if (!deduped.some(e => e.direction === ob.direction && Math.abs((e.high + e.low) / 2 - mid) / mid < 0.003)) {
      deduped.push(ob);
    }
  }
  return deduped.slice(-12);
}

// ── FVG Detection ─────────────────────────────────────────────────────────────

function detectFVGs(candles: Candle[]): FairValueGap[] {
  const fvgs: FairValueGap[] = [];
  for (let i = 1; i < candles.length - 1; i++) {
    const [, , prevHigh, prevLow] = candles[i - 1];
    const [ts]                    = candles[i];
    const [, , , nextLow, , ]     = candles[i + 1];
    const nextHigh                = candles[i + 1][2];

    if (prevHigh < nextLow && (nextLow - prevHigh) / prevHigh >= 0.001) {
      fvgs.push({ id: `fvg_bull_${ts}`, direction: 'BULLISH', high: nextLow, low: prevHigh, timestamp: ts, filled: false, partiallyFilled: false });
    }
    if (prevLow > nextHigh && (prevLow - nextHigh) / nextHigh >= 0.001) {
      fvgs.push({ id: `fvg_bear_${ts}`, direction: 'BEARISH', high: prevLow, low: nextHigh, timestamp: ts, filled: false, partiallyFilled: false });
    }
  }
  return fvgs.slice(-30);
}

// ── Supply & Demand Zones ─────────────────────────────────────────────────────

function detectSupplyDemand(candles: Candle[]): { supplyZones: SupplyDemandZone[]; demandZones: SupplyDemandZone[] } {
  const supplyZones: SupplyDemandZone[] = [];
  const demandZones: SupplyDemandZone[] = [];

  for (let i = 3; i < candles.length - 4; i++) {
    const cons   = candles.slice(i - 2, i + 1);
    const cHigh  = Math.max(...cons.map(c => c[2]));
    const cLow   = Math.min(...cons.map(c => c[3]));
    if (cLow <= 0 || (cHigh - cLow) / cLow >= 0.015) continue;

    const dep = candles.slice(i + 1, Math.min(candles.length, i + 4));
    if (dep.length < 2) continue;
    const endPrice = dep[dep.length - 1][4];

    if (dep.filter(c => c[4] > c[1]).length >= 2) {
      const move = (endPrice - cLow) / cLow;
      if (move >= 0.03) demandZones.push({ high: cHigh, low: cLow, strength: Math.min(100, 40 + move * 2000), touchCount: 0, freshness: 'fresh', departureVelocity: move * 100, type: 'demand' });
    }
    if (dep.filter(c => c[4] < c[1]).length >= 2) {
      const move = (cHigh - endPrice) / cHigh;
      if (move >= 0.03) supplyZones.push({ high: cHigh, low: cLow, strength: Math.min(100, 40 + move * 2000), touchCount: 0, freshness: 'fresh', departureVelocity: move * 100, type: 'supply' });
    }
  }

  return { supplyZones: supplyZones.slice(-8), demandZones: demandZones.slice(-8) };
}

// ── Liquidity Pools ───────────────────────────────────────────────────────────

function detectLiquidityPools(candles: Candle[]): LiquidityPool[] {
  const TOLERANCE = 0.001;
  type G = { price: number; count: number };
  const hGroups: G[] = []; const lGroups: G[] = [];

  for (const c of candles) {
    const hg = hGroups.find(g => Math.abs(c[2] - g.price) / g.price < TOLERANCE);
    if (hg) hg.count++; else hGroups.push({ price: c[2], count: 1 });
    const lg = lGroups.find(g => Math.abs(c[3] - g.price) / g.price < TOLERANCE);
    if (lg) lg.count++; else lGroups.push({ price: c[3], count: 1 });
  }

  const pools: LiquidityPool[] = [
    ...hGroups.filter(g => g.count >= 2).map(g => ({ price: g.price, type: 'BSL' as const, swept: false, count: g.count })),
    ...lGroups.filter(g => g.count >= 2).map(g => ({ price: g.price, type: 'SSL' as const, swept: false, count: g.count })),
  ];
  return pools.sort((a, b) => b.count - a.count).slice(0, 15);
}

// ── Premium / Discount ────────────────────────────────────────────────────────

function computePremiumDiscount(swings: SwingPoint[]): { equilibrium: number; premiumLevel: number; discountLevel: number } {
  const recent = swings.slice(-6);
  const highs  = recent.filter(s => s.type === 'HH' || s.type === 'LH').map(s => s.price);
  const lows   = recent.filter(s => s.type === 'HL' || s.type === 'LL').map(s => s.price);
  if (!highs.length || !lows.length) return { equilibrium: 0, premiumLevel: 0, discountLevel: 0 };
  const premiumLevel = Math.max(...highs); const discountLevel = Math.min(...lows);
  return { equilibrium: (premiumLevel + discountLevel) / 2, premiumLevel, discountLevel };
}

// ── Mitigation & Touch Updates ────────────────────────────────────────────────

function updateMitigations(obs: OrderBlock[], fvgs: FairValueGap[], pools: LiquidityPool[], price: number): void {
  for (const ob of obs) {
    const mid = (ob.high + ob.low) / 2;
    if (ob.direction === 'BULLISH' && price < mid) ob.mitigated = true;
    if (ob.direction === 'BEARISH' && price > mid) ob.mitigated = true;
  }
  for (const fvg of fvgs) {
    if (price >= fvg.low && price <= fvg.high) fvg.partiallyFilled = true;
    if (fvg.direction === 'BULLISH' && price > fvg.high) fvg.filled = true;
    if (fvg.direction === 'BEARISH' && price < fvg.low)  fvg.filled = true;
  }
  for (const pool of pools) {
    if (pool.type === 'BSL' && price > pool.price) pool.swept = true;
    if (pool.type === 'SSL' && price < pool.price) pool.swept = true;
  }
}

function updateZoneTouchCounts(supply: SupplyDemandZone[], demand: SupplyDemandZone[], candles: Candle[]): void {
  for (const zone of [...supply, ...demand]) {
    zone.touchCount = candles.filter(c => c[2] >= zone.low && c[3] <= zone.high).length;
    if (zone.touchCount === 0)      zone.freshness = 'fresh';
    else if (zone.touchCount === 1) zone.freshness = 'tested';
    else if (zone.touchCount <= 3)  zone.freshness = 'weakening';
    else                            zone.freshness = 'retired';
  }
}

function emptyStructuralData(pair: string, timeframe: string): StructuralData {
  return { pair, timeframe, lastUpdated: Date.now(), trend: 'ranging', choch: false, swingPoints: [], bosEvents: [], orderBlocks: [], fairValueGaps: [], supplyZones: [], demandZones: [], liquidityPools: [], equilibrium: 0, premiumLevel: 0, discountLevel: 0 };
}
