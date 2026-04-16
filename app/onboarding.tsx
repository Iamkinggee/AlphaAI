import { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, Dimensions,
  Pressable, ViewToken,
} from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    key: '1',
    icon: 'flash' as const,
    iconColor: '#FFB800',
    title: 'Detect Before\nPrice Moves',
    subtitle: 'Our 3-stage SMC engine scans 20+ pairs around the clock — flagging institution-level setups hours before they trigger.',
  },
  {
    key: '2',
    icon: 'notifications' as const,
    iconColor: '#00D4FF',
    title: 'Real-Time\nSignal Alerts',
    subtitle: 'Get instant push alerts when a signal approaches a key zone, activates, or hits a take-profit — never miss an entry again.',
  },
  {
    key: '3',
    icon: 'analytics' as const,
    iconColor: '#00F0A0',
    title: 'AI-Powered\nTrade Analysis',
    subtitle: 'Ask AlphaAI anything about a setup. Get institutional-grade SMC analysis, risk management guidance, and live chart overlays.',
  },
];

export default function OnboardingScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const flatRef = useRef<FlatList>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems[0]) setActiveIndex(viewableItems[0].index ?? 0);
    }
  ).current;

  const handleNext = async () => {
    if (activeIndex < SLIDES.length - 1) {
      flatRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    } else {
      await AsyncStorage.setItem('@alphaai/onboarded', 'true');
      router.replace('/(auth)/sign-in');
    }
  };

  const handleSkip = async () => {
    await AsyncStorage.setItem('@alphaai/onboarded', 'true');
    router.replace('/(auth)/sign-in');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingBottom: insets.bottom + 24 }]}>
      {/* Skip */}
      <Pressable onPress={handleSkip} style={[styles.skipBtn, { top: insets.top + 16 }]}>
        <Text style={[styles.skipText, { color: theme.textTertiary }]}>Skip</Text>
      </Pressable>

      {/* Slides */}
      <FlatList
        ref={flatRef}
        data={SLIDES}
        keyExtractor={(i) => i.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            {/* Icon circle */}
            <Animated.View
              entering={FadeIn.duration(600)}
              style={[styles.iconCircle, { borderColor: item.iconColor + '30', backgroundColor: item.iconColor + '12' }]}
            >
              <Ionicons name={item.icon} size={64} color={item.iconColor} />
            </Animated.View>

            <Animated.Text
              entering={FadeInDown.delay(150).duration(500)}
              style={[styles.title, { color: theme.textPrimary }]}
            >
              {item.title}
            </Animated.Text>

            <Animated.Text
              entering={FadeInDown.delay(300).duration(500)}
              style={[styles.subtitle, { color: theme.textSecondary }]}
            >
              {item.subtitle}
            </Animated.Text>
          </View>
        )}
      />

      {/* Dots */}
      <View style={styles.dotsRow}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: i === activeIndex ? theme.accentPrimary : theme.border,
                width: i === activeIndex ? 24 : 8,
              },
            ]}
          />
        ))}
      </View>

      {/* CTA */}
      <Pressable
        onPress={handleNext}
        style={[styles.cta, { backgroundColor: theme.accentPrimary }]}
      >
        <Text style={styles.ctaText}>
          {activeIndex < SLIDES.length - 1 ? 'Continue' : 'Get Started'}
        </Text>
        <Ionicons name="arrow-forward" size={18} color="#000" style={{ marginLeft: 8 }} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  skipBtn: { position: 'absolute', right: 24, zIndex: 10 },
  skipText: { fontFamily: 'Inter-Medium', fontSize: 15 },
  slide: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  iconCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 32,
    fontFamily: 'Inter-Bold',
    textAlign: 'center',
    lineHeight: 40,
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
    lineHeight: 26,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 32,
  },
  dot: { height: 8, borderRadius: 4 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 32,
    paddingVertical: 18,
    borderRadius: 16,
  },
  ctaText: { fontFamily: 'Inter-Bold', fontSize: 17, color: '#000' },
});
