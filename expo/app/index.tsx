import { useEffect, useRef, useState, useCallback } from 'react';
import { StyleSheet, Animated, Image, Platform, View } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WHATS_NEW_VERSION } from './whats-new';

const ONBOARDING_KEY = 'onboarding_completed';

export default function WelcomeScreen() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const hasNavigated = useRef(false);
  const [ready, setReady] = useState(false);

  const navigateTo = useCallback((dest: string) => {
    if (hasNavigated.current) return;
    hasNavigated.current = true;
    console.log('[WELCOME] Navigating to:', dest);
    try {
      router.replace(dest as any);
    } catch (e) {
      console.warn('[WELCOME] Navigation error:', e);
    }
  }, [router]);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;

    let fallbackTimer: ReturnType<typeof setTimeout>;
    let animTimer: ReturnType<typeof setTimeout>;

    const checkAndNavigate = async () => {
      let dest = '/onboarding';
      try {
        const completed = await AsyncStorage.getItem(ONBOARDING_KEY);
        const seenWhatsNew = await AsyncStorage.getItem(WHATS_NEW_VERSION);
        console.log('[WELCOME] onboarding_completed:', completed, 'seenWhatsNew:', seenWhatsNew);

        if (completed !== 'true') {
          dest = '/onboarding';
        } else if (seenWhatsNew !== 'true') {
          dest = '/whats-new';
        } else {
          dest = '/(tabs)/track';
        }
      } catch (e) {
        console.warn('[WELCOME] Error checking onboarding:', e);
      }

      console.log('[WELCOME] Will navigate to:', dest);

      fallbackTimer = setTimeout(() => {
        console.log('[WELCOME] Hard fallback navigation to:', dest);
        navigateTo(dest);
      }, 3000);

      animTimer = setTimeout(() => {
        if (Platform.OS === 'web') {
          navigateTo(dest);
        } else {
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }).start(() => {
            navigateTo(dest);
          });

          setTimeout(() => {
            navigateTo(dest);
          }, 800);
        }
      }, 1500);
    };

    void checkAndNavigate();

    return () => {
      clearTimeout(fallbackTimer);
      clearTimeout(animTimer);
    };
  }, [ready, fadeAnim, navigateTo]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.inner, { opacity: fadeAnim }]}>
        <Image
          source={{ uri: 'https://r2-pub.rork.com/attachments/1c5o0h0k30qvgy75ubrhz' }}
          style={styles.animation}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inner: {
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  animation: {
    width: 280,
    height: 280,
  },
});
