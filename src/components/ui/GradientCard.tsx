import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '@/src/contexts/ThemeContext';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  accentColor?: string;
  /** Legacy prop — kept for backwards compat; first element used as tint */
  gradientColors?: string[];
  /** Legacy border color prop */
  borderColor?: string;
}

export function GradientCard({ children, style, accentColor, gradientColors, borderColor }: CardProps) {
  const { theme } = useTheme();

  const bg     = gradientColors?.[0] ?? theme.card;
  const border = borderColor ?? (accentColor ? accentColor + '30' : theme.cardBorder);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: bg,
          borderColor: border,
          borderLeftColor: accentColor ?? border,
          borderLeftWidth: accentColor ? 3 : 1,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 16,
  },
});
