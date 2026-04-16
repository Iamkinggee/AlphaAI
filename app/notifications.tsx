/**
 * AlphaAI — Notifications Screen
 * Theme-aware, Ionicons throughout, grouped by type.
 */
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/contexts/ThemeContext';
import { SkeletonLoader } from '@/src/components/ui/SkeletonLoader';
import { useNotifications } from '@/src/hooks';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface TypeConfig {
  icon: IoniconName;
  label: string;
  colorKey: 'approaching' | 'bullish' | 'accentPrimary' | 'bearish';
}

const TYPE_CONFIG: Record<string, TypeConfig> = {
  approaching: { icon: 'radio-button-on', label: 'APPROACHING',  colorKey: 'approaching'   },
  active:      { icon: 'flame',           label: 'ENTRY',         colorKey: 'bullish'       },
  tp_hit:      { icon: 'trophy',          label: 'TARGET HIT',    colorKey: 'accentPrimary' },
  TP1_hit:     { icon: 'checkmark-circle',label: 'TP1 HIT',       colorKey: 'bullish'       },
  TP2_hit:     { icon: 'checkmark-circle',label: 'TP2 HIT',       colorKey: 'bullish'       },
  TP3_hit:     { icon: 'trophy',          label: 'TP3 HIT',       colorKey: 'bullish'       },
  stopped:     { icon: 'close-circle',    label: 'STOPPED',       colorKey: 'bearish'       },
  system:      { icon: 'information-circle', label: 'SYSTEM',     colorKey: 'accentPrimary' },
};

export default function NotificationsScreen() {
  const { theme } = useTheme();
  const router    = useRouter();
  const insets    = useSafeAreaInsets();
  const { notifications, isLoading, markAsRead, clearAll } = useNotifications();

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16, borderBottomColor: theme.border }]}>
        <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name="arrow-back" size={18} color={theme.textPrimary} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={[styles.title, { color: theme.textPrimary, fontFamily: 'Inter-Bold' }]}>Notifications</Text>
          {unread > 0 && (
            <Text style={[styles.unreadCount, { color: theme.textTertiary, fontFamily: 'Inter-Regular' }]}>
              {unread} unread
            </Text>
          )}
        </View>
        {notifications.length > 0 && (
          <Pressable
            onPress={clearAll}
            style={[styles.clearBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
            accessibilityLabel="Clear all notifications"
          >
            <Ionicons name="trash-outline" size={16} color={theme.textTertiary} />
            <Text style={[styles.clearText, { color: theme.textTertiary, fontFamily: 'Inter-Medium' }]}>Clear</Text>
          </Pressable>
        )}
      </View>

      {/* List */}
      {isLoading ? (
        <View style={styles.skeletonWrap}>
          {[0, 1, 2, 3].map((i) => (
            <SkeletonLoader key={i} width="100%" height={80} borderRadius={14} style={{ marginBottom: 12, marginHorizontal: 16 }} />
          ))}
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => {
            const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.system;
            const color = theme[cfg.colorKey] as string;
            const time  = new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const date  = new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' });

            return (
              <Animated.View entering={FadeInDown.delay(index * 40).duration(350)}>
                <Pressable
                  onPress={() => {
                    markAsRead(item.id);
                    if (item.signalId) router.push(`/signal/${item.signalId}`);
                  }}
                  style={[
                    styles.card,
                    {
                      backgroundColor: !item.read ? theme.card : theme.surface,
                      borderColor: !item.read ? color + '30' : theme.border,
                    },
                  ]}
                  accessibilityLabel={`Notification: ${item.title}`}
                >
                  {/* Unread dot */}
                  {!item.read && <View style={[styles.unreadDot, { backgroundColor: color }]} />}

                  <View style={styles.cardInner}>
                    {/* Icon */}
                    <View style={[styles.iconWrap, { backgroundColor: color + '18' }]}>
                      <Ionicons name={cfg.icon} size={20} color={color} />
                    </View>

                    {/* Content */}
                    <View style={styles.content}>
                      <View style={styles.contentHeader}>
                        <Text style={[styles.typeLabel, { color, fontFamily: 'Inter-Bold' }]}>{cfg.label}</Text>
                        <Text style={[styles.timestamp, { color: theme.textTertiary, fontFamily: 'Inter-Regular' }]}>{date} · {time}</Text>
                      </View>
                      <Text style={[styles.notifTitle, { color: theme.textPrimary, fontFamily: 'Inter-SemiBold' }]}>{item.title}</Text>
                      <Text style={[styles.notifBody, { color: theme.textSecondary, fontFamily: 'Inter-Regular' }]}>{item.body}</Text>
                    </View>

                    {/* Chevron if tappable */}
                    {item.signalId && (
                      <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} style={{ alignSelf: 'center' }} />
                    )}
                  </View>
                </Pressable>
              </Animated.View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={[styles.emptyIconWrap, { backgroundColor: theme.accentPrimaryDim, borderColor: theme.accentPrimary + '30' }]}>
                <Ionicons name="notifications-off-outline" size={40} color={theme.accentPrimary} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.textPrimary, fontFamily: 'Inter-Bold' }]}>All caught up</Text>
              <Text style={[styles.emptyBody, { color: theme.textTertiary, fontFamily: 'Inter-Regular' }]}>
                Signal activity, TP hits, and account events will appear here.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1 },
  header:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn:       { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  title:         { fontSize: 20 },
  unreadCount:   { fontSize: 12, marginTop: 2 },
  clearBtn:      { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  clearText:     { fontSize: 13 },
  skeletonWrap:  { paddingTop: 16 },
  list:          { paddingHorizontal: 16, paddingTop: 16 },
  card:          { borderRadius: 16, borderWidth: 1, marginBottom: 10, overflow: 'hidden' },
  unreadDot:     { position: 'absolute', top: 14, right: 14, width: 8, height: 8, borderRadius: 4 },
  cardInner:     { flexDirection: 'row', gap: 12, padding: 14 },
  iconWrap:      { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  content:       { flex: 1 },
  contentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  typeLabel:     { fontSize: 10, letterSpacing: 0.6 },
  timestamp:     { fontSize: 11 },
  notifTitle:    { fontSize: 14, marginBottom: 4 },
  notifBody:     { fontSize: 13, lineHeight: 19 },
  empty:         { alignItems: 'center', paddingVertical: 80, paddingHorizontal: 40 },
  emptyIconWrap: { width: 92, height: 92, borderRadius: 46, alignItems: 'center', justifyContent: 'center', borderWidth: 1, marginBottom: 20 },
  emptyTitle:    { fontSize: 20, marginBottom: 10 },
  emptyBody:     { fontSize: 14, textAlign: 'center', lineHeight: 22 },
});
