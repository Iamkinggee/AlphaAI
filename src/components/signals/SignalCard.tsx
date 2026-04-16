/**
 * AlphaAI — Signal Card Component
 * Full-size card with View on Chart (navigate to Analyse tab) and AI analysis button.
 */
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { StatusBadge } from '@/src/components/ui/StatusBadge';
import { useTheme } from '@/src/contexts/ThemeContext';
import type { Signal } from '@/src/types';

interface SignalCardProps {
  signal: Signal;
  index?: number;
}

export function SignalCard({ signal, index = 0 }: SignalCardProps) {
  const router  = useRouter();
  const { theme } = useTheme();
  const isLong  = signal.direction === 'LONG';

  const accentColor = isLong ? theme.bullish  : theme.bearish;
  const accentDim   = isLong ? theme.bullishDim : theme.bearishDim;

  const scoreCol = signal.score >= 80 ? theme.bullish
    : signal.score >= 65 ? theme.approaching
    : theme.textTertiary;

  return (
    <Animated.View entering={FadeInDown.delay(index * 40).duration(350)}>
      <Pressable
        onPress={() => router.push(`/signal/${signal.id}`)}
        style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
        accessibilityLabel={`${signal.pair} ${signal.direction} signal`}
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={[styles.pair, { color: theme.textPrimary, fontFamily: 'Inter-Bold' }]}>{signal.pair}</Text>
            <View style={styles.badges}>
              <View style={[styles.dirBadge, { backgroundColor: accentDim }]}>
                <Ionicons
                  name={isLong ? 'trending-up' : 'trending-down'}
                  size={11}
                  color={accentColor}
                />
                <Text style={[styles.dirText, { color: accentColor, fontFamily: 'Inter-SemiBold' }]}>
                  {isLong ? 'LONG' : 'SHORT'}
                </Text>
              </View>
              <View style={[styles.tfBadge, { backgroundColor: theme.accentPrimaryDim }]}>
                <Text style={[styles.tfText, { color: theme.accentPrimary, fontFamily: 'Inter-Medium' }]}>
                  {signal.timeframe}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.scoreGroup}>
            <Text style={[styles.scoreNum, { color: scoreCol, fontFamily: 'Inter-Bold' }]}>{signal.score}</Text>
            <Text style={[styles.scoreMax, { color: theme.textTertiary, fontFamily: 'Inter-Regular' }]}>/100</Text>
          </View>
        </View>

        {/* ── Setup type ─────────────────────────────────────────── */}
        <Text style={[styles.setupType, { color: theme.textSecondary, fontFamily: 'Inter-Regular' }]} numberOfLines={1}>
          {signal.setupType}
        </Text>

        {/* ── Price levels ───────────────────────────────────────── */}
        <View style={[styles.levels, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.levelItem}>
            <Text style={[styles.levelLabel, { color: theme.textTertiary, fontFamily: 'Inter-Regular' }]}>Entry</Text>
            <Text style={[styles.levelValue, { color: theme.textPrimary, fontFamily: 'Inter-SemiBold' }]}>
              {signal.entryZone.lowFormatted} – {signal.entryZone.highFormatted}
            </Text>
          </View>
          <View style={[styles.levelDivider, { backgroundColor: theme.border }]} />
          <View style={styles.levelItem}>
            <Text style={[styles.levelLabel, { color: theme.textTertiary, fontFamily: 'Inter-Regular' }]}>SL</Text>
            <Text style={[styles.levelValue, { color: theme.bearish, fontFamily: 'Inter-SemiBold' }]}>
              {signal.stopLossFormatted}
            </Text>
          </View>
          <View style={[styles.levelDivider, { backgroundColor: theme.border }]} />
          <View style={styles.levelItem}>
            <Text style={[styles.levelLabel, { color: theme.textTertiary, fontFamily: 'Inter-Regular' }]}>TP2</Text>
            <Text style={[styles.levelValue, { color: theme.bullish, fontFamily: 'Inter-SemiBold' }]}>
              {signal.takeProfit2.priceFormatted}
            </Text>
          </View>
        </View>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <View style={styles.footer}>
          <StatusBadge status={signal.status} />
          <Text style={[styles.time, { color: theme.textTertiary, fontFamily: 'Inter-Regular' }]}>
            {signal.timeElapsed}
          </Text>

          {/* View on Chart button */}
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              router.navigate({ pathname: '/(tabs)/analyse', params: { pair: signal.pair } } as any);
            }}
            style={[styles.chartBtn, { backgroundColor: theme.accentPrimaryDim, borderColor: theme.accentPrimary + '30' }]}
            accessibilityLabel={`View ${signal.pair} on chart`}
          >
            <Ionicons name="stats-chart" size={12} color={theme.accentPrimary} />
            <Text style={[styles.chartBtnText, { color: theme.accentPrimary, fontFamily: 'Inter-SemiBold' }]}>
              Chart
            </Text>
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card:         { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12 },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  headerLeft:   { flex: 1, marginRight: 12 },
  pair:         { fontSize: 18, marginBottom: 6 },
  badges:       { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dirBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  dirText:      { fontSize: 11 },
  tfBadge:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  tfText:       { fontSize: 11 },
  scoreGroup:   { flexDirection: 'row', alignItems: 'baseline', gap: 1 },
  scoreNum:     { fontSize: 26 },
  scoreMax:     { fontSize: 12, alignSelf: 'flex-end', marginBottom: 2 },
  setupType:    { fontSize: 13, marginBottom: 12 },
  levels:       { flexDirection: 'row', borderRadius: 10, borderWidth: 1, padding: 10, marginBottom: 12, gap: 8 },
  levelItem:    { flex: 1 },
  levelLabel:   { fontSize: 11, marginBottom: 3 },
  levelValue:   { fontSize: 13 },
  levelDivider: { width: 1, marginVertical: 2 },
  footer:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  time:         { flex: 1, fontSize: 12 },
  chartBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  chartBtnText: { fontSize: 12 },
});
