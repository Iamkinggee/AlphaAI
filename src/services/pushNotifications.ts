/**
 * AlphaAI Frontend — Push Notification Service
 * Registers device push token with the backend.
 */
import { useEffect, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { apiClient } from '@/src/services/apiClient';
import { useNotificationStore } from '@/src/store/useNotificationStore';
import { useAuthStore } from '@/src/store/useAuthStore';
import { wsManager } from '@/src/services/wsManager';
import { buildNotifKey, checkAndMark, isEventFresh, isPairResolved, markPairResolved, clearPairResolved } from '@/src/utils/notificationGuard';

// Dynamic import helper to prevent expo-notifications side-effects in Expo Go
let Notifications: any = null;
const isExpoGo = Constants.appOwnership === 'expo';

if (!isExpoGo && Platform.OS !== 'web') {
  try {
    Notifications = require('expo-notifications');
    // Configure how notifications appear when the app is in foreground
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList:   true,
        shouldPlaySound:  true,
        shouldSetBadge:   true,
      }),
    });
  } catch (err) {
    console.warn('[Push] Failed to load expo-notifications:', err);
  }
}

// ── Notification builders for each signal event type ────────────────────

interface SignalEventData {
  pair?: string;
  signalId?: string;
  score?: number;
  status?: string;
  price?: number;
  direction?: string;
  timeframe?: string;
  entryZone?: { low: number; high: number };
  stopLoss?: number;
  takeProfit1?: number;
  takeProfit2?: number;
  takeProfit3?: number;
  rrTp1?: number;
}

function buildApproachingNotification(data: SignalEventData): any {
  const entry = data.entryZone
    ? `${formatNotifPrice(data.entryZone.low)}–${formatNotifPrice(data.entryZone.high)}`
    : null;
  const sl = typeof data.stopLoss === 'number' ? formatNotifPrice(data.stopLoss) : null;
  const tp1 = typeof data.takeProfit1 === 'number' ? formatNotifPrice(data.takeProfit1) : null;
  const rr1 = typeof data.rrTp1 === 'number' ? `1:${data.rrTp1.toFixed(1)}` : null;
  const planLine = entry && sl && tp1
    ? `Entry ${entry} · SL ${sl} · TP1 ${tp1}${rr1 ? ` (${rr1})` : ''}`
    : null;
  return {
    title: `📡 ${data.pair ?? 'Signal'} — Approaching Zone`,
    body: planLine
      ? `${planLine}${data.score ? ` · Score ${data.score}/100` : ''}${data.timeframe ? ` · ${data.timeframe}` : ''}`
      : `Price approaching entry zone${data.score ? ` · Confluence: ${data.score}/100` : ''}${data.timeframe ? ` · ${data.timeframe}` : ''}`,
    sound: true,
    priority: Notifications?.AndroidNotificationPriority?.HIGH ?? 'high',
    data: { type: 'approaching', signalId: data.signalId, pair: data.pair },
  };
}

function buildActiveNotification(data: SignalEventData): any {
  return {
    title: `🔥 ${data.pair ?? 'Signal'} — Trade Active!`,
    body: `Entry triggered${data.direction ? ` · ${data.direction}` : ''}${data.price ? ` @ $${formatNotifPrice(data.price)}` : ''}`,
    sound: true,
    priority: Notifications?.AndroidNotificationPriority?.MAX ?? 'high',
    data: { type: 'active', signalId: data.signalId, pair: data.pair },
  };
}

function buildTpHitNotification(data: SignalEventData): any {
  const tpLabel = data.status === 'TP1_hit' ? 'TP1' : data.status === 'TP2_hit' ? 'TP2' : data.status === 'TP3_hit' ? 'TP3' : 'Target';
  const emoji = data.status === 'TP3_hit' ? '🏆' : data.status === 'TP2_hit' ? '🎯' : '✅';
  return {
    title: `${emoji} ${data.pair ?? 'Signal'} — ${tpLabel} Hit!`,
    body: data.price
      ? `${tpLabel} reached at $${formatNotifPrice(data.price)}. Secure profits!`
      : `${tpLabel} target reached. Consider taking partial profits.`,
    sound: true,
    priority: Notifications?.AndroidNotificationPriority?.HIGH ?? 'high',
    data: { type: 'tp_hit', signalId: data.signalId, pair: data.pair },
  };
}

