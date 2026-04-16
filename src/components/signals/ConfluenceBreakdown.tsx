/**
 * AlphaAI — ConfluenceBreakdown Component
 * Theme-aware breakdown of all SMC confluence factors.
 */
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/contexts/ThemeContext';
import { scoreLabel } from '@/src/utils/formatters';
import type { ConfluenceFactor } from '@/src/types';

interface ConfluenceBreakdownProps {
  factors: ConfluenceFactor[];
  totalScore: number;
  activeOnly?: boolean;
}

export function ConfluenceBreakdown({ factors, totalScore, activeOnly = false }: ConfluenceBreakdownProps) {
  const { theme } = useTheme();

  const visible     = activeOnly ? factors.filter((f) => f.active) : factors;
  const maxScore    = factors.reduce((s, f) => s + f.points, 0);
  const activeScore = factors.filter((f) => f.active).reduce((s, f) => s + f.points, 0);
  const pct         = Math.min(100, (activeScore / (maxScore || 100)) * 100);

  const scoreColor  = totalScore >= 80 ? theme.bullish : totalScore >= 65 ? theme.approaching : theme.textTertiary;
  const label       = scoreLabel(totalScore);

  return (
    <View style={[styles.container, { backgroundColor: theme.card, borderColor: theme.border }]}>

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <View>
          <Text style={[styles.label, { color: theme.textPrimary, fontFamily: 'Inter-SemiBold' }]}>{label} Setup</Text>
          <Text style={[styles.sub, { color: theme.textTertiary, fontFamily: 'Inter-Regular' }]}>
            {factors.filter((f) => f.active).length} of {factors.length} factors active
          </Text>
        </View>
        <View style={styles.scoreCircle}>
          <Text style={[styles.scoreNum, { color: scoreColor, fontFamily: 'Inter-Bold' }]}>{totalScore}</Text>
          <Text style={[styles.scoreMax, { color: theme.textTertiary, fontFamily: 'Inter-Regular' }]}>/100</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={[styles.track, { backgroundColor: theme.border }]}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: scoreColor }]} />
      </View>

      {/* Factors */}
      <View style={styles.list}>
        {visible.map((f, i) => (
          <View key={i} style={[styles.factorRow, !f.active && styles.inactive]}>
            <Ionicons
              name={f.active ? 'checkmark-circle' : 'ellipse-outline'}
              size={16}
              color={f.active ? theme.bullish : theme.textDisabled}
            />
            <Text style={[styles.factorName, { color: f.active ? theme.textPrimary : theme.textTertiary, fontFamily: 'Inter-Regular' }]} numberOfLines={1}>
              {f.factor}
            </Text>
            <View style={[styles.pts, { backgroundColor: f.active ? theme.bullishDim : theme.surface }]}>
              <Text style={[styles.ptsText, { color: f.active ? theme.bullish : theme.textTertiary, fontFamily: 'Inter-Medium' }]}>
                +{f.points}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Total */}
      <View style={[styles.totalRow, { borderTopColor: theme.border }]}>
        <Text style={[styles.totalLabel, { color: theme.textPrimary, fontFamily: 'Inter-SemiBold' }]}>Score Total</Text>
        <Text style={[styles.totalVal, { color: scoreColor, fontFamily: 'Inter-Bold' }]}>
          {activeScore} / {maxScore}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginBottom: 14 },
  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  label:      { fontSize: 15, marginBottom: 2 },
  sub:        { fontSize: 12 },
  scoreCircle:{ flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  scoreNum:   { fontSize: 32 },
  scoreMax:   { fontSize: 13, alignSelf: 'flex-end', marginBottom: 4 },
  track:      { height: 3, marginHorizontal: 16, borderRadius: 2, overflow: 'hidden', marginBottom: 14 },
  fill:       { height: '100%', borderRadius: 2 },
  list:       { paddingHorizontal: 16, gap: 10, paddingBottom: 14 },
  factorRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  inactive:   { opacity: 0.5 },
  factorName: { flex: 1, fontSize: 14 },
  pts:        { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  ptsText:    { fontSize: 12 },
  totalRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingVertical: 13 },
  totalLabel: { fontSize: 14 },
  totalVal:   { fontSize: 16 },
});
