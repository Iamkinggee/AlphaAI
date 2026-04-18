/**
 * AlphaAI — Auth Store (Zustand)
 * Handles authentication with Supabase backend.
 *
 * Google Sign-In flow (Supabase OAuth via expo-web-browser):
 *  1. Backend returns the Supabase Google OAuth URL.
 *  2. Frontend opens it with WebBrowser.openAuthSessionAsync.
 *  3. Supabase handles Google login and redirects to alphaai://auth/callback
 *     with access_token + refresh_token in the URL fragment.
 *  4. Frontend parses the tokens, stores them, fetches user profile.
 *
 * Requirements:
 *  - Enable Google provider in Supabase Dashboard → Auth → Providers
 *  - Add "alphaai://auth/callback" to Supabase Redirect URLs allow-list
 *
 * In development (__DEV__), falls back to a local dev session if the
 * backend auth is unavailable. In production, auth failures are strict.
 */
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import type { User, AuthStatus, UserSettings, SignInPayload, SignUpPayload } from '@/src/types';
import { apiClient } from '@/src/services/apiClient';
import { API } from '@/src/constants/api';

// Ensure the browser session closes cleanly on Android
WebBrowser.maybeCompleteAuthSession();

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
  signInWithGoogle: () => Promise<boolean>;
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

/**
 * Build a user object from an email address.
 * Used for both real and dev-mode sign-ins.
 */
