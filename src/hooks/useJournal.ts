import { useEffect } from 'react';
import { useJournalStore } from '@/src/store/useJournalStore';
import type { JournalTab } from '@/src/types';

/**
 * AlphaAI — useJournal Hook
 * Analysis and performance tracking integration.
 */
export function useJournal() {
  const {
    stats,
    activeTab,
    isLoading,
    loadTrades,
    setActiveTab,
    filteredTrades,
  } = useJournalStore();

  // Initial load
  useEffect(() => {
    loadTrades();
  }, [loadTrades]);

  const trades = filteredTrades();

  return {
    trades,
    stats,
    activeTab,
    isLoading,
    setTab: setActiveTab,
    refresh: loadTrades,
  };
}
