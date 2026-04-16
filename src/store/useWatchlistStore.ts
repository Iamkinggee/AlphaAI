/**
 * AlphaAI — Watchlist Store (Zustand)
 * Phase 5: Wired to /api/watchlist — AsyncStorage as offline cache.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '@/src/services/apiClient';
import { API } from '@/src/constants/api';

const STORAGE_KEY = 'alphaai_watchlist';

export interface WatchlistItem {
  id: string;
  pair: string;
  baseAsset: string;
  quoteAsset: string;
  addedAt: string;
  alertAbove?: number;
  alertBelow?: number;
  notes?: string;
}

interface WatchlistStore {
  items: WatchlistItem[];
  isLoading: boolean;

  loadWatchlist: () => Promise<void>;
  addItem: (pair: string, baseAsset: string, quoteAsset: string) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  setAlert: (id: string, alertAbove?: number, alertBelow?: number) => Promise<void>;
  isPairWatched: (pair: string) => boolean;
}

const MOCK_WATCHLIST: WatchlistItem[] = [
  { id: 'wl_001', pair: 'BTC/USDT', baseAsset: 'BTC', quoteAsset: 'USDT', addedAt: '2026-04-01T00:00:00Z', alertAbove: 50000, alertBelow: 40000 },
  { id: 'wl_002', pair: 'ETH/USDT', baseAsset: 'ETH', quoteAsset: 'USDT', addedAt: '2026-04-01T00:00:00Z' },
  { id: 'wl_003', pair: 'SOL/USDT', baseAsset: 'SOL', quoteAsset: 'USDT', addedAt: '2026-04-05T00:00:00Z', alertBelow: 90 },
  { id: 'wl_004', pair: 'LINK/USDT', baseAsset: 'LINK', quoteAsset: 'USDT', addedAt: '2026-04-10T00:00:00Z' },
];

export const useWatchlistStore = create<WatchlistStore>((set, get) => ({
  items: [],
  isLoading: false,

  loadWatchlist: async () => {
    set({ isLoading: true });
    try {
      const res = await apiClient.get<{ success: boolean; data: WatchlistItem[] }>(API.WATCHLIST.LIST);
      const items = res.data ?? MOCK_WATCHLIST;
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      set({ items, isLoading: false });
    } catch {
      console.warn('[WatchlistStore] Backend unavailable — loading from cache');
      try {
        const cached = await AsyncStorage.getItem(STORAGE_KEY);
        set({ items: cached ? JSON.parse(cached) : MOCK_WATCHLIST, isLoading: false });
      } catch {
        set({ items: MOCK_WATCHLIST, isLoading: false });
      }
    }
  },

  addItem: async (pair, baseAsset, quoteAsset) => {
    if (get().isPairWatched(pair)) return;
    try {
      const res = await apiClient.post<{ success: boolean; data: WatchlistItem }>(
        API.WATCHLIST.ADD, { pair, baseAsset, quoteAsset }
      );
      const item = res.data ?? { id: `wl_${Date.now()}`, pair, baseAsset, quoteAsset, addedAt: new Date().toISOString() };
      const items = [...get().items, item];
      set({ items });
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      const item: WatchlistItem = { id: `wl_${Date.now()}`, pair, baseAsset, quoteAsset, addedAt: new Date().toISOString() };
      const items = [...get().items, item];
      set({ items });
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }
  },

  removeItem: async (id) => {
    try {
      await apiClient.delete(API.WATCHLIST.REMOVE(id));
    } catch {
      console.warn('[WatchlistStore] Delete failed — removing locally');
    }
    const items = get().items.filter((i) => i.id !== id);
    set({ items });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  },

  setAlert: async (id, alertAbove, alertBelow) => {
    try {
      await apiClient.patch(`/watchlist/${id}`, { alertAbove, alertBelow });
    } catch {
      console.warn('[WatchlistStore] Alert update failed — applying locally');
    }
    const items = get().items.map((i) => i.id === id ? { ...i, alertAbove, alertBelow } : i);
    set({ items });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  },

  isPairWatched: (pair) => get().items.some((i) => i.pair === pair),
}));
