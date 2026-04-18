import { useEffect, useCallback, useRef } from 'react';
import { useSignalStore } from '@/src/store/useSignalStore';
import { wsManager } from '@/src/services/wsManager';
import type { SignalStatus, SignalDirection } from '@/src/types';

/**
 * AlphaAI — useSignals Hook
 * Handles signal loading, filtering, and real-time WS updates.
 * Separates active signals from resolved/history signals.
 *
 * Active signals: approaching, active, TP1_hit, TP2_hit, pending
 * History signals: TP3_hit, stopped, expired
 */
export function useSignals() {
  const {
    isLoading,
    isLoadingHistory,
    isRefreshing,
    lastScanAt,
    nextScanIn,
    fetchSignals,
    fetchHistory,
    refreshSignals,
    setFilters,
    filteredSignals,
    signalById,
    approachingSignals,
    activeSignals,
    historySignals,
    clearHistory,
  } = useSignalStore();

  const unsubsRef = useRef<Array<() => void>>([]);

  // Initial fetch — only active signals
  useEffect(() => {
    fetchSignals();
  }, []);

  // Subscribe to real-time WS signal events
  // On signal events, re-fetch from backend for full Signal shape
  // (WS payloads are minimal — just enough to know what happened).
  useEffect(() => {
    const unsubApproaching = wsManager.on<{ signalId?: string; pair?: string }>(
      'signal_approaching',
      () => {
        // New signal detected — refresh active list to show it with full shape
        fetchSignals();
      }
    );

    const unsubActive = wsManager.on<{ signalId?: string }>(
      'signal_active',
      () => {
        // Signal activated — refresh to get updated status and entry details
        fetchSignals();
      }
    );

    const unsubTpHit = wsManager.on<{ signalId: string; status: SignalStatus }>(
      'signal_tp_hit',
      () => {
        fetchSignals();
      }
    );

    const unsubStopped = wsManager.on<{ signalId: string }>(
      'signal_stopped',
      () => {
        // Signal stopped — refresh both lists: remove from active, add to history
        fetchSignals();
      }
    );

    unsubsRef.current = [unsubApproaching, unsubActive, unsubTpHit, unsubStopped];
    return () => { unsubsRef.current.forEach((fn) => fn()); };
  }, [fetchSignals]);

  const signals    = filteredSignals();
  const approaching = approachingSignals();
  const active     = activeSignals();
  const history    = historySignals;

  /**
   * Filter signals by status or direction
   */
  const filter = useCallback((status?: SignalStatus | 'all', direction?: SignalDirection | 'all') => {
    setFilters({ status, direction });
  }, [setFilters]);

  /**
   * Load history / resolved signals on demand
   */
  const loadHistory = useCallback(() => {
    fetchHistory();
  }, [fetchHistory]);

  return {
    signals,
    approaching,
    active,
    history,
    isLoading,
    isLoadingHistory,
    isRefreshing,
    lastScanAt,
    nextScanIn,
    refresh: refreshSignals,
    filter,
    loadHistory,
    clearHistory,
    getSignal: signalById,
  };
}
