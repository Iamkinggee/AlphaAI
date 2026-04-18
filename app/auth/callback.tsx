/**
 * AlphaAI — OAuth Callback Screen
 *
 * This route handles the deep-link redirect after Google OAuth.
 * On native (iOS/Android), expo-web-browser intercepts the alphaai://auth/callback
 * URL before it reaches this screen, so the user usually never sees this.
 *
 * On web, WebBrowser.maybeCompleteAuthSession() closes the popup and passes
 * control back to the opener — again, the user sees this for < 100 ms.
 *
 * If somehow the user lands here directly (e.g. manually opening the link),
 * we redirect them to the sign-in screen.
 */
import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/src/store/useAuthStore';
import { useTheme } from '@/src/contexts/ThemeContext';

// Required for web: closes the auth popup and returns control to the opener
WebBrowser.maybeCompleteAuthSession();

export default function AuthCallbackScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    // If auth succeeded (state updated by signInWithGoogle), the AuthGuard
    // in _layout.tsx will handle navigation. If not, send back to sign-in.
    const timer = setTimeout(() => {
      if (status !== 'authenticated') {
        router.replace('/(auth)/sign-in');
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [status]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ActivityIndicator size="large" color={theme.accentPrimary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
