import { Tabs } from "expo-router";
import React from "react";
import { Platform, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
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
        headerShown: false,
        tabBarActiveTintColor: colors.tabBarActive,
        tabBarInactiveTintColor: colors.tabBarInactive,
        tabBarStyle: {
          position: 'absolute',
          borderTopWidth: 0,
          elevation: 0,
          backgroundColor: Platform.OS === 'ios' ? 'transparent' : 'rgba(255,255,255,0.9)',
        },
        tabBarBackground: () => 
          Platform.OS === 'ios' ? (
            <BlurView
              intensity={80}
              tint="light"
              style={StyleSheet.absoluteFill}
            />
          ) : null,
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
