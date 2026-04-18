/**
 * AlphaAI Backend — Binance Market Data Service
 * REST: Fetches historical OHLCV candle data for structure scanning.
 * WebSocket: Subscribes to real-time price streams for approach detection.
 * 
 * Supports both Spot and USDⓈ-M Futures (Perpetuals).
 */
import WebSocket from 'ws';

// ── Endpoints ─────────────────────────────────────────────────────────────
const BINANCE_REST   = 'https://api.binance.com/api/v3';
const BINANCE_WS     = 'wss://stream.binance.com:9443';

const F_BINANCE_REST = 'https://fapi.binance.com/fapi/v1';
const F_BINANCE_WS   = 'wss://fstream.binance.com';

export interface BinanceCandle {
  openTime:  number;
  open:      number;
  high:      number;
  low:       number;
  close:     number;
  volume:    number;
  closeTime: number;
}

export type MarketType = 'SPOT' | 'FUTURES';

// ── REST: Historical Candles ─────────────────────────────────────────────

async function fetchWithTimeout(url: string, timeoutMs: number = 8000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err: any) {
    clearTimeout(id);
    if (err.name === 'AbortError') {
      throw new Error(`Fetch timed out after ${timeoutMs}ms: ${url}`);
    }
    throw err;
  }
}

/**
 * Fetch OHLCV candle history for a pair and timeframe.
 */
export async function fetchCandles(
  symbol: string,
  interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d',
  limit = 200,
  market: MarketType = 'SPOT'
): Promise<BinanceCandle[]> {
  const base = market === 'FUTURES' ? F_BINANCE_REST : BINANCE_REST;
  const url = `${base}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;

  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`Binance ${market} REST error: ${res.status} ${res.statusText}`);

  const raw: any[][] = await res.json();

  return raw.map((c) => ({
    openTime:  c[0],
    open:      parseFloat(c[1]),
    high:      parseFloat(c[2]),
    low:       parseFloat(c[3]),
    close:     parseFloat(c[4]),
    volume:    parseFloat(c[5]),
    closeTime: c[6],
  }));
}

/**
 * Fetch top USDT perpetual pairs by 24h volume from Binance Futures.
 */
export async function fetchTopFuturesPairs(limit = 80): Promise<{ pair: string; symbol: string }[]> {
  const url = `${F_BINANCE_REST}/ticker/24hr`;
  try {
    const res = await fetchWithTimeout(url, 10000); // 10s timeout for massive universe payload
    if (!res.ok) throw new Error(`Binance Futures ticker error: ${res.status} ${res.statusText}`);
    
    const data = await res.json();
    if (!Array.isArray(data)) {
      console.error('❌ [BinanceService] Expected array from ticker/24hr, got:', typeof data);
      return [];
    }
  
    console.log(`📡 [BinanceService] Received ${data.length} tickers from Futures API`);

    // Filter for USDT pairs, sort by quoteVolume (USDT volume)
    const pairs = data
      .filter(t => {
        const isUsdt = t.symbol && t.symbol.endsWith('USDT');
        // Keep only standard Binance futures symbols (A-Z/0-9 + USDT)
        // to avoid malformed or non-standard market entries from noisy feeds.
        const isStandardSymbol = /^[A-Z0-9]+USDT$/.test(t.symbol ?? '');
        const hasVol = parseFloat(t.quoteVolume || '0') > 0;
        return isUsdt && isStandardSymbol && hasVol;
      })
      .sort((a, b) => {
        const volA = parseFloat(a.quoteVolume || '0');
        const volB = parseFloat(b.quoteVolume || '0');
        return volB - volA;
      })
      .slice(0, limit)
      .map(t => ({
        symbol: t.symbol,
        pair:   t.symbol.replace('USDT', '/USDT')
      }));

    console.log(`✅ [BinanceService] Filtered ${pairs.length} USDT Perpetual pairs (Target: ${limit})`);
    return pairs;
  } catch (err: any) {
    console.error('❌ [BinanceService] fetchTopFuturesPairs failed:', err.message);
    throw err;
  }
}

/**
 * Get current price for a futures pair.
 */
export async function fetchFuturesTicker(symbol: string): Promise<{ price: number }> {
  const url = `${F_BINANCE_REST}/ticker/price?symbol=${symbol}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`Binance Futures price error: ${res.status}`);
  const data = await res.json();
  return { price: parseFloat(data.price) };
}

// ── WebSocket: Real-time Price Streams ───────────────────────────────────

type PriceCallback = (symbol: string, price: number, change24h?: number) => void;

let wsConnections: Map<string, InstanceType<typeof WebSocket>> = new Map();

/**
 * Subscribe to real-time price streams for a list of pairs.
 * Dynamically switches between Spot and Futures WS based on requirement.
 */
