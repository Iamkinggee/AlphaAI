/**
 * AlphaAI Frontend — Push Notification Service
 * Registers device push token with the backend.
 * Handles foreground notification display and deep link routing.
 */
import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { apiClient } from '@/src/services/apiClient';
import { useNotificationStore } from '@/src/store/useNotificationStore';
import { wsManager } from '@/src/services/wsManager';

// Configure how notifications appear when the app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Hook: registers for push notifications and sets up foreground/tap handlers.
 * Mount once in _layout.tsx after authentication.
 */
export function usePushNotifications() {
  const router = useRouter();
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener      = useRef<Notifications.EventSubscription | null>(null);
  const { fetchNotifications } = useNotificationStore();

  useEffect(() => {
    registerForPushNotifications();

    // Foreground notification received — refresh notification list
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      console.log('📲 [Push] Foreground notification:', notification.request.content.title);
      fetchNotifications(); // refresh badge count
    });

    // User tapped a notification — navigate to relevant screen
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
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

    // Listen for real-time signal alerts via WS
    const unsubApproaching = wsManager.on<{ pair: string; signalId: string; score: number }>(
      'signal_approaching',
      () => fetchNotifications()
    );
    const unsubActive = wsManager.on<{ pair: string; signalId: string }>(
      'signal_active',
      () => fetchNotifications()
    );

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
      unsubApproaching();
      unsubActive();
    };
  }, []);
}

async function registerForPushNotifications(): Promise<void> {
  // Skip push registration in Expo Go / web
  const isPhysicalDevice = Platform.OS === 'ios' || Platform.OS === 'android';
  if (!isPhysicalDevice) {
    console.log('[Push] Non-native platform — skipping push token registration');
    return;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('signals', {
      name: 'Signal Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#00D8A4',
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('system', {
      name: 'System Updates',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: null,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('[Push] Notification permission denied');
    return;
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID ?? 'alphaai',
    });
    const token = tokenData.data;
    console.log(`📲 [Push] Token registered: ${token.substring(0, 30)}…`);
    // Register with backend
    await apiClient.post('/notifications/push-token', { token, platform: Platform.OS });
  } catch (err) {
    console.warn('[Push] Token registration failed:', err);
  }
}
