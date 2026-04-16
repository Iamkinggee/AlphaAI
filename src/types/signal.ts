/**
 * AlphaAI — Signal Type Definitions
 */

export type SignalStatus =
  | 'approaching'   // Price within 0.5–1.5% of zone
  | 'active'        // Price entered zone, trade live
  | 'TP1_hit'       // First take-profit reached
  | 'TP2_hit'       // Second take-profit reached
  | 'TP3_hit'       // All targets hit
  | 'stopped'       // Stop loss triggered
  | 'expired'       // Timed out before entry
  | 'pending';      // Detected, not yet approaching

export type SignalDirection = 'LONG' | 'SHORT';
export type Timeframe = '5M' | '15M' | '1H' | '4H' | '1D' | '1W';

export interface ConfluenceFactor {
  factor: string;
  points: number;
  active: boolean;
}

export interface TakeProfit {
  price: number;
  priceFormatted: string;
  rr: string;
  hit: boolean;
}

export interface Signal {
  id: string;
  pair: string;           // e.g. 'BTC/USDT'
  baseAsset: string;      // e.g. 'BTC'
  quoteAsset: string;     // e.g. 'USDT'
  direction: SignalDirection;
  timeframe: Timeframe;
  status: SignalStatus;
  score: number;          // 0–100 confluence score
  setupType: string;      // human-readable description

  // Price levels
  entryZone: { low: number; high: number; lowFormatted: string; highFormatted: string };
  stopLoss: number;
  stopLossFormatted: string;
  takeProfit1: TakeProfit;
  takeProfit2: TakeProfit;
  takeProfit3: TakeProfit;

  // Confluence
  confluence: ConfluenceFactor[];

  // Metadata
  distance: number;         // % away from zone
  distanceFormatted: string;
  createdAt: string;        // ISO date string
  expiresAt: string;        // ISO date string
  timeElapsed: string;      // human-readable "3 minutes ago"
  expiresIn: string;        // human-readable "47h 57m"

  // Optional live PnL (active trades)
  currentPnl?: number;
  currentPnlFormatted?: string;
}

export interface SignalFilters {
  status: SignalStatus | 'all';
  direction: SignalDirection | 'all';
  timeframe: Timeframe | 'all';
  minScore: number;
}

export const defaultFilters: SignalFilters = {
  status: 'all',
  direction: 'all',
  timeframe: 'all',
  minScore: 0,
};
