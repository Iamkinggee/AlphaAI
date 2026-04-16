/**
 * AlphaAI Color System
 * Dark terminal / institutional trading tool aesthetic
 */

export const Colors = {
  // ─── Background Layers ──────────────────────────────────────────
  background: '#090E1A',
  backgroundSecondary: '#0C1220',
  card: '#0F1923',
  cardElevated: '#141E2C',
  cardBorder: '#1A2636',

  // ─── Surface Layers ─────────────────────────────────────────────
  surface: '#162030',
  surfaceHover: '#1C2A3E',
  surfaceActive: '#223450',

  // ─── Signal Colors ──────────────────────────────────────────────
  bullish: '#00F0A0',       // Long / Bullish accent
  bullishDim: '#00F0A020',  // Subtle bullish background
  bullishMid: '#00F0A060',  // Mid-opacity bullish
  bearish: '#FF3366',       // Short / Bearish / SL
  bearishDim: '#FF336620',  // Subtle bearish background
  bearishMid: '#FF336660',  // Mid-opacity bearish
  approaching: '#FFB800',   // Approaching / Pending
  approachingDim: '#FFB80020',
  approachingMid: '#FFB80060',
  info: '#00D4FF',          // Neutral info accent
  infoDim: '#00D4FF20',
  infoMid: '#00D4FF60',

  // ─── Text Hierarchy ─────────────────────────────────────────────
  textPrimary: '#F0F4FA',
  textSecondary: '#8B9BBF',
  textTertiary: '#5A6B8A',
  textDisabled: '#3A4A66',

  // ─── Interactive ────────────────────────────────────────────────
  accentPrimary: '#00D4FF',
  accentPrimaryDim: '#00D4FF15',
  accentSecondary: '#6C63FF',

  // ─── Status ─────────────────────────────────────────────────────
  success: '#00F0A0',
  warning: '#FFB800',
  error: '#FF3366',
  expired: '#5A6B8A',

  // ─── Borders & Dividers ─────────────────────────────────────────
  border: '#1A2636',
  borderLight: '#243040',
  divider: '#141E2C',

  // ─── Notification Priority ──────────────────────────────────────
  criticalBg: '#FF336615',
  highBg: '#FFB80015',
  standardBg: '#00F0A015',

  // ─── Overlays ───────────────────────────────────────────────────
  overlay: 'rgba(9, 14, 26, 0.8)',
  overlayLight: 'rgba(9, 14, 26, 0.5)',

  // ─── Gradient Stops ─────────────────────────────────────────────
  gradientStart: '#090E1A',
  gradientEnd: '#0F1923',
  gradientAccentStart: '#00D4FF',
  gradientAccentEnd: '#6C63FF',
  gradientBullishStart: '#00F0A0',
  gradientBullishEnd: '#00D4FF',
  gradientBearishStart: '#FF3366',
  gradientBearishEnd: '#FF6B35',

  // ─── Chart Colors ──────────────────────────────────────────────
  chartGrid: '#1A263640',
  chartCrosshair: '#8B9BBF60',
  chartOB: '#6C63FF40',
  chartFVG: '#FFB80030',
  chartSD: '#00D4FF20',
  chartLiquidity: '#FF336650',
  chartLiquiditySwept: '#5A6B8A40',

  // ─── Tab Bar ────────────────────────────────────────────────────
  tabBarBackground: '#0A1018',
  tabBarBorder: '#1A2636',
  tabBarActive: '#00D4FF',
  tabBarInactive: '#5A6B8A',

  // ─── Light Mode (Phase 8 — design tokens ready) ─────────────────
  light: {
    background: '#F5F7FA',
    backgroundSecondary: '#FFFFFF',
    card: '#FFFFFF',
    cardBorder: '#E2E8F0',
    textPrimary: '#0F1923',
    textSecondary: '#5A6B8A',
    textTertiary: '#8B9BBF',
    border: '#E2E8F0',
    divider: '#F0F2F5',
    tabBarBackground: '#FFFFFF',
    tabBarBorder: '#E2E8F0',
  },
} as const;

export type ColorKey = keyof typeof Colors;