export function subscribePriceStream(
  pairs: string[],
  onPrice: PriceCallback,
  market: MarketType = 'SPOT'
): () => void {
  const wsBase = market === 'FUTURES' ? F_BINANCE_WS : BINANCE_WS;
  const suffix = market === 'FUTURES' ? '@markPrice' : '@miniTicker';
  
  const streams = pairs
    .map((p) => p.replace('/', '').toLowerCase() + suffix)
    .join('/');

  const url = `${wsBase}/stream?streams=${streams}`;
  const ws = new WebSocket(url) as InstanceType<typeof WebSocket>;

  ws.on('open', () => console.log(`📡 [BinanceWS] ${market} Connected — streaming ${pairs.length} pairs`));

  ws.on('message', (event: Buffer | string) => {
    try {
      const msg = JSON.parse(event.toString());
      const data = msg.data ?? msg;
      
      let symbol: string;
      let price: number;
      
      if (market === 'FUTURES') {
        symbol = (data.s as string).replace('USDT', '/USDT');
        price  = parseFloat(data.p); // Mark price
      } else {
        symbol = (data.s as string).replace('USDT', '/USDT');
        price  = parseFloat(data.c); // Last price
      }
      
      onPrice(symbol, price);
    } catch { /* ignore */ }
  });

  ws.on('error', (err) => console.error(`❌ [BinanceWS] ${market} Error:`, err));
  ws.on('close', () => console.log(`🔌 [BinanceWS] ${market} Disconnected`));

  wsConnections.set(streams, ws);
  return () => {
    ws.close();
    wsConnections.delete(streams);
  };
}

/**
 * Get 24h stats for a SINGLE pair (Futures).
 * Used for /market/price/:pair individual lookups.
 */
export async function fetch24hStats(symbol: string): Promise<{
  symbol: string;
  lastPrice: number;
  priceChangePercent: number;
  highPrice: number;
  lowPrice: number;
  volume: number;
}> {
  // Use Futures endpoint — app monitors perpetuals, not spot
  const url = `${F_BINANCE_REST}/ticker/24hr?symbol=${symbol}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`Binance Futures 24h stats error: ${res.status}`);
  const data = await res.json() as any;
  return {
    symbol:             data.symbol,
    lastPrice:          parseFloat(data.lastPrice),
    priceChangePercent: parseFloat(data.priceChangePercent),
    highPrice:          parseFloat(data.highPrice),
    lowPrice:           parseFloat(data.lowPrice),
    volume:             parseFloat(data.quoteVolume),
  };
}

/**
 * Fetch 24h stats for ALL Futures symbols in ONE API call.
 * Returns a map of symbol → stats for O(1) lookup.
 * This is the fast path used by GET /market/pairs.
 * ~300ms vs ~11,000ms for 80 individual calls.
 */
export async function fetchBulk24hStats(symbols: string[]): Promise<
  Map<string, {
    lastPrice: number;
    priceChangePercent: number;
    highPrice: number;
    lowPrice: number;
    volume: number;
  }>
> {
  const symbolSet = new Set(symbols.map(s => s.toUpperCase()));
  // No symbol param = returns ALL futures tickers in one shot
  const url = `${F_BINANCE_REST}/ticker/24hr`;
  const res = await fetchWithTimeout(url, 10000); // 10s limit
  if (!res.ok) throw new Error(`Binance Futures bulk ticker error: ${res.status}`);
  const data = await res.json() as any[];

  const result = new Map<string, ReturnType<typeof fetchBulk24hStats> extends Promise<Map<string, infer V>> ? V : never>();
  for (const t of data) {
    if (!symbolSet.has(t.symbol)) continue;
    result.set(t.symbol, {
      lastPrice:          parseFloat(t.lastPrice),
      priceChangePercent: parseFloat(t.priceChangePercent),
      highPrice:          parseFloat(t.highPrice),
      lowPrice:           parseFloat(t.lowPrice),
      volume:             parseFloat(t.quoteVolume),
    });
  }
  return result;
}

/**
 * Subscribe to 5M candle close events.
 */
export function subscribe5MCandles(
  symbol: string,
  onCandle: (candle: BinanceCandle, isClosed: boolean) => void,
  market: MarketType = 'SPOT'
): () => void {
  const wsBase = market === 'FUTURES' ? F_BINANCE_WS : BINANCE_WS;
  const url = `${wsBase}/ws/${symbol.toLowerCase()}@kline_5m`;
  const ws = new WebSocket(url) as InstanceType<typeof WebSocket>;

  ws.on('open', () => console.log(`🕯️  [BinanceWS] 5M ${market} stream: ${symbol}`));

  ws.on('message', (event: Buffer | string) => {
    try {
      const msg = JSON.parse(event.toString());
      const k = msg.k;
      const candle: BinanceCandle = {
        openTime:  k.t,
        open:      parseFloat(k.o),
        high:      parseFloat(k.h),
        low:       parseFloat(k.l),
        close:     parseFloat(k.c),
        volume:    parseFloat(k.v),
        closeTime: k.T,
      };
      onCandle(candle, k.x);
    } catch { /* ignore */ }
  });

  ws.on('close', () => console.log(`🔌 [BinanceWS] 5M ${market} closed: ${symbol}`));

  return () => ws.close();
}
