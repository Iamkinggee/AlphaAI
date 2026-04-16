/**
 * AlphaAI — Journal & Trade Type Definitions
 */

export type TradeResult = 'win' | 'loss' | 'pending' | 'expired' | 'breakeven';
export type TradeDirection = 'LONG' | 'SHORT';

export interface Trade {
  id: string;
  pair: string;
  direction: TradeDirection;
  entry: number;
  entryFormatted: string;
  exit?: number;
  exitFormatted?: string;
  stopLoss: number;
  takeProfit1?: number;
  takeProfit2?: number;
  takeProfit3?: number;
  pnlPercent?: number;
  pnlFormatted?: string;
  rrAchieved?: string;
  setup: string;          // e.g. 'CHOCH + Liq Sweep'
  timeframe: string;
  result: TradeResult;
  notes?: string;
  entryDate: string;      // ISO
  exitDate?: string;      // ISO
  signalId?: string;      // linked AlphaAI signal
  tags?: string[];
}

export interface JournalStats {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;        // 0–100
  avgRR: number;
  totalPnlPercent: number;
  bestTrade: number;
  worstTrade: number;
  streak: number;         // current win/loss streak
  streakType: 'win' | 'loss' | 'none';
}

export type JournalTab = 'all' | 'wins' | 'losses' | 'pending' | 'expired';
