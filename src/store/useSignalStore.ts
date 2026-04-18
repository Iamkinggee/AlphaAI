/**
 * AlphaAI — Signal Store (Zustand)
 * Holds all signal state. No mock fallbacks — empty state if backend unreachable.
 *
 * Separates active/in-play signals from resolved/history signals.
 * The default fetch only retrieves active signals (approaching, active, TP1_hit, TP2_hit).
 * History signals (TP3_hit, stopped, expired) are fetched separately on demand.
 */
import { create } from 'zustand';
import type { Signal, SignalFilters, SignalStatus } from '@/src/types';
import { defaultFilters } from '@/src/types';
import { apiClient } from '@/src/services/apiClient';
import { API } from '@/src/constants/api';

// Statuses considered "resolved" / terminal — these belong in history
const RESOLVED_STATUSES: SignalStatus[] = ['TP3_hit', 'stopped', 'expired'];

interface SignalStore {
  // State
  signals: Signal[];          // Active / in-play signals only
  historySignals: Signal[];   // Resolved / completed signals
  isLoading: boolean;
  isLoadingHistory: boolean;
  isRefreshing: boolean;
  error: string | null;
  filters: SignalFilters;
  lastScanAt: Date | null;
  nextScanIn: number;

  // Selectors (derived)
  approachingSignals: () => Signal[];
  activeSignals: () => Signal[];
  filteredSignals: () => Signal[];
  signalById: (id: string) => Signal | undefined;

  // Actions
  fetchSignals: () => Promise<void>;
  fetchHistory: () => Promise<void>;
  refreshSignals: () => Promise<void>;
  setFilters: (filters: Partial<SignalFilters>) => void;
  resetFilters: () => void;
  updateSignalStatus: (id: string, status: SignalStatus) => void;
  upsertSignal: (signal: Signal) => void;
  deleteHistorySignal: (id: string) => void;
  clearHistory: () => Promise<void>;
  _setNextScanIn: (seconds: number) => void;
}

