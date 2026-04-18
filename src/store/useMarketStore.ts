/**
 * AlphaAI — Market Store (Zustand)
 * Holds live market pulse + price tick data for all 80 monitored pairs.
 * No mock fallbacks — null state if backend unreachable.
 */
import { create } from 'zustand';
import type { MarketPulse, PriceTick } from '@/src/types';
import { apiClient } from '@/src/services/apiClient';
import { API } from '@/src/constants/api';

interface MarketStore {
  // State
  pulse:       MarketPulse | null;
  priceTicks:  Record<string, PriceTick>;
  isLoading:   boolean;
  error:       string | null;
  lastUpdated: Date | null;
  totalPairs:  number;

  // Actions
  fetchPulse:       () => Promise<void>;
  updatePriceTick:  (tick: PriceTick) => void;
  startPriceStream: (pairs: string[]) => void;
  stopPriceStream:  () => void;
  clearError:       () => void;
}

export const useMarketStore = create<MarketStore>((set, get) => ({
  // ─── Initial State ───────────────────────────────────────────────
  pulse:       null,
  priceTicks:  {},
  isLoading:   false,
  error:       null,
  lastUpdated: null,
  totalPairs:  0,

  // ─── Actions ──────────────────────────────────────────────────────

  /**
   * Fetches both the market pulse and the full pair universe (top 80).
   * Stores ALL pairs as price ticks, keyed by pair string (e.g. "BTC/USDT").
   */
  fetchPulse: async () => {
    set({ isLoading: true, error: null });
    try {
      const [pulseRes, pairsRes] = await Promise.all([
        apiClient.get<{ success: boolean; data: MarketPulse }>(API.MARKET.PULSE),
        apiClient.get<{ success: boolean; data: PriceTick[]; total?: number }>(API.MARKET.PAIRS),
      ]);

      const ticks: Record<string, PriceTick> = {};
      (pairsRes.data ?? []).forEach((t) => {
        ticks[t.pair] = t;
      });

      set({
        pulse:       pulseRes.data ?? null,
        priceTicks:  ticks,
        totalPairs:  pairsRes.total ?? (pairsRes.data ?? []).length,
        isLoading:   false,
        lastUpdated: new Date(),
      });

      console.log(`📡 [MarketStore] Loaded ${Object.keys(ticks).length} pairs`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch market data';
      console.error('[MarketStore] fetchPulse error:', message);
      set({ isLoading: false, error: message, lastUpdated: new Date() });
    }
  },

  /**
   * Updates or inserts a single price tick.
   * Works for ANY pair — prices can arrive for pairs not yet in the initial
   * REST payload (e.g. new pairs added mid-session via WS).
   */
  updatePriceTick: (tick) =>
    set((state) => {
      // If we already have a base record for this pair, merge — preserve static fields
      const existing = state.priceTicks[tick.pair];
      const merged: PriceTick = existing
        ? {
            ...existing,
            price:              tick.price,
            priceFormatted:     tick.priceFormatted,
            change24h:          tick.change24h ?? existing.change24h,
            change24hFormatted: tick.change24hFormatted ?? existing.change24hFormatted,
            lastUpdated:        tick.lastUpdated ?? Date.now(),
          }
        : tick;

      return {
        priceTicks:  { ...state.priceTicks, [tick.pair]: merged },
        lastUpdated: new Date(),
      };
    }),

  startPriceStream: (pairs) => {
    console.log(`📡 [MarketStore] Price stream active for ${pairs.length} pairs`);
    // Wired via wsManager in useMarket hook
  },

  stopPriceStream: () => {
    console.log('🔌 [MarketStore] Stopping price stream');
  },

  clearError: () => set({ error: null }),
}));
