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
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  '2xl': 22,
  '3xl': 26,
  '4xl': 30,
  '5xl': 34,
  '6xl': 42,
  '7xl': 50,
} as const;

export const LineHeights = {
  xs: 16,
  sm: 18,
  md: 22,
  lg: 26,
  xl: 28,
  '2xl': 30,
  '3xl': 34,
  '4xl': 38,
  '5xl': 42,
  '6xl': 50,
  '7xl': 58,
} as const;

export const LetterSpacing = {
  tight: -0.5,
  normal: 0,
  wide: 0.5,
  wider: 1,
  mono: 0.5,  // Slight spacing for monospace readability
} as const;

export type FontFamily = typeof Fonts;
