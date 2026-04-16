/**
 * AlphaAI — Signal Store (Zustand)
 * Holds all signal state: approaching, active, history, filters
 */
import { create } from 'zustand';
import type { Signal, SignalFilters, SignalStatus } from '@/src/types';
import { defaultFilters } from '@/src/types';
import { MOCK_SIGNALS } from '@/src/data/mockSignals';
import { apiClient } from '@/src/services/apiClient';
import { API } from '@/src/constants/api';

interface SignalStore {
  // State
  signals: Signal[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  filters: SignalFilters;
  lastScanAt: Date | null;
  nextScanIn: number;           // seconds

  // Selectors (derived)
  approachingSignals: () => Signal[];
  activeSignals: () => Signal[];
  filteredSignals: () => Signal[];
  signalById: (id: string) => Signal | undefined;

  // Actions
  fetchSignals: () => Promise<void>;
  refreshSignals: () => Promise<void>;
  setFilters: (filters: Partial<SignalFilters>) => void;
  resetFilters: () => void;
  updateSignalStatus: (id: string, status: SignalStatus) => void;
  upsertSignal: (signal: Signal) => void;
  _setNextScanIn: (seconds: number) => void;
}

export const useSignalStore = create<SignalStore>((set, get) => ({
  // ─── Initial State ───────────────────────────────────────────────
  signals: [],
  isLoading: false,
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

  signalById: (id) => get().signals.find((s) => s.id === id),

  // ─── Actions ──────────────────────────────────────────────────────
  fetchSignals: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await apiClient.get<{ success: boolean; data: Signal[] }>(API.SIGNALS.LIST);
      set({
        signals: res.data ?? MOCK_SIGNALS,
        isLoading: false,
        lastScanAt: new Date(),
        nextScanIn: 60,
      });
    } catch {
      // Fallback to mock data if backend is unavailable (dev mode)
      console.warn('[SignalStore] Backend unavailable — using mock data');
      set({ signals: MOCK_SIGNALS, isLoading: false, lastScanAt: new Date(), nextScanIn: 60 });
    }
  },

  refreshSignals: async () => {
    set({ isRefreshing: true, error: null });
    try {
      const res = await apiClient.get<{ success: boolean; data: Signal[] }>(API.SIGNALS.LIST);
      set({
        signals: res.data ?? MOCK_SIGNALS,
        isRefreshing: false,
        lastScanAt: new Date(),
        nextScanIn: 60,
      });
    } catch {
      console.warn('[SignalStore] Refresh — backend unavailable, keeping current data');
      set({ isRefreshing: false, lastScanAt: new Date() });
    }
  },

  setFilters: (filters) =>
    set((state) => ({ filters: { ...state.filters, ...filters } })),

  resetFilters: () => set({ filters: defaultFilters }),

  updateSignalStatus: (id, status) =>
    set((state) => ({
      signals: state.signals.map((s) => (s.id === id ? { ...s, status } : s)),
    })),

  upsertSignal: (signal) =>
    set((state) => {
      const idx = state.signals.findIndex((s) => s.id === signal.id);
      if (idx === -1) return { signals: [signal, ...state.signals] };
      const updated = [...state.signals];
      updated[idx] = { ...updated[idx], ...signal };
      return { signals: updated };
    }),

  _setNextScanIn: (seconds) => set({ nextScanIn: seconds }),
}));

