/**
 * AlphaAI Backend — Binance Market Data Service
 * REST: Fetches historical OHLCV candle data for structure scanning.
 * WebSocket: Subscribes to real-time price streams for approach detection.
 */

const BINANCE_REST = 'https://api.binance.com/api/v3';
const BINANCE_WS   = 'wss://stream.binance.com:9443';

export interface BinanceCandle {
  openTime:  number;
  open:      number;
  high:      number;
  low:       number;
  close:     number;
  volume:    number;
  closeTime: number;
}

// ── REST: Historical Candles ─────────────────────────────────────────────

/**
 * Fetch OHLCV candle history for a pair and timeframe.
 * @param symbol  Binance symbol e.g. 'BTCUSDT'
 * @param interval '1h' | '4h' | '1d'
 * @param limit   Number of candles (max 1000)
 */
export async function fetchCandles(
  symbol: string,
  interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d',
  limit = 200
): Promise<BinanceCandle[]> {
  const url = `${BINANCE_REST}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance REST error: ${res.status} ${res.statusText}`);

  const raw: number[][] = await res.json();

  return raw.map((c) => ({
    openTime:  c[0],
    open:      parseFloat(c[1] as unknown as string),
    high:      parseFloat(c[2] as unknown as string),
    low:       parseFloat(c[3] as unknown as string),
    close:     parseFloat(c[4] as unknown as string),
    volume:    parseFloat(c[5] as unknown as string),
    closeTime: c[6],
  }));
}

/**
 * Get current best-bid/ask ticker price for a pair.
 */
export async function fetchTicker(symbol: string): Promise<{ price: number; bidPrice: number; askPrice: number }> {
  const url = `${BINANCE_REST}/ticker/bookTicker?symbol=${symbol}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance ticker error: ${res.status}`);
  const data = await res.json();
  return {
    price:    parseFloat(data.bidPrice),
    bidPrice: parseFloat(data.bidPrice),
    askPrice: parseFloat(data.askPrice),
  };
}

/**
 * Get 24h stats for a pair (price change, high, low, volume).
 */
export async function fetch24hStats(symbol: string): Promise<{
  symbol: string;
  lastPrice: number;
  priceChangePercent: number;
  highPrice: number;
  lowPrice: number;
  volume: number;
}> {
  const url = `${BINANCE_REST}/ticker/24hr?symbol=${symbol}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance 24h stats error: ${res.status}`);
  const data = await res.json();
  return {
    symbol: data.symbol,
    lastPrice:          parseFloat(data.lastPrice),
    priceChangePercent: parseFloat(data.priceChangePercent),
    highPrice:          parseFloat(data.highPrice),
    lowPrice:           parseFloat(data.lowPrice),
    volume:             parseFloat(data.quoteVolume),
  };
}

// ── WebSocket: Real-time Price Streams ───────────────────────────────────

type PriceCallback = (symbol: string, price: number, change24h: number) => void;

let wsConnections: Map<string, WebSocket> = new Map();

/**
 * Subscribe to real-time mini-ticker for a list of pairs.
 * Fires callback on every price update (~1s interval from Binance).
 */
export function subscribePriceStream(
  pairs: string[],
  onPrice: PriceCallback,
  onError?: (err: Event) => void
): () => void {
  // Binance mini-ticker stream (price, 24h change, vol)
  const streams = pairs
    .map((p) => p.replace('/', '').toLowerCase() + '@miniTicker')
    .join('/');

  const url = `${BINANCE_WS}/stream?streams=${streams}`;
  const ws = new WebSocket(url);

  ws.onopen = () => console.log(`📡 [BinanceWS] Connected — streaming ${pairs.length} pairs`);

  ws.onmessage = (event: MessageEvent) => {
    try {
      const msg = JSON.parse(event.data as string);
      const data = msg.data ?? msg;
      const symbol = (data.s as string).replace('USDT', '/USDT');
      const price = parseFloat(data.c);
      const change24h = parseFloat(data.P);
      onPrice(symbol, price, change24h);
    } catch { /* ignore malformed frames */ }
  };

  ws.onerror = (err) => {
    console.error('❌ [BinanceWS] Error:', err);
    onError?.(err);
  };

  ws.onclose = () => console.log('🔌 [BinanceWS] Disconnected');

  const key = streams;
  wsConnections.set(key, ws);

  // Return unsubscribe function
  return () => {
    ws.close();
    wsConnections.delete(key);
    console.log(`🔌 [BinanceWS] Unsubscribed from ${pairs.length} pairs`);
  };
}

/**
 * Subscribe to 5M candle close events for entry trigger monitoring.
 * Fires callback on every closed kline for the pair.
 */
export function subscribe5MCandles(
  symbol: string,
  onCandle: (candle: BinanceCandle, isClosed: boolean) => void
): () => void {
  const url = `${BINANCE_WS}/ws/${symbol.toLowerCase()}@kline_5m`;
  const ws = new WebSocket(url);

  ws.onopen = () => console.log(`🕯️  [BinanceWS] 5M candle stream: ${symbol}`);

  ws.onmessage = (event: MessageEvent) => {
    try {
      const msg = JSON.parse(event.data as string);
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
      const isClosed: boolean = k.x; // true when candle is complete
      onCandle(candle, isClosed);
    } catch { /* ignore malformed frames */ }
  };

  ws.onclose = () => console.log(`🔌 [BinanceWS] 5M stream closed: ${symbol}`);

  return () => ws.close();
}

/** Close all active WebSocket connections. */
export function closeAllStreams(): void {
  wsConnections.forEach((ws) => ws.close());
  wsConnections = new Map();
  console.log('🔌 [BinanceWS] All streams closed');
}
