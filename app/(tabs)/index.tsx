/**
 * AlphaAI — Dashboard
 * Full analytics overview: signal stats, win rate, accuracy donut, recent activity.
 * All colors via useTheme() — responds to dark/light toggle.
 */
import { useMemo } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useSignals, useMarket, useNotifications, useAuth } from '@/src/hooks';
import { SkeletonLoader } from '@/src/components/ui/SkeletonLoader';

// ── Simple Donut Chart (no external package) ─────────────────────────
interface DonutSlice { value: number; color: string; label: string }
function DonutChart({ slices, size = 120, thickness = 18 }: { slices: DonutSlice[]; size?: number; thickness?: number }) {
  const { theme } = useTheme();
  const total = slices.reduce((s, i) => s + i.value, 0) || 1;
  const cx = size / 2, cy = size / 2, r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;

  let cumPct = 0;
  return (
    <View style={{ width: size, height: size, position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
      {/* Background circle */}
      <View style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: thickness, borderColor: theme.border }} />
      {/* Slices — each rendered as an arc overlay using SVG-less technique */}
      {slices.map((slice, i) => {
        const pct = slice.value / total;
        const deg = pct * 360;
        const startDeg = cumPct * 360;
        cumPct += pct;
        // Each slice is a View rotated and shown via overflow + border
        const isRight = startDeg <= 180;
        return (
          <View key={i} style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
            <View style={{
              position: 'absolute', width: size, height: size, borderRadius: size / 2,
              borderWidth: thickness, borderColor: slice.color,
              transform: [{ rotate: `${startDeg}deg` }],
              borderTopColor: deg > 180 ? slice.color : 'transparent',
              borderRightColor: deg > 90 ? slice.color : 'transparent',
              borderBottomColor: deg > 270 ? slice.color : 'transparent',
              borderLeftColor: 'transparent',
            }} />
          </View>
        );
      })}
      {/* Centre hole */}
      <View style={{ width: size - thickness * 2, height: size - thickness * 2, borderRadius: (size - thickness * 2) / 2, backgroundColor: theme.background }} />
    </View>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon, color, delay }: { label: string; value: string; sub?: string; icon: React.ComponentProps<typeof Ionicons>['name']; color: string; delay?: number }) {
  const { theme } = useTheme();
  return (
    <Animated.View entering={FadeInDown.delay(delay ?? 0).duration(400)}
      style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={[styles.statIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={[styles.statValue, { color: theme.textPrimary, fontFamily: 'Inter-Bold' }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.textTertiary, fontFamily: 'Inter-Regular' }]}>{label}</Text>
      {sub && <Text style={[styles.statSub, { color, fontFamily: 'Inter-Medium' }]}>{sub}</Text>}
    </Animated.View>
  );
}

// ── Recent Result Row ─────────────────────────────────────────────────
function ResultRow({ pair, dir, result, pnl, color }: { pair: string; dir: string; result: string; pnl: string; color: string }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.resultRow, { borderBottomColor: theme.divider }]}>
      <View style={[styles.resultDot, { backgroundColor: color }]} />
      <View style={styles.resultInfo}>
        <Text style={[styles.resultPair, { color: theme.textPrimary, fontFamily: 'Inter-SemiBold' }]}>{pair}</Text>
        <Text style={[styles.resultDir, { color: theme.textTertiary, fontFamily: 'Inter-Regular' }]}>{dir}</Text>
      </View>
      <View style={styles.resultRight}>
        <Text style={[styles.resultLabel, { color, fontFamily: 'Inter-SemiBold' }]}>{result}</Text>
        <Text style={[styles.resultPnl, { color, fontFamily: 'Inter-Regular' }]}>{pnl}</Text>
      </View>
    </View>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────
function statusColor(status: string, bullish: string, bearish: string, dim: string) {
  if (status === 'TP1_hit' || status === 'TP2_hit' || status === 'TP3_hit') return bullish;
  if (status === 'stopped') return bearish;
  return dim;
}

