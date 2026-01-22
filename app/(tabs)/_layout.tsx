import { Tabs } from "expo-router";
import { Play, History, Trophy, Settings, BarChart3 } from "lucide-react-native";
import React from "react";
import { useSettings } from "@/providers/SettingsProvider";

export default function TabLayout() {
  const { colors } = useSettings();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tabBarActive,
        tabBarInactiveTintColor: colors.tabBarInactive,
        headerShown: true,
        tabBarStyle: {
          backgroundColor: colors.tabBarBackground,
          borderTopColor: colors.border,
        },
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.text,
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="track"
        options={{
          title: "Track",
          tabBarIcon: ({ color }) => <Play color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: "Recent",
          tabBarIcon: ({ color }) => <History color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: "Leaderboard",
          tabBarIcon: ({ color }) => <Trophy color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="recap"
        options={{
          title: "Recap",
          tabBarIcon: ({ color }) => <BarChart3 color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => <Settings color={color} size={24} />,
        }}
      />
    </Tabs>
  );
}
