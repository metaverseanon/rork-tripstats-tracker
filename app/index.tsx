import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Image } from 'react-native';
import { useRouter } from 'expo-router';

export default function WelcomeScreen() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        router.replace('/(tabs)/track');
      });
    }, 4000);

    return () => clearTimeout(timer);
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
