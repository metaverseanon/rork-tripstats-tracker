import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  Timer,
  Activity,
  Sun,
  Moon,
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
  best0to100: number | null;
  best0to200: number | null;
  maxGForce: number;
  avgTripHour: number;
  dayTrips: number;
  nightTrips: number;
}

export default function RecapScreen() {
  const { trips } = useTrips();
  const { convertSpeed, convertDistance, getSpeedLabel, getDistanceLabel, getAccelerationShortLabel, colors } = useSettings();
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
        best0to100: null,
        best0to200: null,
        maxGForce: 0,
        avgTripHour: 12,
        dayTrips: 0,
        nightTrips: 0,
      };
    }

    const totalDistance = filteredTrips.reduce((sum, trip) => sum + trip.distance, 0);
    const totalDuration = filteredTrips.reduce((sum, trip) => sum + trip.duration, 0);
    const topSpeed = Math.max(...filteredTrips.map((trip) => trip.topSpeed));
    const totalCorners = filteredTrips.reduce((sum, trip) => sum + trip.corners, 0);
    const avgSpeed = totalDuration > 0 ? (totalDistance / totalDuration) * 3600 : 0;
    const bestAcceleration = Math.max(...filteredTrips.map((trip) => trip.acceleration || 0));
    const uniqueCarModels = new Set(filteredTrips.map((trip) => trip.carModel).filter(Boolean)).size;

    const times0to100 = filteredTrips.map((trip) => trip.time0to100).filter((t): t is number => t !== undefined && t > 0);
    const best0to100 = times0to100.length > 0 ? Math.min(...times0to100) : null;

    const times0to200 = filteredTrips.map((trip) => trip.time0to200).filter((t): t is number => t !== undefined && t > 0);
    const best0to200 = times0to200.length > 0 ? Math.min(...times0to200) : null;

    const gForces = filteredTrips.map((trip) => trip.maxGForce || 0);
    const maxGForce = gForces.length > 0 ? Math.max(...gForces) : 0;

    const tripHours = filteredTrips.map((trip) => new Date(trip.startTime).getHours());
    const avgTripHour = tripHours.length > 0 ? tripHours.reduce((sum, h) => sum + h, 0) / tripHours.length : 12;
    
    const dayTrips = tripHours.filter((h) => h >= 6 && h < 20).length;
    const nightTrips = tripHours.filter((h) => h < 6 || h >= 20).length;

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
      best0to100,
      best0to200,
      maxGForce,
      avgTripHour,
      dayTrips,
      nightTrips,
    };
  }, [filterTripsByPeriod, selectedPeriod]);

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    return `${minutes}m ${secs}s`;
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
        <Text 
          style={[styles.statValue, large && styles.statValueLarge]} 
          numberOfLines={1} 
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {value}
        </Text>
        {unit ? <Text style={styles.statUnit}>{unit}</Text> : null}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navHeader}>
        <Text style={styles.navTitle}>Recap</Text>
      </View>
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
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
        <StatCard
          icon={<Activity color="#EF4444" size={20} />}
          title="Max G-Force"
          value={calculateStats.maxGForce > 0 ? calculateStats.maxGForce.toFixed(2) : '—'}
          unit={calculateStats.maxGForce > 0 ? 'G' : ''}
          color="#EF4444"
        />
        <StatCard
          icon={<Zap color={colors.warning} size={20} />}
          title="Best Accel"
          value={calculateStats.bestAcceleration > 0 ? calculateStats.bestAcceleration.toFixed(1) : '—'}
          unit={calculateStats.bestAcceleration > 0 ? 'm/s²' : ''}
          color={colors.warning}
        />
        <StatCard
          icon={<Timer color="#10B981" size={20} />}
          title={`Best ${getAccelerationShortLabel('0-100')}`}
          value={calculateStats.best0to100 !== null ? calculateStats.best0to100.toFixed(1) : '—'}
          unit={calculateStats.best0to100 !== null ? 'sec' : ''}
          color="#10B981"
        />
        <StatCard
          icon={<Timer color="#F59E0B" size={20} />}
          title={`Best ${getAccelerationShortLabel('0-200')}`}
          value={calculateStats.best0to200 !== null ? calculateStats.best0to200.toFixed(1) : '—'}
          unit={calculateStats.best0to200 !== null ? 'sec' : ''}
          color="#F59E0B"
        />
      </View>

      {calculateStats.totalTrips > 0 && (
        <View style={styles.driverTypeCard}>
          <View style={styles.driverTypeHeader}>
            {calculateStats.nightTrips > calculateStats.dayTrips ? (
              <Moon color="#6366F1" size={24} />
            ) : (
              <Sun color="#F59E0B" size={24} />
            )}
            <Text style={styles.driverTypeTitle}>Driver Profile</Text>
          </View>
          <Text style={styles.driverTypeValue}>
            {calculateStats.nightTrips > calculateStats.dayTrips
              ? '🌙 Night Owl'
              : calculateStats.dayTrips > calculateStats.nightTrips
              ? '☀️ Day Cruiser'
              : '⚖️ Balanced Driver'}
          </Text>
          <Text style={styles.driverTypeSubtext}>
            {calculateStats.nightTrips > calculateStats.dayTrips
              ? `You prefer driving at night! ${calculateStats.nightTrips} of your ${calculateStats.totalTrips} trips were after 8 PM or before 6 AM.`
              : calculateStats.dayTrips > calculateStats.nightTrips
              ? `You're a daytime driver! ${calculateStats.dayTrips} of your ${calculateStats.totalTrips} trips were between 6 AM and 8 PM.`
              : `You drive equally during day and night - ${calculateStats.dayTrips} day trips and ${calculateStats.nightTrips} night trips.`}
          </Text>
          <View style={styles.dayNightBar}>
            <View style={styles.dayNightLabels}>
              <View style={styles.dayNightLabelRow}>
                <Sun color="#F59E0B" size={14} />
                <Text style={styles.dayNightLabelText}>Day</Text>
              </View>
              <View style={styles.dayNightLabelRow}>
                <Moon color="#6366F1" size={14} />
                <Text style={styles.dayNightLabelText}>Night</Text>
              </View>
            </View>
            <View style={styles.dayNightBarTrack}>
              <View
                style={[
                  styles.dayNightBarFillDay,
                  {
                    width: `${calculateStats.totalTrips > 0 ? (calculateStats.dayTrips / calculateStats.totalTrips) * 100 : 50}%`,
                  },
                ]}
              />
              <View
                style={[
                  styles.dayNightBarFillNight,
                  {
                    width: `${calculateStats.totalTrips > 0 ? (calculateStats.nightTrips / calculateStats.totalTrips) * 100 : 50}%`,
                  },
                ]}
              />
            </View>
            <View style={styles.dayNightCounts}>
              <Text style={styles.dayNightCountText}>{calculateStats.dayTrips}</Text>
              <Text style={styles.dayNightCountText}>{calculateStats.nightTrips}</Text>
            </View>
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
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  navHeader: {
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 0,
  },
  navTitle: {
    fontSize: 17,
    fontFamily: 'Orbitron_600SemiBold',
    color: colors.text,
  },
  scrollView: {
    flex: 1,
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

  driverTypeCard: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: colors.cardLight,
    borderRadius: 16,
    padding: 20,
  },
  driverTypeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  driverTypeTitle: {
    fontSize: 15,
    fontFamily: 'Orbitron_600SemiBold',
    color: colors.text,
    marginLeft: 10,
  },
  driverTypeValue: {
    fontSize: 24,
    fontFamily: 'Orbitron_700Bold',
    color: colors.text,
    marginBottom: 8,
  },
  driverTypeSubtext: {
    fontSize: 13,
    fontFamily: 'Orbitron_400Regular',
    color: colors.textLight,
    lineHeight: 20,
    marginBottom: 16,
  },
  dayNightBar: {
    marginTop: 8,
  },
  dayNightLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dayNightLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dayNightLabelText: {
    fontSize: 12,
    fontFamily: 'Orbitron_500Medium',
    color: colors.textLight,
  },
  dayNightBarTrack: {
    height: 10,
    backgroundColor: colors.border,
    borderRadius: 5,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  dayNightBarFillDay: {
    height: '100%',
    backgroundColor: '#F59E0B',
  },
  dayNightBarFillNight: {
    height: '100%',
    backgroundColor: '#6366F1',
  },
  dayNightCounts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  dayNightCountText: {
    fontSize: 12,
    fontFamily: 'Orbitron_600SemiBold',
    color: colors.text,
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
