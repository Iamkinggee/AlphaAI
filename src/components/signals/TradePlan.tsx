/**
 * AlphaAI — TradePlan Component
 * Theme-aware entry/SL/TP price table for signal detail views.
 */
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/contexts/ThemeContext';
import type { Signal } from '@/src/types';

interface TradePlanProps {
  signal: Signal;
  compact?: boolean;
}

interface PlanRow {
  label: string;
  value: string;
  sub?: string;
  colorKey: 'textPrimary' | 'bearish' | 'bullish';
  hit?: boolean;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}

export function TradePlan({ signal, compact = false }: TradePlanProps) {
  const { theme } = useTheme();

  const rows: PlanRow[] = [
    { label: 'Entry Zone', value: `${signal.entryZone.lowFormatted} – ${signal.entryZone.highFormatted}`, colorKey: 'textPrimary', icon: 'enter-outline' },
    { label: 'Stop Loss',  value: signal.stopLossFormatted, colorKey: 'bearish', icon: 'close-circle-outline' },
    { label: 'TP 1', value: signal.takeProfit1.priceFormatted, sub: signal.takeProfit1.rr, colorKey: 'bullish', hit: signal.takeProfit1.hit, icon: 'checkmark-circle-outline' },
    { label: 'TP 2', value: signal.takeProfit2.priceFormatted, sub: signal.takeProfit2.rr, colorKey: 'bullish', hit: signal.takeProfit2.hit, icon: 'checkmark-circle-outline' },
    ...(!compact ? [{ label: 'TP 3', value: signal.takeProfit3.priceFormatted, sub: signal.takeProfit3.rr, colorKey: 'bullish' as const, hit: signal.takeProfit3.hit, icon: 'trophy-outline' as const }] : []),
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[styles.sectionTitle, { color: theme.textPrimary, fontFamily: 'Inter-SemiBold', borderBottomColor: theme.border }]}>
        Trade Plan
      </Text>
      {rows.map((row, i) => {
        const color = theme[row.colorKey] as string;
        return (
          <View key={row.label}>
            <View style={styles.row}>
              <View style={styles.labelGroup}>
                <Ionicons name={row.icon} size={14} color={row.hit ? theme.bullish : theme.textTertiary} />
                <Text style={[styles.label, { color: theme.textSecondary, fontFamily: 'Inter-Medium' }]}>{row.label}</Text>
                {row.hit && (
                  <View style={[styles.hitBadge, { backgroundColor: theme.bullishDim }]}>
                    <Text style={[styles.hitText, { color: theme.bullish, fontFamily: 'Inter-SemiBold' }]}>HIT</Text>
                  </View>
                )}
              </View>
              <View style={styles.valueGroup}>
                <Text style={[styles.value, { color, fontFamily: 'Inter-SemiBold' }]}>{row.value}</Text>
                {row.sub && <Text style={[styles.sub, { color: theme.accentPrimary, fontFamily: 'Inter-Regular' }]}>{row.sub}</Text>}
              </View>
            </View>
            {i < rows.length - 1 && <View style={[styles.divider, { backgroundColor: theme.divider }]} />}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginBottom: 14 },
  sectionTitle: { fontSize: 14, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  row:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, minHeight: 44 },
  labelGroup:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label:        { fontSize: 14 },
  hitBadge:     { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  hitText:      { fontSize: 10 },
  valueGroup:   { alignItems: 'flex-end' },
  value:        { fontSize: 15 },
  sub:          { fontSize: 12, marginTop: 2 },
  divider:      { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
});
