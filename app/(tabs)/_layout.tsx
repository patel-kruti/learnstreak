import { Tabs } from 'expo-router';
import { Text, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS } from '../../src/constants/theme';

// Fixed font size — Android clips emoji when size animates between focused/unfocused
function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.4 }}>{emoji}</Text>
  );
}

export default function TabLayout() {
  // Read device safe area so tab bar sits above Android gesture bar / iPhone home indicator
  const insets = useSafeAreaInsets();
  const tabBarHeight = 56 + insets.bottom;

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopWidth: 1.5,
          borderTopColor: COLORS.borderLight,
          // Use inset-aware height so bar is never clipped by gesture nav bar
          height: tabBarHeight,
          paddingTop: 6,
          // paddingBottom driven by safe area, not hardcoded
          paddingBottom: insets.bottom || 6,
        },
        tabBarActiveTintColor: COLORS.black,
        tabBarInactiveTintColor: COLORS.textTertiary,
        tabBarLabelStyle: {
          fontSize: FONTS.sizes.xs,
          fontWeight: FONTS.weights.medium,
        },
        headerStyle: {
          backgroundColor: COLORS.white,
          // elevation:0 removes Android shadow that clashes with our border
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1.5,
          borderBottomColor: COLORS.borderLight,
        },
        headerTitleStyle: {
          fontSize: FONTS.sizes.lg,
          fontWeight: FONTS.weights.bold,
          color: COLORS.textPrimary,
        },
        headerTintColor: COLORS.black,
      }}
    >
      {/* ── Our 5 screens — declared first so they appear in order ── */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Add',
          headerTitle: 'LearnStreak',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📚" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="summary"
        options={{
          title: 'Summary',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📊" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📋" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="streak"
        options={{
          title: 'Streak',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🔥" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="badges"
        options={{
          title: 'Badges',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏆" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => <TabIcon emoji="⚙️" focused={focused} />,
        }}
      />

      {/* ── Hide template leftover screens ── */}
      <Tabs.Screen name="explore" options={{ href: null }} />
      <Tabs.Screen name="two"     options={{ href: null }} />
    </Tabs>
  );
}
