import { useEffect, useRef } from 'react';
import { StyleSheet, Animated, Image } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_KEY = 'onboarding_completed';
const WHATS_NEW_VERSION_KEY = 'whats_new_seen_version';
const CURRENT_APP_VERSION = '1.5.0';
const _BUILD_TIMESTAMP = '20260329';

export default function WelcomeScreen() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const completed = await AsyncStorage.getItem(ONBOARDING_KEY);
        const seenVersion = await AsyncStorage.getItem(WHATS_NEW_VERSION_KEY);

        let destination: string;
        if (completed !== 'true') {
          destination = '/onboarding';
        } else if (seenVersion !== CURRENT_APP_VERSION) {
          destination = '/whats-new';
        } else {
          destination = '/(tabs)/track';
        }

        console.log('[WELCOME] Routing to:', destination, '| onboarding:', completed, '| seenVersion:', seenVersion);

        const timer = setTimeout(() => {
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }).start(() => {
            router.replace(destination as any);
          });
        }, 4000);

        return () => clearTimeout(timer);
      } catch (e) {
        console.warn('[WELCOME] Error checking onboarding:', e);
        const timer = setTimeout(() => {
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }).start(() => {
            router.replace('/onboarding' as any);
          });
        }, 4000);
        return () => clearTimeout(timer);
      }
    };

    void checkOnboarding();
  }, [fadeAnim, router]);

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