function buildUserFromEmail(email: string, displayName?: string): User {
  const prefix = email.split('@')[0].replace(/[._-]/g, ' ');
  const name = displayName
    ?? prefix.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return {
    id: `usr_${Date.now()}`,
    email,
    displayName: name,
    tier: 'pro',
    createdAt: new Date().toISOString(),
  };
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  status: 'initialising',
  isLoading: false,
  settings: DEFAULT_SETTINGS,
  error: null,

  initialize: async (): Promise<void> => {
    try {
      const token = await SecureStore.getItemAsync(STORAGE_KEY_ACCESS);
      if (!token) { set({ status: 'unauthenticated' }); return; }

      // Skip backend validation for known dev tokens — they always 401
      const isDevToken = token === 'dev_access_token' || token === 'dev_google_token';

      if (!isDevToken) {
        // Try to validate the stored token against the backend (with timeout)
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout
          const res = await apiClient.get<{ success: boolean; data: User }>(
            API.AUTH.ME,
            // @ts-ignore — apiClient accepts signal via options if configured
            { signal: controller.signal }
          ).finally(() => clearTimeout(timeout));
          if (res.data) {
            set({ user: res.data, status: 'authenticated' });
            return;
          }
        } catch {
          // Backend unavailable or token expired — fall through to dev cache
        }
      }

      // Restore from cached email (dev mode OR backend unavailable)
      if (__DEV__) {
        const cachedEmail = await SecureStore.getItemAsync('alphaai_user_email').catch(() => null);
        const cachedName  = await SecureStore.getItemAsync('alphaai_user_name').catch(() => null);
        if (cachedEmail) {
          console.log('[AuthStore] Dev mode — restoring session for', cachedEmail);
          set({ user: buildUserFromEmail(cachedEmail, cachedName ?? undefined), status: 'authenticated' });
          return;
        }
      }

      // Token invalid and no dev cache — require re-auth
      await SecureStore.deleteItemAsync(STORAGE_KEY_ACCESS).catch(() => {});
      await SecureStore.deleteItemAsync(STORAGE_KEY_REFRESH).catch(() => {});
      set({ status: 'unauthenticated' });
    } catch {
      set({ status: 'unauthenticated' });
    }
  },

  signIn: async ({ email, password }: SignInPayload): Promise<boolean> => {
    set({ isLoading: true, error: null });
    try {
      // Race against a 10-second timeout — Supabase auth can be slow but 8s+ is unacceptable
      const signInPromise = apiClient.post<{
        success: boolean;
        data: { accessToken: string; refreshToken: string; user: User };
      }>(API.AUTH.SIGN_IN, { email, password });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Sign in timed out')), 10_000)
      );

      const res = await Promise.race([signInPromise, timeoutPromise]);

      if (!res.success || !res.data) {
        set({ isLoading: false, error: 'Invalid credentials.' });
        return false;
      }

      await SecureStore.setItemAsync(STORAGE_KEY_ACCESS, res.data.accessToken);
      await SecureStore.setItemAsync(STORAGE_KEY_REFRESH, res.data.refreshToken);
      await SecureStore.setItemAsync('alphaai_user_email', email);
      await SecureStore.setItemAsync('alphaai_user_name', res.data.user.displayName ?? '');
      set({ user: res.data.user, status: 'authenticated', isLoading: false });
      return true;
    } catch {
      // In dev mode, allow sign-in when backend is unreachable
      if (__DEV__ && email && password) {
        console.log('[AuthStore] Dev mode — backend unavailable, creating local session');
        const user = buildUserFromEmail(email);
        await SecureStore.setItemAsync(STORAGE_KEY_ACCESS, 'dev_access_token');
        await SecureStore.setItemAsync('alphaai_user_email', email);
        await SecureStore.setItemAsync('alphaai_user_name', user.displayName ?? '');
        set({ user, status: 'authenticated', isLoading: false });
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
        set({ isLoading: false, error: 'Sign up failed. Please try again.' });
        return false;
      }
      // After successful registration, sign in to get tokens
      try {
        const signInRes = await apiClient.post<{
          success: boolean;
          data: { accessToken: string; refreshToken: string; user: User };
        }>(API.AUTH.SIGN_IN, { email, password });
        if (signInRes.success && signInRes.data) {
          await SecureStore.setItemAsync(STORAGE_KEY_ACCESS, signInRes.data.accessToken);
          await SecureStore.setItemAsync(STORAGE_KEY_REFRESH, signInRes.data.refreshToken);
          await SecureStore.setItemAsync('alphaai_user_email', email);
          await SecureStore.setItemAsync('alphaai_user_name', signInRes.data.user.displayName ?? '');
          set({ user: signInRes.data.user, status: 'authenticated', isLoading: false });
          return true;
        }
      } catch { /* fall through */ }
      set({ isLoading: false, error: 'Account created! Please sign in.' });
      return false;
    } catch {
      // In dev mode, allow sign-up when backend is unreachable
      if (__DEV__ && email && password) {
        console.log('[AuthStore] Dev mode — backend unavailable, creating local account');
        const user = buildUserFromEmail(email, displayName);
        await SecureStore.setItemAsync(STORAGE_KEY_ACCESS, 'dev_access_token');
        await SecureStore.setItemAsync('alphaai_user_email', email);
        await SecureStore.setItemAsync('alphaai_user_name', user.displayName ?? '');
        set({ user, status: 'authenticated', isLoading: false });
        return true;
      }
      set({ isLoading: false, error: 'Sign up failed. Please check your connection.' });
      return false;
    }
  },

  /**
   * Google Sign-In via Supabase OAuth + expo-web-browser.
   *
   * Real flow (when Supabase Google provider is configured):
   *  1. Fetch OAuth URL from backend  GET /api/auth/google/url
   *  2. Open in browser               WebBrowser.openAuthSessionAsync
   *  3. Supabase handles Google auth, redirects → alphaai://auth/callback#access_token=...
   *  4. Parse tokens from URL fragment
   *  5. Fetch user profile            GET /api/auth/me
   *
   * Dev fallback: If backend is unreachable or Google not configured,
   * creates a local session so you can test the rest of the app.
   */
  signInWithGoogle: async (): Promise<boolean> => {
    set({ isLoading: true, error: null });

    try {
      // Build the redirect URI using the app's registered scheme
      const redirectUri = Linking.createURL('/auth/callback');

      // ── Step 1: Get the Supabase Google OAuth URL from backend ──────
      let oauthUrl: string | null = null;
      try {
        const res = await apiClient.get<{ success: boolean; data: { url: string } }>(
          `${API.AUTH.GOOGLE_URL}?redirectUri=${encodeURIComponent(redirectUri)}`
        );
        if (res.success && res.data?.url) {
          oauthUrl = res.data.url;
        }
      } catch (err) {
        console.warn('[AuthStore] Could not fetch Google OAuth URL:', err);
      }

      if (!oauthUrl) {
        // Backend unreachable or Google not configured — dev fallback
        if (__DEV__) {
          console.log('[AuthStore] Dev mode — Google OAuth unavailable, using dev session');
          const user: User = {
            id: `usr_google_${Date.now()}`,
            email: 'dev.user@gmail.com',
            displayName: 'Dev Google User',
            tier: 'pro',
            createdAt: new Date().toISOString(),
          };
          await SecureStore.setItemAsync(STORAGE_KEY_ACCESS, 'dev_google_token');
          await SecureStore.setItemAsync('alphaai_user_email', user.email);
          await SecureStore.setItemAsync('alphaai_user_name', user.displayName ?? '');
          set({ user, status: 'authenticated', isLoading: false });
          return true;
        }
        set({
          isLoading: false,
          error: 'Google Sign-In is not configured yet. Please sign in with email.',
        });
        return false;
      }

      // ── Step 2: Open OAuth URL in browser ───────────────────────────
      const result = await WebBrowser.openAuthSessionAsync(oauthUrl, redirectUri);

      if (result.type === 'cancel' || result.type === 'dismiss') {
        set({ isLoading: false, error: null }); // silent — user cancelled
        return false;
      }

      if (result.type !== 'success' || !result.url) {
        set({ isLoading: false, error: 'Google Sign-In failed. Please try again.' });
        return false;
      }

      // ── Step 3: Parse tokens from redirect URL ───────────────────────
      // Supabase returns tokens in the URL fragment: #access_token=...&refresh_token=...
      const urlStr = result.url;
      const fragment = urlStr.includes('#') ? urlStr.split('#')[1] : urlStr.split('?')[1] ?? '';
      const params = new URLSearchParams(fragment);

      const accessToken  = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (!accessToken) {
        // Check if Supabase returned an error
        const errorCode = params.get('error');
        const errorDesc = params.get('error_description');
        const message = errorDesc
          ? decodeURIComponent(errorDesc.replace(/\+/g, ' '))
          : errorCode ?? 'No access token received.';
        set({ isLoading: false, error: `Google Sign-In failed: ${message}` });
        return false;
      }

      // ── Step 4: Store tokens ─────────────────────────────────────────
      await SecureStore.setItemAsync(STORAGE_KEY_ACCESS, accessToken);
      if (refreshToken) {
        await SecureStore.setItemAsync(STORAGE_KEY_REFRESH, refreshToken);
      }

      // ── Step 5: Fetch user profile from backend ──────────────────────
      const profileRes = await apiClient.get<{ success: boolean; data: User }>(API.AUTH.ME);
      if (profileRes.success && profileRes.data) {
        await SecureStore.setItemAsync('alphaai_user_email', profileRes.data.email ?? '');
        await SecureStore.setItemAsync('alphaai_user_name', profileRes.data.displayName ?? '');
        set({ user: profileRes.data, status: 'authenticated', isLoading: false });
        return true;
      }

      set({ isLoading: false, error: 'Could not load your profile. Please try again.' });
      return false;

    } catch (err) {
      console.error('[AuthStore] Google Sign-In error:', err);
      set({ isLoading: false, error: 'Google Sign-In failed. Please try again.' });
      return false;
    }
  },

  signOut: async () => {
    await SecureStore.deleteItemAsync(STORAGE_KEY_ACCESS).catch(() => {});
    await SecureStore.deleteItemAsync(STORAGE_KEY_REFRESH).catch(() => {});
    await SecureStore.deleteItemAsync('alphaai_user_email').catch(() => {});
    await SecureStore.deleteItemAsync('alphaai_user_name').catch(() => {});
    set({ user: null, status: 'unauthenticated' });
  },

  updateSettings: (partial) =>
    set((state) => ({ settings: { ...state.settings, ...partial } })),

  clearError: () => set({ error: null }),
}));
