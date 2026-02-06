import React, { useMemo, useCallback, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { MapPin, Car, Zap, Navigation, Gauge, Activity, CornerDownRight, Timer, Route, Trophy, Calendar } from 'lucide-react-native';
import { useSettings } from '@/providers/SettingsProvider';
import { useUser } from '@/providers/UserProvider';
import { useTrips } from '@/providers/TripProvider';
import { ThemeColors } from '@/constants/colors';
import { TripStats } from '@/types/trip';


interface CarStats {
  carKey: string;
  brand: string;
  model: string;
  picture?: string;
  totalTrips: number;
  totalDistance: number;
  topSpeed: number;
  avgSpeed: number;
  topCornerSpeed: number;
  maxGForce: number;
  best0to100: number | null;
  best0to200: number | null;
  totalDuration: number;
  lastDriveDate: number;
}

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { user } = useUser();
  const { trips } = useTrips();
  const { convertSpeed, convertDistance, getSpeedLabel, getDistanceLabel, colors } = useSettings();
  const [selectedCarIndex, setSelectedCarIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const styles = useMemo(() => createStyles(colors), [colors]);

  const isOwnProfile = !userId || userId === user?.id;

  const profileUser = useMemo(() => {
    if (isOwnProfile && user) {
      return {
        displayName: user.displayName,
        profilePicture: user.profilePicture,
        country: user.country,
        city: user.city,
        cars: user.cars || [],
        carBrand: user.carBrand,
        carModel: user.carModel,
        carPicture: user.carPicture,
        createdAt: user.createdAt,
      };
    }
    return null;
  }, [isOwnProfile, user]);

  const carStats = useMemo((): CarStats[] => {
    if (!profileUser) return [];

    const carMap = new Map<string, { brand: string; model: string; picture?: string; trips: TripStats[] }>();

    if (profileUser.cars && profileUser.cars.length > 0) {
      for (const car of profileUser.cars) {
        const key = `${car.brand} ${car.model}`;
        carMap.set(key, { brand: car.brand, model: car.model, picture: car.picture, trips: [] });
      }
    } else if (profileUser.carBrand) {
      const key = `${profileUser.carBrand} ${profileUser.carModel || ''}`.trim();
      carMap.set(key, { brand: profileUser.carBrand, model: profileUser.carModel || '', picture: profileUser.carPicture, trips: [] });
    }

    for (const trip of trips) {
      if (trip.carModel) {
        const existing = carMap.get(trip.carModel);
        if (existing) {
          existing.trips.push(trip);
        } else {
          const parts = trip.carModel.split(' ');
          const brand = parts[0];
          const model = parts.slice(1).join(' ');
          carMap.set(trip.carModel, { brand, model, trips: [trip] });
        }
      } else {
        const firstKey = carMap.keys().next().value;
        if (firstKey) {
          carMap.get(firstKey)!.trips.push(trip);
        }
      }
    }

    const result: CarStats[] = [];
    for (const [key, data] of carMap) {
      const t = data.trips;
      let topCornerSpeed = 0;
      for (const trip of t) {
        if (trip.corners > 0 && trip.avgSpeed > 0) {
          const cornerSpeed = trip.avgSpeed * 0.7;
          if (cornerSpeed > topCornerSpeed) topCornerSpeed = cornerSpeed;
        }
        if (trip.topSpeed > 0 && trip.corners > 0) {
          const estimatedCornerSpeed = trip.topSpeed * 0.45;
          if (estimatedCornerSpeed > topCornerSpeed) topCornerSpeed = estimatedCornerSpeed;
        }
      }

      result.push({
        carKey: key,
        brand: data.brand,
        model: data.model,
        picture: data.picture,
        totalTrips: t.length,
        totalDistance: t.reduce((sum, tr) => sum + tr.distance, 0),
        topSpeed: Math.max(0, ...t.map(tr => tr.topSpeed)),
        avgSpeed: t.length > 0 ? t.reduce((sum, tr) => sum + tr.avgSpeed, 0) / t.length : 0,
        topCornerSpeed,
        maxGForce: Math.max(0, ...t.map(tr => tr.maxGForce ?? 0)),
        best0to100: t.reduce((best: number | null, tr) => {
          if (!tr.time0to100 || tr.time0to100 <= 0) return best;
          return best === null ? tr.time0to100 : Math.min(best, tr.time0to100);
        }, null),
        best0to200: t.reduce((best: number | null, tr) => {
          if (!tr.time0to200 || tr.time0to200 <= 0) return best;
          return best === null ? tr.time0to200 : Math.min(best, tr.time0to200);
        }, null),
        totalDuration: t.reduce((sum, tr) => sum + tr.duration, 0),
        lastDriveDate: Math.max(0, ...t.map(tr => tr.startTime)),
      });
    }

    result.sort((a, b) => b.totalTrips - a.totalTrips);
    return result;
  }, [profileUser, trips]);

  const selectCar = useCallback((index: number) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0.3, duration: 100, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setSelectedCarIndex(index);
  }, [fadeAnim]);

  const selectedCar = carStats[selectedCarIndex] || null;

  const totalTrips = trips.length;
  const totalDistance = trips.reduce((sum, t) => sum + t.distance, 0);
  const overallTopSpeed = Math.max(0, ...trips.map(t => t.topSpeed));

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  const memberSince = profileUser?.createdAt
    ? new Date(profileUser.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '';

  if (!profileUser) {
    return (
      <>
        <Stack.Screen options={{ title: 'Profile', headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text }} />
        <View style={[styles.container, styles.centered]}>
          <Text style={styles.emptyText}>Profile not available</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: '',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontSize: 16, fontWeight: '600' as const },
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeader}>
          <View style={styles.avatarWrapper}>
            {profileUser.profilePicture ? (
              <Image source={{ uri: profileUser.profilePicture }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>
                  {profileUser.displayName[0].toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.displayName}>{profileUser.displayName}</Text>
          {(profileUser.city || profileUser.country) && (
            <View style={styles.locationRow}>
              <MapPin size={14} color={colors.accent} />
              <Text style={styles.locationText}>
                {profileUser.city}{profileUser.city && profileUser.country ? ', ' : ''}{profileUser.country}
              </Text>
            </View>
          )}
          {memberSince ? (
            <View style={styles.memberRow}>
              <Calendar size={12} color={colors.textLight} />
              <Text style={styles.memberText}>Member since {memberSince}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.overviewRow}>
          <View style={styles.overviewCard}>
            <Route size={18} color={colors.accent} />
            <Text style={styles.overviewValue}>{totalTrips}</Text>
            <Text style={styles.overviewLabel}>Trips</Text>
          </View>
          <View style={styles.overviewCard}>
            <Navigation size={18} color={colors.primary} />
            <Text style={styles.overviewValue}>{convertDistance(totalDistance).toFixed(0)}</Text>
            <Text style={styles.overviewLabel}>{getDistanceLabel()}</Text>
          </View>
          <View style={styles.overviewCard}>
            <Zap size={18} color={colors.warning} />
            <Text style={styles.overviewValue}>{Math.round(convertSpeed(overallTopSpeed))}</Text>
            <Text style={styles.overviewLabel}>{getSpeedLabel()}</Text>
          </View>
        </View>

        {carStats.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Car size={18} color={colors.text} />
              <Text style={styles.sectionTitle}>Garage</Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carCardsContainer}
              style={styles.carCardsScroll}
            >
              {carStats.map((car, index) => (
                <TouchableOpacity
                  key={car.carKey}
                  style={[styles.carCard, selectedCarIndex === index && styles.carCardSelected]}
                  onPress={() => selectCar(index)}
                  activeOpacity={0.8}
                >
                  {car.picture ? (
                    <Image source={{ uri: car.picture }} style={styles.carCardImage} />
                  ) : (
                    <View style={styles.carCardImagePlaceholder}>
                      <Car size={28} color={selectedCarIndex === index ? colors.accent : colors.textLight} />
                    </View>
                  )}
                  <Text style={[styles.carCardBrand, selectedCarIndex === index && styles.carCardBrandSelected]}>
                    {car.brand}
                  </Text>
                  <Text style={[styles.carCardModel, selectedCarIndex === index && styles.carCardModelSelected]} numberOfLines={1}>
                    {car.model}
                  </Text>
                  {car.totalTrips > 0 && (
                    <Text style={[styles.carCardTrips, selectedCarIndex === index && styles.carCardTripsSelected]}>
                      {car.totalTrips} {car.totalTrips === 1 ? 'trip' : 'trips'}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            {selectedCar && (
              <Animated.View style={[styles.statsContainer, { opacity: fadeAnim }]}>
                <View style={styles.statsHeader}>
                  <Text style={styles.statsTitle}>{selectedCar.brand} {selectedCar.model}</Text>
                  {selectedCar.lastDriveDate > 0 && (
                    <Text style={styles.statsSubtitle}>
                      Last drive: {new Date(selectedCar.lastDriveDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                  )}
                </View>

                <View style={styles.statsGrid}>
                  <View style={styles.statItem}>
                    <View style={[styles.statIconBg, { backgroundColor: colors.warning + '20' }]}>
                      <Zap size={16} color={colors.warning} />
                    </View>
                    <Text style={styles.statValue}>{Math.round(convertSpeed(selectedCar.topSpeed))} {getSpeedLabel()}</Text>
                    <Text style={styles.statLabel}>Top Speed</Text>
                  </View>

                  <View style={styles.statItem}>
                    <View style={[styles.statIconBg, { backgroundColor: colors.accent + '20' }]}>
                      <Navigation size={16} color={colors.accent} />
                    </View>
                    <Text style={styles.statValue}>{convertDistance(selectedCar.totalDistance).toFixed(1)} {getDistanceLabel()}</Text>
                    <Text style={styles.statLabel}>Distance</Text>
                  </View>

                  <View style={styles.statItem}>
                    <View style={[styles.statIconBg, { backgroundColor: colors.success + '20' }]}>
                      <Gauge size={16} color={colors.success} />
                    </View>
                    <Text style={styles.statValue}>{Math.round(convertSpeed(selectedCar.avgSpeed))} {getSpeedLabel()}</Text>
                    <Text style={styles.statLabel}>Avg Speed</Text>
                  </View>

                  <View style={styles.statItem}>
                    <View style={[styles.statIconBg, { backgroundColor: colors.primary + '20' }]}>
                      <CornerDownRight size={16} color={colors.primary} />
                    </View>
                    <Text style={styles.statValue}>
                      {selectedCar.topCornerSpeed > 0
                        ? `${Math.round(convertSpeed(selectedCar.topCornerSpeed))} ${getSpeedLabel()}`
                        : '—'}
                    </Text>
                    <Text style={styles.statLabel}>Corner Speed</Text>
                  </View>

                  <View style={styles.statItem}>
                    <View style={[styles.statIconBg, { backgroundColor: colors.danger + '20' }]}>
                      <Activity size={16} color={colors.danger} />
                    </View>
                    <Text style={styles.statValue}>{selectedCar.maxGForce > 0 ? `${selectedCar.maxGForce.toFixed(2)} G` : '—'}</Text>
                    <Text style={styles.statLabel}>Max G-Force</Text>
                  </View>

                  <View style={styles.statItem}>
                    <View style={[styles.statIconBg, { backgroundColor: colors.warning + '20' }]}>
                      <Timer size={16} color={colors.warning} />
                    </View>
                    <Text style={styles.statValue}>{selectedCar.best0to100 ? `${selectedCar.best0to100.toFixed(2)}s` : '—'}</Text>
                    <Text style={styles.statLabel}>0-100</Text>
                  </View>

                  {selectedCar.best0to200 && (
                    <View style={styles.statItem}>
                      <View style={[styles.statIconBg, { backgroundColor: colors.accent + '20' }]}>
                        <Timer size={16} color={colors.accent} />
                      </View>
                      <Text style={styles.statValue}>{selectedCar.best0to200.toFixed(2)}s</Text>
                      <Text style={styles.statLabel}>0-200</Text>
                    </View>
                  )}

                  <View style={styles.statItem}>
                    <View style={[styles.statIconBg, { backgroundColor: colors.textLight + '20' }]}>
                      <Trophy size={16} color={colors.textLight} />
                    </View>
                    <Text style={styles.statValue}>{formatDuration(selectedCar.totalDuration)}</Text>
                    <Text style={styles.statLabel}>Drive Time</Text>
                  </View>
                </View>
              </Animated.View>
            )}

            {carStats.length > 0 && selectedCar && selectedCar.totalTrips === 0 && (
              <View style={styles.noStatsCard}>
                <Car size={32} color={colors.textLight} />
                <Text style={styles.noStatsText}>No trips recorded with this car yet</Text>
              </View>
            )}
          </>
        )}

        {carStats.length === 0 && (
          <View style={styles.noStatsCard}>
            <Car size={40} color={colors.textLight} />
            <Text style={styles.noStatsText}>No cars in garage</Text>
            <Text style={styles.noStatsSubtext}>Add a car in your profile to see stats</Text>
          </View>
        )}
      </ScrollView>
    </>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  profileHeader: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  avatarWrapper: {
    marginBottom: 14,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: colors.accent,
  },
  avatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.cardLight,
    borderWidth: 3,
    borderColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 32,
    fontFamily: 'Orbitron_700Bold',
    color: colors.accent,
  },
  displayName: {
    fontSize: 20,
    fontFamily: 'Orbitron_700Bold',
    color: colors.text,
    marginBottom: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  locationText: {
    fontSize: 13,
    fontFamily: 'Orbitron_500Medium',
    color: colors.textLight,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  memberText: {
    fontSize: 11,
    fontFamily: 'Orbitron_400Regular',
    color: colors.textLight,
  },
  overviewRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 24,
  },
  overviewCard: {
    flex: 1,
    backgroundColor: colors.cardLight,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  overviewValue: {
    fontSize: 18,
    fontFamily: 'Orbitron_700Bold',
    color: colors.text,
  },
  overviewLabel: {
    fontSize: 10,
    fontFamily: 'Orbitron_500Medium',
    color: colors.textLight,
    textTransform: 'uppercase',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: 'Orbitron_600SemiBold',
    color: colors.text,
  },
  carCardsScroll: {
    marginBottom: 20,
  },
  carCardsContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  carCard: {
    width: 140,
    backgroundColor: colors.cardLight,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  carCardSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent + '10',
  },
  carCardImage: {
    width: 100,
    height: 60,
    borderRadius: 8,
    marginBottom: 8,
  },
  carCardImagePlaceholder: {
    width: 100,
    height: 60,
    borderRadius: 8,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  carCardBrand: {
    fontSize: 11,
    fontFamily: 'Orbitron_600SemiBold',
    color: colors.text,
    textAlign: 'center',
  },
  carCardBrandSelected: {
    color: colors.accent,
  },
  carCardModel: {
    fontSize: 10,
    fontFamily: 'Orbitron_400Regular',
    color: colors.textLight,
    textAlign: 'center',
    marginTop: 2,
  },
  carCardModelSelected: {
    color: colors.text,
  },
  carCardTrips: {
    fontSize: 9,
    fontFamily: 'Orbitron_500Medium',
    color: colors.textLight,
    marginTop: 4,
  },
  carCardTripsSelected: {
    color: colors.accent,
  },
  statsContainer: {
    marginHorizontal: 16,
    backgroundColor: colors.cardLight,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statsHeader: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 12,
  },
  statsTitle: {
    fontSize: 14,
    fontFamily: 'Orbitron_600SemiBold',
    color: colors.text,
  },
  statsSubtitle: {
    fontSize: 11,
    fontFamily: 'Orbitron_400Regular',
    color: colors.textLight,
    marginTop: 3,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statItem: {
    width: '46%' as any,
    alignItems: 'flex-start',
    gap: 4,
  },
  statIconBg: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 13,
    fontFamily: 'Orbitron_600SemiBold',
    color: colors.text,
  },
  statLabel: {
    fontSize: 10,
    fontFamily: 'Orbitron_400Regular',
    color: colors.textLight,
  },
  noStatsCard: {
    marginHorizontal: 16,
    backgroundColor: colors.cardLight,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  noStatsText: {
    fontSize: 14,
    fontFamily: 'Orbitron_500Medium',
    color: colors.textLight,
    textAlign: 'center',
  },
  noStatsSubtext: {
    fontSize: 12,
    fontFamily: 'Orbitron_400Regular',
    color: colors.textLight,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Orbitron_500Medium',
    color: colors.textLight,
  },
});
