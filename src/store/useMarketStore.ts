/**
 * AlphaAI — Market Store (Zustand)
 * Holds live market pulse data: BTC dominance, Fear & Greed, market cap, price ticks.
 */
import { create } from 'zustand';
import type { MarketPulse, PriceTick } from '@/src/types';
import { apiClient } from '@/src/services/apiClient';
import { API } from '@/src/constants/api';

interface MarketStore {
  // State
  pulse: MarketPulse | null;
  priceTicks: Record<string, PriceTick>; // keyed by pair e.g. 'BTC/USDT'
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;

  // Actions
  fetchPulse: () => Promise<void>;
  updatePriceTick: (tick: PriceTick) => void;
  startPriceStream: (pairs: string[]) => void;
  stopPriceStream: () => void;
  clearError: () => void;
}

const MOCK_PULSE: MarketPulse = {
  btcDominance: 54.2,
  fearGreedIndex: 72,
  fearGreedLabel: 'Greed',
  totalMarketCap: '$2.41T',
  totalMarketCapRaw: 2_410_000_000_000,
  volume24h: '$98.4B',
  lastUpdated: new Date().toISOString(),
};

const MOCK_TICKS: PriceTick[] = [
  { pair: 'BTC/USDT', price: 43218.50, priceFormatted: '$43,218.50', change24h: 2.14, change24hFormatted: '+2.14%', high24h: 43680, low24h: 41900, volume24h: 28_400_000_000, lastUpdated: Date.now() },
  { pair: 'ETH/USDT', price: 2341.80, priceFormatted: '$2,341.80', change24h: 1.78, change24hFormatted: '+1.78%', high24h: 2390, low24h: 2268, volume24h: 12_100_000_000, lastUpdated: Date.now() },
  { pair: 'SOL/USDT', price: 103.42, priceFormatted: '$103.42', change24h: 4.82, change24hFormatted: '+4.82%', high24h: 106.8, low24h: 97.1, volume24h: 3_800_000_000, lastUpdated: Date.now() },
  { pair: 'DOGE/USDT', price: 0.1441, priceFormatted: '$0.1441', change24h: -1.22, change24hFormatted: '-1.22%', high24h: 0.1510, low24h: 0.1402, volume24h: 1_200_000_000, lastUpdated: Date.now() },
  { pair: 'LINK/USDT', price: 14.28, priceFormatted: '$14.28', change24h: 3.41, change24hFormatted: '+3.41%', high24h: 14.80, low24h: 13.52, volume24h: 620_000_000, lastUpdated: Date.now() },
  { pair: 'AVAX/USDT', price: 36.71, priceFormatted: '$36.71', change24h: -0.88, change24hFormatted: '-0.88%', high24h: 37.90, low24h: 35.90, volume24h: 480_000_000, lastUpdated: Date.now() },
];

function buildMockTicks(): Record<string, PriceTick> {
  const map: Record<string, PriceTick> = {};
  MOCK_TICKS.forEach((t) => { map[t.pair] = t; });
  return map;
}

export const useMarketStore = create<MarketStore>((set, get) => ({
  // ─── Initial State ───────────────────────────────────────────────
  pulse: null,
  priceTicks: {},
  isLoading: false,
  error: null,
  lastUpdated: null,

  // ─── Actions ──────────────────────────────────────────────────────
  fetchPulse: async () => {
    set({ isLoading: true, error: null });
    try {
      const [pulseRes, pairsRes] = await Promise.all([
        apiClient.get<{ success: boolean; data: MarketPulse }>(API.MARKET.PULSE),
        apiClient.get<{ success: boolean; data: PriceTick[] }>(API.MARKET.PAIRS),
      ]);
      const ticks: Record<string, PriceTick> = {};
      (pairsRes.data ?? []).forEach((t) => { ticks[t.pair] = t; });
      set({
        pulse: pulseRes.data ?? MOCK_PULSE,
        priceTicks: Object.keys(ticks).length > 0 ? ticks : buildMockTicks(),
        isLoading: false,
        lastUpdated: new Date(),
      });
    } catch {
      console.warn('[MarketStore] Backend unavailable — using mock market data');
      const ticks: Record<string, PriceTick> = {};
      MOCK_TICKS.forEach((t) => { ticks[t.pair] = t; });
      set({ pulse: MOCK_PULSE, priceTicks: ticks, isLoading: false, lastUpdated: new Date() });
    }
  },

  updatePriceTick: (tick) =>
    set((state) => ({
      priceTicks: { ...state.priceTicks, [tick.pair]: tick },
      lastUpdated: new Date(),
    })),

  startPriceStream: (pairs) => {
    console.log('📡 [MarketStore] Starting price stream for:', pairs);
    // TODO: Connect via wsManager
  },

  stopPriceStream: () => {
    console.log('🔌 [MarketStore] Stopping price stream');
    // TODO: Disconnect via wsManager
  },

  clearError: () => set({ error: null }),
}));
