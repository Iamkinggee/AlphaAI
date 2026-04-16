/**
 * AlphaAI — TradeCard Component
 * Consistent card for journal entries (completed or manual trades).
 */
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { GradientCard } from '@/src/components/ui/GradientCard';
import { Colors } from '@/src/constants/colors';
import { FontSizes } from '@/src/constants/fonts';
import { Spacing, BorderRadius } from '@/src/constants/spacing';
import { formatShortDate } from '@/src/utils/formatters';
import type { Trade } from '@/src/types';

interface TradeCardProps {
  trade: Trade;
  index?: number;
}

export function TradeCard({ trade, index = 0 }: TradeCardProps) {
  const isWin = trade.result === 'win';
  const isLoss = trade.result === 'loss';
  const pnlColor = isWin ? Colors.bullish : isLoss ? Colors.bearish : Colors.approaching;

  const isLong = trade.direction === 'LONG';
  const dirColor = isLong ? Colors.bullish : Colors.bearish;
  const dirDim = isLong ? Colors.bullishDim : Colors.bearishDim;

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(350)}>
      <GradientCard
        gradientColors={[Colors.card, Colors.card]}
        borderColor={Colors.cardBorder}
        style={styles.card}
      >
        {/* Top: Pair, Direction, PnL */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.pair}>{trade.pair}</Text>
            <View style={[styles.dirBadge, { backgroundColor: dirDim }]}>
              <Text style={[styles.dirText, { color: dirColor }]}>{trade.direction}</Text>
            </View>
            <Text style={styles.tf}>{trade.timeframe}</Text>
          </View>
          <Text style={[styles.pnl, { color: pnlColor }]}>{trade.pnlFormatted ?? '—'}</Text>
        </View>

        {/* Middle: Entry, Exit, RR */}
        <View style={styles.details}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Entry</Text>
            <Text style={styles.detailValue}>{trade.entryFormatted}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Exit</Text>
            <Text style={styles.detailValue}>{trade.exitFormatted ?? '—'}</Text>
          </View>
          <View style={[styles.detailItem, { flex: 1.5 }]}>
            <Text style={styles.detailLabel}>R:R Achieved</Text>
            <Text style={[styles.detailValue, { color: Colors.info }]}>{trade.rrAchieved ?? '—'}</Text>
          </View>
        </View>

        {/* Footer: Setup type + Date */}
        <View style={styles.footer}>
          <Text style={styles.setup} numberOfLines={1}>{trade.setup}</Text>
          <Text style={styles.date}>{formatShortDate(trade.entryDate)}</Text>
        </View>
      </GradientCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  pair: {
    fontSize: FontSizes.md,
    fontFamily: 'Inter-Bold',
    color: Colors.textPrimary,
  },
  dirBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  dirText: {
    fontSize: FontSizes.xs,
    fontFamily: 'Inter-SemiBold',
  },
  tf: {
    fontSize: FontSizes.xs,
    fontFamily: 'Inter-Medium',
    color: Colors.textTertiary,
  },
  pnl: {
    fontSize: FontSizes.lg,
    fontFamily: 'Inter-Bold',
  },
  details: {
    flexDirection: 'row',
    gap: Spacing.xl,
    marginBottom: Spacing.md,
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: FontSizes.xs,
    fontFamily: 'Inter-Regular',
    color: Colors.textTertiary,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: FontSizes.xs,
    fontFamily: 'Inter-Medium',
    color: Colors.textPrimary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    paddingTop: Spacing.sm,
  },
  setup: {
    flex: 1,
    fontSize: FontSizes.xs,
    fontFamily: 'Inter-Regular',
    color: Colors.textTertiary,
    marginRight: Spacing.md,
  },
  date: {
    fontSize: FontSizes.xs,
    fontFamily: 'Inter-Regular',
    color: Colors.textTertiary,
  },
});
