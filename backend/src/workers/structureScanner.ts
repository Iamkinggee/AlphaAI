/**
 * AlphaAII Backend — Stage 1: Structure Scanner
 * Runs on every 1H / 4H / 1D candle close.
 * Detects swing points, order blocks, FVGs, S&D zones,
 * and liquidity pools for each pair in the universe.
 * Results are written to the Redis Structural Map.
 */
import { structuralMap } from '../cache/redisClient';

export interface SwingPoint {
  index: number;
  price: number;
  type: 'HH' | 'HL' | 'LH' | 'LL';
  timestamp: number;
}

export interface OrderBlock {
  id: string;
  direction: 'BULLISH' | 'BEARISH';
  high: number;
  low: number;
  open: number;
  close: number;
  timestamp: number;
  timeframe: string;
  broken: boolean;
}

export interface FairValueGap {
  id: string;
  direction: 'BULLISH' | 'BEARISH';
  high: number;
  low: number;
  timestamp: number;
  filled: boolean;
}

export interface StructuralData {
  pair: string;
  timeframe: string;
  lastUpdated: number;
  swingPoints: SwingPoint[];
  orderBlocks: OrderBlock[];
  fairValueGaps: FairValueGap[];
  supplyZones: { high: number; low: number; strength: number }[];
  demandZones: { high: number; low: number; strength: number }[];
  liquidityPools: { price: number; type: 'BSL' | 'SSL'; swept: boolean }[];
}

/**
 * Main entry point for the Structure Scanner.
 * Called after each candle close for a given pair and timeframe.
 */
export async function runStructureScanner(pair: string, timeframe: string, candles: number[][]): Promise<StructuralData> {
  console.log(`🔬 [StructureScanner] Scanning ${pair} ${timeframe} — ${candles.length} candles`);

  // ── Step 1: Detect Swing Points ────────────────────────────────
  const swingPoints = detectSwings(candles);

  // ── Step 2: Identify Order Blocks ──────────────────────────────
  const orderBlocks = detectOrderBlocks(candles, swingPoints, timeframe);

  // ── Step 3: Detect Fair Value Gaps ─────────────────────────────
  const fairValueGaps = detectFVGs(candles);

  // ── Step 4: S&D Zones (simplified — from swing confluences) ────
  const { supplyZones, demandZones } = detectSupplyDemand(swingPoints, candles);

  // ── Step 5: Liquidity Pools (equal highs/lows) ─────────────────
  const liquidityPools = detectLiquidityPools(candles);

  const data: StructuralData = {
    pair, timeframe,
    lastUpdated: Date.now(),
    swingPoints, orderBlocks, fairValueGaps,
    supplyZones, demandZones, liquidityPools,
  };

  // Persist to Redis Structural Map
  await structuralMap.set(pair, data as unknown as Record<string, unknown>);
  console.log(`✅ [StructureScanner] ${pair} ${timeframe} written to Redis (OBs: ${orderBlocks.length}, FVGs: ${fairValueGaps.length})`);

  return data;
}

/**
 * ZigZag swing detection.
 * Each candle: [timestamp, open, high, low, close, volume]
 */
function detectSwings(candles: number[][]): SwingPoint[] {
  const swings: SwingPoint[] = [];
  const LOOKBACK = 3;

  for (let i = LOOKBACK; i < candles.length - LOOKBACK; i++) {
    const high = candles[i][2];
    const low = candles[i][3];
    const timestamp = candles[i][0];

    const isSwingHigh = candles.slice(i - LOOKBACK, i).every(c => c[2] <= high)
      && candles.slice(i + 1, i + LOOKBACK + 1).every(c => c[2] <= high);

    const isSwingLow = candles.slice(i - LOOKBACK, i).every(c => c[3] >= low)
      && candles.slice(i + 1, i + LOOKBACK + 1).every(c => c[3] >= low);

    if (isSwingHigh) {
      const prevHigh = swings.filter(s => s.type === 'HH' || s.type === 'LH').slice(-1)[0];
      swings.push({ index: i, price: high, type: prevHigh && high > prevHigh.price ? 'HH' : 'LH', timestamp });
    }
    if (isSwingLow) {
      const prevLow = swings.filter(s => s.type === 'HL' || s.type === 'LL').slice(-1)[0];
      swings.push({ index: i, price: low, type: prevLow && low > prevLow.price ? 'HL' : 'LL', timestamp });
    }
  }

  return swings;
}

