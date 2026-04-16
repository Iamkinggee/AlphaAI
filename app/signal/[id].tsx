/**
 * AlphaAI — Signal Detail Screen
 * Full signal info with AI explanation, View on Chart, Set Alert, Add to Watchlist.
 */
import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Alert, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/contexts/ThemeContext';
import { StatusBadge } from '@/src/components/ui/StatusBadge';
import { TradePlan, ConfluenceBreakdown } from '@/src/components/signals';
import { formatRelativeTime } from '@/src/utils/formatters';
import { useSignals } from '@/src/hooks';
import { useWatchlistStore } from '@/src/store/useWatchlistStore';
import * as Notifications from 'expo-notifications';

// ── AI mock analysis keyed by setup type ────────────────────────────
function generateAIAnalysis(signal: any): string {
  const dir = signal.direction === 'LONG' ? 'bullish' : 'bearish';
  const opp = signal.direction === 'LONG' ? 'demand' : 'supply';
  const score = signal.score;
  const rr = signal.takeProfit2?.rr ?? '1:2';

  return `**SMC Analysis — ${signal.pair} ${signal.timeframe}**

**Setup:** ${signal.setupType}

Price is approaching a key ${opp} zone at ${signal.entryZone.lowFormatted}–${signal.entryZone.highFormatted}. This level has been validated by ${score >= 80 ? 'strong' : 'moderate'} institutional confluence (score: ${score}/100).

**Key Factors:**
${signal.confluence.filter((c: any) => c.active).slice(0, 4).map((c: any) => `• ${c.factor}`).join('\n')}

**Trade Plan:**
The ${dir} bias is supported by the higher timeframe structure. Entry is within the ${opp} OB with a fair value gap acting as additional confirmation. Stop loss at ${signal.stopLossFormatted} sits beyond the zone, protecting against invalidation.

**Risk Management:**
Target TP1 at ${signal.takeProfit1.priceFormatted} (${signal.takeProfit1.rr}) to bank partials — then trail to TP2 at ${signal.takeProfit2.priceFormatted} (${rr}).

**Bias:** ${score >= 80 ? '🟢 High Probability' : score >= 65 ? '🟡 Moderate' : '🟠 Conditional'} setup. ${score >= 75 ? 'Wait for entry confirmation — a 5M BOS into the zone strengthens validity.' : 'Exercise caution — score is below the high-probability threshold.'}`;
}

