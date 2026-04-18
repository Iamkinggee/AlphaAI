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

  // Initial REST fetch — loads pulse + full pair list (top 80)
  useEffect(() => {
    fetchPulse();
  }, []);

  // Subscribe to real-time WS price ticks
  // Use '*' wildcard so we receive ticks for ALL 80 pairs without listing them
  useEffect(() => {
    // Wildcard subscription — backend sends price_tick for every monitored pair
    wsManager.subscribe(['*']);

    const unsubHandler = wsManager.on<{ pair: string; price: number; change24h: number }>(
      'price_tick',
      ({ pair, price, change24h }) => {
        // Update the tick for any pair — whether it was pre-loaded or not
        updatePriceTick({
          pair,
          price,
          priceFormatted:     formatPrice(price),
          change24h:          change24h ?? 0,
          change24hFormatted: `${(change24h ?? 0) >= 0 ? '+' : ''}${(change24h ?? 0).toFixed(2)}%`,
          lastUpdated:        Date.now(),
        });
      }
    );

    unsubRef.current = () => {
      unsubHandler();
      wsManager.unsubscribe(['*']);
    };

    return () => unsubRef.current?.();
  }, []);

  const getPrice = (pair: string) => priceTicks[pair];

  return {
    pulse,
    priceTicks,
    isLoading,
    refresh: fetchPulse,
    getPrice,
  };
}

function formatPrice(price: number): string {
  if (price >= 10000) return `$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (price >= 1000)  return `$${price.toFixed(1)}`;
  if (price >= 1)     return `$${price.toFixed(3)}`;
  return `$${price.toFixed(5)}`;
}
