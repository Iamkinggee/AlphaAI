import { useEffect, useMemo } from 'react';
import { useAuthStore } from '@/src/store/useAuthStore';

/**
 * AlphaAI — useAuth Hook
 * Centralised auth interface for the application.
 */
export function useAuth() {
  const {
    user,
    status,
    isLoading,
    settings,
    error,
    initialize,
    signIn,
    signUp,
    signOut,
  } = useAuthStore();

  const isAuthenticated = useMemo(() => status === 'authenticated', [status]);
  const isInitialising = useMemo(() => status === 'initialising', [status]);

  return {
    user,
    settings,
    status,
    isLoading,
    error,
    isAuthenticated,
    isInitialising,
    initialize,
    signIn,
    signUp,
    signOut,
  };
}
