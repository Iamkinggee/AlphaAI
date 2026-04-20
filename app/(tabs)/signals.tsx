import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable,
  FlatList, RefreshControl, Alert, ScrollView,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/contexts/ThemeContext';
import { SkeletonLoader } from '@/src/components/ui/SkeletonLoader';
import { SignalCard } from '@/src/components/signals';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { useSignals } from '@/src/hooks';
import type { SignalStatus, SignalDirection } from '@/src/types';

type FilterDir    = SignalDirection | 'all';

// Two top-level tabs: Active signals vs History
type TabKey = 'active' | 'history';

// Status sub-filters for the Active tab
type ActiveFilterStatus = 'all' | 'approaching' | 'active' | 'TP1_hit' | 'TP2_hit' | 'pending';

// Status sub-filters for the History tab
type HistoryFilterStatus = 'all' | 'TP3_hit' | 'stopped' | 'expired';

// Common type for filter items (shared by both tabs)
type StatusFilterItem = { key: string; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] };

const ACTIVE_STATUS_FILTERS: StatusFilterItem[] = [
  { key: 'all',         label: 'All',        icon: 'apps-outline'             },
  { key: 'approaching', label: 'Approaching', icon: 'radio-button-on-outline' },
  { key: 'active',      label: 'Active',     icon: 'flame-outline'            },
  { key: 'TP1_hit',     label: 'TP1 Hit',    icon: 'checkmark-circle-outline' },
  { key: 'TP2_hit',     label: 'TP2 Hit',    icon: 'checkmark-done-outline'   },
  { key: 'pending',     label: 'Pending',    icon: 'time-outline'             },
];

const HISTORY_STATUS_FILTERS: StatusFilterItem[] = [
  { key: 'all',     label: 'All',         icon: 'apps-outline'             },
  { key: 'TP3_hit', label: 'Full TP Hit',  icon: 'trophy-outline'          },
  { key: 'stopped', label: 'Stopped Out', icon: 'close-circle-outline'     },
  { key: 'expired', label: 'Expired',     icon: 'timer-outline'            },
];

