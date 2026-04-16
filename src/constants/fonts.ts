/**
 * AlphaAI Typography System
 * JetBrains Mono for financial data, DM Sans for UI text
 */

export const Fonts = {
  // ─── Monospace (prices, figures, RR, scores) ────────────────────
  mono: {
    regular: 'Inter-Regular',
    medium: 'Inter-Medium',
    semiBold: 'Inter-SemiBold',
    bold: 'Inter-Bold',
  },

  // ─── Sans Serif (all other text) ────────────────────────────────
  sans: {
    regular: 'Inter-Regular',
    medium: 'Inter-Medium',
    semiBold: 'Inter-SemiBold',
    bold: 'Inter-Bold',
  },
} as const;

export const FontSizes = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  '2xl': 20,
  '3xl': 24,
  '4xl': 28,
  '5xl': 32,
  '6xl': 40,
  '7xl': 48,
} as const;

export const LineHeights = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 26,
  '2xl': 28,
  '3xl': 32,
  '4xl': 36,
  '5xl': 40,
  '6xl': 48,
  '7xl': 56,
} as const;

export const LetterSpacing = {
  tight: -0.5,
  normal: 0,
  wide: 0.5,
  wider: 1,
  mono: 0.5,  // Slight spacing for monospace readability
} as const;

export type FontFamily = typeof Fonts;
