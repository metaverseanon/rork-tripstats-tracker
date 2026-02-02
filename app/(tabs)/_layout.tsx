import { Tabs } from "expo-router";
import React from "react";
import { Platform } from "react-native";
import { Play, Clock, Trophy, BarChart3, Settings } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useSettings } from "@/providers/SettingsProvider";

export default function TabLayout() {
  const { colors } = useSettings();

  const handleTabPress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: '600' as const,
        },
        tabBarActiveTintColor: colors.tabBarActive,
        tabBarInactiveTintColor: colors.tabBarInactive,
        tabBarStyle: {
          backgroundColor: colors.tabBarBackground,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        },
      }}
    >
      <Tabs.Screen
        name="track"
        options={{
          title: "Track",
          tabBarIcon: ({ color, size }) => <Play size={size} color={color} />,
        }}
        listeners={{ tabPress: handleTabPress }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: "Recent",
          tabBarIcon: ({ color, size }) => <Clock size={size} color={color} />,
        }}
        listeners={{ tabPress: handleTabPress }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: "Leaderboard",
          tabBarIcon: ({ color, size }) => <Trophy size={size} color={color} />,
        }}
        listeners={{ tabPress: handleTabPress }}
      />
      <Tabs.Screen
        name="recap"
        options={{
          title: "Recap",
          tabBarIcon: ({ color, size }) => <BarChart3 size={size} color={color} />,
        }}
        listeners={{ tabPress: handleTabPress }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
        }}
        listeners={{ tabPress: handleTabPress }}
      />
    </Tabs>
  );
}
