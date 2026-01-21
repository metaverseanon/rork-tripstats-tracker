import { Tabs } from "expo-router";
import { Play, History, Trophy, Settings, BarChart3 } from "lucide-react-native";
import React from "react";
import { Image } from "react-native";
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
          headerRight: () => (
            <Image
              source={{ uri: colors.background === '#000000'
                ? 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/3b6m9hjk0d8m052wblrpp'
                : 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/u0e61nd6z1z8cesg8xthm'
              }}
              style={{ width: 112, height: 32, marginRight: 16 }}
              resizeMode="contain"
            />
          ),
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
