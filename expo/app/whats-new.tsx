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
import {
  Gauge,
  Shield,
  BarChart3,
  Sparkles,
  ChevronRight,
  PartyPopper,
  Zap,
  Target,
} from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
export const WHATS_NEW_VERSION = 'whats_new_v2';

interface WhatsNewPage {
  id: string;
  icon: React.ReactNode;
  accentColor: string;
  tagline: string;
  title: string;
  highlight: string;
  description: string;
  features: string[];
}

const pages: WhatsNewPage[] = [
  {
    id: 'track_redesign',
    icon: <Gauge size={44} color="#FFFFFF" strokeWidth={1.5} />,
    accentColor: '#30D158',
    tagline: 'REDESIGNED',
    title: 'New',
    highlight: 'Track Screen',
    description: 'A completely refreshed driving experience with live speed-reactive colors that shift from green to red as you accelerate.',
    features: [
      'Speed-reactive color gradient',
      'Cleaner stats layout',
      'Duration, 0-100, 0-200 at a glance',
      'G-Force & speed cameras inline',
    ],
  },
  {
    id: 'challenges',
    icon: <Target size={44} color="#FFFFFF" strokeWidth={1.5} />,
    accentColor: '#FF9500',
    tagline: 'EXPANDED',
    title: '22 New',
    highlight: 'Challenges',
    description: 'Way more challenges to conquer across speed, distance, trips, streaks, social, and performance categories.',
    features: [
      'Night Owl — drive after midnight',
      'Marathon Driver — 2hr+ trips',
      'Quick Launch — 0-100 in under 6s',
      'Corner King, Long Hauler & more',
    ],
  },
  {
    id: 'badges',
    icon: <Shield size={44} color="#FFFFFF" strokeWidth={1.5} />,
    accentColor: '#FFD700',
    tagline: 'NEW FEATURE',
    title: 'Earn',
    highlight: 'Badges',
    description: 'Complete challenges to unlock 4 badge tiers displayed on your profile. Show the community how far you\'ve come.',
    features: [
      'Bronze — 25% challenges done',
      'Silver — 50% challenges done',
      'Gold — 75% challenges done',
      'Diamond — 100% challenges done',
    ],
  },
  {
    id: 'congrats',
    icon: <PartyPopper size={44} color="#FFFFFF" strokeWidth={1.5} />,
    accentColor: '#AF52DE',
    tagline: 'CELEBRATIONS',
    title: 'Challenge',
    highlight: 'Complete!',
    description: 'Every time you unlock a challenge, you get a beautiful animated congratulations screen with your progress.',
    features: [
      'Animated trophy celebration',
      'Progress bar tracking',
      'Badge unlock notifications',
      'Quick jump to all achievements',
    ],
  },
  {
    id: 'leaderboard',
    icon: <BarChart3 size={44} color="#FFFFFF" strokeWidth={1.5} />,
    accentColor: '#CC0000',
    tagline: 'LEADERBOARD',
    title: 'Challenges',
    highlight: 'Leaderboard',
    description: 'A brand new leaderboard category where you compete on challenge completion percentage. Plus, proper mph/kmh conversion across all boards.',
    features: [
      'New "Challenges %" category',
      'Proper mph ↔ km/h conversion',
      'Accurate cross-unit rankings',
      'Redesigned recent activity',
    ],
  },
];

