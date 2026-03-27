import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  useFonts,
  Orbitron_400Regular,
  Orbitron_500Medium,
  Orbitron_600SemiBold,
  Orbitron_700Bold,
  Orbitron_800ExtraBold,
  Orbitron_900Black,
} from "@expo-google-fonts/orbitron";
import { trpc, trpcClient } from "@/lib/trpc";
import { SettingsProvider } from "@/providers/SettingsProvider";
import { UserProvider } from "@/providers/UserProvider";
import { TripProvider } from "@/providers/TripProvider";
import { NotificationProvider } from "@/providers/NotificationProvider";
import { AchievementProvider } from "@/providers/AchievementProvider";

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ headerShown: false }} />
      <Stack.Screen name="user-profile" options={{ headerShown: false }} />
      <Stack.Screen name="achievements" options={{ headerShown: false }} />
      <Stack.Screen name="create-post" options={{ presentation: "modal", headerShown: false }} />
      <Stack.Screen name="notifications" options={{ headerShown: false }} />
      <Stack.Screen name="my-posts" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Orbitron_400Regular,
    Orbitron_500Medium,
    Orbitron_600SemiBold,
    Orbitron_700Bold,
    Orbitron_800ExtraBold,
    Orbitron_900Black,
  });

  useEffect(() => {
    if (fontsLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <UserProvider>
            <SettingsProvider>
              <TripProvider>
                <NotificationProvider>
                  <AchievementProvider>
                    <RootLayoutNav />
                  </AchievementProvider>
                </NotificationProvider>
              </TripProvider>
            </SettingsProvider>
          </UserProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
