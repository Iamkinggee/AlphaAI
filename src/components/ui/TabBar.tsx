import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Animated, { useAnimatedStyle, withSpring, useSharedValue, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/src/contexts/ThemeContext';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_CONFIG: Record<string, { active: IoniconName; inactive: IoniconName; label: string }> = {
  index:    { active: 'grid',                inactive: 'grid-outline',                label: 'Dashboard' },
  signals:  { active: 'flash',               inactive: 'flash-outline',               label: 'Signals'   },
  analyse:  { active: 'stats-chart',         inactive: 'stats-chart-outline',         label: 'Analyse'   },
  aichat:   { active: 'chatbubble-ellipses', inactive: 'chatbubble-ellipses-outline', label: 'AI Chat'   },
  settings: { active: 'settings',            inactive: 'settings-outline',            label: 'Settings'  },
};

interface TabItemProps {
  name: string;
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
}

function TabItem({ name, isFocused, onPress, onLongPress }: TabItemProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const cfg = TAB_CONFIG[name] ?? { active: 'ellipse', inactive: 'ellipse-outline', label: name };
  const iconName = isFocused ? cfg.active : cfg.inactive;
  const color    = isFocused ? theme.tabBarActive : theme.tabBarInactive;

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  // Pill highlight under active icon
  const pillStyle = useAnimatedStyle(() => ({
    opacity: withTiming(isFocused ? 1 : 0, { duration: 180 }),
    transform: [{ scaleX: withTiming(isFocused ? 1 : 0.4, { duration: 180 }) }],
  }));

  const onPressIn  = () => { scale.value = withSpring(0.88, { damping: 12 }); };
  const onPressOut = () => { scale.value = withSpring(1,    { damping: 12 }); };

  const handlePress = () => {
    if (!isFocused) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={onLongPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={styles.item}
      accessibilityLabel={`${cfg.label} tab`}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
    >
      <Animated.View style={[styles.inner, animStyle]}>
        {/* Active pill — sits behind icon, no overlap */}
        <Animated.View style={[styles.pill, { backgroundColor: theme.tabBarActive + '18' }, pillStyle]} />

        <Ionicons name={iconName} size={22} color={color} />

        <Text style={[
          styles.label,
          {
            color,
            fontFamily: isFocused ? 'Inter-SemiBold' : 'Inter-Regular',
            opacity: isFocused ? 1 : 0.7,
          },
        ]}>
          {cfg.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export default function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.bar, { backgroundColor: theme.tabBarBackground, borderTopColor: theme.tabBarBorder }]}>
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
        };
        const onLongPress = () => navigation.emit({ type: 'tabLongPress', target: route.key });

        return (
          <TabItem
            key={route.key}
            name={route.name}
            isFocused={isFocused}
            onPress={onPress}
            onLongPress={onLongPress}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar:   {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
    paddingBottom: Platform.OS === 'ios' ? 28 : 10,
    paddingHorizontal: 4,
  },
  item:  { flex: 1, alignItems: 'center' },
  inner: { alignItems: 'center', position: 'relative', paddingVertical: 4, paddingHorizontal: 8 },
  pill:  {
    // Sits behind icon — full-width rounded rectangle
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 12,
  },
  label: { fontSize: 10, marginTop: 3, letterSpacing: 0.2 },
});
