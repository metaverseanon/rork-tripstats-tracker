import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Animated,
  Platform,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Trophy, Shield, Target, Sparkles, ChevronRight, Award, Flame } from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
export const WHATS_NEW_VERSION = 'whats_new_v2';

interface WhatsNewPage {
  id: string;
  icon: React.ReactNode;
  decorIcon: React.ReactNode;
  title: string;
  highlight: string;
  description: string;
  tag: string;
}

const pages: WhatsNewPage[] = [
  {
    id: 'challenges',
    icon: <Target size={48} color="#FFFFFF" strokeWidth={1.5} />,
    decorIcon: <Flame size={18} color="#CC0000" />,
    title: 'Introducing',
    highlight: 'Challenges',
    description: 'Push your limits with driving challenges. Hit speed milestones, cover distances, maintain streaks and more.',
    tag: 'NEW',
  },
  {
    id: 'badges',
    icon: <Shield size={48} color="#FFFFFF" strokeWidth={1.5} />,
    decorIcon: <Sparkles size={18} color="#CC0000" />,
    title: 'Earn',
    highlight: 'Badges',
    description: 'Unlock Bronze, Silver, Gold, and Diamond badges as you complete challenges. Show them off on your profile.',
    tag: 'NEW',
  },
  {
    id: 'achievements',
    icon: <Trophy size={48} color="#FFFFFF" strokeWidth={1.5} />,
    decorIcon: <Award size={18} color="#CC0000" />,
    title: 'Track Your',
    highlight: 'Achievements',
    description: 'A brand new achievements screen to track all your progress across speed, distance, trips, streaks and performance.',
    tag: 'IMPROVED',
  },
];