export const useSignalStore = create<SignalStore>((set, get) => ({
  // ─── Initial State ───────────────────────────────────────────────
  signals: [],
  historySignals: [],
  isLoading: false,
  isLoadingHistory: false,
  isRefreshing: false,
  error: null,
  filters: defaultFilters,
  lastScanAt: null,
  nextScanIn: 60,

  // ─── Selectors ────────────────────────────────────────────────────
  approachingSignals: () =>
    get().signals.filter((s) => s.status === 'approaching'),

  activeSignals: () =>
    get().signals.filter(
      (s) => s.status === 'active' || s.status === 'TP1_hit' || s.status === 'TP2_hit'
    ),

  filteredSignals: () => {
    const { signals, filters } = get();
    return signals.filter((s) => {
      if (filters.status !== 'all' && s.status !== filters.status) return false;
      if (filters.direction !== 'all' && s.direction !== filters.direction) return false;
      if (filters.timeframe !== 'all' && s.timeframe !== filters.timeframe) return false;
      if (s.score < filters.minScore) return false;
      return true;
    });
  },

  signalById: (id) => {
    // Search both active and history
    return get().signals.find((s) => s.id === id)
      ?? get().historySignals.find((s) => s.id === id);
  },

  // ─── Actions ──────────────────────────────────────────────────────
  fetchSignals: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await apiClient.get<{ success: boolean; data: any[] }>(API.SIGNALS.LIST);
      const rawData = res.data ?? [];
      const data = rawData.map(normaliseSignal);
      
      console.log(`📡 [SignalStore] Loaded ${data.length} signals (Cached: ${!!(res as any).cached})`);
      set({
        signals: data,
        isLoading: false,
        lastScanAt: new Date(),
        nextScanIn: 60,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch signals';
      console.error('[SignalStore] fetchSignals error:', message);
      set({ isLoading: false, error: message, lastScanAt: new Date() });
    }
  },

  fetchHistory: async () => {
    set({ isLoadingHistory: true });
    try {
      const res = await apiClient.get<{ success: boolean; data: any[] }>(API.SIGNALS.HISTORY);
      const rawData = res.data ?? [];
      const data = rawData.map(normaliseSignal);
      set({ historySignals: data, isLoadingHistory: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch history';
      console.error('[SignalStore] fetchHistory error:', message);
      set({ isLoadingHistory: false });
    }
  },

  refreshSignals: async () => {
    set({ isRefreshing: true, error: null });
    try {
      const res = await apiClient.get<{ success: boolean; data: any[] }>(API.SIGNALS.LIST);
      const rawData = res.data ?? [];
      const data = rawData.map(normaliseSignal);
      set({
        signals: data,
        isRefreshing: false,
        lastScanAt: new Date(),
        nextScanIn: 60,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Refresh failed';
      console.error('[SignalStore] refreshSignals error:', message);
      set({ isRefreshing: false, error: message, lastScanAt: new Date() });
    }
  },

  setFilters: (filters) =>
    set((state) => ({ filters: { ...state.filters, ...filters } })),

  resetFilters: () => set({ filters: defaultFilters }),

  updateSignalStatus: (id, status) => {
    // If the status is now resolved, move signal from active list to history
    if (RESOLVED_STATUSES.includes(status)) {
      set((state) => {
        const signal = state.signals.find((s) => s.id === id);
        if (!signal) return state;
        const resolvedSignal = { ...signal, status };
        return {
          signals: state.signals.filter((s) => s.id !== id),
          historySignals: [resolvedSignal, ...state.historySignals],
        };
      });
    } else {
      set((state) => ({
        signals: state.signals.map((s) => (s.id === id ? { ...s, status } : s)),
      }));
    }
  },

  upsertSignal: (signal) =>
    set((state) => {
      // If the incoming signal has a resolved status, put it in history
      if (RESOLVED_STATUSES.includes(signal.status)) {
        // Remove from active list if present
        const filteredActive = state.signals.filter((s) => s.id !== signal.id);
        // Upsert into history
        const histIdx = state.historySignals.findIndex((s) => s.id === signal.id);
        if (histIdx === -1) {
          return {
            signals: filteredActive,
            historySignals: [signal, ...state.historySignals],
          };
        }
        const updatedHist = [...state.historySignals];
        updatedHist[histIdx] = { ...updatedHist[histIdx], ...signal };
        return { signals: filteredActive, historySignals: updatedHist };
      }

      // Active signal upsert
      const idx = state.signals.findIndex((s) => s.id === signal.id);
      if (idx === -1) return { signals: [signal, ...state.signals] };
      const updated = [...state.signals];
      updated[idx] = { ...updated[idx], ...signal };
      return { signals: updated };
    }),

  _setNextScanIn: (seconds) => set({ nextScanIn: seconds }),

  deleteHistorySignal: (id) =>
    set((state) => ({
      historySignals: state.historySignals.filter((s) => s.id !== id),
    })),

  clearHistory: async () => {
    set({ isLoadingHistory: true });
    try {
      await apiClient.delete(API.SIGNALS.HISTORY);
      set({ historySignals: [], isLoadingHistory: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Clear history failed';
      console.error('[SignalStore] clearHistory error:', message);
      set({ isLoadingHistory: false });
      throw err;
    }
  },
}));

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Bridges the gap between SnakeCase DB rows and CamelCase Signal types.
 * Populates formatted strings and derived TP objects for the UI.
 */
function normaliseSignal(s: any): Signal {
  const entryLow = s.entry_low ?? s.entry_zone_low ?? 0;
  const entryHigh = s.entry_high ?? s.entry_zone_high ?? 0;
  const stopLoss = s.stop_loss ?? 0;
  const tp1 = s.take_profit1 ?? s.take_profit_1 ?? 0;
  const tp2 = s.take_profit2 ?? s.take_profit_2 ?? 0;
  const tp3 = s.take_profit3 ?? s.take_profit_3 ?? 0;

  const format = (val: number) => {
    if (val >= 10000) return val.toLocaleString('en-US', { maximumFractionDigits: 0 });
    if (val >= 1000) return val.toFixed(1);
    if (val >= 1) return val.toFixed(3);
    return val.toFixed(5);
  };

  const risk = Math.abs((entryLow + entryHigh) / 2 - stopLoss);
  const getRr = (tp: number) => (risk > 0 ? (Math.abs(tp - (entryLow + entryHigh) / 2) / risk).toFixed(1) : '0.0');

  return {
    id: s.id,
    pair: s.pair,
    baseAsset: s.pair.split('/')[0],
    quoteAsset: s.pair.split('/')[1] || 'USDT',
    direction: s.direction,
    timeframe: s.timeframe,
    status: s.status,
    score: s.score,
    setupType: s.setup_type || 'SMC Setup Detected',
    entryZone: {
      low: entryLow,
      high: entryHigh,
      lowFormatted: format(entryLow),
      highFormatted: format(entryHigh),
    },
    stopLoss: stopLoss,
    stopLossFormatted: format(stopLoss),
    takeProfit1: { price: tp1, priceFormatted: format(tp1), rr: getRr(tp1), hit: s.status === 'TP1_hit' || s.status === 'TP2_hit' || s.status === 'TP3_hit' },
    takeProfit2: { price: tp2, priceFormatted: format(tp2), rr: getRr(tp2), hit: s.status === 'TP2_hit' || s.status === 'TP3_hit' },
    takeProfit3: { price: tp3, priceFormatted: format(tp3), rr: getRr(tp3), hit: s.status === 'TP3_hit' },
    confluence: s.confluence_factors || [],
    distance: s.distance_pct || 0,
    distanceFormatted: `${(s.distance_pct || 0).toFixed(2)}%`,
    createdAt: s.created_at,
    expiresAt: s.expires_at,
    timeElapsed: s.created_at ? 'Fresh' : 'Unknown', // Could use date-fns here if needed
    expiresIn: '48h',
  };
}

