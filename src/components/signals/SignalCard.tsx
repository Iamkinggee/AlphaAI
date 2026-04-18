/**
 * AlphaAI — Signal Card Component
 * Full-size card with View on Chart (navigate to Analyse tab) and AI analysis button.
 */
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { StatusBadge } from '@/src/components/ui/StatusBadge';
import { GradientCard } from '@/src/components/ui/GradientCard';
import { Colors } from '@/src/constants/colors';
import { useTheme } from '@/src/contexts/ThemeContext';
import type { Signal } from '@/src/types';

interface SignalCardProps {
  signal: Signal;
  index?: number;
  onDelete?: (id: string) => void;
}

export function SignalCard({ signal, index = 0, onDelete }: SignalCardProps) {
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
        accessibilityLabel={`${signal.pair} ${signal.direction} signal`}
      >
        <GradientCard
          gradientColors={[theme.card, theme.background]}
          borderColor={accentColor + '25'}
          style={styles.card}
        >
          {/* ── Header ─────────────────────────────────────────────── */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.pairRow}>
                <Text style={[styles.pair, { color: theme.textPrimary, fontFamily: 'Inter-Bold' }]}>{signal.pair}</Text>
                {onDelete && (
                  <Pressable
                    onPress={(e) => { e.stopPropagation(); onDelete(signal.id); }}
                    style={styles.cardDeleteBtn}
                    hitSlop={8}
                  >
                    <Ionicons name="trash-outline" size={16} color={theme.error} />
                  </Pressable>
                )}
              </View>
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
              <View style={styles.scoreTextRow}>
                <Text style={[styles.scoreNum, { color: scoreCol, fontFamily: 'Inter-Bold' }]}>{signal.score}</Text>
                <Text style={[styles.scoreMax, { color: theme.textTertiary, fontFamily: 'Inter-Regular' }]}>/100</Text>
              </View>
              {/* Strength Meter */}
              <View style={[styles.meterBg, { backgroundColor: theme.border }]}>
                <View 
                  style={[
                    styles.meterFill, 
                    { backgroundColor: scoreCol, width: `${signal.score}%` }
                  ]} 
                />
              </View>
            </View>
          </View>

          {/* ── Setup type ─────────────────────────────────────────── */}
          <Text style={[styles.setupType, { color: theme.textSecondary, fontFamily: 'Inter-Regular' }]} numberOfLines={1}>
            {signal.setupType}
          </Text>

          {/* ── Price levels ───────────────────────────────────────── */}
          <View style={[styles.levels, { backgroundColor: theme.surface + '80', borderColor: theme.border }]}>
            <View style={styles.levelItem}>
              <Text style={[styles.levelLabel, { color: theme.textTertiary, fontFamily: 'Inter-Regular' }]}>
                {signal.status === 'approaching' ? 'Entry Zone' : 'Entry'}
              </Text>
              <Text style={[styles.levelValue, { color: theme.textPrimary, fontFamily: 'Inter-SemiBold' }]}>
                {signal.status === 'approaching'
                  ? `${signal.entryZone.lowFormatted} – ${signal.entryZone.highFormatted}`
                  : signal.entryZone.lowFormatted}
              </Text>
              {signal.status === 'approaching' && signal.distanceFormatted !== '—' ? (
                <Text style={[styles.levelHint, { color: theme.approaching, fontFamily: 'Inter-Medium' }]}>
                  {signal.distanceFormatted} away
                </Text>
              ) : null}
            </View>
            <View style={[styles.levelDivider, { backgroundColor: theme.border }]} />
            <View style={styles.levelItem}>
              <Text style={[styles.levelLabel, { color: theme.textTertiary, fontFamily: 'Inter-Regular' }]}>Stop Loss</Text>
              <Text style={[styles.levelValue, { color: theme.bearish, fontFamily: 'Inter-SemiBold' }]}>
                {signal.stopLossFormatted}
              </Text>
            </View>
            <View style={[styles.levelDivider, { backgroundColor: theme.border }]} />
            <View style={styles.levelItem}>
              <Text style={[styles.levelLabel, { color: theme.textTertiary, fontFamily: 'Inter-Regular' }]}>Target 2</Text>
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
        </GradientCard>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card:         { padding: 16, marginBottom: 12 },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  headerLeft:   { flex: 1, marginRight: 12 },
  pairRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  pair:         { fontSize: 22 },
  cardDeleteBtn:{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.error + '10' },
  badges:       { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dirBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  dirText:      { fontSize: 13 },
  tfBadge:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  tfText:       { fontSize: 13 },
  scoreGroup:   { alignItems: 'flex-end', gap: 4 },
  scoreTextRow: { flexDirection: 'row', alignItems: 'baseline', gap: 1 },
  scoreNum:     { fontSize: 26 },
  scoreMax:     { fontSize: 13, alignSelf: 'flex-end', marginBottom: 2 },
  meterBg:      { width: 60, height: 4, borderRadius: 2, overflow: 'hidden' },
  meterFill:    { height: '100%', borderRadius: 2 },
  setupType:    { fontSize: 15, marginBottom: 14, opacity: 0.8 },
  levels:       { flexDirection: 'row', borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 14, gap: 10 },
  levelItem:    { flex: 1 },
  levelLabel:   { fontSize: 12, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  levelValue:   { fontSize: 15 },
  levelHint:    { fontSize: 12, marginTop: 4 },
  levelDivider: { width: 1, marginVertical: 2 },
  footer:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
  time:         { flex: 1, fontSize: 14, opacity: 0.7 },
  chartBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  chartBtnText: { fontSize: 14 },
});

