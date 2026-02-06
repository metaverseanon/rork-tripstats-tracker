import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState, Component, ErrorInfo, ReactNode } from "react";
import { StyleSheet, Platform, View, Text, TouchableOpacity } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { TripProvider } from "@/providers/TripProvider";
import { SettingsProvider } from "@/providers/SettingsProvider";
import { UserProvider } from "@/providers/UserProvider";
import { NotificationProvider } from "@/providers/NotificationProvider";
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
import AsyncStorage from "@react-native-async-storage/async-storage";

SplashScreen.preventAutoHideAsync();

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('App Error Boundary caught an error:', error, errorInfo);
  }

  handleReset = async () => {
    try {
      await AsyncStorage.removeItem('tracking_state');
      await AsyncStorage.removeItem('current_trip');
      await AsyncStorage.removeItem('current_speed');
      await AsyncStorage.removeItem('last_location_time');
    } catch (e) {
      console.warn('Failed to clear corrupted state:', e);
    }
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={errorStyles.container}>
          <Text style={errorStyles.title}>Something went wrong</Text>
          <Text style={errorStyles.message}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </Text>
          <TouchableOpacity style={errorStyles.button} onPress={this.handleReset}>
            <Text style={errorStyles.buttonText}>Restart App</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold' as const,
    color: '#CC0000',
    marginBottom: 16,
  },
  message: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center' as const,
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#CC0000',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600' as const,
  },
});

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
      <Stack.Screen name="user-profile" options={{ presentation: "card" }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

const FONT_LOAD_TIMEOUT = 10000;

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Orbitron_400Regular,
    Orbitron_500Medium,
    Orbitron_600SemiBold,
    Orbitron_700Bold,
    Orbitron_800ExtraBold,
    Orbitron_900Black,
  });
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      console.log('Font loading timed out, proceeding anyway');
      setTimedOut(true);
    }, FONT_LOAD_TIMEOUT);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (fontError) {
      console.warn('Font loading error:', fontError);
    }
    if (fontsLoaded) {
      console.log('Orbitron fonts loaded successfully');
    }
    if (fontsLoaded || fontError || timedOut) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, timedOut]);

  if (!fontsLoaded && !fontError && !timedOut) {
    return null;
  }

  return (
    <ErrorBoundary>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <SettingsProvider>
            <UserProvider>
              <NotificationProvider>
                <TripProvider>
                  <SafeAreaProvider>
                    <GestureHandlerRootView style={styles.container}>
                      <RootLayoutNav />
                    </GestureHandlerRootView>
                  </SafeAreaProvider>
                </TripProvider>
              </NotificationProvider>
            </UserProvider>
          </SettingsProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </ErrorBoundary>
  );
}
