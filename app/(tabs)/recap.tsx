import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import {
  BarChart3,
  Route,
  Clock,
  Gauge,
  Zap,
  CornerDownRight,
  TrendingUp,
  Car,
  Calendar,
} from 'lucide-react-native';
import { useTrips } from '@/providers/TripProvider';
import { useSettings } from '@/providers/SettingsProvider';
import { TripStats } from '@/types/trip';
import { ThemeColors } from '@/constants/colors';

type TimePeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all';

interface PeriodStats {
  totalTrips: number;
  totalDistance: number;
  totalDuration: number;
  avgSpeed: number;
  topSpeed: number;
  totalCorners: number;
  avgTripsPerPeriod: number;
  bestAcceleration: number;
  uniqueCarModels: number;
}

export default function RecapScreen() {
  const { trips } = useTrips();
  const { convertSpeed, convertDistance, getSpeedLabel, getDistanceLabel, colors } = useSettings();
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('weekly');

  const styles = useMemo(() => createStyles(colors), [colors]);

  const periods: { key: TimePeriod; label: string }[] = [
    { key: 'daily', label: 'Today' },
    { key: 'weekly', label: 'Week' },
    { key: 'monthly', label: 'Month' },
    { key: 'yearly', label: 'Year' },
    { key: 'all', label: 'All Time' },
  ];

  const filterTripsByPeriod = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    weekDate.setDate(weekDate.getDate() - weekDate.getDay());
    const startOfWeek = weekDate.getTime();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();

    return (period: TimePeriod): TripStats[] => {
      switch (period) {
        case 'daily':
          return trips.filter((trip) => trip.startTime >= startOfDay);
        case 'weekly':
          return trips.filter((trip) => trip.startTime >= startOfWeek);
        case 'monthly':
          return trips.filter((trip) => trip.startTime >= startOfMonth);
        case 'yearly':
          return trips.filter((trip) => trip.startTime >= startOfYear);
        case 'all':
        default:
          return trips;
      }
    };
  }, [trips]);

  const calculateStats = useMemo((): PeriodStats => {
    const filteredTrips = filterTripsByPeriod(selectedPeriod);

    if (filteredTrips.length === 0) {
      return {
        totalTrips: 0,
        totalDistance: 0,
        totalDuration: 0,
        avgSpeed: 0,
        topSpeed: 0,
        totalCorners: 0,
        avgTripsPerPeriod: 0,
        bestAcceleration: 0,
        uniqueCarModels: 0,
      };
    }

    const totalDistance = filteredTrips.reduce((sum, trip) => sum + trip.distance, 0);
    const totalDuration = filteredTrips.reduce((sum, trip) => sum + trip.duration, 0);
    const topSpeed = Math.max(...filteredTrips.map((trip) => trip.topSpeed));
    const totalCorners = filteredTrips.reduce((sum, trip) => sum + trip.corners, 0);
    const avgSpeed = totalDuration > 0 ? (totalDistance / totalDuration) * 3600 : 0;
    const bestAcceleration = Math.max(...filteredTrips.map((trip) => trip.acceleration || 0));
    const uniqueCarModels = new Set(filteredTrips.map((trip) => trip.carModel).filter(Boolean)).size;

    return {
      totalTrips: filteredTrips.length,
      totalDistance,
      totalDuration,
      avgSpeed,
      topSpeed,
      totalCorners,
      avgTripsPerPeriod: filteredTrips.length,
      bestAcceleration,
      uniqueCarModels,
    };
  }, [filterTripsByPeriod, selectedPeriod]);

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const StatCard = ({
    icon,
    title,
    value,
    unit,
    color,
    large = false,
  }: {
    icon: React.ReactNode;
    title: string;
    value: string | number;
    unit?: string;
    color: string;
    large?: boolean;
  }) => (
    <View style={[styles.statCard, large && styles.statCardLarge]}>
      <View style={[styles.iconContainer, { backgroundColor: color + '15' }]}>
        {icon}
      </View>
      <Text style={styles.statTitle}>{title}</Text>
      <View style={styles.statValueRow}>
        <Text style={[styles.statValue, large && styles.statValueLarge]}>{value}</Text>
        {unit && <Text style={styles.statUnit}>{unit}</Text>}
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.headerIconContainer}>
          <BarChart3 color={colors.accent} size={28} />
        </View>
        <Text style={styles.headerTitle}>Your Driving Recap</Text>
        <Text style={styles.headerSubtitle}>Track your progress over time</Text>
      </View>

      <View style={styles.periodSelector}>
        {periods.map((period) => (
          <TouchableOpacity
            key={period.key}
            style={[
              styles.periodButton,
              selectedPeriod === period.key && styles.periodButtonActive,
            ]}
            onPress={() => setSelectedPeriod(period.key)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.periodButtonText,
                selectedPeriod === period.key && styles.periodButtonTextActive,
              ]}
            >
              {period.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.highlightCard}>
        <View style={styles.highlightIconRow}>
          <View style={styles.highlightIcon}>
            <Route color="#FFFFFF" size={24} />
          </View>
          <Text style={styles.highlightLabel}>Total Trips</Text>
        </View>
        <Text style={styles.highlightValue}>{calculateStats.totalTrips}</Text>
        <Text style={styles.highlightSubtext}>
          {selectedPeriod === 'all'
            ? 'All time'
            : selectedPeriod === 'daily'
            ? 'Today'
            : `This ${selectedPeriod.replace('ly', '')}`}
        </Text>
      </View>

      <View style={styles.statsGrid}>
        <StatCard
          icon={<TrendingUp color={colors.accent} size={20} />}
          title="Distance"
          value={convertDistance(calculateStats.totalDistance).toFixed(1)}
          unit={getDistanceLabel()}
          color={colors.accent}
        />
        <StatCard
          icon={<Clock color={colors.warning} size={20} />}
          title="Time Driving"
          value={formatDuration(calculateStats.totalDuration)}
          color={colors.warning}
        />
        <StatCard
          icon={<Gauge color={colors.success} size={20} />}
          title="Avg Speed"
          value={convertSpeed(calculateStats.avgSpeed).toFixed(0)}
          unit={getSpeedLabel()}
          color={colors.success}
        />
        <StatCard
          icon={<Zap color={colors.danger} size={20} />}
          title="Top Speed"
          value={convertSpeed(calculateStats.topSpeed).toFixed(0)}
          unit={getSpeedLabel()}
          color={colors.danger}
        />
        <StatCard
          icon={<CornerDownRight color="#8B5CF6" size={20} />}
          title="Corners"
          value={calculateStats.totalCorners}
          color="#8B5CF6"
        />
        <StatCard
          icon={<Car color="#EC4899" size={20} />}
          title="Cars Used"
          value={calculateStats.uniqueCarModels}
          color="#EC4899"
        />
      </View>

      {calculateStats.bestAcceleration > 0 && (
        <View style={styles.accelerationCard}>
          <View style={styles.accelerationHeader}>
            <Zap color={colors.warning} size={20} />
            <Text style={styles.accelerationTitle}>Best Acceleration</Text>
          </View>
          <Text style={styles.accelerationValue}>
            {calculateStats.bestAcceleration.toFixed(2)} m/s²
          </Text>
          <View style={styles.accelerationBar}>
            <View
              style={[
                styles.accelerationFill,
                { width: `${Math.min(calculateStats.bestAcceleration * 10, 100)}%`, backgroundColor: colors.warning },
              ]}
            />
          </View>
        </View>
      )}

      {calculateStats.totalTrips === 0 && (
        <View style={styles.emptyState}>
          <Calendar color={colors.textLight} size={48} />
          <Text style={styles.emptyTitle}>No trips yet</Text>
          <Text style={styles.emptySubtitle}>
            Start tracking your trips to see your statistics here
          </Text>
        </View>
      )}

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  headerIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.accent + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: 'Orbitron_700Bold',
    color: colors.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 15,
    fontFamily: 'Orbitron_400Regular',
    color: colors.textLight,
  },
  periodSelector: {
    flexDirection: 'row',
    marginHorizontal: 16,
    backgroundColor: colors.cardLight,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  periodButtonActive: {
    backgroundColor: colors.primary,
  },
  periodButtonText: {
    fontSize: 13,
    fontFamily: 'Orbitron_600SemiBold',
    color: colors.textLight,
  },
  periodButtonTextActive: {
    color: colors.textInverted,
  },
  highlightCard: {
    marginHorizontal: 16,
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  highlightIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  highlightIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  highlightLabel: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Orbitron_500Medium',
  },
  highlightValue: {
    fontSize: 64,
    fontFamily: 'Orbitron_700Bold',
    color: '#FFFFFF',
    lineHeight: 72,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  highlightSubtext: {
    fontSize: 14,
    fontFamily: 'Orbitron_400Regular',
    color: 'rgba(255,255,255,0.5)',
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 8,
  },
  statCard: {
    width: '48%',
    backgroundColor: colors.cardLight,
    borderRadius: 16,
    padding: 16,
    marginBottom: 4,
    flexGrow: 1,
    flexBasis: '45%',
    marginHorizontal: 4,
  },
  statCardLarge: {
    width: '100%',
    flexBasis: '100%',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statTitle: {
    fontSize: 13,
    fontFamily: 'Orbitron_400Regular',
    color: colors.textLight,
    marginBottom: 4,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  statValue: {
    fontSize: 24,
    fontFamily: 'Orbitron_700Bold',
    color: colors.text,
  },
  statValueLarge: {
    fontSize: 32,
  },
  statUnit: {
    fontSize: 14,
    fontFamily: 'Orbitron_500Medium',
    color: colors.textLight,
    marginLeft: 4,
  },
  accelerationCard: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: colors.cardLight,
    borderRadius: 16,
    padding: 20,
  },
  accelerationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  accelerationTitle: {
    fontSize: 15,
    fontFamily: 'Orbitron_600SemiBold',
    color: colors.text,
    marginLeft: 8,
  },
  accelerationValue: {
    fontSize: 28,
    fontFamily: 'Orbitron_700Bold',
    color: colors.text,
    marginBottom: 12,
  },
  accelerationBar: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  accelerationFill: {
    height: '100%',
    borderRadius: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Orbitron_600SemiBold',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Orbitron_400Regular',
    color: colors.textLight,
    textAlign: 'center',
  },
  bottomSpacer: {
    height: 40,
  },
});
