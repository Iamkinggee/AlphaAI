/**
 * AlphaAI API Configuration
 */

const DEV_API_URL = 'http://localhost:3000/api';
const PROD_API_URL = 'https://api.alphaai.app/api';

export const API = {
  BASE_URL: __DEV__ ? DEV_API_URL : PROD_API_URL,

  // ─── Auth ───────────────────────────────────────────────────────
  AUTH: {
    SIGN_IN: '/auth/sign-in',
    SIGN_UP: '/auth/sign-up',
    SIGN_OUT: '/auth/sign-out',
    REFRESH: '/auth/refresh',
    FORGOT_PASSWORD: '/auth/forgot-password',
    GOOGLE: '/auth/google',
  },

  // ─── Signals ────────────────────────────────────────────────────
  SIGNALS: {
    LIST: '/signals',
    DETAIL: (id: string) => `/signals/${id}`,
    APPROACHING: '/signals/approaching',
    ACTIVE: '/signals/active',
    HISTORY: '/signals/history',
  },

  // ─── Market Data ────────────────────────────────────────────────
  MARKET: {
    PULSE: '/market/pulse',
    PAIRS: '/market/pairs',
    CANDLES: (pair: string) => `/market/candles/${pair}`,
    PRICE: (pair: string) => `/market/price/${pair}`,
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
    PROFILE: '/user/profile',
    SETTINGS: '/user/settings',
    AVATAR: '/user/avatar',
  },
} as const;

export const WS = {
  URL: __DEV__ ? 'ws://localhost:3000' : 'wss://api.alphaai.app',
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