/**
 * Order Block detection — last bullish/bearish candle before a BOS.
 */
function detectOrderBlocks(candles: number[][], swings: SwingPoint[], timeframe: string): OrderBlock[] {
  const obs: OrderBlock[] = [];
  // TODO: Full BOS-based OB detection in Phase 5
  // Stub: mark last 3 swing-adjacent candles as OBs
  swings.slice(-6).forEach((swing, i) => {
    const c = candles[swing.index];
    if (!c) return;
    const direction = swing.type === 'HH' || swing.type === 'HL' ? 'BULLISH' : 'BEARISH';
    obs.push({
      id: `ob_${swing.timestamp}_${i}`,
      direction,
      high: c[2], low: c[3], open: c[1], close: c[4],
      timestamp: swing.timestamp,
      timeframe, broken: false,
    });
  });
  return obs;
}

/**
 * Fair Value Gap detection — gap between candle[i-1].high and candle[i+1].low (bullish FVG)
 * or candle[i-1].low and candle[i+1].high (bearish FVG).
 */
function detectFVGs(candles: number[][]): FairValueGap[] {
  const fvgs: FairValueGap[] = [];
  for (let i = 1; i < candles.length - 1; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];
    const next = candles[i + 1];

    // Bullish FVG: prev.high < next.low (gap up)
    if (prev[2] < next[3]) {
      fvgs.push({ id: `fvg_bull_${curr[0]}`, direction: 'BULLISH', high: next[3], low: prev[2], timestamp: curr[0], filled: false });
    }
    // Bearish FVG: prev.low > next.high (gap down)
    if (prev[3] > next[2]) {
      fvgs.push({ id: `fvg_bear_${curr[0]}`, direction: 'BEARISH', high: prev[3], low: next[2], timestamp: curr[0], filled: false });
    }
  }
  return fvgs.slice(-20); // Keep last 20 FVGs
}

/**
 * Supply & Demand zone identification from swing confluences.
 */
function detectSupplyDemand(swings: SwingPoint[], candles: number[][]): {
  supplyZones: { high: number; low: number; strength: number }[];
  demandZones: { high: number; low: number; strength: number }[];
} {
  const supplyZones: { high: number; low: number; strength: number }[] = [];
  const demandZones: { high: number; low: number; strength: number }[] = [];

  swings.filter(s => s.type === 'LH').forEach(s => {
    const c = candles[s.index];
    if (c) supplyZones.push({ high: c[2], low: c[1], strength: 50 });
  });
  swings.filter(s => s.type === 'HL').forEach(s => {
    const c = candles[s.index];
    if (c) demandZones.push({ high: c[1], low: c[3], strength: 50 });
  });

  return { supplyZones: supplyZones.slice(-5), demandZones: demandZones.slice(-5) };
}

/**
 * Liquidity pool detection — equal highs (BSL) and equal lows (SSL).
 */
function detectLiquidityPools(candles: number[][]): { price: number; type: 'BSL' | 'SSL'; swept: boolean }[] {
  const pools: { price: number; type: 'BSL' | 'SSL'; swept: boolean }[] = [];
  const TOLERANCE = 0.001; // 0.1%

  const highs = candles.map(c => c[2]);
  const lows  = candles.map(c => c[3]);

  for (let i = 0; i < highs.length - 1; i++) {
    for (let j = i + 1; j < highs.length; j++) {
      if (Math.abs(highs[i] - highs[j]) / highs[i] < TOLERANCE) {
        if (!pools.some(p => p.type === 'BSL' && Math.abs(p.price - highs[i]) / highs[i] < TOLERANCE)) {
          pools.push({ price: highs[i], type: 'BSL', swept: false });
        }
      }
      if (Math.abs(lows[i] - lows[j]) / lows[i] < TOLERANCE) {
        if (!pools.some(p => p.type === 'SSL' && Math.abs(p.price - lows[i]) / lows[i] < TOLERANCE)) {
          pools.push({ price: lows[i], type: 'SSL', swept: false });
        }
      }
    }
  }
  return pools.slice(-10);
}
