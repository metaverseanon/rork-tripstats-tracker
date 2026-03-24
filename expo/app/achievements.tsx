import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { Stack } from 'expo-router';
import {
  Gauge,
  MapPin,
  Route,
  Map,
  Globe,
  Flag,
  Repeat,
  Award,
  Infinity as InfinityIcon,
  Flame,
  Users,
  Star,
  Zap,
  CornerDownRight,
  Rocket,
  Moon,
  Trophy,
  Lock,
} from 'lucide-react-native';
import { useSettings } from '@/providers/SettingsProvider';
import { useAchievements } from '@/providers/AchievementProvider';
import { ACHIEVEMENT_CATEGORIES } from '@/constants/achievements';
import { AchievementProgress, AchievementCategory } from '@/types/achievement';
import { ThemeColors } from '@/constants/colors';

const ICON_MAP: Record<string, React.ComponentType<{ size: number; color: string }>> = {
  'gauge': Gauge,
  'map-pin': MapPin,
  'route': Route,
  'map': Map,
  'globe': Globe,
  'flag': Flag,
  'repeat': Repeat,
  'award': Award,
  'infinity': InfinityIcon,
  'flame': Flame,
  'users': Users,
  'star': Star,
  'zap': Zap,
  'corner-down-right': CornerDownRight,
  'rocket': Rocket,
  'moon': Moon,
};

const CATEGORY_COLORS: Record<AchievementCategory, string> = {
  speed: '#FF3B30',
  distance: '#007AFF',
  trips: '#FF9500',
  streak: '#FF6B00',
  social: '#AF52DE',
  performance: '#30D158',
};

function AchievementCard({ item, colors, isNew }: {
  item: AchievementProgress;
  colors: ThemeColors;
  isNew: boolean;
}) {
  const scaleAnim = useRef(new Animated.Value(isNew ? 0.8 : 1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isNew) {
      Animated.sequence([
        Animated.spring(scaleAnim, {
          toValue: 1.05,
          friction: 3,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 5,
          useNativeDriver: true,
        }),
      ]).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 1200,
            useNativeDriver: false,
          }),
        ]),
        { iterations: 3 }
      ).start();
    }
  }, [isNew, scaleAnim, glowAnim]);

  const IconComponent = ICON_MAP[item.definition.icon] || Trophy;
  const categoryColor = CATEGORY_COLORS[item.definition.category];
  const isUnlocked = item.isUnlocked;

  const borderColor = isNew
    ? glowAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [categoryColor + '40', categoryColor],
      })
    : undefined;

  const formattedDate = item.unlockedAt
    ? new Date(item.unlockedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : undefined;

  const styles = StyleSheet.create({
    card: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      backgroundColor: isUnlocked ? colors.cardLight : colors.cardLight,
      borderRadius: 16,
      padding: 16,
      marginBottom: 10,
      borderWidth: isNew ? 2 : 1,
      borderColor: isNew ? categoryColor : (isUnlocked ? categoryColor + '30' : colors.border),
      opacity: isUnlocked ? 1 : 0.5,
    },
    iconContainer: {
      width: 52,
      height: 52,
      borderRadius: 14,
      backgroundColor: isUnlocked ? categoryColor + '18' : colors.background,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      marginRight: 14,
    },
    content: {
      flex: 1,
    },
    title: {
      fontSize: 16,
      fontWeight: '700' as const,
      color: isUnlocked ? colors.text : colors.textLight,
      marginBottom: 3,
    },
    description: {
      fontSize: 13,
      color: colors.textLight,
      lineHeight: 18,
    },
    dateText: {
      fontSize: 11,
      color: categoryColor,
      fontWeight: '600' as const,
      marginTop: 4,
    },
    lockIcon: {
      marginLeft: 8,
    },
    newBadge: {
      backgroundColor: categoryColor,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      marginLeft: 8,
    },
    newBadgeText: {
      fontSize: 10,
      fontWeight: '800' as const,
      color: '#FFFFFF',
      letterSpacing: 0.5,
    },
  });

  const content = (
    <View style={styles.card}>
      <View style={styles.iconContainer}>
        <IconComponent
          size={26}
          color={isUnlocked ? categoryColor : colors.textLight}
        />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{item.definition.title}</Text>
        <Text style={styles.description}>{item.definition.description}</Text>
        {formattedDate && (
          <Text style={styles.dateText}>Unlocked {formattedDate}</Text>
        )}
      </View>
      {isNew && (
        <View style={styles.newBadge}>
          <Text style={styles.newBadgeText}>NEW</Text>
        </View>
      )}
      {!isUnlocked && (
        <View style={styles.lockIcon}>
          <Lock size={18} color={colors.textLight} />
        </View>
      )}
    </View>
  );

  if (isNew && Platform.OS !== 'web') {
    return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }], borderColor, borderRadius: 16 }}>
        {content}
      </Animated.View>
    );
  }

  return content;
}

