import React, { useMemo, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
  ActivityIndicator,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { MapPin, Car, Zap, Navigation, Gauge, Activity, CornerDownRight, Timer, Route, Trophy, Calendar, ChevronDown } from 'lucide-react-native';
import { useSettings } from '@/providers/SettingsProvider';
import { useUser } from '@/providers/UserProvider';
import { useTrips } from '@/providers/TripProvider';
import { trpc } from '@/lib/trpc';
import { ThemeColors } from '@/constants/colors';
import { TripStats } from '@/types/trip';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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

interface ProfileData {
  displayName: string;
  profilePicture?: string;
  country?: string;
  city?: string;
  carBrand?: string;
  carModel?: string;
  carPicture?: string;
  cars?: Array<{ id: string; brand: string; model: string; picture?: string; isPrimary?: boolean }>;
  createdAt: number;
}

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { user } = useUser();
  const { trips: ownTrips } = useTrips();
  const { convertSpeed, convertDistance, getSpeedLabel, getDistanceLabel, colors } = useSettings();
  const [expandedCarKey, setExpandedCarKey] = useState<string | null>(null);

  const styles = useMemo(() => createStyles(colors), [colors]);

  const isOwnProfile = !userId || userId === user?.id;

  const remoteProfileQuery = trpc.user.getPublicProfile.useQuery(
    { userId: userId || '' },
    { enabled: !isOwnProfile && !!userId }
  );

  const remoteTripsQuery = trpc.trips.getUserTrips.useQuery(
    { userId: userId || '' },
    { enabled: !isOwnProfile && !!userId }
  );

  const profileUser = useMemo((): ProfileData | null => {
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

    if (!isOwnProfile && remoteProfileQuery.data) {
      const p = remoteProfileQuery.data;
      return {
        displayName: p.displayName,
        country: p.country,
        city: p.city,
        carBrand: p.carBrand,
        carModel: p.carModel,
        createdAt: p.createdAt,
      };
    }

    return null;
  }, [isOwnProfile, user, remoteProfileQuery.data]);

  const profileTrips = useMemo(() => {
    if (isOwnProfile) return ownTrips;
    if (remoteTripsQuery.data) {
      return remoteTripsQuery.data.map(t => ({
        ...t,
        locations: [] as Array<{ latitude: number; longitude: number; speed: number | null; timestamp: number }>,
      }));
    }
    return [] as TripStats[];
  }, [isOwnProfile, ownTrips, remoteTripsQuery.data]);

  const isLoadingRemote = !isOwnProfile && (remoteProfileQuery.isLoading || remoteTripsQuery.isLoading);

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

    for (const trip of profileTrips) {
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
  }, [profileUser, profileTrips]);

  const toggleCar = useCallback((carKey: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedCarKey(prev => prev === carKey ? null : carKey);
  }, []);

  const totalTrips = profileTrips.length;
  const totalDistance = profileTrips.reduce((sum, t) => sum + t.distance, 0);
  const overallTopSpeed = Math.max(0, ...profileTrips.map(t => t.topSpeed));

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  const memberSince = profileUser?.createdAt
    ? new Date(profileUser.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '';

  if (isLoadingRemote) {
    return (
      <>
        <Stack.Screen options={{ title: 'Profile', headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text }} />
        <View style={[styles.container, styles.centered]}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.emptyText, { marginTop: 12 }]}>Loading profile...</Text>
        </View>
      </>
    );
  }

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

            <View style={styles.garageList}>
              {carStats.map((car) => {
                const isExpanded = expandedCarKey === car.carKey;
                return (
                  <View key={car.carKey} style={[styles.garageItem, isExpanded && styles.garageItemExpanded]}>
                    <TouchableOpacity
                      style={styles.garageItemRow}
                      onPress={() => toggleCar(car.carKey)}
                      activeOpacity={0.7}
                    >
                      {car.picture ? (
                        <Image source={{ uri: car.picture }} style={styles.garageItemImage} />
                      ) : (
                        <View style={styles.garageItemImagePlaceholder}>
                          <Car size={22} color={isExpanded ? colors.accent : colors.textLight} />
                        </View>
                      )}
                      <View style={styles.garageItemInfo}>
                        <Text style={styles.garageItemBrand}>{car.brand}</Text>
                        <Text style={styles.garageItemModel}>{car.model}</Text>
                        {car.totalTrips > 0 && (
                          <Text style={styles.garageItemTrips}>{car.totalTrips} {car.totalTrips === 1 ? 'trip' : 'trips'}</Text>
                        )}
                      </View>
                      <View style={[styles.garageChevron, isExpanded && styles.garageChevronExpanded]}>
                        <ChevronDown size={18} color={colors.textLight} />
                      </View>
                    </TouchableOpacity>

                    {isExpanded && (
                      <View style={styles.garageStatsPanel}>
                        {car.lastDriveDate > 0 && (
                          <Text style={styles.garageLastDrive}>
                            Last drive: {new Date(car.lastDriveDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </Text>
                        )}
                        {car.totalTrips === 0 ? (
                          <View style={styles.garageNoStats}>
                            <Car size={24} color={colors.textLight} />
                            <Text style={styles.garageNoStatsText}>No trips recorded yet</Text>
                          </View>
                        ) : (
                          <View style={styles.statsGrid}>
                            <View style={styles.statItem}>
                              <View style={[styles.statIconBg, { backgroundColor: colors.warning + '20' }]}>
                                <Zap size={18} color={colors.warning} />
                              </View>
                              <View style={styles.statTextGroup}>
                                <Text style={styles.statValue}>{Math.round(convertSpeed(car.topSpeed))} {getSpeedLabel()}</Text>
                                <Text style={styles.statLabel}>Top Speed</Text>
                              </View>
                            </View>
                            <View style={styles.statItem}>
                              <View style={[styles.statIconBg, { backgroundColor: colors.accent + '20' }]}>
                                <Navigation size={18} color={colors.accent} />
                              </View>
                              <View style={styles.statTextGroup}>
                                <Text style={styles.statValue}>{convertDistance(car.totalDistance).toFixed(1)} {getDistanceLabel()}</Text>
                                <Text style={styles.statLabel}>Distance</Text>
                              </View>
                            </View>
                            <View style={styles.statItem}>
                              <View style={[styles.statIconBg, { backgroundColor: colors.accent + '20' }]}>
                                <Route size={18} color={colors.accent} />
                              </View>
                              <View style={styles.statTextGroup}>
                                <Text style={styles.statValue}>{car.totalTrips}</Text>
                                <Text style={styles.statLabel}>Trips</Text>
                              </View>
                            </View>
                            <View style={styles.statItem}>
                              <View style={[styles.statIconBg, { backgroundColor: colors.success + '20' }]}>
                                <Gauge size={18} color={colors.success} />
                              </View>
                              <View style={styles.statTextGroup}>
                                <Text style={styles.statValue}>{Math.round(convertSpeed(car.avgSpeed))} {getSpeedLabel()}</Text>
                                <Text style={styles.statLabel}>Avg Speed</Text>
                              </View>
                            </View>
                            <View style={styles.statItem}>
                              <View style={[styles.statIconBg, { backgroundColor: colors.primary + '20' }]}>
                                <CornerDownRight size={18} color={colors.primary} />
                              </View>
                              <View style={styles.statTextGroup}>
                                <Text style={styles.statValue}>
                                  {car.topCornerSpeed > 0 ? `${Math.round(convertSpeed(car.topCornerSpeed))} ${getSpeedLabel()}` : '—'}
                                </Text>
                                <Text style={styles.statLabel}>Corner Speed</Text>
                              </View>
                            </View>
                            <View style={styles.statItem}>
                              <View style={[styles.statIconBg, { backgroundColor: colors.danger + '20' }]}>
                                <Activity size={18} color={colors.danger} />
                              </View>
                              <View style={styles.statTextGroup}>
                                <Text style={styles.statValue}>{car.maxGForce > 0 ? `${car.maxGForce.toFixed(2)} G` : '—'}</Text>
                                <Text style={styles.statLabel}>Max G-Force</Text>
                              </View>
                            </View>
                            <View style={styles.statItem}>
                              <View style={[styles.statIconBg, { backgroundColor: colors.warning + '20' }]}>
                                <Timer size={18} color={colors.warning} />
                              </View>
                              <View style={styles.statTextGroup}>
                                <Text style={styles.statValue}>{car.best0to100 ? `${car.best0to100.toFixed(2)}s` : '—'}</Text>
                                <Text style={styles.statLabel}>0-100</Text>
                              </View>
                            </View>
                            {car.best0to200 && (
                              <View style={styles.statItem}>
                                <View style={[styles.statIconBg, { backgroundColor: colors.accent + '20' }]}>
                                  <Timer size={18} color={colors.accent} />
                                </View>
                                <View style={styles.statTextGroup}>
                                  <Text style={styles.statValue}>{car.best0to200.toFixed(2)}s</Text>
                                  <Text style={styles.statLabel}>0-200</Text>
                                </View>
                              </View>
                            )}
                            <View style={styles.statItem}>
                              <View style={[styles.statIconBg, { backgroundColor: colors.textLight + '20' }]}>
                                <Trophy size={18} color={colors.textLight} />
                              </View>
                              <View style={styles.statTextGroup}>
                                <Text style={styles.statValue}>{formatDuration(car.totalDuration)}</Text>
                                <Text style={styles.statLabel}>Drive Time</Text>
                              </View>
                            </View>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </>
        )}

        {carStats.length === 0 && !isOwnProfile && profileUser.carBrand && (
          <View style={styles.noStatsCard}>
            <Car size={40} color={colors.accent} />
            <Text style={styles.noStatsCarName}>
              {profileUser.carBrand}{profileUser.carModel ? ` ${profileUser.carModel}` : ''}
            </Text>
            <Text style={styles.noStatsSubtext}>No trip data available</Text>
          </View>
        )}

        {carStats.length === 0 && (isOwnProfile || !profileUser.carBrand) && (
          <View style={styles.noStatsCard}>
            <Car size={40} color={colors.textLight} />
            <Text style={styles.noStatsText}>No cars in garage</Text>
            <Text style={styles.noStatsSubtext}>
              {isOwnProfile ? 'Add a car in your profile to see stats' : 'This user has no cars listed'}
            </Text>
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
  garageList: {
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 20,
  },
  garageItem: {
    backgroundColor: colors.cardLight,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  garageItemExpanded: {
    borderColor: colors.accent,
  },
  garageItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  garageItemImage: {
    width: 56,
    height: 56,
    borderRadius: 10,
  },
  garageItemImagePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  garageItemInfo: {
    flex: 1,
    gap: 2,
  },
  garageItemBrand: {
    fontSize: 13,
    fontFamily: 'Orbitron_600SemiBold',
    color: colors.text,
  },
  garageItemModel: {
    fontSize: 11,
    fontFamily: 'Orbitron_400Regular',
    color: colors.textLight,
  },
  garageItemTrips: {
    fontSize: 10,
    fontFamily: 'Orbitron_500Medium',
    color: colors.accent,
    marginTop: 2,
  },
  garageChevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  garageChevronExpanded: {
    transform: [{ rotate: '180deg' }],
    backgroundColor: colors.accent + '20',
  },
  garageStatsPanel: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 14,
  },
  garageLastDrive: {
    fontSize: 10,
    fontFamily: 'Orbitron_400Regular',
    color: colors.textLight,
    marginBottom: 12,
  },
  garageNoStats: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 6,
  },
  garageNoStatsText: {
    fontSize: 12,
    fontFamily: 'Orbitron_400Regular',
    color: colors.textLight,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statItem: {
    width: '47%' as any,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  statIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statTextGroup: {
    flex: 1,
  },
  statValue: {
    fontSize: 13,
    fontFamily: 'Orbitron_600SemiBold',
    color: colors.text,
  },
  statLabel: {
    fontSize: 9,
    fontFamily: 'Orbitron_400Regular',
    color: colors.textLight,
    marginTop: 2,
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
  noStatsCarName: {
    fontSize: 16,
    fontFamily: 'Orbitron_600SemiBold',
    color: colors.text,
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
