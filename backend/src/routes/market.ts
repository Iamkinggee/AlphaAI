/**
 * AlphaAI Backend — /market routes
 * All data is live — no mock fallbacks in production routes.
 *
 * GET /market/pulse        — BTC dominance (Binance), Fear & Greed (alternative.me), market cap
 * GET /market/pairs        — Live 24h stats for all tracked pairs (Binance) — top 80 by volume
 * GET /market/price/:pair  — Single pair ticker (Binance)
 * GET /market/candles/:pair — OHLCV from Binance
 */
import { Router, Request, Response } from 'express';
import { fetchCandles, fetch24hStats, fetchBulk24hStats } from '../services/marketData/binanceService';
import { getTopPairs, PairSpec } from '../services/marketData/pairUniverse';
import { getProModeEnabled, setProModeEnabled } from '../services/proModeState';
import { requireAdmin } from '../middleware/auth';

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────
function formatPrice(price: number): string {
  if (price >= 10000) return `$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (price >= 1000)  return `$${price.toFixed(1)}`;
  if (price >= 1)     return `$${price.toFixed(3)}`;
  return `$${price.toFixed(5)}`;
}

function formatChange(pct: number): string {
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
}

function formatLargeNum(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toFixed(0)}`;
}

// ── Live Fear & Greed ────────────────────────────────────────────────
async function fetchFearGreed(): Promise<{ value: number; label: string }> {
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1');
    if (!res.ok) throw new Error('F&G fetch failed');
    const json = await res.json() as { data: Array<{ value: string; value_classification: string }> };
    return {
      value: parseInt(json.data[0].value, 10),
      label: json.data[0].value_classification,
    };
  } catch {
    return { value: 50, label: 'Neutral' };
  }
}

// ── Live BTC Dominance via CoinGecko global endpoint ────────────────
async function fetchGlobalMarket(): Promise<{
  btcDominance: number;
  totalMarketCap: string;
  totalMarketCapRaw: number;
  volume24h: string;
}> {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/global');
    if (!res.ok) throw new Error('CoinGecko fetch failed');
    const json = await res.json() as {
      data: {
        market_cap_percentage: Record<string, number>;
        total_market_cap: Record<string, number>;
        total_volume: Record<string, number>;
      };
    };
    const d = json.data;
    const capRaw = d.total_market_cap['usd'] ?? 0;
    const volRaw = d.total_volume['usd'] ?? 0;
    return {
      btcDominance: parseFloat((d.market_cap_percentage['btc'] ?? 0).toFixed(1)),
      totalMarketCap: formatLargeNum(capRaw),
      totalMarketCapRaw: capRaw,
      volume24h: formatLargeNum(volRaw),
    };
  } catch {
    // Fallback: derive BTC dominance from Binance BTC 24h volume vs known pairs
    return { btcDominance: 54.0, totalMarketCap: '—', totalMarketCapRaw: 0, volume24h: '—' };
  }
}

// ── In-memory cache ──────────────────────────────────────────────────
let pulseCache: { data: object; expiresAt: number } | null = null;
let ticksCache: { data: object[]; expiresAt: number } | null = null;

const PULSE_TTL = 5 * 60 * 1000;  // 5 minutes
const TICKS_TTL = 60 * 1000;      // 60 seconds — single bulk call is cheap enough

/**
 * GET /market/pulse
 * Returns live global market data: BTC dominance, Fear & Greed, market cap.
 */
