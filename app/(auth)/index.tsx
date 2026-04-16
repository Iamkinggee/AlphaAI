import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  withSpring,
  Easing,
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';
import { Colors } from '@/src/constants/colors';
import { Fonts, FontSizes } from '@/src/constants/fonts';

const { width, height } = Dimensions.get('window');

export default function SplashScreen() {
  const router = useRouter();
  const logoScale = useSharedValue(0.3);
  const logoOpacity = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(20);
  const subtitleOpacity = useSharedValue(0);
  const glowOpacity = useSharedValue(0);
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    // Stage 1: Logo appears with spring animation
    logoOpacity.value = withTiming(1, { duration: 600 });
    logoScale.value = withSpring(1, {
      damping: 12,
      stiffness: 100,
    });

    // Stage 2: Glow effect
    glowOpacity.value = withDelay(400, withTiming(0.6, { duration: 800 }));

    // Stage 3: Title slides up
    titleOpacity.value = withDelay(600, withTiming(1, { duration: 500 }));
    titleTranslateY.value = withDelay(600, withSpring(0, { damping: 15 }));

    // Stage 4: Subtitle fades in
    subtitleOpacity.value = withDelay(900, withTiming(1, { duration: 400 }));

    // Stage 5: Pulse animation loop
    pulseScale.value = withDelay(
      1200,
      withSequence(
        withTiming(1.05, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      )
    );

    // Navigate after animation
    const timer = setTimeout(() => {
      router.replace('/(auth)/sign-in');
    }, 2800);

    return () => clearTimeout(timer);
  }, []);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const glowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: pulseScale.value }],
  }));

  const titleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));

  const subtitleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
  }));

  return (
    <View style={styles.container}>
      {/* Background glow */}
      <Animated.View style={[styles.glow, glowAnimatedStyle]} />

      {/* Logo */}
      <Animated.View style={[styles.logoContainer, logoAnimatedStyle]}>
        <View style={styles.logoInner}>
          <Text style={styles.logoText}>α</Text>
        </View>
        <View style={styles.logoBorderOuter} />
      </Animated.View>

      {/* Title */}
      <Animated.View style={titleAnimatedStyle}>
        <Text style={styles.title}>AlphaAI</Text>
      </Animated.View>

      {/* Subtitle */}
      <Animated.View style={subtitleAnimatedStyle}>
        <Text style={styles.subtitle}>Institutional-Grade Signal Detection</Text>
      </Animated.View>

      {/* Decorative grid lines */}
      <View style={styles.gridContainer}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Animated.View
            key={i}
            entering={FadeIn.delay(200 + i * 100).duration(600)}
            style={[
              styles.gridLine,
              {
                top: (height / 8) * i,
                opacity: 0.03,
              },
            ]}
          />
        ))}
      </View>

      {/* Version */}
      <Animated.Text
        entering={FadeInDown.delay(1200).duration(400)}
        style={styles.version}
      >
        v1.0.0
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: Colors.accentPrimary,
    opacity: 0.08,
  },
  logoContainer: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  logoInner: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.accentPrimary + '40',
  },
  logoBorderOuter: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: Colors.accentPrimary + '20',
  },
  logoText: {
    fontSize: 48,
    fontFamily: 'Inter-Bold',
    color: Colors.accentPrimary,
  },
  title: {
    fontSize: FontSizes['5xl'],
    fontFamily: 'Inter-Bold',
    color: Colors.textPrimary,
    letterSpacing: 1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: FontSizes.md,
    fontFamily: 'Inter-Regular',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  gridContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: Colors.accentPrimary,
  },
  version: {
    position: 'absolute',
    bottom: 60,
    fontSize: FontSizes.xs,
    fontFamily: 'Inter-Regular',
    color: Colors.textTertiary,
    letterSpacing: 1,
  },
});