export default function SignalsScreen() {
  const { theme } = useTheme();
  const insets    = useSafeAreaInsets();

  const {
    signals: allSignals,
    history: historySignals,
    isLoading,
    isLoadingHistory,
    isRefreshing,
    refresh,
    loadHistory,
    clearHistory,
  } = useSignals();

  const [tab, setTab] = useState<TabKey>('active');
  const [activeStatusFilter, setActiveStatusFilter] = useState<ActiveFilterStatus>('all');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<HistoryFilterStatus>('all');
  const [dirFilter, setDirFilter] = useState<FilterDir>('all');

  // Load history on first switch to history tab
  const [historyLoaded, setHistoryLoaded] = useState(false);
  useEffect(() => {
    if (tab === 'history' && !historyLoaded) {
      loadHistory();
      setHistoryLoaded(true);
    }
  }, [tab]);

  // Filtered signals based on current tab + filters
  const displaySignals = useMemo(() => {
    const source = tab === 'active' ? allSignals : historySignals;
    const statusFilter = tab === 'active' ? activeStatusFilter : historyStatusFilter;

    return source.filter((s) => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (dirFilter !== 'all' && s.direction !== dirFilter) return false;
      return true;
    });
  }, [tab, allSignals, historySignals, activeStatusFilter, historyStatusFilter, dirFilter]);

  const statusFilters = tab === 'active' ? ACTIVE_STATUS_FILTERS : HISTORY_STATUS_FILTERS;
  const currentStatusFilter = tab === 'active' ? activeStatusFilter : historyStatusFilter;
  const setCurrentStatusFilter = tab === 'active'
    ? (k: string) => setActiveStatusFilter(k as ActiveFilterStatus)
    : (k: string) => setHistoryStatusFilter(k as HistoryFilterStatus);

  const loading = tab === 'active' ? isLoading : isLoadingHistory;

  const handleClearHistory = useCallback(() => {
    Alert.alert(
      'Clear All History',
      'This will permanently remove all historical signals from the database. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear All', 
          style: 'destructive', 
          onPress: async () => {
            try {
              await clearHistory();
            } catch (err) {
              Alert.alert('Error', 'Failed to clear history. Please try again.');
            }
          } 
        },
      ]
    );
  }, [clearHistory]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Animated.View entering={FadeInDown.duration(400)}>
          <Text style={[styles.title, { color: theme.textPrimary, fontFamily: 'Inter-Bold' }]}>Signals</Text>
          <View style={styles.scannerRow}>
            <View style={[styles.statusIndicator, { backgroundColor: theme.bullish }]} />
            <Text style={[styles.scannerText, { color: theme.textTertiary, fontFamily: 'Inter-Medium' }]}>
              Scanner Active · {allSignals.length} In-Play
            </Text>
          </View>
        </Animated.View>
      </View>

      {/* ── Tab Toggle ─────────────────────────────────────────────── */}
      <View style={styles.tabWrapper}>
        <View style={[styles.tabContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Pressable 
            onPress={() => setTab('active')}
            style={[styles.tabItem, tab === 'active' && [styles.tabActive, { backgroundColor: theme.surface }]]}
          >
            <Text style={[styles.tabText, { color: tab === 'active' ? theme.textPrimary : theme.textTertiary, fontFamily: 'Inter-SemiBold' }]}>
              Active
            </Text>
            {allSignals.length > 0 && (
              <View style={[styles.tabBadge, { backgroundColor: theme.accentPrimary }]}>
                <Text style={styles.tabBadgeText}>{allSignals.length}</Text>
              </View>
            )}
          </Pressable>
          <Pressable 
            onPress={() => setTab('history')}
            style={[styles.tabItem, tab === 'history' && [styles.tabActive, { backgroundColor: theme.surface }]]}
          >
            <Text style={[styles.tabText, { color: tab === 'history' ? theme.textPrimary : theme.textTertiary, fontFamily: 'Inter-SemiBold' }]}>
              History
            </Text>
          </Pressable>
        </View>
      </View>

      {/* ── Sub-filters ────────────────────────────────────────────── */}
      <Animated.View entering={FadeInDown.delay(100).duration(400)}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statusFilters}
        >
          {statusFilters.map((item) => {
            const isActive = currentStatusFilter === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setCurrentStatusFilter(item.key)}
                style={[
                  styles.statusChip,
                  {
                    backgroundColor: isActive ? theme.accentPrimaryDim : theme.card,
                    borderColor: isActive ? theme.accentPrimary + '50' : theme.border,
                  },
                ]}
              >
                <Ionicons
                  name={item.icon}
                  size={13}
                  color={isActive ? theme.accentPrimary : theme.textTertiary}
                />
                <Text style={[
                  styles.statusChipText,
                  { color: isActive ? theme.accentPrimary : theme.textTertiary, fontFamily: 'Inter-Medium' },
                ]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </Animated.View>


      {/* ── Signal List ─────────────────────────────────────────────── */}
      {loading && displaySignals.length === 0 ? (
        <View style={styles.skeletons}>
          {[0, 1, 2].map((i) => (
            <SkeletonLoader key={i} width="100%" height={160} borderRadius={20} style={{ marginBottom: 12 }} />
          ))}
        </View>
      ) : (
        <FlatList
          data={displaySignals}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: 100 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => {
                refresh();
                if (tab === 'history') loadHistory();
              }}
              tintColor={theme.accentPrimary}
              colors={[theme.accentPrimary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon={tab === 'active' ? '📡' : '📜'}
              title={tab === 'active' ? 'No active signals' : 'No signal history yet'}
              description={
                tab === 'active'
                  ? 'The scanner is watching for setups. New signals will appear automatically.'
                  : 'Signals that hit TP3, stopped out, or expired will appear here.'
              }
            />
          }
          renderItem={({ item, index }) => (
            <SignalCard 
              signal={item} 
              index={index} 
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16 },
  title:        { fontSize: 26, marginBottom: 4 },
  scannerRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusIndicator: { width: 6, height: 6, borderRadius: 3 },
  scannerText:  { fontSize: 14 },
  refreshIcon:  { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  
  tabWrapper:   { paddingHorizontal: 20, marginBottom: 16 },
  tabContainer: { flexDirection: 'row', padding: 4, borderRadius: 14, borderWidth: 1 },
  tabItem:      { flex: 1, flexDirection: 'row', height: 38, alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10 },
  tabActive:    { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 },
  tabText:      { fontSize: 15 },
  tabBadge:     { backgroundColor: '#00D4FF', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8 },
  tabBadgeText: { fontSize: 12, color: '#000', fontFamily: 'Inter-Bold' },

  statusFilters: { paddingHorizontal: 20, gap: 10, paddingBottom: 16 },
  statusChip:   { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 24, borderWidth: 1 },
  statusChipText: { fontSize: 15 },
  
  skeletons:    { paddingHorizontal: 20 },
  listContent:  { paddingHorizontal: 20, paddingTop: 4 },
});