export default function WhatsNewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(0.3)).current;
  const iconScale = useRef(new Animated.Value(0.5)).current;
  const featureAnims = useRef(pages[0].features.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
      Animated.spring(iconScale, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.6, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 1500, useNativeDriver: true }),
      ])
    ).start();

    animateFeatures();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animateFeatures = () => {
    featureAnims.forEach((anim, i) => {
      anim.setValue(0);
      Animated.timing(anim, {
        toValue: 1,
        duration: 300,
        delay: 400 + i * 100,
        useNativeDriver: true,
      }).start();
    });
  };

  useEffect(() => {
    iconScale.setValue(0.5);
    Animated.spring(iconScale, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }).start();
    animateFeatures();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

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
      scrollViewRef.current?.scrollTo({ x: nextPage * SCREEN_WIDTH, animated: true });
      setCurrentPage(nextPage);
    } else {
      void dismissWhatsNew();
    }
  };

  const dismissWhatsNew = async () => {
    try {
      await AsyncStorage.setItem(WHATS_NEW_VERSION, 'seen');
    } catch (e) {
      console.warn('[WHATS_NEW] Failed to save:', e);
    }
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      router.back();
    });
  };

  const handleButtonPressIn = () => {
    Animated.spring(buttonScale, { toValue: 0.95, tension: 300, friction: 10, useNativeDriver: true }).start();
  };

  const handleButtonPressOut = () => {
    Animated.spring(buttonScale, { toValue: 1, tension: 300, friction: 10, useNativeDriver: true }).start();
  };

  const isLastPage = currentPage === pages.length - 1;
  const activePage = pages[currentPage];

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <View style={styles.versionPill}>
          <Sparkles size={12} color="#CC0000" />
          <Text style={styles.versionText}>WHAT'S NEW</Text>
        </View>
        {!isLastPage && (
          <TouchableOpacity
            onPress={dismissWhatsNew}
            style={styles.skipButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        bounces={false}
      >
        {pages.map((page, index) => (
          <View key={page.id} style={styles.page}>
            <View style={styles.pageContent}>
              <Animated.View style={[
                styles.iconContainer,
                {
                  backgroundColor: page.accentColor + '18',
                  borderColor: page.accentColor + '35',
                  transform: currentPage === index ? [{ scale: iconScale }] : [],
                },
              ]}>
                <View style={[styles.iconGlow, { backgroundColor: page.accentColor + '0A' }]} />
                {page.icon}
              </Animated.View>

              <View style={styles.taglineRow}>
                <View style={[styles.taglineDot, { backgroundColor: page.accentColor }]} />
                <Text style={[styles.taglineText, { color: page.accentColor }]}>{page.tagline}</Text>
                <View style={[styles.taglineDot, { backgroundColor: page.accentColor }]} />
              </View>

              <View style={styles.textContainer}>
                <Text style={styles.title}>{page.title}</Text>
                <Text style={[styles.highlight, { color: page.accentColor }]}>{page.highlight}</Text>
                <Text style={styles.description}>{page.description}</Text>
              </View>

              <View style={styles.featureList}>
                {page.features.map((feature, fi) => (
                  <Animated.View
                    key={fi}
                    style={[
                      styles.featureRow,
                      currentPage === index ? {
                        opacity: featureAnims[fi] ?? 1,
                        transform: [{
                          translateX: (featureAnims[fi] ?? new Animated.Value(1)).interpolate({
                            inputRange: [0, 1],
                            outputRange: [20, 0],
                          }),
                        }],
                      } : {},
                    ]}
                  >
                    <Zap size={14} color={page.accentColor} />
                    <Text style={styles.featureText}>{feature}</Text>
                  </Animated.View>
                ))}
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.pagination}>
          {pages.map((page, index) => (
            <Animated.View
              key={index}
              style={[
                styles.dot,
                currentPage === index
                  ? [styles.dotActive, { backgroundColor: activePage.accentColor }]
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
            style={[styles.nextButton, { backgroundColor: activePage.accentColor }]}
            activeOpacity={0.9}
          >
            <Text style={styles.nextButtonText}>
              {isLastPage ? "Let's Drive!" : 'Next'}
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
  versionPill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(204, 0, 0, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(204, 0, 0, 0.25)',
  },
  versionText: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: '#CC0000',
    letterSpacing: 1.5,
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
    paddingHorizontal: 28,
    marginTop: -20,
    width: '100%',
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginBottom: 24,
    borderWidth: 1,
  },
  iconGlow: {
    position: 'absolute' as const,
    width: 130,
    height: 130,
    borderRadius: 65,
  },
  taglineRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 16,
  },
  taglineDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  taglineText: {
    fontSize: 11,
    fontWeight: '800' as const,
    letterSpacing: 2.5,
  },
  textContainer: {
    alignItems: 'center' as const,
    marginBottom: 28,
  },
  title: {
    fontSize: 26,
    fontWeight: '300' as const,
    color: '#8E8E93',
    textAlign: 'center' as const,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  },
  highlight: {
    fontSize: 38,
    fontWeight: '800' as const,
    textAlign: 'center' as const,
    marginTop: 2,
    marginBottom: 14,
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center' as const,
    lineHeight: 22,
    maxWidth: 300,
  },
  featureList: {
    width: '100%',
    maxWidth: 320,
    gap: 10,
  },
  featureRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  featureText: {
    fontSize: 13,
    color: '#CCCCCC',
    fontWeight: '500' as const,
    flex: 1,
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
  },
  nextButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
    width: '100%' as any,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
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