function statusLabel(status: string) {
  if (status === 'TP1_hit') return 'TP1 Hit';
  if (status === 'TP2_hit') return 'TP2 Hit';
  if (status === 'TP3_hit') return 'TP3 Hit';
  if (status === 'stopped') return 'Stopped';
  if (status === 'active')  return 'Active';
  if (status === 'expired') return 'Expired';
  return 'Pending';
}

export default function DashboardScreen() {
  const { theme } = useTheme();
  const router    = useRouter();
  const insets    = useSafeAreaInsets();
  const { user }  = useAuth();

  const { isLoading, isRefreshing, refresh, approaching, active, signals } = useSignals();
  const { pulse } = useMarket();
  const { unreadCount } = useNotifications();

  // ── Derive recent results from live signals ─────────────────────
  const recentResults = useMemo(() => {
    const resolved = signals
      .filter(s => ['TP1_hit','TP2_hit','TP3_hit','stopped','expired'].includes(s.status))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
    return resolved;
  }, [signals]);

  const activeResults = useMemo(() => {
    return signals
      .filter(s => s.status === 'active' || s.status === 'approaching')
      .sort((a, b) => (b.score - a.score))
      .slice(0, 3);
  }, [signals]);

  // ── Analytics from live signals ─────────────────────────────────────
  const stats = useMemo(() => {
    const total    = signals.length;
    const wins     = signals.filter(s => s.status === 'TP1_hit' || s.status === 'TP2_hit' || s.status === 'TP3_hit').length;
    const losses   = signals.filter(s => s.status === 'stopped').length;
    const resolved = wins + losses;
    const winRate  = resolved > 0 ? Math.round((wins / resolved) * 100) : 0;
    return { total, wins, losses, winRate, approaching: approaching.length, active: active.length };
  }, [signals, approaching, active]);

  // ── Weekly P&L from resolved signals ──────────────────────────────────
  const weeklyPnl = useMemo(() => {
    // Group resolved signals into 7-day buckets (last 7 weeks)
    const buckets = new Array(7).fill(0);
    const now = Date.now();
    const WEEK = 7 * 24 * 3600 * 1000;
    signals
      .filter(s => s.currentPnl !== undefined && s.status !== 'active' && s.status !== 'approaching')
      .forEach(s => {
        const age = now - new Date(s.createdAt).getTime();
        const weekIdx = Math.min(6, Math.floor(age / WEEK));
        buckets[6 - weekIdx] += s.currentPnl ?? 0;
      });
    return buckets;
  }, [signals]);

  const mtdPnl = useMemo(() => {
    const total = weeklyPnl.reduce((a, b) => a + b, 0);
    return total !== 0 ? `${total >= 0 ? '+' : ''}${total.toFixed(1)}% MTD` : null;
  }, [weeklyPnl]);

  const donutSlices: DonutSlice[] = [
    { value: stats.wins,       color: theme.bullish,    label: 'Wins'      },
    { value: stats.losses,     color: theme.bearish,    label: 'Losses'    },
    { value: stats.approaching,color: theme.approaching,label: 'Active'    },
    { value: Math.max(1, stats.total - stats.wins - stats.losses - stats.approaching), color: theme.textTertiary, label: 'Pending' },
  ];

  const greeting = (() => { const h = new Date().getHours(); return h < 12 ? 'Morning' : h < 18 ? 'Afternoon' : 'Evening'; })();
  const firstName = (() => {
    const name = user?.name ?? user?.displayName ?? user?.email?.split('@')[0] ?? 'Trader';
    return name.split(' ')[0].charAt(0).toUpperCase() + name.split(' ')[0].slice(1);
  })();
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={theme.accentPrimary} colors={[theme.accentPrimary]} />}
      >
        {/* ── Header ───────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(50).duration(400)} style={[styles.header, { paddingTop: insets.top + 20 }]}>
          <View>
            <Text style={[styles.greetingSmall, { color: theme.textTertiary, fontFamily: 'Inter-Regular' }]}>Good {greeting}</Text>
            <Text style={[styles.greetingName, { color: theme.textPrimary, fontFamily: 'Inter-Bold' }]}>{firstName} 👋</Text>
            <Text style={[styles.date, { color: theme.textTertiary, fontFamily: 'Inter-Regular' }]}>{today}</Text>
          </View>
          <Pressable
            onPress={() => router.push('/notifications')}
            style={[styles.notifBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
          >
            <Ionicons name="notifications-outline" size={20} color={theme.textSecondary} />
            {unreadCount > 0 && (
              <View style={[styles.badge, { backgroundColor: theme.bearish }]}>
                <Text style={styles.badgeText}>{unreadCount}</Text>
              </View>
            )}
          </Pressable>
        </Animated.View>

        {/* ── Market pulse strip ───────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)}
          style={[styles.pulseStrip, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {[
            { label: 'BTC Dom', value: pulse ? `${pulse.btcDominance}%` : '—', color: theme.approaching },
            { label: 'Fear & Greed', value: pulse ? String(pulse.fearGreedIndex) : '—', color: pulse && (pulse.fearGreedIndex as number) < 30 ? theme.bearish : theme.bullish },
            { label: 'Active Signals', value: String(stats.active), color: theme.accentPrimary },
            { label: 'Approaching', value: String(stats.approaching), color: theme.approaching },
          ].map((item, i, arr) => (
            <View key={item.label} style={[styles.pulseItem, i < arr.length - 1 && { borderRightWidth: 1, borderRightColor: theme.border }]}>
              <Text style={[styles.pulseLabel, { color: theme.textTertiary, fontFamily: 'Inter-Regular' }]}>{item.label}</Text>
              <Text style={[styles.pulseValue, { color: item.color, fontFamily: 'Inter-Bold' }]}>{item.value}</Text>
            </View>
          ))}
        </Animated.View>

        {/* ── Stat cards row ───────────────────────────────────────── */}
        <View style={styles.statsRow}>
          <StatCard label="Win Rate" value={`${stats.winRate}%`} icon="trending-up" color={theme.bullish} sub="All time" delay={150} />
          <StatCard label="Total Signals" value={String(stats.total)} icon="flash" color={theme.accentPrimary} sub="This month" delay={200} />
          <StatCard label="Stopped" value={String(stats.losses)} icon="close-circle" color={theme.bearish} delay={250} />
        </View>

        {/* ── Signal breakdown + donut ─────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)}
          style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary, fontFamily: 'Inter-SemiBold' }]}>Signal Breakdown</Text>
          <View style={styles.donutRow}>
            <DonutChart slices={donutSlices} size={110} thickness={16} />
            <View style={styles.legend}>
              {[
                { label: 'Wins',      value: stats.wins,        color: theme.bullish },
                { label: 'Losses',    value: stats.losses,       color: theme.bearish },
                { label: 'Approaching',value: stats.approaching,  color: theme.approaching },
                { label: 'Pending',   value: Math.max(0, stats.total - stats.wins - stats.losses - stats.approaching), color: theme.textTertiary },
              ].map((r) => (
                <View key={r.label} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: r.color }]} />
                  <Text style={[styles.legendLabel, { color: theme.textTertiary, fontFamily: 'Inter-Regular' }]}>{r.label}</Text>
                  <Text style={[styles.legendVal, { color: theme.textPrimary, fontFamily: 'Inter-SemiBold' }]}>{r.value}</Text>
                </View>
              ))}
            </View>
          </View>
        </Animated.View>

        {/* ── P&L bar chart (live — from resolved signals) ───────────── */}
        <Animated.View entering={FadeInDown.delay(350).duration(400)}
          style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary, fontFamily: 'Inter-SemiBold' }]}>Signal P&L</Text>
            {mtdPnl && (
              <Text style={[styles.sectionSub, { color: weeklyPnl.reduce((a,b)=>a+b,0) >= 0 ? theme.bullish : theme.bearish, fontFamily: 'Inter-SemiBold' }]}>
                {mtdPnl}
              </Text>
            )}
          </View>
          {weeklyPnl.every(v => v === 0) ? (
            <Text style={[{ color: theme.textTertiary, fontFamily: 'Inter-Regular', fontSize: 14, textAlign: 'center', paddingVertical: 16 }]}>
              P&L data will appear once signals resolve
            </Text>
          ) : (
            <View style={styles.barChart}>
              {weeklyPnl.map((v, i) => {
                const isPos = v >= 0;
                const maxAbs = Math.max(...weeklyPnl.map(Math.abs), 1);
                const h = Math.max(4, (Math.abs(v) / maxAbs) * 52);
                return (
                  <View key={i} style={styles.barCol}>
                    <View style={[styles.bar, { height: h, backgroundColor: isPos ? theme.bullish : theme.bearish, opacity: 0.85, borderRadius: 3 }]} />
                    <Text style={[styles.barLabel, { color: theme.textTertiary, fontFamily: 'Inter-Regular' }]}>
                      {['W1','W2','W3','W4','W5','W6','W7'][i]}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </Animated.View>

        {/* ── Recent signal results ────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(400).duration(400)}
          style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary, fontFamily: 'Inter-SemiBold' }]}>Recent Signals</Text>
            <Pressable onPress={() => router.push('/(tabs)/signals')}>
              <Text style={[styles.viewAll, { color: theme.accentPrimary, fontFamily: 'Inter-Medium' }]}>View All</Text>
            </Pressable>
          </View>
          {recentResults.length === 0 ? (
            <Text style={[{ color: theme.textTertiary, fontFamily: 'Inter-Regular', fontSize: 15, textAlign: 'center', paddingVertical: 12 }]}>
              {isLoading ? 'Loading signals…' : 'No resolved signals yet — pipeline is scanning'}
            </Text>
          ) : (
            recentResults.map((s) => {
              const col = statusColor(s.status, theme.bullish, theme.bearish, theme.textTertiary);
              const pnl = s.currentPnlFormatted ?? '—';
              return (
                <ResultRow
                  key={s.id}
                  pair={s.pair}
                  dir={`${s.direction} · ${s.timeframe}`}
                  result={statusLabel(s.status)}
                  pnl={pnl}
                  color={col}
                />
              );
            })
          )}
        </Animated.View>

        {/* ── Approaching now ─────────────────────────────────────── */}
        {approaching.length > 0 && (
          <Animated.View entering={FadeInDown.delay(450).duration(400)}
            style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.sectionRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.liveDot, { backgroundColor: theme.approaching }]} />
                <Text style={[styles.sectionTitle, { color: theme.textPrimary, fontFamily: 'Inter-SemiBold' }]}>Approaching Now</Text>
              </View>
              <Text style={[styles.sectionSub, { color: theme.approaching, fontFamily: 'Inter-Regular' }]}>{approaching.length} setup{approaching.length > 1 ? 's' : ''}</Text>
            </View>
            {approaching.slice(0, 3).map((s) => (
              <Pressable key={s.id} style={[styles.approachingRow, { borderBottomColor: theme.divider }]} onPress={() => router.push(`/signal/${s.id}`)}>
                <View style={[styles.approachDot, { backgroundColor: s.direction === 'LONG' ? theme.bullish : theme.bearish }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.resultPair, { color: theme.textPrimary, fontFamily: 'Inter-SemiBold' }]}>{s.pair}</Text>
                  <Text style={[styles.resultDir, { color: theme.textTertiary, fontFamily: 'Inter-Regular' }]}>{s.direction} · {s.timeframe} · Score {s.score}</Text>
                </View>
                <Text style={[{ color: theme.approaching, fontFamily: 'Inter-Medium', fontSize: 14 }]}>{s.distanceFormatted}</Text>
                <Ionicons name="chevron-forward" size={14} color={theme.textTertiary} />
              </Pressable>
            ))}
          </Animated.View>
        )}

        {/* ── Quick action — Watchlist only ────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(500).duration(400)} style={{ paddingHorizontal: 20, marginBottom: 8 }}>
          <Pressable
            onPress={() => router.push('/watchlist')}
            style={[styles.watchlistBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
          >
            <View style={[styles.watchlistIconWrap, { backgroundColor: theme.accentPrimaryDim }]}>
              <Ionicons name="bookmark" size={20} color={theme.accentPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.watchlistLabel, { color: theme.textPrimary, fontFamily: 'Inter-SemiBold' }]}>My Watchlist</Text>
              <Text style={[styles.watchlistSub, { color: theme.textTertiary, fontFamily: 'Inter-Regular' }]}>Track pairs & get alerts</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
          </Pressable>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1 },
  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingBottom: 16 },
  greetingSmall: { fontSize: 15, marginBottom: 2 },
  greetingName:  { fontSize: 28 },
  date:          { fontSize: 14, marginTop: 2 },
  notifBtn:      { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  badge:         { position: 'absolute', top: -2, right: -2, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  badgeText:     { fontSize: 11, color: '#fff', fontFamily: 'Inter-Bold' },
  pulseStrip:    { flexDirection: 'row', marginHorizontal: 20, borderRadius: 14, borderWidth: 1, marginBottom: 20 },
  pulseItem:     { flex: 1, alignItems: 'center', paddingVertical: 12 },
  pulseLabel:    { fontSize: 12, marginBottom: 4 },
  pulseValue:    { fontSize: 16 },
  statsRow:      { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 16 },
  statCard:      { flex: 1, borderRadius: 14, borderWidth: 1, padding: 12, alignItems: 'center', gap: 4 },
  statIcon:      { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  statValue:     { fontSize: 22 },
  statLabel:     { fontSize: 12, textAlign: 'center' },
  statSub:       { fontSize: 12 },
  section:       { marginHorizontal: 20, borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 16 },
  sectionTitle:  { fontSize: 18, marginBottom: 12 },
  sectionRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionSub:    { fontSize: 15 },
  viewAll:       { fontSize: 15 },
  donutRow:      { flexDirection: 'row', alignItems: 'center', gap: 20 },
  legend:        { flex: 1, gap: 8 },
  legendItem:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot:     { width: 8, height: 8, borderRadius: 4 },
  legendLabel:   { flex: 1, fontSize: 15 },
  legendVal:     { fontSize: 15 },
  barChart:      { flexDirection: 'row', alignItems: 'flex-end', height: 60, gap: 6 },
  barCol:        { flex: 1, alignItems: 'center', gap: 4, justifyContent: 'flex-end', height: 60 },
  bar:           {},
  barLabel:      { fontSize: 11 },
  resultRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  resultDot:     { width: 8, height: 8, borderRadius: 4 },
  resultInfo:    { flex: 1 },
  resultPair:    { fontSize: 16 },
  resultDir:     { fontSize: 14, marginTop: 1 },
  resultRight:   { alignItems: 'flex-end' },
  resultLabel:   { fontSize: 15 },
  resultPnl:     { fontSize: 14 },
  liveDot:       { width: 8, height: 8, borderRadius: 4 },
  approachingRow:{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  approachDot:   { width: 8, height: 8, borderRadius: 4 },
  quickRow:       { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 8 },
  quickBtn:       { flex: 1, borderRadius: 14, borderWidth: 1, padding: 14, alignItems: 'center', gap: 6 },
  quickLabel:     { fontSize: 13 },
  watchlistBtn:   { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, borderWidth: 1, padding: 16 },
  watchlistIconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  watchlistLabel: { fontSize: 17, marginBottom: 3 },
  watchlistSub:   { fontSize: 14 },
});
