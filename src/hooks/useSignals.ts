import { useEffect, useCallback, useRef } from 'react';
import { useSignalStore } from '@/src/store/useSignalStore';
import { wsManager } from '@/src/services/wsManager';
import type { Signal, SignalStatus, SignalDirection } from '@/src/types';

/**
 * AlphaAI — useSignals Hook
 * Handles signal loading, filtering, and real-time WS updates.
 * Listens for signal_approaching and signal_active events to
 * instantly update the store without waiting for a REST poll.
 */
export function useSignals() {
  const {
    isLoading,
    isRefreshing,
    lastScanAt,
    nextScanIn,
    fetchSignals,
    refreshSignals,
    setFilters,
    filteredSignals,
    signalById,
    approachingSignals,
    activeSignals,
    upsertSignal,
  } = useSignalStore();

  const unsubsRef = useRef<Array<() => void>>([]);

  // Initial fetch
  useEffect(() => {
    fetchSignals();
  }, []);

  // Subscribe to real-time WS signal events
  useEffect(() => {
    const unsubApproaching = wsManager.on<Signal>(
      'signal_approaching',
      (signal) => {
        upsertSignal({ ...signal, status: 'approaching' });
      }
    );

    const unsubActive = wsManager.on<Signal>(
      'signal_active',
      (signal) => {
        upsertSignal({ ...signal, status: 'active' });
      }
    );

    const unsubTpHit = wsManager.on<{ signalId: string; status: SignalStatus }>(
      'signal_tp_hit',
      ({ signalId, status }) => {
        const existing = signalById(signalId);
        if (existing) upsertSignal({ ...existing, status });
      }
    );

    const unsubStopped = wsManager.on<{ signalId: string }>(
      'signal_stopped',
      ({ signalId }) => {
        const existing = signalById(signalId);
        if (existing) upsertSignal({ ...existing, status: 'stopped' });
      }
    );

    unsubsRef.current = [unsubApproaching, unsubActive, unsubTpHit, unsubStopped];
    return () => { unsubsRef.current.forEach((fn) => fn()); };
  }, []);

  const signals    = filteredSignals();
  const approaching = approachingSignals();
  const active     = activeSignals();

  /**
   * Filter signals by status or direction
   */
  const filter = useCallback((status?: SignalStatus | 'all', direction?: SignalDirection | 'all') => {
    setFilters({ status, direction });
  }, [setFilters]);

  return {
    signals,
    approaching,
    active,
    isLoading,
    isRefreshing,
    lastScanAt,
    nextScanIn,
    refresh: refreshSignals,
    filter,
    getSignal: signalById,
  };
}
