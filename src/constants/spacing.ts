/**
 * AlphaAI Spacing & Layout System
 * 4px base grid
 */

export const Spacing = {
  /** 2px */  '2xs': 2,
  /** 4px */  xs: 4,
  /** 8px */  sm: 8,
  /** 12px */ md: 12,
  /** 16px */ lg: 16,
  /** 20px */ xl: 20,
  /** 24px */ '2xl': 24,
  /** 32px */ '3xl': 32,
  /** 40px */ '4xl': 40,
  /** 48px */ '5xl': 48,
  /** 56px */ '6xl': 56,
  /** 64px */ '7xl': 64,
  /** 80px */ '8xl': 80,
} as const;

export const BorderRadius = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  '3xl': 24,
  full: 9999,
} as const;

export const IconSizes = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 28,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
} as const;

export const ScreenPadding = {
  horizontal: Spacing.lg,
  vertical: Spacing.lg,
} as const;

export const CardPadding = {
  horizontal: Spacing.lg,
  vertical: Spacing.md,
} as const;
