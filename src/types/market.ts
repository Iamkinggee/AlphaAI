/**
 * AlphaAI — Market Data Type Definitions
 */

export interface MarketPulse {
  btcDominance: number;       // e.g. 54.2
  fearGreedIndex: number;     // 0–100
  fearGreedLabel: string;     // 'Extreme Fear' | 'Fear' | 'Neutral' | 'Greed' | 'Extreme Greed'
  totalMarketCap: string;     // e.g. '$2.41T'
  totalMarketCapRaw: number;  // in USD
  volume24h: string;          // e.g. '$98.4B'
  lastUpdated: string;        // ISO timestamp
}

export interface CandleData {
  time: number;   // Unix ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PriceTick {
  pair: string;
  price: number;
  priceFormatted: string;
  change24h: number;        // percentage
  change24hFormatted: string;
  high24h: number;
  low24h: number;
  volume24h: number;
  lastUpdated: number;      // Unix ms
}

export interface TradingPair {
  symbol: string;           // e.g. 'BTCUSDT'
  pair: string;             // e.g. 'BTC/USDT'
  baseAsset: string;        // e.g. 'BTC'
  quoteAsset: string;       // e.g. 'USDT'
  pricePrecision: number;
  tickSize: number;
  isActive: boolean;
}
