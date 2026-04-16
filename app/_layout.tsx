import { useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { useAuthStore } from '@/src/store/useAuthStore';
import { useFonts } from 'expo-font';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';

import { ThemeProvider, useTheme } from '@/src/contexts/ThemeContext';
import { SplashView } from '@/src/components/SplashView';
import { usePushNotifications } from '@/src/services/pushNotifications';
import { wsManager } from '@/src/services/wsManager';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = { anchor: '(tabs)' };

// ── Auth Guard ────────────────────────────────────────────────────────
function AuthGuard({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const segments = useSegments();
  const status   = useAuthStore((s) => s.status);
  const initialized = useRef(false);

  useEffect(() => {
    if (status === 'loading' || status === 'initialising') return;

    const inAuth    = segments[0] === '(auth)';
    const inOnboard = segments[0] === 'onboarding';

    if (status === 'unauthenticated' && !inAuth) {
      router.replace('/(auth)/sign-in');
    } else if (status === 'authenticated' && (inAuth || inOnboard)) {
      router.replace('/(tabs)');
    }

    initialized.current = true;
  }, [status, segments]);

  return <>{children}</>;
}

// ── Inner layout (needs theme access) ─────────────────────────────────
function RootLayoutInner() {
  const { theme, isDark } = useTheme();

  const [fontsLoaded, fontError] = useFonts({
    'Inter-Regular':  Inter_400Regular,
    'Inter-Medium':   Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold':     Inter_700Bold,
  });

  const initialize = useAuthStore((s: { initialize: () => void }) => s.initialize);
  usePushNotifications();

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
      initialize();
      wsManager.connect();
    }
  }, [fontsLoaded, fontError]);

  // Show our custom logo splash while fonts are loading — no lines, just the mark
  if (!fontsLoaded && !fontError) {
    return <SplashView />;
  }

  return (
    <AuthGuard>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.background },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="(auth)"        options={{ headerShown: false, animation: 'fade' }} />
          <Stack.Screen name="onboarding"    options={{ headerShown: false, animation: 'fade' }} />
          <Stack.Screen name="(tabs)"        options={{ headerShown: false }} />
          <Stack.Screen name="notifications" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="watchlist"     options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="signal/[id]"   options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="terms"         options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="privacy"       options={{ animation: 'slide_from_right' }} />
        </Stack>
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </View>
    </AuthGuard>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutInner />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