export default function AchievementsScreen() {
  const { colors } = useSettings();
  const { getAchievementProgress, unlockedCount, totalCount, newlyUnlocked, clearNewlyUnlocked, streak } = useAchievements();
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    return () => {
      clearNewlyUnlocked();
    };
  }, [clearNewlyUnlocked]);

  const achievements = useMemo(() => getAchievementProgress(), [getAchievementProgress]);

  const filteredAchievements = useMemo(() => {
    let filtered: AchievementProgress[];
    if (selectedCategory === 'all') {
      filtered = achievements;
    } else {
      filtered = achievements.filter(a => a.definition.category === selectedCategory);
    }
    return filtered.sort((a, b) => {
      if (a.isUnlocked && !b.isUnlocked) return -1;
      if (!a.isUnlocked && b.isUnlocked) return 1;
      if (a.isUnlocked && b.isUnlocked) {
        return (b.unlockedAt ?? 0) - (a.unlockedAt ?? 0);
      }
      return 0;
    });
  }, [achievements, selectedCategory]);

  const progressPercent = totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0;
  const progressWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressWidth, {
      toValue: progressPercent,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [progressPercent, progressWidth]);

  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Achievements',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontSize: 16, fontWeight: '600' as const },
          headerTitleAlign: 'center',
        }}
      />
      <View style={styles.container}>
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View style={styles.trophyContainer}>
              <Trophy size={28} color="#FFD700" />
            </View>
            <View style={styles.headerStats}>
              <Text style={styles.headerCount}>{unlockedCount}/{totalCount}</Text>
              <Text style={styles.headerLabel}>Achievements Unlocked</Text>
            </View>
            {streak.currentStreak > 0 && (
              <View style={styles.streakBadge}>
                <Flame size={14} color="#FF6B00" />
                <Text style={styles.streakText}>{streak.currentStreak}d</Text>
              </View>
            )}
          </View>
          <View style={styles.progressBar}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: progressWidth.interpolate({
                    inputRange: [0, 100],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {Math.round(progressPercent)}% complete
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
          style={styles.categoryContainer}
        >
          {ACHIEVEMENT_CATEGORIES.map(cat => {
            const isActive = selectedCategory === cat.key;
            const catColor = cat.key === 'all' ? colors.accent : CATEGORY_COLORS[cat.key as AchievementCategory] ?? colors.accent;
            return (
              <TouchableOpacity
                key={cat.key}
                style={[
                  styles.categoryChip,
                  isActive && { backgroundColor: catColor, borderColor: catColor },
                ]}
                onPress={() => setSelectedCategory(cat.key)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    isActive && styles.categoryChipTextActive,
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <ScrollView
          style={styles.listContainer}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {filteredAchievements.map(item => (
            <AchievementCard
              key={item.definition.id}
              item={item}
              colors={colors}
              isNew={newlyUnlocked.includes(item.definition.id)}
            />
          ))}
          {filteredAchievements.length === 0 && (
            <View style={styles.emptyState}>
              <Trophy size={48} color={colors.textLight} />
              <Text style={styles.emptyText}>No achievements in this category yet</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerCard: {
      backgroundColor: colors.cardLight,
      marginHorizontal: 16,
      marginTop: 12,
      borderRadius: 20,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    headerTop: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    trophyContainer: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: '#FFD700' + '18',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 14,
    },
    headerStats: {
      flex: 1,
    },
    headerCount: {
      fontSize: 28,
      fontWeight: '800' as const,
      color: colors.text,
      fontFamily: 'Orbitron_800ExtraBold',
    },
    headerLabel: {
      fontSize: 13,
      color: colors.textLight,
      marginTop: 1,
    },
    streakBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FF6B00' + '18',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      gap: 4,
    },
    streakText: {
      fontSize: 14,
      fontWeight: '700' as const,
      color: '#FF6B00',
    },
    progressBar: {
      height: 8,
      backgroundColor: colors.background,
      borderRadius: 4,
      overflow: 'hidden',
    },
    progressFill: {
      height: 8,
      backgroundColor: colors.accent,
      borderRadius: 4,
    },
    progressText: {
      fontSize: 12,
      color: colors.textLight,
      marginTop: 8,
      textAlign: 'right' as const,
    },
    categoryContainer: {
      maxHeight: 48,
      marginTop: 16,
    },
    categoryScroll: {
      paddingHorizontal: 16,
      gap: 8,
    },
    categoryChip: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.cardLight,
      borderWidth: 1,
      borderColor: colors.border,
    },
    categoryChipText: {
      fontSize: 13,
      fontWeight: '600' as const,
      color: colors.textLight,
    },
    categoryChipTextActive: {
      color: '#FFFFFF',
    },
    listContainer: {
      flex: 1,
      marginTop: 12,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingBottom: 40,
    },
    emptyState: {
      alignItems: 'center',
      paddingTop: 60,
      gap: 12,
    },
    emptyText: {
      fontSize: 15,
      color: colors.textLight,
    },
  });
}
