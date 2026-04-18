/**
 * AlphaAI — CandlestickChart
 * Pure View-based OHLCV candle renderer. No external libraries.
 * Renders up to 60 candles with price axis, grid lines, and zone overlays.
 */
import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/src/constants/colors';
import { FontSizes } from '@/src/constants/fonts';
import { Spacing } from '@/src/constants/spacing';

export interface OHLCVCandle {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ZoneOverlayData {
  type: 'OB' | 'FVG' | 'SD';
  direction: 'BULLISH' | 'BEARISH';
  high: number;
  low: number;
}

interface CandlestickChartProps {
  candles: OHLCVCandle[];
  width: number;
  height: number;
  zones?: ZoneOverlayData[];
  currentPrice?: number;
}

const PRICE_AXIS_WIDTH = 58;
const GRID_LINES = 5;
const CANDLE_GAP = 2;

export function CandlestickChart({ candles, width, height, zones = [], currentPrice }: CandlestickChartProps) {
  const chartWidth = width - PRICE_AXIS_WIDTH;

  const { minPrice, maxPrice, priceRange, candleWidth, labels } = useMemo(() => {
    if (candles.length === 0) return { minPrice: 0, maxPrice: 0, priceRange: 1, candleWidth: 8, labels: [] };

    const highs  = candles.map(c => c.high);
    const lows   = candles.map(c => c.low);
    const rawMin = Math.min(...lows);
    const rawMax = Math.max(...highs);
    const padding = (rawMax - rawMin) * 0.06;
    const minPrice  = rawMin - padding;
    const maxPrice  = rawMax + padding;
    const priceRange = maxPrice - minPrice;

    const candleWidth = Math.max(3, (chartWidth / candles.length) - CANDLE_GAP);

    // Price axis labels
    const labels: string[] = Array.from({ length: GRID_LINES + 1 }, (_, i) => {
      const p = maxPrice - (priceRange / GRID_LINES) * i;
      return formatPriceLabel(p);
    });

    return { minPrice, maxPrice, priceRange, candleWidth, labels };
  }, [candles, chartWidth]);

  const toY = (price: number) =>
    height - ((price - minPrice) / priceRange) * height;

  if (candles.length === 0) {
    return (
      <View style={[styles.empty, { width, height }]}>
        <Text style={styles.emptyIcon}>📈</Text>
        <Text style={styles.emptyText}>Select a pair to load chart</Text>
      </View>
    );
  }

  return (
    <View style={{ width, height, flexDirection: 'row' }}>
      {/* ── Candle + overlay area ─────────────────────────────────── */}
      <View style={{ width: chartWidth, height, position: 'relative', overflow: 'hidden' }}>
        {/* Grid lines */}
        {Array.from({ length: GRID_LINES + 1 }, (_, i) => (
          <View
            key={i}
            style={[
              styles.gridLine,
              { top: (i / GRID_LINES) * height, width: chartWidth },
            ]}
          />
        ))}

        {/* Zone overlays (OB / FVG / S&D) */}
        {zones.map((zone, i) => {
          const top    = toY(zone.high);
          const bottom = toY(zone.low);
          const zoneH  = Math.max(2, bottom - top);
          const color  = zone.direction === 'BULLISH' ? Colors.bullish : Colors.bearish;
          const opacity= zone.type === 'FVG' ? 0.15 : 0.10;
          return (
            <View
              key={i}
              style={{
                position: 'absolute',
                top,
                left: 0,
                right: 0,
                height: zoneH,
                backgroundColor: color,
                opacity,
                borderTopWidth: 1,
                borderBottomWidth: 1,
                borderColor: color + '60',
              }}
            />
          );
        })}

        {/* Candles */}
        {candles.map((candle, i) => {
          const isBull = candle.close >= candle.open;
          const color  = isBull ? Colors.bullish : Colors.bearish;
          const x      = i * (candleWidth + CANDLE_GAP);

          const bodyTop    = toY(Math.max(candle.open, candle.close));
          const bodyBottom = toY(Math.min(candle.open, candle.close));
          const bodyH      = Math.max(1, bodyBottom - bodyTop);

          const wickTop    = toY(candle.high);
          const wickBottom = toY(candle.low);
          const wickH      = Math.max(1, wickBottom - wickTop);

          const wickX = x + candleWidth / 2 - 0.5;

          return (
            <View key={i} style={{ position: 'absolute' }}>
              {/* Wick */}
              <View style={{
                position: 'absolute',
                left: wickX,
                top: wickTop,
                width: 1,
                height: wickH,
                backgroundColor: color,
              }} />
              {/* Body */}
              <View style={{
                position: 'absolute',
                left: x,
                top: bodyTop,
                width: candleWidth,
                height: bodyH,
                backgroundColor: isBull ? color : 'transparent',
                borderWidth: isBull ? 0 : 1,
                borderColor: color,
              }} />
            </View>
          );
        })}

        {/* Current price line */}
        {currentPrice !== undefined && (
          <View style={{
            position: 'absolute',
            top: toY(currentPrice),
            left: 0,
            right: 0,
            height: 1,
            backgroundColor: Colors.accentPrimary,
            opacity: 0.7,
          }} />
        )}
      </View>

      {/* ── Price Axis ───────────────────────────────────────────── */}
      <View style={{ width: PRICE_AXIS_WIDTH, height, justifyContent: 'space-between', paddingVertical: 2 }}>
        {labels.map((label, i) => (
          <Text key={i} style={styles.priceLabel}>{label}</Text>
        ))}
      </View>
    </View>
  );
}

function formatPriceLabel(price: number): string {
  if (price >= 10000) return `${(price / 1000).toFixed(1)}k`;
  if (price >= 1000)  return `${(price / 1000).toFixed(2)}k`;
  if (price >= 1)     return price.toFixed(2);
  return price.toPrecision(3);
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { fontSize: 42, opacity: 0.25, marginBottom: Spacing.md },
  emptyText: { fontSize: FontSizes.sm, fontFamily: 'Inter-Regular', color: Colors.textTertiary },
  gridLine: {
    position: 'absolute',
    left: 0,
    height: 1,
    backgroundColor: Colors.chartGrid,
  },
  priceLabel: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: Colors.textTertiary,
    textAlign: 'right',
    paddingLeft: 4,
  },
});