export default function WhatsNewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(0.3)).current;
  const iconScale = useRef(new Animated.Value(0.5)).current;
  const tagAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(iconScale, {
        toValue: 1,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(tagAnim, {
        toValue: 1,
        duration: 800,
        delay: 300,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.6,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [fadeAnim, slideAnim, pulseAnim, iconScale, tagAnim]);

  useEffect(() => {
    iconScale.setValue(0.5);
    Animated.spring(iconScale, {
      toValue: 1,
      tension: 60,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [currentPage, iconScale]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const page = Math.round(offsetX / SCREEN_WIDTH);
    if (page !== currentPage && page >= 0 && page < pages.length) {
      setCurrentPage(page);
      if (Platform.OS !== 'web') {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  };

  const goToNext = () => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    if (currentPage < pages.length - 1) {
      const nextPage = currentPage + 1;
      scrollViewRef.current?.scrollTo({
        x: nextPage * SCREEN_WIDTH,
        animated: true,
      });
      setCurrentPage(nextPage);
    } else {
      void completeWhatsNew();
    }
  };

  const completeWhatsNew = async () => {
    try {
      await AsyncStorage.setItem(WHATS_NEW_VERSION, 'true');
      console.log('[WHATS_NEW] Marked as seen:', WHATS_NEW_VERSION);
    } catch (e) {
      console.warn('[WHATS_NEW] Failed to save:', e);
    }

    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      router.replace('/(tabs)/track' as any);
    });
  };

  const skipWhatsNew = async () => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    void completeWhatsNew();
  };

  const handleButtonPressIn = () => {
    Animated.spring(buttonScale, {
      toValue: 0.95,
      tension: 300,
      friction: 10,
      useNativeDriver: true,
    }).start();
  };

  const handleButtonPressOut = () => {
    Animated.spring(buttonScale, {
      toValue: 1,
      tension: 300,
      friction: 10,
      useNativeDriver: true,
    }).start();
  };

  const isLastPage = currentPage === pages.length - 1;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <View style={styles.whatsNewBadge}>
          <Sparkles size={14} color="#CC0000" />
          <Text style={styles.whatsNewBadgeText}>What's New</Text>
        </View>
        <TouchableOpacity
          onPress={skipWhatsNew}
          style={styles.skipButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          testID="whats-new-skip"
        >
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        bounces={false}
        testID="whats-new-scroll"
      >
        {pages.map((page, index) => (
          <View key={page.id} style={styles.page}>
            <View style={styles.pageContent}>
              <Animated.View style={[
                styles.tagContainer,
                { opacity: currentPage === index ? tagAnim : 0 },
              ]}>
                <Text style={styles.tagText}>{page.tag}</Text>
              </Animated.View>

              <Animated.View style={[
                styles.iconContainer,
                currentPage === index ? {
                  transform: [{ scale: iconScale }],
                } : {},
              ]}>
                <View style={styles.iconGlow} />
                <View style={styles.iconRing} />
                {page.icon}
              </Animated.View>

              <View style={styles.decorRow}>
                {page.decorIcon}
                <View style={styles.decorLine} />
                {page.decorIcon}
              </View>

              <Animated.View style={[
                styles.textContainer,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}>
                <Text style={styles.title}>{page.title}</Text>
                <Text style={styles.highlight}>{page.highlight}</Text>
                <Text style={styles.description}>{page.description}</Text>
              </Animated.View>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.pagination}>
          {pages.map((_, index) => (
            <Animated.View
              key={index}
              style={[
                styles.dot,
                currentPage === index
                  ? styles.dotActive
                  : { opacity: pulseAnim },
              ]}
            />
          ))}
        </View>

        <Animated.View style={{ transform: [{ scale: buttonScale }], width: '100%' }}>
          <TouchableOpacity
            onPress={goToNext}
            onPressIn={handleButtonPressIn}
            onPressOut={handleButtonPressOut}
            style={[styles.nextButton, isLastPage && styles.nextButtonFinal]}
            activeOpacity={0.9}
            testID="whats-new-next"
          >
            <Text style={styles.nextButtonText}>
              {isLastPage ? 'Got It' : 'Next'}
            </Text>
            {!isLastPage && <ChevronRight size={20} color="#FFFFFF" />}
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  topBar: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 20,
    paddingBottom: 8,
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  whatsNewBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(204, 0, 0, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(204, 0, 0, 0.25)',
  },
  whatsNewBadgeText: {
    color: '#CC0000',
    fontSize: 13,
    fontWeight: '600' as const,
    letterSpacing: 0.3,
  },
  skipButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  skipText: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: '500' as const,
    letterSpacing: 0.3,
  },
  page: {
    width: SCREEN_WIDTH,
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  pageContent: {
    alignItems: 'center' as const,
    paddingHorizontal: 32,
    marginTop: -40,
  },
  tagContainer: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(204, 0, 0, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(204, 0, 0, 0.3)',
    marginBottom: 24,
  },
  tagText: {
    color: '#CC0000',
    fontSize: 11,
    fontWeight: '800' as const,
    letterSpacing: 2,
  },
  iconContainer: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(204, 0, 0, 0.12)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(204, 0, 0, 0.3)',
  },
  iconGlow: {
    position: 'absolute' as const,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(204, 0, 0, 0.06)',
  },
  iconRing: {
    position: 'absolute' as const,
    width: 126,
    height: 126,
    borderRadius: 63,
    borderWidth: 1,
    borderColor: 'rgba(204, 0, 0, 0.1)',
  },
  decorRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 28,
    gap: 12,
  },
  decorLine: {
    width: 40,
    height: 1,
    backgroundColor: 'rgba(204, 0, 0, 0.4)',
  },
  textContainer: {
    alignItems: 'center' as const,
  },
  title: {
    fontSize: 28,
    fontWeight: '300' as const,
    color: '#8E8E93',
    textAlign: 'center' as const,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  },
  highlight: {
    fontSize: 42,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    textAlign: 'center' as const,
    marginTop: 4,
    marginBottom: 20,
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center' as const,
    lineHeight: 24,
    maxWidth: 300,
  },
  bottomSection: {
    paddingHorizontal: 24,
    alignItems: 'center' as const,
    gap: 24,
  },
  pagination: {
    flexDirection: 'row' as const,
    gap: 10,
    alignItems: 'center' as const,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3A3A3C',
  },
  dotActive: {
    width: 28,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#CC0000',
  },
  nextButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: '#CC0000',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
    width: '100%' as any,
  },
  nextButtonFinal: {
    backgroundColor: '#CC0000',
    shadowColor: '#CC0000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
  },
});
