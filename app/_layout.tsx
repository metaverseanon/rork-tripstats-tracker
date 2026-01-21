import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { StyleSheet, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { TripProvider } from "@/providers/TripProvider";
import { SettingsProvider } from "@/providers/SettingsProvider";
import { UserProvider } from "@/providers/UserProvider";
import { trpc, trpcClient } from "@/lib/trpc";
import {
  useFonts,
  Orbitron_400Regular,
  Orbitron_500Medium,
  Orbitron_600SemiBold,
  Orbitron_700Bold,
  Orbitron_800ExtraBold,
  Orbitron_900Black,
} from "@expo-google-fonts/orbitron";

SplashScreen.preventAutoHideAsync();

// Suppress TronLink wallet extension errors (browser extension interference)
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  const shouldSuppressError = (message: string) => {
    const lowerMessage = message.toLowerCase();
    return (
      lowerMessage.includes('tronlinkparams') ||
      lowerMessage.includes('tronlink') ||
      lowerMessage.includes('trap returned falsish') ||
      (lowerMessage.includes('proxy') && lowerMessage.includes('trap'))
    );
  };

  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    const errorMessage = String(args[0] || '');
    if (shouldSuppressError(errorMessage)) {
      return;
    }
    originalConsoleError.apply(console, args);
  };

  const originalConsoleWarn = console.warn;
  console.warn = (...args: any[]) => {
    const warnMessage = String(args[0] || '');
    if (shouldSuppressError(warnMessage)) {
      return;
    }
    originalConsoleWarn.apply(console, args);
  };

  window.addEventListener('error', (event) => {
    if (shouldSuppressError(event.message || '')) {
      event.preventDefault();
      event.stopPropagation();
      return true;
    }
  }, true);

  window.addEventListener('unhandledrejection', (event) => {
    const reason = String(event.reason || '');
    if (shouldSuppressError(reason)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

  // Clean up any TronLink injected properties
  try {
    if ('tronlinkParams' in window) {
      delete (window as any).tronlinkParams;
    }
  } catch {
    // Ignore deletion errors
  }
}

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ presentation: "card" }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

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
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <SettingsProvider>
          <UserProvider>
            <TripProvider>
              <GestureHandlerRootView style={styles.container}>
                <RootLayoutNav />
              </GestureHandlerRootView>
            </TripProvider>
          </UserProvider>
        </SettingsProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
