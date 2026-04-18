/**
 * AlphaAI — Auth Splash Screen
 * Plain screen with only the app logo loading.
 * Auto-navigates to sign-in after a brief delay.
 */
import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '@/src/contexts/ThemeContext';

export default function SplashScreen() {
  const router = useRouter();
  const { theme } = useTheme();

  const logoScale = useSharedValue(0.3);
  const logoOpacity = useSharedValue(0);
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    // Logo appears with spring animation
    logoOpacity.value = withTiming(1, { duration: 600 });
    logoScale.value = withSpring(1, { damping: 12, stiffness: 100 });

    // Subtle pulse loop
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1,    { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    // Navigate to sign-in after animation
    const timer = setTimeout(() => {
      router.replace('/(auth)/sign-in');
    }, 2400);

    return () => clearTimeout(timer);
  }, []);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value * pulseScale.value }],
  }));

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Animated.View style={[styles.logoContainer, logoAnimatedStyle]}>
        <View style={[styles.logoInner, { backgroundColor: theme.accentPrimaryDim, borderColor: theme.accentPrimary + '40' }]}>
          <Animated.Text style={[styles.logoText, { color: theme.accentPrimary, fontFamily: 'Inter-Bold' }]}>
            A
          </Animated.Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  logoText: {
    fontSize: 50,
  },
});
