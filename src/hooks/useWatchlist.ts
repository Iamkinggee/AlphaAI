import { useWatchlistStore } from '@/src/store/useWatchlistStore';

/**
 * AlphaAI — useWatchlist Hook
 * Watchlist management and persistence interaction.
 */
export function useWatchlist() {
  const {
    items,
    isLoading,
    addItem,
    removeItem,
    isPairWatched,
    loadWatchlist,
  } = useWatchlistStore();

  return {
    items,
    isLoading,
    add: addItem,
    remove: removeItem,
    isWatched: isPairWatched,
    load: loadWatchlist,
  };
}
