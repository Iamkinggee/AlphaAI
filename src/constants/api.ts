/**
 * AlphaAI API Configuration
 * In development, auto-resolves the backend host from Expo's hostUri
 * so the app works on physical devices (not just simulators).
 */
import Constants from 'expo-constants';

/**
 * Derive the backend host from Expo's dev server URI.
 * Expo tells the app which IP the Metro bundler is on —
 * we reuse that IP but swap the port to 3000 (our backend).
 *
 * e.g. hostUri = "192.168.1.5:8081"  → host = "192.168.1.5"
 *      → API  = "http://192.168.1.5:3000/api"
 *      → WS   = "ws://192.168.1.5:3000"
 */
function getDevHost(): string {
  try {
    // Expo SDK 49+ uses expoConfig.hostUri
    const uri =
      Constants.expoConfig?.hostUri ??
      // Older SDK uses manifest.debuggerHost
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (Constants as any).manifest?.debuggerHost ??
      // Expo Go uses manifest2
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (Constants as any).manifest2?.extra?.expoGo?.debuggerHost ??
      '';
    const host = uri.split(':')[0];
    if (host && host !== 'localhost' && host !== '127.0.0.1' && host !== '') {
      return host;
    }
  } catch {}
  // Explicit fallback — your dev machine's LAN IP
  // Updated automatically; change if your IP changes
  return '192.168.196.47';
}

const DEV_HOST     = __DEV__ ? getDevHost() : '';
const DEV_API_URL  = `http://${DEV_HOST}:3000/api`;
const PROD_API_URL = 'https://api.alphaai.app/api';

export const API = {
  BASE_URL: __DEV__ ? DEV_API_URL : PROD_API_URL,

  // ─── Auth ───────────────────────────────────────────────────────
  AUTH: {
    SIGN_IN:        '/auth/sign-in',
    SIGN_UP:        '/auth/sign-up',
    SIGN_OUT:       '/auth/sign-out',
    REFRESH:        '/auth/refresh',
    FORGOT_PASSWORD:'/auth/forgot-password',
    ME:             '/auth/me',
    GOOGLE_URL:     '/auth/google/url',
  },

  // ─── Signals ────────────────────────────────────────────────────
  SIGNALS: {
    LIST: '/signals',
    DETAIL: (id: string) => `/signals/${id}`,
    APPROACHING: '/signals/approaching',
    ACTIVE: '/signals/active',
    HISTORY: '/signals/history',
    ANALYSE: '/signals/analyse',
  },

  // ─── Market Data ────────────────────────────────────────────────
  MARKET: {
    PULSE:    '/market/pulse',
    PAIRS:    '/market/pairs',         // live 24h stats for all top-80 pairs
    UNIVERSE: '/market/universe',      // full pair list (symbol + pair string)
    PRO_MODE: '/market/pro-mode',
    CANDLES:  (pair: string) => `/market/candles/${encodeURIComponent(pair)}`,
    PRICE:    (pair: string) => `/market/price/${encodeURIComponent(pair)}`,
  },

  // ─── Analysis ───────────────────────────────────────────────────
  ANALYSIS: {
    RUN: '/analysis/run',
    STRUCTURE: (pair: string) => `/analysis/structure/${pair}`,
  },

  // ─── Journal ────────────────────────────────────────────────────
  JOURNAL: {
    LIST: '/journal',
    CREATE: '/journal',
    DETAIL: (id: string) => `/journal/${id}`,
    STATS: '/journal/stats',
  },

  // ─── Watchlist ──────────────────────────────────────────────────
  WATCHLIST: {
    LIST: '/watchlist',
    ADD: '/watchlist',
    REMOVE: (id: string) => `/watchlist/${id}`,
    ALERTS: '/watchlist/alerts',
  },

  // ─── Notifications ──────────────────────────────────────────────
  NOTIFICATIONS: {
    LIST: '/notifications',
    MARK_READ: (id: string) => `/notifications/${id}/read`,
    SETTINGS: '/notifications/settings',
    REGISTER_PUSH: '/notifications/push-token',
  },

  // ─── AI Chat ────────────────────────────────────────────────────
  CHAT: {
    SEND: '/chat/message',
    SESSIONS: '/chat/sessions',
    SESSION_DETAIL: (id: string) => `/chat/sessions/${id}`,
    NEW_SESSION: '/chat/sessions',
  },

  // ─── User / Settings ───────────────────────────────────────────
  USER: {
    PROFILE:  '/auth/me',   // Backend serves profile via GET /auth/me
    SETTINGS: '/user/settings',
    AVATAR:   '/user/avatar',
  },
} as const;

export const WS = {
  URL: __DEV__ ? `ws://${DEV_HOST}:3000` : 'wss://api.alphaai.app',
  RECONNECT_INTERVAL: 3000,
  MAX_RECONNECT_ATTEMPTS: 10,
  PING_INTERVAL: 15000,
} as const;

export const EXTERNAL_APIS = {
  BINANCE_WS: 'wss://stream.binance.com:9443',
  BINANCE_REST: 'https://api.binance.com/api/v3',
  BINANCE_FUTURES_REST: 'https://fapi.binance.com/fapi/v1',
  COINGECKO: 'https://api.coingecko.com/api/v3',
} as const;
