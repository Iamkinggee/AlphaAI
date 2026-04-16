/**
 * AlphaAI — Theme Context
 * Dark/Light mode with AsyncStorage persistence.
 * Wrap the root layout in <ThemeProvider> to unlock useTheme() anywhere.
 */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Theme Palette ────────────────────────────────────────────────────

export interface ThemePalette {
  // Backgrounds
  background: string;
  backgroundSecondary: string;
  card: string;
  cardElevated: string;
  cardBorder: string;
  surface: string;
  surfaceHover: string;
  // Text
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textDisabled: string;
  // Signal
  bullish: string;
  bullishDim: string;
  bearish: string;
  bearishDim: string;
  approaching: string;
  approachingDim: string;
  // Interactive
  accentPrimary: string;
  accentPrimaryDim: string;
  accentSecondary: string;
  // Status
  success: string;
  warning: string;
  error: string;
  // Borders
  border: string;
  borderLight: string;
  divider: string;
  // Tabs
  tabBarBackground: string;
  tabBarBorder: string;
  tabBarActive: string;
  tabBarInactive: string;
  // Overlays & gradients
  overlay: string;
  // Chart
  chartGrid: string;
}

export const darkTheme: ThemePalette = {
  background: '#090E1A',
  backgroundSecondary: '#0C1220',
  card: '#0F1923',
  cardElevated: '#141E2C',
  cardBorder: '#1A2636',
  surface: '#162030',
  surfaceHover: '#1C2A3E',
  textPrimary: '#F0F4FA',
  textSecondary: '#8B9BBF',
  textTertiary: '#5A6B8A',
  textDisabled: '#3A4A66',
  bullish: '#00F0A0',
  bullishDim: '#00F0A020',
  bearish: '#FF3366',
  bearishDim: '#FF336620',
  approaching: '#FFB800',
  approachingDim: '#FFB80020',
  accentPrimary: '#00D4FF',
  accentPrimaryDim: '#00D4FF15',
  accentSecondary: '#6C63FF',
  success: '#00F0A0',
  warning: '#FFB800',
  error: '#FF3366',
  border: '#1A2636',
  borderLight: '#243040',
  divider: '#141E2C',
  tabBarBackground: '#0A1018',
  tabBarBorder: '#1A2636',
  tabBarActive: '#00D4FF',
  tabBarInactive: '#5A6B8A',
  overlay: 'rgba(9, 14, 26, 0.85)',
  chartGrid: '#1A263640',
};

export const lightTheme: ThemePalette = {
  background: '#F0F4FA',
  backgroundSecondary: '#FFFFFF',
  card: '#FFFFFF',
  cardElevated: '#F8FAFD',
  cardBorder: '#DDE4EF',
  surface: '#EFF3FA',
  surfaceHover: '#E5ECF7',
  textPrimary: '#0F1923',
  textSecondary: '#4A5B7A',
  textTertiary: '#7A8EAF',
  textDisabled: '#B0BED4',
  bullish: '#00B67A',
  bullishDim: '#00B67A15',
  bearish: '#E02050',
  bearishDim: '#E0205015',
  approaching: '#D48200',
  approachingDim: '#D4820015',
  accentPrimary: '#0090CC',
  accentPrimaryDim: '#0090CC12',
  accentSecondary: '#5046CC',
  success: '#00B67A',
  warning: '#D48200',
  error: '#E02050',
  border: '#DDE4EF',
  borderLight: '#E8EEF8',
  divider: '#EFF3FA',
  tabBarBackground: '#FFFFFF',
  tabBarBorder: '#DDE4EF',
  tabBarActive: '#0090CC',
  tabBarInactive: '#7A8EAF',
  overlay: 'rgba(240, 244, 250, 0.85)',
  chartGrid: '#DDE4EF60',
};

// ── Context ──────────────────────────────────────────────────────────

interface ThemeContextValue {
  theme: ThemePalette;
  isDark: boolean;
  toggleTheme: () => void;
  setDark: (dark: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: darkTheme,
  isDark: true,
  toggleTheme: () => {},
  setDark: () => {},
});

const STORAGE_KEY = '@alphaai/theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(true);

  // Load saved preference
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val !== null) setIsDark(val === 'dark');
    });
  }, []);

  const setDark = useCallback((dark: boolean) => {
    setIsDark(dark);
    AsyncStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light').catch(() => {});
  }, []);

  const toggleTheme = useCallback(() => {
    setDark(!isDark);
  }, [isDark, setDark]);

  return (
    <ThemeContext.Provider value={{ theme: isDark ? darkTheme : lightTheme, isDark, toggleTheme, setDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

/** Access theme colors and toggle anywhere in the app */
export function useTheme() {
  return useContext(ThemeContext);
}
