/**
 * AlphaAI — SparklineChart Component
 * Lightweight, View-based mini price chart. No native dependencies.
 * Used in watchlist rows, signal cards, and dashboard ticks.
 */
import { View, StyleSheet } from 'react-native';
import type { ViewStyle } from 'react-native';
import { Colors } from '@/src/constants/colors';

interface SparklineChartProps {
  /** Normalised data points (raw prices — component handles min/max scaling) */
  data: number[];
  /** Width of the chart area in px */
  width?: number;
  /** Height of the chart area in px */
  height?: number;
  /** Override line colour (defaults to bullish vs bearish based on first/last) */
  color?: string;
  /** Number of vertical bars to render */
  barCount?: number;
  style?: ViewStyle;
}

export function SparklineChart({
  data,
  width = 80,
  height = 32,
  color,
  barCount = 20,
  style,
}: SparklineChartProps) {
  if (!data || data.length < 2) {
    return <View style={[styles.placeholder, { width, height }, style]} />;
  }

  // Downsample to barCount
  const step = Math.max(1, Math.floor(data.length / barCount));
  const sampled = Array.from({ length: barCount }, (_, i) => {
    const idx = Math.min(i * step, data.length - 1);
    return data[idx];
  });

  const min = Math.min(...sampled);
  const max = Math.max(...sampled);
  const range = max - min || 1;

  const isPositive = sampled[sampled.length - 1] >= sampled[0];
  const lineColor = color ?? (isPositive ? Colors.bullish : Colors.bearish);

  const barWidth = Math.floor((width - (barCount - 1)) / barCount);

  return (
    <View style={[styles.container, { width, height }, style]}>
      {sampled.map((value, index) => {
        const normalised = (value - min) / range; // 0 → 1
        const barHeight = Math.max(2, Math.round(normalised * (height - 2)));
        return (
          <View
            key={index}
            style={[
              styles.bar,
              {
                width: barWidth,
                height: barHeight,
                backgroundColor: lineColor,
                opacity: index === sampled.length - 1 ? 1 : 0.4 + normalised * 0.4,
                marginRight: index < sampled.length - 1 ? 1 : 0,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    overflow: 'hidden',
  },
  bar: {
    borderRadius: 1,
  },
  placeholder: {
    backgroundColor: Colors.cardBorder,
    borderRadius: 4,
    opacity: 0.4,
  },
});
