/**
 * SplashView — shown while fonts load.
 * Simple: logo mark only, no lines, no rings, no text.
 */
import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withSequence, withTiming, Easing,
} from 'react-native-reanimated';
import { useTheme } from '@/src/contexts/ThemeContext';

export function SplashView() {
  const { theme } = useTheme();

  const opacity = useSharedValue(0);
  const scale   = useSharedValue(0.85);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.ease) });
    scale.value   = withTiming(1, { duration: 500, easing: Easing.out(Easing.back(1.2)) });
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Animated.View style={[styles.logoWrap, { backgroundColor: theme.accentPrimaryDim }, animStyle]}>
        <Text style={[styles.logoLetter, { color: theme.accentPrimary, fontFamily: 'Inter-Bold' }]}>A</Text>
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
  logoWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLetter: {
    fontSize: 40,
  },
});
