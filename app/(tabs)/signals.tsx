import { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, Pressable,
  FlatList, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/contexts/ThemeContext';
import { SkeletonLoader } from '@/src/components/ui/SkeletonLoader';
import { SignalCard } from '@/src/components/signals';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { useSignals } from '@/src/hooks';
import type { SignalStatus, SignalDirection } from '@/src/types';

type FilterStatus = SignalStatus | 'all';
type FilterDir    = SignalDirection | 'all';

const STATUS_FILTERS: { key: FilterStatus; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'all',         label: 'All',       icon: 'apps-outline'            },
  { key: 'approaching', label: 'Approaching', icon: 'radio-button-on-outline' },
  { key: 'active',      label: 'Active',    icon: 'flame-outline'           },
  { key: 'TP1_hit',     label: 'TP1 Hit',   icon: 'checkmark-circle-outline'},
  { key: 'pending',     label: 'Pending',   icon: 'time-outline'            },
  { key: 'expired',     label: 'Expired',   icon: 'close-circle-outline'    },
];

export default function SignalsScreen() {
  const { theme } = useTheme();
  const router    = useRouter();
  const insets    = useSafeAreaInsets();

  const { signals: allSignals, isLoading, isRefreshing, refresh } = useSignals();

  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [dirFilter,    setDirFilter]    = useState<FilterDir>('all');

  // Client-side filter (fixes the Zustand selector reactivity issue)
  const signals = useMemo(() => {
    return allSignals.filter((s) => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (dirFilter    !== 'all' && s.direction !== dirFilter)  return false;
      return true;
    });
  }, [allSignals, statusFilter, dirFilter]);

  const handleStatusFilter = useCallback((key: FilterStatus) => {
    setStatusFilter(key);
  }, []);

  const handleDirFilter = useCallback((dir: FilterDir) => {
    setDirFilter(dir);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <Animated.View entering={FadeInDown.delay(50).duration(400)}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <View>
          <Text style={[styles.title, { color: theme.textPrimary, fontFamily: 'Inter-Bold' }]}>Signals</Text>
          <Text style={[styles.subtitle, { color: theme.textTertiary, fontFamily: 'Inter-Regular' }]}>
            {signals.length} result{signals.length !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* Direction chips */}
        <View style={styles.dirRow}>
          {(['all', 'LONG', 'SHORT'] as FilterDir[]).map((dir) => {
            const isActive = dirFilter === dir;
            const col = dir === 'LONG' ? theme.bullish : dir === 'SHORT' ? theme.bearish : theme.accentPrimary;
            return (
              <Pressable
                key={dir}
                onPress={() => handleDirFilter(dir)}
                style={[
                  styles.dirChip,
                  {
                    backgroundColor: isActive ? col + '18' : theme.card,
                    borderColor: isActive ? col + '50' : theme.border,
                  },
                ]}
              >
                {dir !== 'all' && (
                  <Ionicons
                    name={dir === 'LONG' ? 'trending-up' : 'trending-down'}
                    size={12}
                    color={isActive ? col : theme.textTertiary}
                  />
                )}
                <Text style={[styles.dirChipText, { color: isActive ? col : theme.textTertiary, fontFamily: 'Inter-SemiBold' }]}>
                  {dir === 'all' ? 'All' : dir}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Animated.View>

      {/* ── Status filter horizontal scroll ─────────────────────────── */}
      <Animated.View entering={FadeInDown.delay(150).duration(400)}>
        <FlatList
          horizontal
          data={STATUS_FILTERS}
          keyExtractor={(i) => i.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statusFilters}
          renderItem={({ item }) => {
            const isActive = statusFilter === item.key;
            return (
              <Pressable
                onPress={() => handleStatusFilter(item.key)}
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
          }}
        />
      </Animated.View>

      {/* ── Signal List ─────────────────────────────────────────────── */}
      {isLoading && signals.length === 0 ? (
        <View style={styles.skeletons}>
          {[0, 1, 2].map((i) => (
            <SkeletonLoader key={i} width="100%" height={130} borderRadius={16} style={{ marginBottom: 12 }} />
          ))}
        </View>
      ) : (
        <FlatList
          data={signals}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={refresh}
              tintColor={theme.accentPrimary}
              colors={[theme.accentPrimary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="📡"
              title="No signals match filters"
              description="Try adjusting your filters or pull down to refresh."
            />
          }
          renderItem={({ item, index }) => (
            <SignalCard signal={item} index={index} />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 20, paddingBottom: 14 },
  title:        { fontSize: 28 },
  subtitle:     { fontSize: 13, marginTop: 2 },
  dirRow:       { flexDirection: 'row', gap: 6 },
  dirChip:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 20, borderWidth: 1 },
  dirChipText:  { fontSize: 12 },
  statusFilters: { paddingHorizontal: 20, gap: 8, paddingBottom: 12 },
  statusChip:   { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1 },
  statusChipText: { fontSize: 13 },
  skeletons:    { paddingHorizontal: 20, paddingTop: 8 },
  listContent:  { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 100 },
});