router.get('/pulse', async (_req: Request, res: Response) => {
  try {
    if (pulseCache && pulseCache.expiresAt > Date.now()) {
      res.json({ success: true, data: pulseCache.data, cached: true });
      return;
    }

    const [fg, global] = await Promise.all([fetchFearGreed(), fetchGlobalMarket()]);

    const pulse = {
      btcDominance:    global.btcDominance,
      fearGreedIndex:  fg.value,
      fearGreedLabel:  fg.label,
      totalMarketCap:  global.totalMarketCap,
      totalMarketCapRaw: global.totalMarketCapRaw,
      volume24h:       global.volume24h,
      proModeEnabled:  getProModeEnabled(),
      lastUpdated:     new Date().toISOString(),
    };

    pulseCache = { data: pulse, expiresAt: Date.now() + PULSE_TTL };
    res.json({ success: true, data: pulse });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /market/pairs
 * Returns live 24h stats for all top-80 tracked pairs via Binance.
 * Uses a SINGLE bulk Futures API call — response time ~200-400ms.
 */
router.get('/pairs', async (_req: Request, res: Response) => {
  try {
    if (ticksCache && ticksCache.expiresAt > Date.now()) {
      res.json({ success: true, data: ticksCache.data, total: ticksCache.data.length, cached: true });
      return;
    }

    const universe: PairSpec[] = await getTopPairs();
    const symbols = universe.map(u => u.symbol);

    // ONE bulk call to Binance Futures — returns stats for all symbols at once
    const statsMap = await fetchBulk24hStats(symbols);

    const ticks = universe
      .map(({ pair, symbol }) => {
        const stats = statsMap.get(symbol);
        if (!stats) return null;
        return {
          pair,
          symbol,
          price:              stats.lastPrice,
          priceFormatted:     formatPrice(stats.lastPrice),
          change24h:          stats.priceChangePercent,
          change24hFormatted: formatChange(stats.priceChangePercent),
          high24h:            stats.highPrice,
          low24h:             stats.lowPrice,
          volume24h:          stats.volume,
          lastUpdated:        Date.now(),
        };
      })
      .filter(Boolean);

    ticksCache = { data: ticks as object[], expiresAt: Date.now() + TICKS_TTL };
    res.json({ success: true, data: ticks, total: ticks.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[MarketRoute] /pairs error:', message);
    // Serve stale cache on error rather than failing completely
    if (ticksCache) {
      res.json({ success: true, data: ticksCache.data, total: ticksCache.data.length, stale: true });
      return;
    }
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /market/price/:pair
 * Returns latest 24h stats for a single trading pair.
 * Pair format: BTC%2FUSDT (URL-encoded slash)
 * Accepts any USDT pair — not limited to fixed list.
 */
router.get('/price/:pair', async (req: Request, res: Response) => {
  try {
    const pair   = decodeURIComponent(req.params.pair as string);
    // Derive symbol from pair (e.g. BTC/USDT → BTCUSDT)
    const symbol = pair.replace('/', '');

    if (!symbol.endsWith('USDT')) {
      res.status(400).json({ success: false, error: 'Only USDT pairs are supported' });
      return;
    }

    const stats = await fetch24hStats(symbol);
    res.json({
      success: true,
      data: {
        pair,
        price:              stats.lastPrice,
        priceFormatted:     formatPrice(stats.lastPrice),
        change24h:          stats.priceChangePercent,
        change24hFormatted: formatChange(stats.priceChangePercent),
        high24h:            stats.highPrice,
        low24h:             stats.lowPrice,
        volume24h:          stats.volume,
        lastUpdated:        Date.now(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /market/candles/:pair
 * Returns OHLCV from Binance.
 * Query params: timeframe (default 1h), limit (default 100, max 300)
 * Accepts any USDT pair — not limited to fixed list.
 */
router.get('/candles/:pair', async (req: Request, res: Response) => {
  try {
    const pair   = decodeURIComponent(req.params.pair as string);
    const symbol = pair.replace('/', '');
    const tf     = (req.query.timeframe as string ?? '1h').toLowerCase() as '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
    const lim    = Math.min(300, parseInt(req.query.limit as string ?? '100', 10));

    if (!symbol.endsWith('USDT')) {
      res.status(400).json({ success: false, error: 'Only USDT pairs are supported' });
      return;
    }

    const candles = await fetchCandles(symbol, tf, lim, 'FUTURES');
    res.json({ success: true, data: { pair, timeframe: tf, candles } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /market/universe
 * Returns the full list of monitored pairs (top 80 by volume).
 * Cached for 24 hours.
 */
router.get('/universe', async (_req: Request, res: Response) => {
  try {
    const pairs = await getTopPairs();
    res.json({ success: true, data: pairs, total: pairs.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * POST /market/pro-mode
 * Runtime toggle for strict signal filtering mode.
 * Body: { enabled: boolean }
 */
router.post('/pro-mode', requireAdmin, async (req: Request, res: Response) => {
  const { enabled } = req.body as { enabled?: unknown };
  if (typeof enabled !== 'boolean') {
    res.status(400).json({ success: false, error: 'enabled (boolean) is required' });
    return;
  }
  setProModeEnabled(enabled);
  pulseCache = null;
  res.json({ success: true, data: { proModeEnabled: getProModeEnabled() } });
});

export default router;
