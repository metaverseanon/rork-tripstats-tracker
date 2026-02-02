import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";
import React from "react";
import { useSettings } from "@/providers/SettingsProvider";

export default function TabLayout() {
  const { colors } = useSettings();

  return (
    <NativeTabs
      blurEffect="systemMaterial"
      tintColor={colors.tabBarActive}
      iconColor={{
        default: colors.tabBarInactive,
        selected: colors.tabBarActive,
      }}
      labelStyle={{
        color: colors.tabBarInactive,
      }}
    >
      <NativeTabs.Trigger name="track">
        <Icon sf="play.fill" />
        <Label>Track</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="trips">
        <Icon sf="clock.arrow.circlepath" />
        <Label>Recent</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="leaderboard">
        <Icon sf="trophy.fill" />
        <Label>Leaderboard</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="recap">
        <Icon sf="chart.bar.fill" />
        <Label>Recap</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <Icon sf="gearshape.fill" />
        <Label>Settings</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
