import { Tabs } from 'expo-router';
import CustomTabBar from '@/src/components/ui/TabBar';

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index"    options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="signals"  options={{ title: 'Signals'   }} />
      <Tabs.Screen name="analyse"  options={{ title: 'Analyse'   }} />
      <Tabs.Screen name="aichat"   options={{ title: 'AI Chat'   }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings'  }} />
    </Tabs>
  );
}
