/**
 * AlphaAI Backend — Pair Universe Service
 * Manages the dynamic list of monitored pairs.
 * Fetches the top 80 USDT perpetuals by volume from Binance Futures.
 */
import { fetchTopFuturesPairs } from './binanceService';

export interface PairSpec {
  pair:   string;
  symbol: string;
}

const CACHE_TTL = 24 * 60 * 60 * 1000; // Refresh every 24 hours
let cachedUniverse: PairSpec[] = [];
let lastFetched = 0;

/**
 * Get the current top 80 USDT Perpetual pairs.
 * Uses a 24-hour cache to avoid excessive API calls.
 */
export async function getTopPairs(refresh = false): Promise<PairSpec[]> {
  const now = Date.now();
  
  if (!refresh && cachedUniverse.length > 0 && (now - lastFetched < CACHE_TTL)) {
    return cachedUniverse;
  }

  console.log('🌐 [PairUniverse] Refreshing top 80 USDT Perpetual pairs...');
  try {
    const topPairs = await fetchTopFuturesPairs(80);
    cachedUniverse = topPairs;
    lastFetched = now;
    console.log(`✅ [PairUniverse] Loaded ${cachedUniverse.length} pairs by volume`);
    return cachedUniverse;
  } catch (err: any) {
    console.error('❌ [PairUniverse] Failed to fetch top pairs:', err.message || err);
    if (err.stack) console.debug(err.stack);
    // Fallback to minimal set if everything fails
    if (cachedUniverse.length === 0) {
      return [
        { pair: 'BTC/USDT', symbol: 'BTCUSDT' },
        { pair: 'ETH/USDT', symbol: 'ETHUSDT' },
        { pair: 'SOL/USDT', symbol: 'SOLUSDT' },
      ];
    }
    return cachedUniverse;
  }
}
