import { useEffect, useRef } from 'react';
import { useMarketStore } from '@/src/store/useMarketStore';
import { wsManager } from '@/src/services/wsManager';

/**
 * AlphaAI — useMarket Hook
 * Real-time price updates, market sentiment, and WS subscription management.
 */
export function useMarket() {
  const {
    pulse,
    priceTicks,
    isLoading,
    fetchPulse,
    updatePriceTick,
  } = useMarketStore();

  const PAIRS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'DOGE/USDT', 'LINK/USDT', 'AVAX/USDT'];
  const unsubRef = useRef<(() => void) | null>(null);

  // Initial REST fetch for all prices and market pulse
  useEffect(() => {
    fetchPulse();
  }, []);

  // Subscribe to real-time WS price ticks
  useEffect(() => {
    // Subscribe to pairs on the WS server
    wsManager.subscribe(PAIRS);

    // Register price_tick event handler → update Zustand store
    const unsubHandler = wsManager.on<{ pair: string; price: number; change24h: number }>(
      'price_tick',
      ({ pair, price, change24h }) => {
        const current = useMarketStore.getState().priceTicks[pair];
        if (!current) return;
        updatePriceTick({
          ...current,
          price,
          priceFormatted: formatPrice(price),
          change24h,
          change24hFormatted: `${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%`,
          lastUpdated: Date.now(),
        });
      }
    );

    unsubRef.current = () => {
      unsubHandler();
      wsManager.unsubscribe(PAIRS);
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
  if (price >= 1000) return `$${price.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  if (price >= 1)    return `$${price.toFixed(4)}`;
  return `$${price.toPrecision(4)}`;
}
