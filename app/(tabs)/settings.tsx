import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Switch,
  Pressable, Alert, TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useAuthStore } from '@/src/store/useAuthStore';
import { useAuth } from '@/src/hooks';
import { apiClient } from '@/src/services/apiClient';
import { API } from '@/src/constants/api';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function SettingRow({
  icon, label, sublabel, value, onToggle, onPress, chevron, iconColor,
}: {
  icon: IoniconsName;
  label: string;
  sublabel?: string;
  value?: boolean;
  onToggle?: (v: boolean) => void;
  onPress?: () => void;
  chevron?: boolean;
  iconColor?: string;
}) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      style={[styles.row, { borderBottomColor: theme.divider }]}
    >
      <View style={[styles.rowIcon, { backgroundColor: (iconColor ?? theme.accentPrimaryDim) }]}>
        <Ionicons name={icon} size={18} color={iconColor ? '#fff' : theme.accentPrimary} />
      </View>
      <View style={styles.rowLabel}>
        <Text style={[styles.rowTitle, { color: theme.textPrimary, fontFamily: 'Inter-Medium' }]}>{label}</Text>
        {sublabel && <Text style={[styles.rowSub, { color: theme.textTertiary, fontFamily: 'Inter-Regular' }]}>{sublabel}</Text>}
      </View>
      {onToggle !== undefined && (
        <Switch
          value={value}
          onValueChange={onToggle}
          trackColor={{ false: theme.border, true: theme.accentPrimary + '80' }}
          thumbColor={value ? theme.accentPrimary : theme.textTertiary}
          ios_backgroundColor={theme.border}
        />
      )}
      {chevron && <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const { theme, isDark, toggleTheme } = useTheme();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const [proModeEnabled, setProModeEnabled] = useState<boolean | null>(null);
  const [isProModeSaving, setIsProModeSaving] = useState(false);

  // ── Notification settings wired directly to the auth store ──────────
  // This is the single source of truth — pushNotifications.ts reads from
  // the same store before firing any local notification.
  const notifications  = useAuthStore((s) => s.settings.notifications);
  const updateSettings = useAuthStore((s) => s.updateSettings);

  const setNotifPref = useCallback(
    (key: keyof typeof notifications, val: boolean) => {
      updateSettings({ notifications: { ...notifications, [key]: val } });
    },
    [notifications, updateSettings]
  );

  // Master toggle: disabling push turns off all sub-toggles visually
  const pushEnabled   = notifications.pushEnabled;
  const approaching   = notifications.approaching && pushEnabled;
  const active        = notifications.active && pushEnabled;
  const tpHit         = notifications.tpHit && pushEnabled;
  const stopped       = notifications.stopped && pushEnabled;

  const handleSignOut = useCallback(() => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/sign-in');
        },
      },
    ]);
  }, [signOut, router]);

  const displayName = user?.displayName
    ?? user?.name
    ?? user?.email?.split('@')[0]?.replace(/[._-]/g, ' ')
    ?? 'Trader';

  const initials = displayName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);

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
        // Silent fallback: keep settings screen responsive when backend is unavailable.
      }
    })();
    return () => { alive = false; };
  }, []);

  const toggleProMode = useCallback(async (next: boolean) => {
    setProModeEnabled(next);
    setIsProModeSaving(true);
    try {
      const res = await apiClient.post<{ success: boolean; data?: { proModeEnabled?: boolean } }>(
        API.MARKET.PRO_MODE,
        { enabled: next }
      );
      if (res.success && typeof res.data?.proModeEnabled === 'boolean') {
        setProModeEnabled(res.data.proModeEnabled);
      }
    } catch {
      setProModeEnabled((prev) => (typeof prev === 'boolean' ? !prev : null));
      Alert.alert('Update Failed', 'Could not update Pro Mode right now. Please try again.');
    } finally {
      setIsProModeSaving(false);
    }
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.duration(400)} style={[styles.header, { paddingTop: insets.top + 20 }]}>
          <Text style={[styles.title, { color: theme.textPrimary, fontFamily: 'Inter-Bold' }]}>Settings</Text>
        </Animated.View>

        {/* ── Profile card ────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={[styles.profileCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={[styles.avatar, { backgroundColor: theme.accentPrimary }]}>
            <Text style={[styles.avatarText, { fontFamily: 'Inter-Bold' }]}>{initials}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: theme.textPrimary, fontFamily: 'Inter-SemiBold' }]} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={[styles.profileEmail, { color: theme.textSecondary, fontFamily: 'Inter-Regular' }]} numberOfLines={1}>
              {user?.email ?? 'Not signed in'}
            </Text>
          </View>
          <View
            style={[
              styles.tierBadge,
              {
                backgroundColor:
                  proModeEnabled === null
                    ? theme.surface
                    : proModeEnabled
                      ? theme.accentPrimaryDim
                      : theme.surface,
                borderColor:
                  proModeEnabled === null
                    ? theme.border
                    : proModeEnabled
                      ? theme.accentPrimary + '40'
                      : theme.textTertiary + '40',
              },
            ]}
          >
            <Text
              style={[
                styles.tierText,
                {
                  color:
                    proModeEnabled === null
                      ? theme.textTertiary
                      : proModeEnabled
                        ? theme.accentPrimary
                        : theme.textTertiary,
                  fontFamily: 'Inter-SemiBold',
                },
              ]}
            >
              {proModeEnabled === null ? '...' : proModeEnabled ? 'PRO' : 'STD'}
            </Text>
          </View>
        </Animated.View>

        {/* ── Appearance ──────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(150).duration(400)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textTertiary, fontFamily: 'Inter-SemiBold' }]}>APPEARANCE</Text>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <SettingRow
              icon={isDark ? 'moon' : 'sunny'}
              label="Dark Mode"
              sublabel={isDark ? 'Currently dark' : 'Currently light'}
              value={isDark}
              onToggle={toggleTheme}
              iconColor={isDark ? '#5046CC' : '#D48200'}
            />
          </View>
        </Animated.View>

        {/* ── Notifications ────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textTertiary, fontFamily: 'Inter-SemiBold' }]}>NOTIFICATIONS</Text>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>

            {/* Master push toggle */}
            <SettingRow
              icon="notifications"
              label="Push Notifications"
              sublabel={pushEnabled ? 'Receiving all alerts' : 'All notifications silenced'}
              value={pushEnabled}
              onToggle={(v) => setNotifPref('pushEnabled', v)}
            />

            {/* Sub-toggles — dimmed when master is off */}
            <View style={{ opacity: pushEnabled ? 1 : 0.4 }}>
              <SettingRow
                icon="flash"
                label="Signal Alerts"
                sublabel="Approaching & active entries"
                value={approaching}
                onToggle={(v) => {
                  if (!pushEnabled) return;
                  setNotifPref('approaching', v);
                  setNotifPref('active', v);
                }}
              />
              <SettingRow
                icon="checkmark-circle"
                label="Take Profit Alerts"
                sublabel="TP1, TP2, TP3 hits"
                value={tpHit}
                onToggle={(v) => {
                  if (!pushEnabled) return;
                  setNotifPref('tpHit', v);
                }}
              />
              <SettingRow
                icon="close-circle"
                label="Stop Loss Alerts"
                sublabel="When stop loss is triggered"
                value={stopped}
                onToggle={(v) => {
                  if (!pushEnabled) return;
                  setNotifPref('stopped', v);
                }}
              />
            </View>
          </View>
        </Animated.View>

        {/* ── Security ─────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(250).duration(400)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textTertiary, fontFamily: 'Inter-SemiBold' }]}>SECURITY</Text>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <SettingRow
              icon="lock-closed"
              label="Change Password"
              sublabel="Send a reset link to your email"
              chevron
              onPress={() => Alert.alert('Change Password', 'A password reset link will be sent to your email.', [{ text: 'OK' }])}
            />
          </View>
        </Animated.View>

        {/* ── About ────────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textTertiary, fontFamily: 'Inter-SemiBold' }]}>ABOUT</Text>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <SettingRow icon="school" label="How to Use AlphaAI" sublabel="Guide, Pro Mode filters & tradeable coins" chevron onPress={() => router.push('/guide')} iconColor="#6C4BEF" />
            <SettingRow
              icon="shield-checkmark"
              label="Pro Mode"
              sublabel={
                proModeEnabled === null
                  ? 'Checking backend mode...'
                  : proModeEnabled
                    ? (isProModeSaving ? 'Saving... strict filters active' : 'ON — strict filters active')
                    : (isProModeSaving ? 'Saving... wider signal intake' : 'OFF — wider signal intake')
              }
              iconColor={proModeEnabled === false ? '#9AA5B1' : '#00B67A'}
              value={!!proModeEnabled}
              onToggle={toggleProMode}
            />
            <SettingRow icon="information-circle" label="App Version" sublabel="AlphaAI v1.0.0" />
            <SettingRow icon="document-text" label="Terms of Service" chevron onPress={() => router.push('/terms')} />
            <SettingRow icon="shield-checkmark" label="Privacy Policy" chevron onPress={() => router.push('/privacy')} iconColor="#00B67A" />
          </View>
        </Animated.View>

        {/* ── Sign Out ─────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(350).duration(400)} style={{ marginHorizontal: 20, marginTop: 8 }}>
          <Pressable onPress={handleSignOut} style={[styles.signOutBtn, { borderColor: theme.error + '40', backgroundColor: theme.error + '12' }]}>
            <Ionicons name="log-out-outline" size={18} color={theme.error} />
            <Text style={[styles.signOutText, { color: theme.error, fontFamily: 'Inter-SemiBold' }]}>Sign Out</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  scroll:       { paddingHorizontal: 20 },
  header:       { marginBottom: 24 },
  title:        { fontSize: 30 },
  profileCard:  { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 28 },
  avatar:       { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  avatarText:   { fontSize: 22, color: '#000' },
  profileInfo:  { flex: 1 },
  profileName:  { fontSize: 18, marginBottom: 2 },
  profileEmail: { fontSize: 15 },
  tierBadge:    { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  tierText:     { fontSize: 14 },
  section:      { marginBottom: 24 },
  sectionTitle: { fontSize: 13, letterSpacing: 1.2, marginBottom: 8, marginLeft: 4 },
  card:         { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  row:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  rowIcon:      { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowLabel:     { flex: 1 },
  rowTitle:     { fontSize: 17 },
  rowSub:       { fontSize: 14, marginTop: 2 },
  signOutBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 16, borderWidth: 1, paddingVertical: 16 },
  signOutText:  { fontSize: 18 },
});
