/**
 * AlphaAI — How to Use the App
 * Comprehensive guide covering app features and trading strategies.
 *
 * This page is the single source of truth for user onboarding.
 * UPDATE THIS FILE whenever the app architecture or features change.
 *
 * Last updated: 2026-04-20 (Telemetry + Quality Layer)
 * Current architecture:
 *  - Monitoring Top 80 USDT Perpetual pairs (Binance Futures)
 *  - 3-stage detection: Structure Scanner → Approach Detector → Entry Trigger
 *  - 2.5% Early-Detection Approach Window
 *  - Institutional Confirmation: 5M BOS / FVG Fill / Volume Gate
 */
import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/contexts/ThemeContext';
import { apiClient } from '@/src/services/apiClient';
import { API } from '@/src/constants/api';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface GuideSection {
  id: string;
  emoji: string;
  title: string;
  icon: IoniconsName;
  items: { heading: string; body: string }[];
}

interface UniversePair {
  pair: string;
  symbol: string;
}

const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: 'overview',
    emoji: '🏛️',
    title: 'What is AlphaAI?',
    icon: 'information-circle-outline',
    items: [
      {
        heading: 'SMC Institutional Intelligence',
        body: 'AlphaAI is a Smart Money Concept (SMC) signal engine. It monitors top USDT perpetual pairs by volume on Binance Futures, then highlights areas where institutional order flow is likely to react.',
      },
      {
        heading: 'The 3-Stage Detection Pipeline',
        body: 'The engine runs a 3-stage lifecycle:\n\n1. Structure Scanner (H1/H4/D1) — maps Order Blocks, FVGs, and key zones.\n\n2. Approach Detector — alerts when price is near valid zones so you can prepare early.\n\n3. Entry Trigger (5M confirmation) — confirms entries on lower-timeframe structure and volume.',
      },
    ],
  },
  {
    id: 'signals',
    emoji: '📡',
    title: 'Understanding Signals',
    icon: 'pulse-outline',
    items: [
      {
        heading: 'Status: Approaching (Early Warning)',
        body: 'Price is entering the approach window of a mapped zone. Use this stage to set your plan, review direction, and prepare execution before the final trigger.',
      },
      {
        heading: 'Status: Active (Confirmed Entry)',
        body: 'Price has reached the zone and confirmed on 5M structure. This is the execution-ready stage where the setup is validated by the engine.',
      },
      {
        heading: 'Institutional Confluence (Score)',
        body: 'Signals are scored 0–100 using weighted institutional factors:\n\n• 4H Order Block Alignment (+20)\n• HTF Trend/Bias Confluence (+15)\n• Liquidity Sweep / Induced Liquidity (+20)\n• Entry in 5M Premium/Discount (+10)\n• 5M Structural BOS Confirmation (+15)\n\nSignals below 65 are automatically rejected by the engine.',
      },
      {
        heading: 'New Telemetry Fields (How to Read Them)',
        body: 'Each signal now includes advanced telemetry:\n\n• Confidence Score — refined confidence estimate based on confluence, RR quality, distance-to-zone timing, and regime bias.\n\n• Quality Band (A/B/C) — fast ranking for decision speed. A = strongest candidates, B = valid with moderate caution, C = lowest priority.\n\n• Regime Tag — market condition context (trend_following, reversal, ranging_risk, high_volatility).\n\n• Stale Timer — tells you when a setup has been waiting too long and should be deprioritized or ignored.',
      },
    ],
  },
  {
    id: 'trading',
    emoji: '💰',
    title: 'Professional Strategy',
    icon: 'trending-up-outline',
    items: [
      {
        heading: 'Hard Invalidation Rules',
        body: 'AlphaAI enforces strict institutional risk rules:\n\n• RR Check — TP1 must provide at least 1:2 Risk/Reward ratio. If a setup offers less, it is discarded.\n\n• Extension Guard — If price closes >2% past the far edge of a zone, the entry is "too late" and the signal is invalidated.',
      },
      {
        heading: 'The Partial Profit Model',
        body: 'Treat targets as a risk management ladder:\n\n• TP1 → reduce exposure and secure partial profit.\n• TP2 → continue scaling out and tighten risk.\n• TP3 → close the remainder if momentum follows through.',
      },
      {
        heading: 'Execution Flow in App',
        body: 'Recommended flow: Dashboard pulse check → Signals tab for setup quality + regime → check Quality Band and Confidence Score → verify Stale Timer is still valid → Analyse tab for chart context and AI confirmation → execute on your exchange with predefined risk.',
      },
      {
        heading: 'How Professionals Should Use Quality + Regime',
        body: 'Base model: prioritize A/B setups in trend_following or clean reversal regimes. Reduce size or skip C setups during ranging_risk/high_volatility unless your playbook is built for those conditions. If a signal is close to staleness, treat it as lower-quality timing even if score is high.',
      },
      {
        heading: 'Pro Mode (Now Active)',
        body: 'Pro Mode applies stricter filtering before a signal reaches you. Active rules:\n\n• Confidence Score must be at least 78\n• TP1 Risk/Reward must be at least 1:2.5\n• Distance to zone must be within 1.2%\n• Quality band C setups are suppressed\n• Ranging-risk and high-volatility regimes are suppressed\n\nThis is designed to reduce noise and prioritize consistency over signal quantity.',
      },
    ],
  },
  {
    id: 'features',
    emoji: '🔧',
    title: 'App Ecosystem',
    icon: 'apps-outline',
    items: [
      {
        heading: 'Real-Time Pulse',
        body: 'The dashboard displays live BTC Dominance, Fear & Greed, and real-time price ticks for all 80 monitored pairs. The engine scans the entire universe every 60 seconds.',
      },
      {
        heading: 'AI Market Intelligence',
        body: 'Use the AI Chat to verify setups. The AI analyzes live chart data, including ATR-based volatility, recent BOS events, and volume profile to give you a "Second Opinion".',
      },
    ],
  },
  {
    id: 'tips',
    emoji: '🧠',
    title: 'Risk & Mindset',
    icon: 'bulb-outline',
    items: [
      {
        heading: 'The 1% Rule',
        body: 'Never risk more than 1% of your account capital on any single setup. AlphaAI is designed for consistent equity growth, not "get rich quick" gambling.',
      },
      {
        heading: 'Verification is Key',
        body: 'AlphaAI signals provide the "Where" and the "When". Your job as a trader is to verify the "How"—ensure the 5M confirmation candle looks strong and has institutional volume.',
      },
    ],
  },
];

