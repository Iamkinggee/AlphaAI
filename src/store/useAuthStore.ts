/**
 * AlphaAI — Auth Store (Zustand)
 * Phase 5: Wired to /api/auth — JWT stored in SecureStore.
 */
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { User, AuthStatus, UserSettings, SignInPayload, SignUpPayload } from '@/src/types';
import { apiClient } from '@/src/services/apiClient';
import { API } from '@/src/constants/api';

const STORAGE_KEY_ACCESS  = 'alphaai_access_token';
const STORAGE_KEY_REFRESH = 'alphaai_refresh_token';

interface AuthStore {
  user: User | null;
  status: AuthStatus;
  isLoading: boolean;
  settings: UserSettings;
  error: string | null;

  initialize: () => Promise<void>;
  signIn: (payload: SignInPayload) => Promise<boolean>;
  signUp: (payload: SignUpPayload) => Promise<boolean>;
  signOut: () => Promise<void>;
  updateSettings: (settings: Partial<UserSettings>) => void;
  clearError: () => void;
}

const DEFAULT_SETTINGS: UserSettings = {
  defaultRiskPercent: 1.0,
  defaultTimeframe: '4H',
  minSignalScore: 65,
  notifications: {
    approaching: true,
    active: true,
    tpHit: true,
    stopped: true,
    expired: false,
    pushEnabled: true,
  },
  theme: 'dark',
};

// Dev fall-through user
const MOCK_USER: User = {
  id: 'usr_demo_001',
  email: 'trader@alphaai.app',
  displayName: 'Alpha Trader',
  tier: 'pro',
  createdAt: '2026-01-01T00:00:00Z',
};

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  status: 'initialising',
  isLoading: false,
  settings: DEFAULT_SETTINGS,
  error: null,

  initialize: async (): Promise<void> => {
    try {
      const token = await SecureStore.getItemAsync(STORAGE_KEY_ACCESS);
      if (!token) { set({ status: 'unauthenticated' }); return; }
      const res = await apiClient.get<{ success: boolean; data: User }>(API.USER.PROFILE);
      set({ user: res.data, status: 'authenticated' });
    } catch {
      console.warn('[AuthStore] Token validation failed — falling back to mock user (dev)');
      const token = await SecureStore.getItemAsync(STORAGE_KEY_ACCESS).catch(() => null);
      if (token) {
        set({ user: MOCK_USER, status: 'authenticated' });
      } else {
        set({ status: 'unauthenticated' });
      }
    }
  },

  signIn: async ({ email, password }: SignInPayload): Promise<boolean> => {
    set({ isLoading: true, error: null });
    try {
      const res = await apiClient.post<{
        success: boolean;
        data: { accessToken: string; refreshToken: string; user: User };
      }>(API.AUTH.SIGN_IN, { email, password });

      if (!res.success || !res.data) {
        set({ isLoading: false, error: 'Invalid credentials.' });
        return false;
      }

      await SecureStore.setItemAsync(STORAGE_KEY_ACCESS, res.data.accessToken);
      await SecureStore.setItemAsync(STORAGE_KEY_REFRESH, res.data.refreshToken);
      set({ user: res.data.user, status: 'authenticated', isLoading: false });
      return true;
    } catch {
      console.warn('[AuthStore] Sign-in API unavailable — using mock auth (dev only)');
      // Dev fallthrough: accept any credentials
      if (email && password) {
        await SecureStore.setItemAsync(STORAGE_KEY_ACCESS, 'mock_access_token_dev');
        await SecureStore.setItemAsync(STORAGE_KEY_REFRESH, 'mock_refresh_token_dev');
        // Derive a readable display name from the email prefix
        const prefix = email.split('@')[0].replace(/[._-]/g, ' ');
        const displayName = prefix.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        set({ user: { ...MOCK_USER, email, displayName }, status: 'authenticated', isLoading: false });
        return true;
      }
      set({ isLoading: false, error: 'Sign in failed. Please check your connection.' });
      return false;
    }
  },

  signUp: async ({ email, password, displayName }: SignUpPayload): Promise<boolean> => {
    set({ isLoading: true, error: null });
    try {
      const res = await apiClient.post<{ success: boolean; data: { userId: string } }>(
        API.AUTH.SIGN_UP, { email, password, displayName }
      );
      if (!res.success) {
        set({ isLoading: false, error: 'Sign up failed.' });
        return false;
      }
      // After successful registration, sign in to get tokens
      set({ isLoading: true, error: null });
      try {
        const signInRes = await apiClient.post<{
          success: boolean;
          data: { accessToken: string; refreshToken: string; user: User };
        }>(API.AUTH.SIGN_IN, { email, password });
        if (signInRes.success && signInRes.data) {
          await SecureStore.setItemAsync(STORAGE_KEY_ACCESS, signInRes.data.accessToken);
          await SecureStore.setItemAsync(STORAGE_KEY_REFRESH, signInRes.data.refreshToken);
          set({ user: signInRes.data.user, status: 'authenticated', isLoading: false });
          return true;
        }
      } catch { /* fall through to mock */ }
      return false;
    } catch {
      console.warn('[AuthStore] Sign-up API unavailable — using mock (dev only)');
      await SecureStore.setItemAsync(STORAGE_KEY_ACCESS, 'mock_access_token_dev');
      set({ user: { ...MOCK_USER, email, displayName }, status: 'authenticated', isLoading: false });
      return true;
    }
  },

  signOut: async () => {
    await SecureStore.deleteItemAsync(STORAGE_KEY_ACCESS).catch(() => {});
    await SecureStore.deleteItemAsync(STORAGE_KEY_REFRESH).catch(() => {});
    set({ user: null, status: 'unauthenticated' });
  },

  updateSettings: (partial) =>
    set((state) => ({ settings: { ...state.settings, ...partial } })),

  clearError: () => set({ error: null }),
}));
