/**
 * AlphaAI Splash Screen
 * Shows a clean animated logo while the app initialises.
 * Hides automatically once fonts are loaded and auth state is resolved.
 */
import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withTiming, withSequence, Easing,
} from 'react-native-reanimated';
import { useTheme } from '@/src/contexts/ThemeContext';

interface SplashProps {
  /** Called when the splash is ready to be dismissed */
  onReady?: () => void;
}

export default function SplashScreen({ onReady }: SplashProps = {}) {
  const { theme } = useTheme();

  const pulse = useSharedValue(1);
  const opacity = useSharedValue(0);

  useEffect(() => {
    // Fade in
    opacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) });
    // Subtle pulse loop
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(1,    { duration: 900, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const containerStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const logoStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Animated.View style={[styles.content, containerStyle]}>
        {/* Logo mark */}
        <Animated.View style={[styles.logoRing, { borderColor: theme.accentPrimary + '30' }, logoStyle]}>
          <View style={[styles.logoInner, { backgroundColor: theme.accentPrimaryDim, borderColor: theme.accentPrimary + '50' }]}>
            <Text style={[styles.logoLetter, { color: theme.accentPrimary, fontFamily: 'Inter-Bold' }]}>A</Text>
          </View>
        </Animated.View>

        <Text style={[styles.brand, { color: theme.textPrimary, fontFamily: 'Inter-Bold' }]}>AlphaAI</Text>
        <Text style={[styles.tagline, { color: theme.textTertiary, fontFamily: 'Inter-Regular' }]}>Institutional Signal Detection</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content:   { alignItems: 'center' },
  logoRing:  { width: 120, height: 120, borderRadius: 60, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  logoInner: { width: 90, height: 90, borderRadius: 45, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  logoLetter:{ fontSize: 44 },
  brand:     { fontSize: 28, marginBottom: 8 },
  tagline:   { fontSize: 14, letterSpacing: 0.3 },
});