function buildStoppedNotification(data: SignalEventData): any {
  return {
    title: `❌ ${data.pair ?? 'Signal'} — Stopped Out`,
    body: data.price
      ? `Stop loss hit at $${formatNotifPrice(data.price)}. Review trade in journal.`
      : `Stop loss triggered. Review your position.`,
    sound: true,
    priority: Notifications?.AndroidNotificationPriority?.HIGH ?? 'high',
    data: { type: 'stopped', signalId: data.signalId, pair: data.pair },
  };
}

function formatNotifPrice(price: number): string {
  if (price >= 10000) return price.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (price >= 1000) return price.toFixed(1);
  if (price >= 1) return price.toFixed(3);
  return price.toFixed(5);
}

/**
 * Fire a local notification immediately with sound + haptics.
 */
async function fireLocalNotification(
  content: any,
  channelId: string = 'signals',
  dedupKey: string,
): Promise<boolean> {
  if (!Notifications) return false;

  const isNew = await checkAndMark(dedupKey);
  if (!isNew) {
    console.log(`[Push] Suppressed duplicate notification: ${dedupKey}`);
    return false;
  }

  try {
    await Haptics.notificationAsync(
      content.priority === Notifications.AndroidNotificationPriority?.MAX
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning
    ).catch(() => {});

    await Notifications.scheduleNotificationAsync({
      content: {
        ...content,
        sound: true,
        ...(Platform.OS === 'android' ? { channelId } : {}),
      },
      trigger: null,
    });
    return true;
  } catch (err) {
    console.warn('[Push] Failed to fire local notification:', err);
    return false;
  }
}

/**
 * Hook: registers for push notifications and sets up foreground/tap handlers.
 */
