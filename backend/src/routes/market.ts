/**
 * AlphaAI Backend — /market routes
 * GET /market/pulse   — BTC dominance, F&G, market cap
 * GET /market/price/:pair — Single pair price tick
 * GET /market/candles/:pair — OHLCV candle history (stub)
 */
import { Router, Request, Response } from 'express';

const router = Router();

// Mock market pulse — replace with CoinGecko API call in Phase 5
const MOCK_PULSE = {
  btcDominance: 54.2,
  fearGreedIndex: 72,
  fearGreedLabel: 'Greed',
  totalMarketCap: '$2.41T',
  totalMarketCapRaw: 2_410_000_000_000,
  volume24h: '$98.4B',
  lastUpdated: new Date().toISOString(),
};

const MOCK_TICKS: Record<string, object> = {
  'BTC/USDT': { pair: 'BTC/USDT', price: 43218.50, priceFormatted: '$43,218.50', change24h: 2.14, change24hFormatted: '+2.14%', high24h: 43680, low24h: 41900, volume24h: 28_400_000_000, lastUpdated: Date.now() },
  'ETH/USDT': { pair: 'ETH/USDT', price: 2341.80, priceFormatted: '$2,341.80', change24h: 1.78, change24hFormatted: '+1.78%', high24h: 2390, low24h: 2268, volume24h: 12_100_000_000, lastUpdated: Date.now() },
  'SOL/USDT': { pair: 'SOL/USDT', price: 103.42, priceFormatted: '$103.42', change24h: 4.82, change24hFormatted: '+4.82%', high24h: 106.8, low24h: 97.1, volume24h: 3_800_000_000, lastUpdated: Date.now() },
};

/**
 * GET /market/pulse
 * Returns global market sentiment data.
 */
router.get('/pulse', (_req: Request, res: Response) => {
  res.json({ success: true, data: MOCK_PULSE });
});

/**
 * GET /market/price/:pair
 * Returns latest price tick for a trading pair.
 */
router.get('/price/:pair', (req: Request, res: Response) => {
  const pair = decodeURIComponent(req.params.pair as string);
  const tick = MOCK_TICKS[pair];

  if (!tick) {
    res.status(404).json({ success: false, error: `Pair ${pair} not found` });
    return;
  }

  res.json({ success: true, data: tick });
});

/**
 * GET /market/pairs
 * Returns all tracked pairs with last price.
 */
router.get('/pairs', (_req: Request, res: Response) => {
  res.json({ success: true, data: Object.values(MOCK_TICKS) });
});

/**
 * GET /market/candles/:pair
 * Returns OHLCV history (stubbed — will connect to Binance REST API).
 */
router.get('/candles/:pair', (req: Request, res: Response) => {
  const pair = decodeURIComponent(req.params.pair as string);
  const { timeframe = '1H', limit = '100' } = req.query;

  // TODO: Fetch from Binance REST API
  res.json({
    success: true,
    data: {
      pair,
      timeframe,
      candles: [],
      message: 'Binance REST integration pending — Phase 5',
    },
  });
});

export default router;