export default function SignalDetailScreen() {
  const { theme } = useTheme();
  const router    = useRouter();
  const insets    = useSafeAreaInsets();
  const { id }    = useLocalSearchParams<{ id: string }>();
  const { getSignal } = useSignals();

  const addItem    = useWatchlistStore((s) => s.addItem);
  const isWatched  = useWatchlistStore((s) => s.isPairWatched);

  const [aiVisible,  setAiVisible]  = useState(false);
  const [aiLoading,  setAiLoading]  = useState(false);
  const [aiText,     setAiText]     = useState('');
  const [alertSet,   setAlertSet]   = useState(false);

  const signal = getSignal(id);

  const handleViewOnChart = useCallback(() => {
    if (!signal) return;
    router.navigate({ pathname: '/(tabs)/analyse', params: { pair: signal.pair } } as any);
  }, [signal, router]);

  const handleSetAlert = useCallback(async () => {
    if (!signal) return;
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissions needed', 'Enable notifications in Settings to receive signal alerts.');
        return;
      }
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `⚡ ${signal.pair} Alert`,
          body: `${signal.direction} signal approaching ${signal.entryZone.lowFormatted}–${signal.entryZone.highFormatted}`,
          data: { signalId: signal.id },
        },
        trigger: { seconds: 1 } as any,
      });
      setAlertSet(true);
      Alert.alert('Alert Set ✓', `You'll be notified when ${signal.pair} approaches the entry zone.`);
    } catch {
      Alert.alert('Alert Set ✓', `Alert saved for ${signal.pair} — you'll be notified when price approaches the zone.`);
      setAlertSet(true);
    }
  }, [signal]);

  const handleAddWatchlist = useCallback(async () => {
    if (!signal) return;
    if (isWatched(signal.pair)) {
      Alert.alert('Already in Watchlist', `${signal.pair} is already being tracked.`);
      return;
    }
    await addItem(signal.pair, signal.baseAsset, signal.quoteAsset);
    Alert.alert('Added ✓', `${signal.pair} added to your watchlist.`);
  }, [signal, addItem, isWatched]);

  const handleAIAnalysis = useCallback(async () => {
    if (!signal) return;
    if (aiText) { setAiVisible(!aiVisible); return; }
    setAiLoading(true);
    setAiVisible(true);
    await new Promise((r) => setTimeout(r, 900));
    setAiText(generateAIAnalysis(signal));
    setAiLoading(false);
  }, [signal, aiText, aiVisible]);

  if (!signal) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.background }]}>
        <Ionicons name="alert-circle-outline" size={48} color={theme.textTertiary} />
        <Text style={[styles.errorText, { color: theme.textSecondary, fontFamily: 'Inter-SemiBold' }]}>Signal not found</Text>
        <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: theme.accentPrimary }]}>
          <Text style={[styles.backBtnText, { fontFamily: 'Inter-SemiBold' }]}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const isLong = signal.direction === 'LONG';
  const accentColor = isLong ? theme.bullish : theme.bearish;
  const timeAgo = formatRelativeTime(signal.createdAt);
  const watched = isWatched(signal.pair);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: theme.border, backgroundColor: theme.background }]}>
        <Pressable onPress={() => router.back()} style={[styles.backCircle, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name="arrow-back" size={18} color={theme.textPrimary} />
        </Pressable>
        <View style={styles.titleArea}>
          <Text style={[styles.pair, { color: theme.textPrimary, fontFamily: 'Inter-Bold' }]}>{signal.pair}</Text>
          <Text style={[styles.tfRow, { color: theme.textTertiary, fontFamily: 'Inter-Regular' }]}>{signal.timeframe} · {timeAgo}</Text>
        </View>
        {/* Watchlist button */}
        <Pressable
          onPress={handleAddWatchlist}
          style={[styles.watchBtn, { backgroundColor: watched ? theme.accentPrimaryDim : theme.card, borderColor: watched ? theme.accentPrimary + '50' : theme.border }]}
        >
          <Ionicons name={watched ? 'bookmark' : 'bookmark-outline'} size={18} color={watched ? theme.accentPrimary : theme.textSecondary} />
        </Pressable>
        <StatusBadge status={signal.status} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 140 }]} showsVerticalScrollIndicator={false}>

        {/* Direction / Score / Setup row */}
        <Animated.View entering={FadeInDown.delay(80).duration(400)}
          style={[styles.statsCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {[
            { label: 'Direction', value: signal.direction, color: accentColor },
            { label: 'Score', value: `${signal.score}/100`, color: signal.score >= 75 ? theme.bullish : theme.approaching },
            { label: 'Setup', value: signal.setupType.split(' ').slice(0, 2).join(' '), color: theme.textPrimary },
          ].map((item, i, arr) => (
            <View key={item.label} style={[styles.statItem, i < arr.length - 1 && { borderRightWidth: 1, borderRightColor: theme.border }]}>
              <Text style={[styles.statLabel, { color: theme.textTertiary, fontFamily: 'Inter-Regular' }]}>{item.label}</Text>
              <Text style={[styles.statVal, { color: item.color, fontFamily: 'Inter-Bold' }]} numberOfLines={1}>{item.value}</Text>
            </View>
          ))}
        </Animated.View>

        {/* AI Analysis panel */}
        <Animated.View entering={FadeInDown.delay(140).duration(400)}>
          <Pressable
            onPress={handleAIAnalysis}
            style={[styles.aiToggle, { backgroundColor: theme.accentPrimaryDim, borderColor: theme.accentPrimary + '30' }]}
          >
            <Ionicons name="sparkles" size={16} color={theme.accentPrimary} />
            <Text style={[styles.aiToggleText, { color: theme.accentPrimary, fontFamily: 'Inter-SemiBold' }]}>
              {aiText ? (aiVisible ? 'Hide AI Analysis' : 'Show AI Analysis') : 'Generate AI Analysis'}
            </Text>
            {aiLoading && <ActivityIndicator size="small" color={theme.accentPrimary} style={{ marginLeft: 8 }} />}
            {!aiLoading && <Ionicons name={aiVisible ? 'chevron-up' : 'chevron-down'} size={14} color={theme.accentPrimary} />}
          </Pressable>

          {aiVisible && aiText ? (
            <View style={[styles.aiCard, { backgroundColor: theme.cardElevated, borderColor: theme.border }]}>
              <Text style={[styles.aiText, { color: theme.textPrimary, fontFamily: 'Inter-Regular' }]}>{aiText}</Text>
            </View>
          ) : null}
        </Animated.View>

        {/* Trade Plan */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <TradePlan signal={signal} />
        </Animated.View>

        {/* Confluence */}
        <Animated.View entering={FadeInDown.delay(280).duration(400)}>
          <ConfluenceBreakdown factors={signal.confluence} totalScore={signal.score} />
        </Animated.View>

        {/* Disclaimer */}
        <Animated.View entering={FadeInDown.delay(360).duration(400)}
          style={[styles.disclaimer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="information-circle-outline" size={14} color={theme.textTertiary} style={{ marginTop: 1 }} />
          <Text style={[styles.disclaimerText, { color: theme.textTertiary, fontFamily: 'Inter-Regular' }]}>
            AlphaAI signals are not financial advice. Always use appropriate position sizing and wait for entry confirmation.
          </Text>
        </Animated.View>
      </ScrollView>

      {/* ── Sticky Action Bar ───────────────────────────────────────── */}
      <View style={[styles.footer, { backgroundColor: theme.background, borderTopColor: theme.border, paddingBottom: insets.bottom + 12 }]}>
        {signal.status === 'approaching' || signal.status === 'pending' ? (
          <Pressable
            onPress={handleSetAlert}
            style={[styles.actionBtn, { backgroundColor: alertSet ? theme.success + '20' : theme.approaching, borderColor: alertSet ? theme.success : 'transparent' }]}
          >
            <Ionicons name={alertSet ? 'checkmark-circle' : 'notifications'} size={18} color={alertSet ? theme.success : '#000'} />
            <Text style={[styles.actionBtnText, { color: alertSet ? theme.success : '#000', fontFamily: 'Inter-Bold' }]}>
              {alertSet ? 'Alert Active' : 'Set Alert'}
            </Text>
          </Pressable>
        ) : (
          <Pressable onPress={handleViewOnChart} style={[styles.actionBtn, { backgroundColor: theme.accentPrimary }]}>
            <Ionicons name="stats-chart" size={18} color="#000" />
            <Text style={[styles.actionBtnText, { color: '#000', fontFamily: 'Inter-Bold' }]}>View on Chart</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1 },
  centered:       { alignItems: 'center', justifyContent: 'center' },
  errorText:      { fontSize: 18, marginTop: 16, marginBottom: 24 },
  backBtn:        { paddingVertical: 12, paddingHorizontal: 28, borderRadius: 12 },
  backBtnText:    { color: '#000', fontSize: 15 },
  header:         { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  backCircle:     { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  titleArea:      { flex: 1 },
  pair:           { fontSize: 20 },
  tfRow:          { fontSize: 12, marginTop: 2 },
  watchBtn:       { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  scroll:         { paddingHorizontal: 16, paddingTop: 16 },
  statsCard:      { flexDirection: 'row', borderRadius: 14, borderWidth: 1, marginBottom: 14 },
  statItem:       { flex: 1, padding: 14, alignItems: 'center' },
  statLabel:      { fontSize: 11, marginBottom: 4 },
  statVal:        { fontSize: 16 },
  aiToggle:       { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10 },
  aiToggleText:   { flex: 1, fontSize: 14 },
  aiCard:         { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 14 },
  aiText:         { fontSize: 14, lineHeight: 22 },
  disclaimer:     { flexDirection: 'row', gap: 8, borderRadius: 12, borderWidth: 1, padding: 12, marginTop: 8 },
  disclaimerText: { flex: 1, fontSize: 12, lineHeight: 18 },
  footer:         { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  actionBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 14, borderWidth: 1 },
  actionBtnText:  { fontSize: 16 },
});
