import { useEffect, useRef } from 'react';
import { useMarketStore } from '@/src/store/useMarketStore';
import { wsManager } from '@/src/services/wsManager';

/**
 * AlphaAI — useMarket Hook
 * Real-time price updates, market sentiment, and WS subscription management.
 *
 * Subscribes the WS to ALL pairs loaded from the backend (top 80 by volume).
 * Uses a wildcard '*' subscription so ANY signal pair gets price ticks.
 */
export function useMarket() {
  const {
    pulse,
    priceTicks,
    isLoading,
    fetchPulse,
    updatePriceTick,
  } = useMarketStore();

  const unsubRef = useRef<(() => void) | null>(null);

  // Shared singleton guards to avoid duplicate WS/poll loops when multiple
  // screens use this hook (dashboard, watchlist, etc.).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _shared = useRef(0);

  // Initial REST fetch — loads pulse + full pair list (top 80)
  useEffect(() => {
    sharedMountCount += 1;
    if (!sharedStarted) {
      sharedStarted = true;
    }
    // React StrictMode remounts effects in dev; keep bootstrap fetch one-time per app session.
    if (!sharedBootstrapped) {
      sharedBootstrapped = true;
      fetchPulse();
    }
  }, []);

  // Subscribe to real-time WS price ticks
  // Use '*' wildcard so we receive ticks for ALL 80 pairs without listing them
  useEffect(() => {
    // Start shared realtime loop only once app-wide.
    if (!sharedRealtimeStarted) {
      sharedRealtimeStarted = true;

      // Defensive connect call to recover sessions where root connect was missed.
      wsManager.connect();

      // Wildcard subscription — backend sends price_tick for every monitored pair
      wsManager.subscribe(['*']);

      sharedUnsubHandler = wsManager.on<{ pair: string; price: number; change24h: number }>(
        'price_tick',
        ({ pair, price, change24h }) => {
          const state = useMarketStore.getState();
          const existing = state.priceTicks[pair];
          state.updatePriceTick({
            pair,
            price,
            priceFormatted: formatPrice(price),
            change24h: change24h ?? 0,
            change24hFormatted: `${(change24h ?? 0) >= 0 ? '+' : ''}${(change24h ?? 0).toFixed(2)}%`,
            high24h: existing?.high24h ?? 0,
            low24h: existing?.low24h ?? 0,
            volume24h: existing?.volume24h ?? 0,
            lastUpdated: Date.now(),
          });
        }
      );

      // Auto-heal WS connection if mobile network drops intermittently.
      sharedReconnectInterval = setInterval(() => {
        if (!wsManager.connected) {
          wsManager.connect();
          wsManager.subscribe(['*']);
        }
      }, 10_000);

      // Dashboard pulse fallback refresh (WS does not stream fear/greed and BTC dom).
      sharedPulseRefreshInterval = setInterval(() => {
        useMarketStore.getState().fetchPulse();
      }, 30_000);
    }

    unsubRef.current = () => {};

    return () => {
      sharedMountCount = Math.max(0, sharedMountCount - 1);
      if (sharedMountCount === 0) {
        // Stop shared loops only when last consumer unmounts.
        sharedUnsubHandler?.();
        sharedUnsubHandler = null;
        wsManager.unsubscribe(['*']);

        if (sharedReconnectInterval) {
          clearInterval(sharedReconnectInterval);
          sharedReconnectInterval = null;
        }
        if (sharedPulseRefreshInterval) {
          clearInterval(sharedPulseRefreshInterval);
          sharedPulseRefreshInterval = null;
        }
        sharedRealtimeStarted = false;
        sharedStarted = false;
      }
    };
  }, [fetchPulse, updatePriceTick]);

  const getPrice = (pair: string) => priceTicks[pair];

  return {
    pulse,
    priceTicks,
    isLoading,
    refresh: fetchPulse,
    getPrice,
  };
}

let sharedMountCount = 0;
let sharedStarted = false;
let sharedBootstrapped = false;
let sharedRealtimeStarted = false;
let sharedUnsubHandler: (() => void) | null = null;
let sharedReconnectInterval: ReturnType<typeof setInterval> | null = null;
let sharedPulseRefreshInterval: ReturnType<typeof setInterval> | null = null;

function formatPrice(price: number): string {
  if (price >= 10000) return `$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (price >= 1000)  return `$${price.toFixed(1)}`;
  if (price >= 1)     return `$${price.toFixed(3)}`;
  return `$${price.toFixed(5)}`;
}
