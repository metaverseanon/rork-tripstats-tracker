import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Animated, Image, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WHATS_NEW_VERSION } from './whats-new';

const ONBOARDING_KEY = 'onboarding_completed';

export default function WelcomeScreen() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [destination, setDestination] = useState<string | null>(null);
  const hasNavigated = useRef(false);

  const navigateTo = useRef((dest: string) => {
    if (hasNavigated.current) return;
    hasNavigated.current = true;
    console.log('[WELCOME] Navigating to:', dest);
    router.replace(dest as any);
  }).current;

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const completed = await AsyncStorage.getItem(ONBOARDING_KEY);
        const seenWhatsNew = await AsyncStorage.getItem(WHATS_NEW_VERSION);
        console.log('[WELCOME] onboarding_completed:', completed, 'seenWhatsNew:', seenWhatsNew);

        if (completed !== 'true') {
          setDestination('/onboarding');
        } else if (seenWhatsNew !== 'true') {
          setDestination('/whats-new');
        } else {
          setDestination('/(tabs)/track');
        }
      } catch (e) {
        console.warn('[WELCOME] Error checking onboarding:', e);
        setDestination('/onboarding');
      }
    };

    void checkOnboarding();
  }, []);

  useEffect(() => {
    if (!destination) return;

    const useNative = Platform.OS !== 'web';

    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: useNative,
      }).start((result) => {
        console.log('[WELCOME] Animation finished:', result);
        navigateTo(destination);
      });

      const fallback = setTimeout(() => {
        console.log('[WELCOME] Fallback navigation triggered');
        navigateTo(destination);
      }, 1000);

      return () => clearTimeout(fallback);
    }, 1500);

    return () => clearTimeout(timer);
  }, [destination, fadeAnim, navigateTo]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Image
        source={{ uri: 'https://r2-pub.rork.com/attachments/1c5o0h0k30qvgy75ubrhz' }}
        style={styles.animation}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  animation: {
    width: 280,
    height: 280,
  },
});