export default function HowToUseScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tradeablePairs, setTradeablePairs] = useState<string[]>([]);
  const [isUniverseLoading, setIsUniverseLoading] = useState(true);
  const [proModeEnabled, setProModeEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await apiClient.get<{ success: boolean; data?: UniversePair[] }>(API.MARKET.UNIVERSE);
        if (!alive || !res.success || !Array.isArray(res.data)) return;
        const pairs = Array.from(
          new Set(
            res.data
              .map((item) => item.pair)
              .filter((pair): pair is string => typeof pair === 'string' && pair.endsWith('/USDT'))
          )
        );
        setTradeablePairs(pairs);
      } catch {
        // Keep guide accessible even when backend is unreachable.
      } finally {
        if (alive) setIsUniverseLoading(false);
      }
    })();

    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await apiClient.get<{ success: boolean; data?: { proModeEnabled?: boolean } }>(API.MARKET.PULSE);
        if (!alive || !res.success) return;
        if (typeof res.data?.proModeEnabled === 'boolean') {
          setProModeEnabled(res.data.proModeEnabled);
        }
      } catch {
        // Keep guide available even if runtime mode cannot be fetched.
      }
    })();
    return () => { alive = false; };
  }, []);

  const tradeableTickers = useMemo(
    () => tradeablePairs.map((pair) => pair.replace('/USDT', '')).sort((a, b) => a.localeCompare(b)),
    [tradeablePairs]
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 16, borderBottomColor: theme.border }]}>
        <Pressable
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
        >
          <Ionicons name="arrow-back" size={18} color={theme.textPrimary} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={[styles.headerTitle, { color: theme.textPrimary, fontFamily: 'Inter-Bold' }]}>
            How to Use AlphaAI
          </Text>
          <Text style={[styles.headerSub, { color: theme.textTertiary, fontFamily: 'Inter-Regular' }]}>
            Institutional SMC Guide · 80 Pairs
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(400)} style={styles.hero}>
          <View style={[styles.heroIconWrap, { backgroundColor: theme.accentPrimaryDim, borderColor: theme.accentPrimary + '30' }]}>
            <Ionicons name="school-outline" size={36} color={theme.accentPrimary} />
          </View>
          <Text style={[styles.heroTitle, { color: theme.textPrimary, fontFamily: 'Inter-Bold' }]}>
            Master Institutional SMC
          </Text>
          <Text style={[styles.heroBody, { color: theme.textTertiary, fontFamily: 'Inter-Regular' }]}>
            Learn how AlphaAI monitors 80 top markets using high-probability structure mapping, multi-stage confirmation, and new confidence telemetry for cleaner execution decisions.
          </Text>
          <View
            style={[
              styles.proModeBadge,
              {
                backgroundColor:
                  proModeEnabled === null
                    ? theme.surface
                    : proModeEnabled
                      ? theme.bullishDim
                      : theme.surface,
                borderColor:
                  proModeEnabled === null
                    ? theme.border
                    : proModeEnabled
                      ? theme.bullish + '40'
                      : theme.textTertiary + '40',
              },
            ]}
          >
            <Ionicons
              name="shield-checkmark-outline"
              size={14}
              color={
                proModeEnabled === null
                  ? theme.textTertiary
                  : proModeEnabled
                    ? theme.bullish
                    : theme.textTertiary
              }
            />
            <Text
              style={[
                styles.proModeBadgeText,
                {
                  color:
                    proModeEnabled === null
                      ? theme.textTertiary
                      : proModeEnabled
                        ? theme.bullish
                        : theme.textTertiary,
                  fontFamily: 'Inter-SemiBold',
                },
              ]}
            >
              {proModeEnabled === null ? 'Pro Mode: checking...' : `Pro Mode ${proModeEnabled ? 'ON' : 'OFF'}`}
            </Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(60).duration(400)} style={styles.statsRow}>
          {[
            { label: 'Markets', value: tradeablePairs.length > 0 ? `${tradeablePairs.length}` : '80', icon: 'globe-outline' as IoniconsName },
            { label: 'Detection', value: '3-Stage', icon: 'flash-outline' as IoniconsName },
            { label: 'Telemetry', value: 'Live', icon: 'pulse-outline' as IoniconsName },
          ].map((stat, i) => (
            <View key={i} style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Ionicons name={stat.icon} size={16} color={theme.accentPrimary} />
              <Text style={[styles.statValue, { color: theme.textPrimary, fontFamily: 'Inter-Bold' }]}>{stat.value}</Text>
              <Text style={[styles.statLabel, { color: theme.textTertiary, fontFamily: 'Inter-Regular' }]}>{stat.label}</Text>
            </View>
          ))}
        </Animated.View>

        {GUIDE_SECTIONS.map((section, index) => (
          <SectionCard key={section.id} section={section} index={index} />
        ))}

        <Animated.View
          entering={FadeInDown.delay(460).duration(400)}
          style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}
        >
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconWrap, { backgroundColor: theme.accentPrimaryDim }]}>
              <Ionicons name="logo-bitcoin" size={20} color={theme.accentPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionEmoji}>🪙</Text>
              <Text style={[styles.sectionTitle, { color: theme.textPrimary, fontFamily: 'Inter-Bold' }]}>
                Currently Tradeable Coins
              </Text>
              <Text style={[styles.tradeableMeta, { color: theme.textTertiary, fontFamily: 'Inter-Regular' }]}>
                {isUniverseLoading
                  ? 'Loading live universe...'
                  : tradeablePairs.length > 0
                    ? `${tradeablePairs.length} pairs currently supported`
                    : 'Could not load live universe. Showing core majors.'}
              </Text>
            </View>
          </View>

          <View style={styles.coinsWrap}>
            {(tradeableTickers.length > 0 ? tradeableTickers : ['BTC', 'ETH', 'SOL']).map((coin) => (
              <View key={coin} style={[styles.coinPill, { backgroundColor: theme.accentPrimaryDim, borderColor: theme.accentPrimary + '30' }]}>
                <Text style={[styles.coinPillText, { color: theme.accentPrimary, fontFamily: 'Inter-SemiBold' }]}>{coin}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(500).duration(400)} style={styles.disclaimer}>
          <Ionicons name="warning-outline" size={16} color={theme.textTertiary} />
          <Text style={[styles.disclaimerText, { color: theme.textTertiary, fontFamily: 'Inter-Regular' }]}>
            AlphaAI signals are based on institutional structural mapping. All trading involves risk. Use signals in conjunction with your own analysis and strict risk management protocols.
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function SectionCard({ section, index }: { section: GuideSection; index: number }) {
  const { theme } = useTheme();
  return (
    <Animated.View
      entering={FadeInDown.delay(100 + index * 60).duration(400)}
      style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}
    >
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIconWrap, { backgroundColor: theme.accentPrimaryDim }]}>
          <Ionicons name={section.icon} size={20} color={theme.accentPrimary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sectionEmoji]}>{section.emoji}</Text>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary, fontFamily: 'Inter-Bold' }]}>
            {section.title}
          </Text>
        </View>
      </View>

      {section.items.map((item, i) => (
        <View
          key={i}
          style={[
            styles.itemWrap,
            i < section.items.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.divider },
          ]}
        >
          <Text style={[styles.itemHeading, { color: theme.accentPrimary, fontFamily: 'Inter-SemiBold' }]}>
            {item.heading}
          </Text>
          <Text style={[styles.itemBody, { color: theme.textSecondary, fontFamily: 'Inter-Regular' }]}>
            {item.body}
          </Text>
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1 },
  header:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn:        { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  headerTitle:    { fontSize: 22 },
  headerSub:      { fontSize: 13, marginTop: 2 },
  scroll:         { paddingHorizontal: 16, paddingTop: 20 },
  hero:           { alignItems: 'center', marginBottom: 24 },
  heroIconWrap:   { width: 80, height: 80, borderRadius: 40, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  heroTitle:      { fontSize: 26, marginBottom: 8 },
  heroBody:       { fontSize: 16, textAlign: 'center', lineHeight: 22, paddingHorizontal: 12 },
  proModeBadge:   { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  proModeBadgeText: { fontSize: 13 },
  statsRow:       { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statCard:       { flex: 1, alignItems: 'center', gap: 4, borderRadius: 14, borderWidth: 1, paddingVertical: 14 },
  statValue:      { fontSize: 20 },
  statLabel:      { fontSize: 12 },
  sectionCard:    { borderRadius: 18, borderWidth: 1, marginBottom: 16, overflow: 'hidden' },
  sectionHeader:  { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 10 },
  sectionIconWrap:{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sectionEmoji:   { fontSize: 16, marginBottom: 2 },
  sectionTitle:   { fontSize: 20 },
  itemWrap:       { paddingHorizontal: 16, paddingVertical: 14 },
  itemHeading:    { fontSize: 17, marginBottom: 6 },
  itemBody:       { fontSize: 15, lineHeight: 21 },
  tradeableMeta:  { fontSize: 13, marginTop: 2 },
  coinsWrap:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingBottom: 16 },
  coinPill:       { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  coinPillText:   { fontSize: 13 },
  disclaimer:     { flexDirection: 'row', gap: 10, paddingHorizontal: 8, paddingVertical: 20, alignItems: 'flex-start' },
  disclaimerText: { flex: 1, fontSize: 14, lineHeight: 18 },
});
