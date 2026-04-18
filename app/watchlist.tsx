/**
 * AlphaAI — Watchlist Screen
 * Theme-aware, tappable pair cards (→ signal detail or Analyse tab).
 * Delete replaces Scan. Suggested pairs to add.
 */
import { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Alert } from 'react-native';
import Animated, { FadeInDown, FadeInRight, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/contexts/ThemeContext';
import { SkeletonLoader } from '@/src/components/ui/SkeletonLoader';
import { SparklineChart } from '@/src/components/charts';
import { useWatchlist, useMarket, useSignals } from '@/src/hooks';

const SUGGESTED_PAIRS = [
  { pair: 'ADA/USDT',   base: 'ADA',   quote: 'USDT' },
  { pair: 'DOT/USDT',   base: 'DOT',   quote: 'USDT' },
  { pair: 'MATIC/USDT', base: 'MATIC', quote: 'USDT' },
  { pair: 'OP/USDT',    base: 'OP',    quote: 'USDT' },
  { pair: 'ARB/USDT',   base: 'ARB',   quote: 'USDT' },
  { pair: 'DOGE/USDT',  base: 'DOGE',  quote: 'USDT' },
];

export default function WatchlistScreen() {
  const { theme } = useTheme();
  const router    = useRouter();
  const insets    = useSafeAreaInsets();

  const { items, isLoading, add, remove, isWatched } = useWatchlist();
  const { priceTicks } = useMarket();
  const { signals }    = useSignals();

  const [deleting, setDeleting] = useState<string | null>(null);

  const handlePairPress = (pair: string) => {
    // If there's an active/approaching signal for this pair, go to it
    const signal = signals.find(
      (s) => s.pair === pair && (s.status === 'active' || s.status === 'approaching')
    );
    if (signal) {
      router.push(`/signal/${signal.id}`);
    } else {
      // Otherwise open Analyse tab with pair pre-selected
      router.navigate({ pathname: '/(tabs)/analyse', params: { pair } } as any);
    }
  };

  const handleDelete = (id: string, pair: string) => {
    Alert.alert(
      'Remove from Watchlist',
      `Remove ${pair} from your watchlist?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setDeleting(id);
            setTimeout(() => { remove(id); setDeleting(null); }, 300);
          },
        },
      ]
    );
  };

  const suggested = SUGGESTED_PAIRS.filter((p) => !isWatched(p.pair));

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16, borderBottomColor: theme.border }]}>
        <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name="arrow-back" size={18} color={theme.textPrimary} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={[styles.headerTitle, { color: theme.textPrimary, fontFamily: 'Inter-Bold' }]}>Watchlist</Text>
          <Text style={[styles.headerSub, { color: theme.textTertiary, fontFamily: 'Inter-Regular' }]}>{items.length} pair{items.length !== 1 ? 's' : ''} tracked</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: theme.accentPrimaryDim, borderColor: theme.accentPrimary + '40' }]}>
          <Ionicons name="bookmark" size={14} color={theme.accentPrimary} />
          <Text style={[styles.badgeText, { color: theme.accentPrimary, fontFamily: 'Inter-SemiBold' }]}>{items.length}</Text>
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          isLoading ? (
            <View>
              {[0, 1, 2].map((i) => (
                <SkeletonLoader key={i} width="100%" height={82} borderRadius={14} style={{ marginBottom: 12 }} />
              ))}
            </View>
          ) : null
        }
        ListFooterComponent={
          suggested.length > 0 ? (
            <Animated.View entering={FadeInDown.delay(300).duration(400)}>
              <Text style={[styles.sectionLabel, { color: theme.textTertiary, fontFamily: 'Inter-SemiBold' }]}>
                Suggested Pairs
              </Text>
              <View style={[styles.suggestGrid]}>
                {suggested.map((p) => (
                  <Pressable
                    key={p.pair}
                    onPress={() => add(p.pair, p.base, p.quote)}
                    style={[styles.suggestChip, { backgroundColor: theme.card, borderColor: theme.border }]}
                  >
                    <Text style={[styles.suggestPair, { color: theme.textPrimary, fontFamily: 'Inter-SemiBold' }]}>
                      {p.base}
                    </Text>
                    <Ionicons name="add-circle-outline" size={16} color={theme.accentPrimary} />
                  </Pressable>
                ))}
              </View>
            </Animated.View>
          ) : null
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: theme.accentPrimaryDim, borderColor: theme.accentPrimary + '30' }]}>
                <Ionicons name="bookmark-outline" size={36} color={theme.accentPrimary} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.textPrimary, fontFamily: 'Inter-Bold' }]}>No pairs yet</Text>
              <Text style={[styles.emptyBody, { color: theme.textTertiary, fontFamily: 'Inter-Regular' }]}>
                Add pairs from the suggestions below to monitor their signals and price action.
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item, index }) => {
          const tick       = priceTicks[item.pair];
          const isPos      = (tick?.change24h ?? 0) >= 0;
          const changeColor= isPos ? theme.bullish : theme.bearish;

          // Signal badge for this pair
          const signal = signals.find(
            (s) => s.pair === item.pair && (s.status === 'active' || s.status === 'approaching')
          );

          const basePrice = tick?.price || 100;
          const change    = tick?.change24h || 0;
          const sparkData = Array.from({ length: 20 }, (_, i) => {
            const prog = i / 19;
            const noise = Math.sin(i * 0.8) * Math.abs(change) * 0.2;
            return basePrice * (1 + (change / 100) * prog) + noise;
          });

          return (
            <Animated.View entering={FadeInDown.delay(index * 60).duration(350)}>
              <Pressable
                onPress={() => handlePairPress(item.pair)}
                style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
                accessibilityLabel={`Open ${item.pair} details`}
              >
                <View style={styles.cardMain}>
                  {/* Left: pair + change */}
                  <View style={styles.cardLeft}>
                    <View style={styles.pairRow}>
                      <Text style={[styles.pairName, { color: theme.textPrimary, fontFamily: 'Inter-Bold' }]}>{item.pair}</Text>
                      {signal && (
                        <View style={[styles.signalPill, { backgroundColor: signal.status === 'active' ? theme.bullishDim : theme.approachingDim, borderColor: (signal.status === 'active' ? theme.bullish : theme.approaching) + '50' }]}>
                          <Ionicons name={signal.status === 'active' ? 'flame' : 'radio-button-on'} size={8} color={signal.status === 'active' ? theme.bullish : theme.approaching} />
                          <Text style={[styles.signalPillText, { color: signal.status === 'active' ? theme.bullish : theme.approaching, fontFamily: 'Inter-SemiBold' }]}>
                            {signal.status === 'active' ? 'ACTIVE' : 'APPROACH'}
                          </Text>
                        </View>
                      )}
                    </View>
                    {tick ? (
                      <View style={styles.changeRow}>
                        <Ionicons name={isPos ? 'trending-up' : 'trending-down'} size={12} color={changeColor} />
                        <Text style={[styles.changeText, { color: changeColor, fontFamily: 'Inter-Medium' }]}>{tick.change24hFormatted}</Text>
                        <Text style={[styles.changeLabel, { color: theme.textTertiary, fontFamily: 'Inter-Regular' }]}>24h</Text>
                      </View>
                    ) : (
                      <Text style={[styles.changeLabel, { color: theme.textTertiary, fontFamily: 'Inter-Regular' }]}>Loading…</Text>
                    )}
                    {(item.alertAbove || item.alertBelow) && (
                      <View style={styles.alertRow}>
                        <Ionicons name="notifications-outline" size={11} color={theme.approaching} />
                        <Text style={[styles.alertText, { color: theme.approaching, fontFamily: 'Inter-Regular' }]}>
                          {item.alertAbove ? `≥ ${item.alertAbove.toLocaleString()}` : ''}
                          {item.alertAbove && item.alertBelow ? '  ' : ''}
                          {item.alertBelow ? `≤ ${item.alertBelow.toLocaleString()}` : ''}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Centre: sparkline */}
                  <Animated.View entering={FadeInRight.delay(index * 100 + 200).duration(500)}>
                    <SparklineChart data={sparkData} width={72} height={30} color={changeColor} />
                  </Animated.View>

                  {/* Right: price + delete */}
                  <View style={styles.cardRight}>
                    {tick ? (
                      <Text style={[styles.price, { color: theme.textPrimary, fontFamily: 'Inter-SemiBold' }]}>{tick.priceFormatted}</Text>
                    ) : (
                      <SkeletonLoader width={72} height={20} borderRadius={6} />
                    )}
                    <Pressable
                      onPress={() => handleDelete(item.id, item.pair)}
                      style={[styles.deleteBtn, { backgroundColor: theme.error + '15', borderColor: theme.error + '30' }]}
                      accessibilityLabel={`Remove ${item.pair} from watchlist`}
                    >
                      <Ionicons name="trash-outline" size={15} color={theme.error} />
                    </Pressable>
                  </View>
                </View>

                {/* Tap hint */}
                <View style={[styles.tapHintRow]}>
                  <Ionicons name={signal ? 'flash-outline' : 'stats-chart-outline'} size={11} color={theme.textTertiary} />
                  <Text style={[styles.tapHint, { color: theme.textTertiary, fontFamily: 'Inter-Regular' }]}>
                    Tap to {signal ? 'view signal' : 'analyse'}
                  </Text>
                </View>
              </Pressable>
            </Animated.View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1 },
  header:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn:       { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  headerTitle:   { fontSize: 22 },
  headerSub:     { fontSize: 14, marginTop: 2 },
  badge:         { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText:     { fontSize: 15 },
  list:          { paddingHorizontal: 16, paddingTop: 16 },
  card:          { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 12 },
  cardMain:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardLeft:      { flex: 1 },
  pairRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  pairName:      { fontSize: 19 },
  signalPill:    { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 6, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 },
  signalPillText:{ fontSize: 11 },
  changeRow:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  changeText:    { fontSize: 15 },
  changeLabel:   { fontSize: 14 },
  alertRow:      { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  alertText:     { fontSize: 13 },
  cardRight:     { alignItems: 'flex-end', gap: 8 },
  price:         { fontSize: 18 },
  deleteBtn:     { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  tapHintRow:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(128,128,128,0.15)' },
  tapHint:       { fontSize: 13 },
  sectionLabel:  { fontSize: 15, marginBottom: 12, marginTop: 8 },
  suggestGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  suggestChip:   { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  suggestPair:   { fontSize: 16 },
  empty:         { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 },
  emptyIcon:     { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, marginBottom: 20 },
  emptyTitle:    { fontSize: 22, marginBottom: 10 },
  emptyBody:     { fontSize: 16, textAlign: 'center', lineHeight: 22 },
});