export function usePushNotifications() {
  const router = useRouter();
  const notificationListener = useRef<any>(null);
  const responseListener      = useRef<any>(null);
  const { addRealtimeNotification } = useNotificationStore();

  useEffect(() => {
    if (isExpoGo || !Notifications) return;

    registerForPushNotifications();

    notificationListener.current = Notifications.addNotificationReceivedListener((notification: any) => {
      console.log('📲 [Push] Foreground notification:', notification.request.content.title);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response: any) => {
      const data = response.notification.request.content.data as {
        type?: string;
        signalId?: string;
        pair?: string;
      };

      if (data?.signalId) {
        router.push(`/signal/${data.signalId}`);
      } else if (data?.type === 'approaching' || data?.type === 'active') {
        router.push('/(tabs)/signals');
      } else if (data?.type === 'system') {
        router.push('/notifications');
      }
    });

    // ── Real-time WebSocket → Local Notification bridge ──────────
    const unsubApproaching = wsManager.on<SignalEventData>(
      'signal_approaching',
      async (data) => {
        if (!isEventFresh((data as any).timestamp ?? (data as any).created_at)) return;
        const prefs = useAuthStore.getState().settings.notifications;
        if (!prefs.pushEnabled || !prefs.approaching) return;
        await clearPairResolved(data.pair);
        const key = buildNotifKey('approaching', data.signalId);
        const fired = await fireLocalNotification(buildApproachingNotification(data), 'signals', key);
        if (fired) {
          addRealtimeNotification({
            type: 'approaching',
            priority: 'critical',
            title: `${data.pair ?? 'Signal'} — Approaching Zone`,
            body: data.entryZone && typeof data.stopLoss === 'number' && typeof data.takeProfit1 === 'number'
              ? `Entry ${formatNotifPrice(data.entryZone.low)}–${formatNotifPrice(data.entryZone.high)} · SL ${formatNotifPrice(data.stopLoss)} · TP1 ${formatNotifPrice(data.takeProfit1)}${typeof data.rrTp1 === 'number' ? ` (1:${data.rrTp1.toFixed(1)})` : ''}${data.score ? ` · Score ${data.score}` : ''}`
              : `Price approaching entry zone${data.score ? ` · Score: ${data.score}` : ''}`,
            pair: data.pair,
            signalId: data.signalId,
          });
        }
      }
    );

    const unsubActive = wsManager.on<SignalEventData>(
      'signal_active',
      async (data) => {
        if (!isEventFresh((data as any).timestamp ?? (data as any).created_at)) return;
        const prefs = useAuthStore.getState().settings.notifications;
        if (!prefs.pushEnabled || !prefs.active) return;
        await clearPairResolved(data.pair);
        const key = buildNotifKey('active', data.signalId);
        const fired = await fireLocalNotification(buildActiveNotification(data), 'signals', key);
        if (fired) {
          addRealtimeNotification({
            type: 'active',
            priority: 'critical',
            title: `${data.pair ?? 'Signal'} — Trade Active!`,
            body: `Entry triggered${data.direction ? ` · ${data.direction}` : ''}`,
            pair: data.pair,
            signalId: data.signalId,
          });
        }
      }
    );

    const unsubTpHit = wsManager.on<SignalEventData>(
      'signal_tp_hit',
      async (data) => {
        if (!isEventFresh((data as any).timestamp ?? (data as any).created_at)) return;
        const prefs = useAuthStore.getState().settings.notifications;
        if (!prefs.pushEnabled || !prefs.tpHit) return;
        if (await isPairResolved(data.pair)) return;
        const key = buildNotifKey(`tp_hit_${data.status ?? 'tp'}`, data.signalId);
        const fired = await fireLocalNotification(buildTpHitNotification(data), 'signals', key);
        if (fired) {
          addRealtimeNotification({
            type: 'tp_hit',
            priority: 'high',
            title: `${data.pair ?? 'Signal'} — Target Hit!`,
            body: `${data.status ?? 'TP'} reached${data.price ? ` at $${formatNotifPrice(data.price)}` : ''}`,
            pair: data.pair,
            signalId: data.signalId,
          });
          if (data.status === 'TP3_hit') await markPairResolved(data.pair);
        }
      }
    );

    const unsubStopped = wsManager.on<SignalEventData>(
      'signal_stopped',
      async (data) => {
        if (!isEventFresh((data as any).timestamp ?? (data as any).created_at)) return;
        const prefs = useAuthStore.getState().settings.notifications;
        if (!prefs.pushEnabled || !prefs.stopped) return;
        if (await isPairResolved(data.pair)) return;
        const key = buildNotifKey('stopped', data.signalId);
        const fired = await fireLocalNotification(buildStoppedNotification(data), 'signals', key);
        if (fired) {
          addRealtimeNotification({
            type: 'stopped',
            priority: 'high',
            title: `${data.pair ?? 'Signal'} — Stopped Out`,
            body: `Stop loss hit${data.price ? ` at $${formatNotifPrice(data.price)}` : ''}`,
            pair: data.pair,
            signalId: data.signalId,
          });
          await markPairResolved(data.pair);
        }
      }
    );

    const unsubScanComplete = wsManager.on<{ pairsScanned?: number; signalsFound?: number }>(
      'scan_complete',
      async (data) => {
        const prefs = useAuthStore.getState().settings.notifications;
        if (!prefs.pushEnabled) return;
        if (data.signalsFound && data.signalsFound > 0) {
          const key = buildNotifKey('scan_complete', null);
          await fireLocalNotification(
            {
              title: '🔍 Scan Complete',
              body: `${data.pairsScanned ?? 0} pairs scanned · ${data.signalsFound} new signal${data.signalsFound > 1 ? 's' : ''} detected`,
              sound: true,
              priority: Notifications?.AndroidNotificationPriority?.DEFAULT ?? 'default',
              data: { type: 'system' },
            },
            'system',
            key,
          );
        }
      }
    );

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
      unsubApproaching();
      unsubActive();
      unsubTpHit();
      unsubStopped();
      unsubScanComplete();
    };
  }, []);
}

async function registerForPushNotifications(): Promise<void> {
  if (!Notifications) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('signals', {
      name: 'Signal Alerts',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
    });

    await Notifications.setNotificationChannelAsync('system', {
      name: 'System Updates',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return;

  try {
    const projectId = process.env.EXPO_PUBLIC_PROJECT_ID;
    const isValidUUID = projectId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);

    if (!isValidUUID) return;

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;
    await apiClient.post('/notifications/push-token', { token, platform: Platform.OS });
  } catch (err) {
    console.warn('[Push] Token registration failed:', err);
  }
}
