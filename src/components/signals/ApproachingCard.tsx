/**
 * AlphaAI — ApproachingCard Component
 * Featured card for a signal that is approaching its entry zone.
 * Displayed prominently on the Dashboard — larger, more spacious than a regular SignalCard.
 */
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { GradientCard } from '@/src/components/ui/GradientCard';
import { StatusBadge } from '@/src/components/ui/StatusBadge';
import { Colors } from '@/src/constants/colors';
import { FontSizes } from '@/src/constants/fonts';
import { Spacing, BorderRadius } from '@/src/constants/spacing';
import { scoreColor, scoreLabel } from '@/src/utils/formatters';
import type { Signal } from '@/src/types';

interface ApproachingCardProps {
  signal: Signal;
  index?: number;
}

export function ApproachingCard({ signal, index = 0 }: ApproachingCardProps) {
  const router = useRouter();
  const isLong = signal.direction === 'LONG';
  const dirColor = isLong ? Colors.bullish : Colors.bearish;

  const sColor = scoreColor(signal.score, {
    bullish: Colors.bullish,
    approaching: Colors.approaching,
    textTertiary: Colors.textTertiary,
  });
  const sLabel = scoreLabel(signal.score);

  return (
    <Animated.View entering={FadeInDown.delay(index * 80).duration(380)}>
      <Pressable
        onPress={() => router.push(`/signal/${signal.id}`)}
        accessibilityLabel={`${signal.pair} approaching signal`}
      >
        <GradientCard
          gradientColors={[Colors.approaching + '12', Colors.approaching + '04']}
          borderColor={Colors.approaching + '35'}
          style={styles.card}
        >
          {/* Top row */}
          <View style={styles.topRow}>
            <View style={styles.topLeft}>
              <Text style={styles.pair}>{signal.pair}</Text>
              <View style={styles.badgeRow}>
                <View style={[styles.dirBadge, { backgroundColor: dirColor + '18' }]}>
                  <Text style={[styles.dirText, { color: dirColor }]}>
                    {isLong ? '🟢 LONG' : '🔴 SHORT'}
                  </Text>
                </View>
                <Text style={styles.tfBadge}>{signal.timeframe}</Text>
              </View>
            </View>

            {/* Score pill */}
            <View style={styles.scoreSection}>
              <Text style={[styles.scoreNum, { color: sColor }]}>{signal.score}</Text>
              <Text style={styles.scoreLabel}>{sLabel}</Text>
            </View>
          </View>

          {/* Setup description */}
          <Text style={styles.setup} numberOfLines={1}>{signal.setupType}</Text>

          {/* Zone + distance row */}
          <View style={styles.zoneRow}>
            <View style={styles.zoneItem}>
              <Text style={styles.zoneLabel}>Entry Zone</Text>
              <Text style={styles.zoneValue}>
                {signal.entryZone.lowFormatted} – {signal.entryZone.highFormatted}
              </Text>
            </View>
            <View style={styles.zoneDivider} />
            <View style={styles.zoneItem}>
              <Text style={styles.zoneLabel}>TP2 Target</Text>
              <Text style={[styles.zoneValue, { color: Colors.bullish }]}>
                {signal.takeProfit2.priceFormatted}
              </Text>
            </View>
            <View style={styles.zoneDivider} />
            <View style={styles.zoneItem}>
              <Text style={styles.zoneLabel}>Best R:R</Text>
              <Text style={[styles.zoneValue, { color: Colors.info }]}>
                {signal.takeProfit2.rr}
              </Text>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <StatusBadge status={signal.status} />
            <Text style={styles.distance}>
              {signal.distanceFormatted} · {signal.timeElapsed}
            </Text>
          </View>
        </GradientCard>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  topLeft: {
    flex: 1,
    marginRight: Spacing.md,
  },
  pair: {
    fontSize: FontSizes.xl,
    fontFamily: 'Inter-Bold',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dirBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.xs,
  },
  dirText: {
    fontSize: FontSizes.xs,
    fontFamily: 'Inter-SemiBold',
  },
  tfBadge: {
    fontSize: FontSizes.xs,
    fontFamily: 'Inter-Medium',
    color: Colors.info,
    backgroundColor: Colors.infoDim,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  scoreSection: {
    alignItems: 'center',
  },
  scoreNum: {
    fontSize: FontSizes['3xl'],
    fontFamily: 'Inter-Bold',
    lineHeight: 36,
  },
  scoreLabel: {
    fontSize: FontSizes.xs,
    fontFamily: 'Inter-Regular',
    color: Colors.textTertiary,
  },
  setup: {
    fontSize: FontSizes.sm,
    fontFamily: 'Inter-Regular',
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  zoneRow: {
    flexDirection: 'row',
    backgroundColor: Colors.background + '80',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  zoneItem: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
  },
  zoneDivider: {
    width: 1,
    backgroundColor: Colors.border,
  },
  zoneLabel: {
    fontSize: FontSizes.xs,
    fontFamily: 'Inter-Regular',
    color: Colors.textTertiary,
    marginBottom: 3,
  },
  zoneValue: {
    fontSize: FontSizes.xs,
    fontFamily: 'Inter-SemiBold',
    color: Colors.textPrimary,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  distance: {
    fontSize: FontSizes.xs,
    fontFamily: 'Inter-Regular',
    color: Colors.approaching,
    flex: 1,
  },
});
