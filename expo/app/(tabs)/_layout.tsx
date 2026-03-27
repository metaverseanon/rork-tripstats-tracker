import { Tabs } from "expo-router";
import { Gauge, Trophy, Clock, Settings, Newspaper } from "lucide-react-native";
import React from "react";
import { useSettings } from "@/providers/SettingsProvider";

export default function TabLayout() {
  const { colors } = useSettings();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.tabIconDefault,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.background === '#000000' ? '#0A0A0A' : colors.card,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: {
          fontFamily: 'Orbitron_500Medium',
          fontSize: 9,
        },
      }}
    >
      <Tabs.Screen
        name="track"
        options={{
          title: "Track",
          tabBarIcon: ({ color, size }) => <Gauge size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: "Trips",
          tabBarIcon: ({ color, size }) => <Clock size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          title: "Feed",
          tabBarIcon: ({ color, size }) => <Newspaper size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: "Ranks",
          tabBarIcon: ({ color, size }) => <Trophy size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="recap"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
