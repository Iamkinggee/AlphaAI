/**
 * AlphaAI — Journal Store (Zustand)
 * Manages trade journal entries and computed performance stats.
 * Phase 5: Wired to /api/journal — AsyncStorage as offline cache.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Trade, JournalStats, JournalTab } from '@/src/types';
import { apiClient } from '@/src/services/apiClient';
import { API } from '@/src/constants/api';

const STORAGE_KEY = 'alphaai_journal';

interface JournalStore {
  // State
  trades: Trade[];
  stats: JournalStats;
  activeTab: JournalTab;
  isLoading: boolean;
  error: string | null;

  // Selectors
  filteredTrades: () => Trade[];

  // Actions
  loadTrades: () => Promise<void>;
  addTrade: (trade: Omit<Trade, 'id'>) => Promise<void>;
  updateTrade: (id: string, updates: Partial<Trade>) => Promise<void>;
  deleteTrade: (id: string) => Promise<void>;
  setActiveTab: (tab: JournalTab) => void;
}

const MOCK_TRADES: Trade[] = [
  { id: 'tr_001', pair: 'SOL/USDT', direction: 'LONG', entry: 98.40, entryFormatted: '$98.40', exit: 104.60, exitFormatted: '$104.60', stopLoss: 95.80, pnlPercent: 6.3, pnlFormatted: '+6.3%', rrAchieved: '1:2.8', setup: 'CHOCH + Liq Sweep', timeframe: '4H', result: 'win', entryDate: '2026-04-14T08:00:00Z', exitDate: '2026-04-14T14:00:00Z', signalId: 'sig_003' },
  { id: 'tr_002', pair: 'BTC/USDT', direction: 'LONG', entry: 42280, entryFormatted: '$42,280', exit: 41900, exitFormatted: '$41,900', stopLoss: 41774, pnlPercent: -0.9, pnlFormatted: '-0.9%', rrAchieved: '-', setup: '4H OB + FVG', timeframe: '4H', result: 'loss', entryDate: '2026-04-13T10:00:00Z', exitDate: '2026-04-13T16:00:00Z', signalId: 'sig_001' },
  { id: 'tr_003', pair: 'ETH/USDT', direction: 'SHORT', entry: 2480, entryFormatted: '$2,480', exit: 2380, exitFormatted: '$2,380', stopLoss: 2540, pnlPercent: 4.0, pnlFormatted: '+4.0%', rrAchieved: '1:3.2', setup: 'HTF Supply', timeframe: '1H', result: 'win', entryDate: '2026-04-13T14:00:00Z', exitDate: '2026-04-13T20:00:00Z' },
  { id: 'tr_004', pair: 'DOGE/USDT', direction: 'SHORT', entry: 0.1482, entryFormatted: '$0.1482', stopLoss: 0.1514, pnlPercent: 2.1, pnlFormatted: '+2.1%', rrAchieved: '1:2.1', setup: 'OB + Supply', timeframe: '1H', result: 'pending', entryDate: '2026-04-14T09:00:00Z', signalId: 'sig_004' },
  { id: 'tr_005', pair: 'LINK/USDT', direction: 'LONG', entry: 13.80, entryFormatted: '$13.80', exit: 15.20, exitFormatted: '$15.20', stopLoss: 13.20, pnlPercent: 10.1, pnlFormatted: '+10.1%', rrAchieved: '1:4.2', setup: '4H Demand + FVG', timeframe: '4H', result: 'win', entryDate: '2026-04-12T08:00:00Z', exitDate: '2026-04-12T20:00:00Z' },
  { id: 'tr_006', pair: 'AVAX/USDT', direction: 'SHORT', entry: 38.90, entryFormatted: '$38.90', exit: 36.20, exitFormatted: '$36.20', stopLoss: 39.80, pnlPercent: 6.9, pnlFormatted: '+6.9%', rrAchieved: '1:3.0', setup: '1D HTF Supply', timeframe: '1D', result: 'win', entryDate: '2026-04-11T00:00:00Z', exitDate: '2026-04-12T00:00:00Z' },
];

function computeStats(trades: Trade[]): JournalStats {
  const closed = trades.filter((t) => t.result === 'win' || t.result === 'loss' || t.result === 'breakeven');
  const wins = closed.filter((t) => t.result === 'win');
  const losses = closed.filter((t) => t.result === 'loss');
  const totalPnl = closed.reduce((sum, t) => sum + (t.pnlPercent ?? 0), 0);
  const avgRR = wins.length
    ? wins.reduce((sum, t) => {
        const rr = parseFloat(t.rrAchieved?.replace('1:', '') ?? '0');
        return sum + (isNaN(rr) ? 0 : rr);
      }, 0) / wins.length
    : 0;
  const pnls = closed.map((t) => t.pnlPercent ?? 0);

  let streak = 0;
  let streakType: 'win' | 'loss' | 'none' = 'none';
  for (let i = closed.length - 1; i >= 0; i--) {
    const r = closed[i].result;
    if (i === closed.length - 1) { streakType = r === 'win' ? 'win' : 'loss'; streak = 1; }
    else if (r === streakType) { streak++; }
    else break;
  }

  return {
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: closed.length ? Math.round((wins.length / closed.length) * 100) : 0,
    avgRR: Math.round(avgRR * 10) / 10,
    totalPnlPercent: Math.round(totalPnl * 10) / 10,
    bestTrade: pnls.length ? Math.max(...pnls) : 0,
    worstTrade: pnls.length ? Math.min(...pnls) : 0,
    streak,
    streakType,
  };
}

export const useJournalStore = create<JournalStore>((set, get) => ({
  trades: [],
  stats: computeStats([]),
  activeTab: 'all',
  isLoading: false,
  error: null,

  filteredTrades: () => {
    const { trades, activeTab } = get();
    if (activeTab === 'all') return trades;
    return trades.filter((t) => t.result === activeTab);
  },

  loadTrades: async () => {
    set({ isLoading: true });
    try {
      // Try real API first
      const res = await apiClient.get<{ success: boolean; data: Trade[] }>(API.JOURNAL.LIST);
      const trades = res.data ?? MOCK_TRADES;
      // Cache to AsyncStorage for offline use
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
      set({ trades, stats: computeStats(trades), isLoading: false });
    } catch {
      console.warn('[JournalStore] Backend unavailable — loading from cache');
      try {
        const cached = await AsyncStorage.getItem(STORAGE_KEY);
        const trades: Trade[] = cached ? JSON.parse(cached) : MOCK_TRADES;
        set({ trades, stats: computeStats(trades), isLoading: false });
      } catch {
        set({ trades: MOCK_TRADES, stats: computeStats(MOCK_TRADES), isLoading: false });
      }
    }
  },

  addTrade: async (tradeData) => {
    try {
      const res = await apiClient.post<{ success: boolean; data: Trade }>(API.JOURNAL.CREATE, tradeData);
      const newTrade: Trade = res.data ?? { ...tradeData, id: `tr_${Date.now()}` };
      const trades = [newTrade, ...get().trades];
      set({ trades, stats: computeStats(trades) });
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
    } catch {
      // Optimistic local write
      const newTrade: Trade = { ...tradeData, id: `tr_${Date.now()}` };
      const trades = [newTrade, ...get().trades];
      set({ trades, stats: computeStats(trades) });
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
    }
  },

  updateTrade: async (id, updates) => {
    try {
      await apiClient.patch(API.JOURNAL.DETAIL(id), updates);
    } catch {
      console.warn('[JournalStore] Patch failed — applying locally');
    }
    const trades = get().trades.map((t) => (t.id === id ? { ...t, ...updates } : t));
    set({ trades, stats: computeStats(trades) });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
  },

  deleteTrade: async (id) => {
    try {
      await apiClient.delete(API.JOURNAL.DETAIL(id));
    } catch {
      console.warn('[JournalStore] Delete failed — removing locally');
    }
    const trades = get().trades.filter((t) => t.id !== id);
    set({ trades, stats: computeStats(trades) });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
  },

  setActiveTab: (tab) => set({ activeTab: tab }),
}));
