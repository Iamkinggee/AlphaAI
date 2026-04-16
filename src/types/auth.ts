/**
 * AlphaAI — Auth & User Type Definitions
 */

export type UserTier = 'free' | 'pro' | 'institutional';
export type AuthStatus = 'loading' | 'initialising' | 'authenticated' | 'unauthenticated';

export interface User {
  id: string;
  email: string;
  name?: string;         // Optional preferred name (may differ from displayName)
  displayName: string;
  avatarUrl?: string;
  tier: UserTier;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;    // Unix ms
}

export interface SignInPayload {
  email: string;
  password: string;
}

export interface SignUpPayload {
  email: string;
  password: string;
  displayName: string;
}

export interface NotificationPreferences {
  approaching: boolean;
  active: boolean;
  tpHit: boolean;
  stopped: boolean;
  expired: boolean;
  pushEnabled: boolean;
}

export interface UserSettings {
  defaultRiskPercent: number;     // e.g. 1.0
  defaultTimeframe: string;       // e.g. '4H'
  minSignalScore: number;         // 0–100
  notifications: NotificationPreferences;
  theme: 'dark' | 'light' | 'system';
}
