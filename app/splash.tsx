/**
 * AlphaAI Splash Screen
 * Plain screen with only the app logo — no text, no decorations.
 */
import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
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
        withTiming(1.06, { duration: 900, easing: Easing.inOut(Easing.ease) }),
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
        <Animated.View style={[styles.logoWrap, { backgroundColor: theme.accentPrimaryDim, borderColor: theme.accentPrimary + '40' }, logoStyle]}>
          <Animated.Text style={[styles.logoLetter, { color: theme.accentPrimary, fontFamily: 'Inter-Bold' }]}>A</Animated.Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content:   { alignItems: 'center' },
  logoWrap:  { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  logoLetter:{ fontSize: 50 },
});
