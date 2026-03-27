import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Clock, Gauge, Route, Zap, Navigation, MapPin } from 'lucide-react-native';
import MapView, { Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { useMemo } from 'react';
import { useTrips } from '@/providers/TripProvider';
import { useSettings } from '@/providers/SettingsProvider';
import { ThemeColors } from '@/constants/colors';

export default function RecentScreen() {
  const { trips } = useTrips();
  const { convertSpeed, convertDistance, getSpeedLabel, getDistanceLabel, getAccelerationShortLabel, colors } = useSettings();

  const lastTrip = trips.length > 0 ? trips[0] : null;
  const styles = useMemo(() => createStyles(colors), [colors]);

  const routeCoordinates = useMemo(() => {
    if (!lastTrip || !lastTrip.locations || lastTrip.locations.length < 2) return [];
    return lastTrip.locations.map(loc => ({
      latitude: loc.latitude,
      longitude: loc.longitude,
    }));
  }, [lastTrip]);

  const mapRegion = useMemo(() => {
    if (routeCoordinates.length === 0) return null;
    const lats = routeCoordinates.map(c => c.latitude);
    const lngs = routeCoordinates.map(c => c.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const latDelta = Math.max((maxLat - minLat) * 1.3, 0.01);
    const lngDelta = Math.max((maxLng - minLng) * 1.3, 0.01);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: latDelta,
      longitudeDelta: lngDelta,
    };
  }, [routeCoordinates]);

  const formatAccelTime = (time: number | undefined) => {
    if (time === undefined || time === null || time <= 0) return null;
    return time.toFixed(1);
  };

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return { hrs, mins, secs };
  };

  const formatDateLarge = (timestamp: number) => {
    const date = new Date(timestamp);
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    const dateStr = date.toLocaleDateString('en-US', options);
    const timeStr = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    return `${dateStr}, ${timeStr}`;
  };

  const getPerformanceLabel = () => {
    if (!lastTrip) return 'NO DATA';
    const topSpeed = lastTrip.topSpeed;
    if (topSpeed > 200) return 'PEAK PERFORMANCE';
    if (topSpeed > 150) return 'OPTIMIZED PERFORMANCE';
    if (topSpeed > 100) return 'SOLID DRIVE';
    return 'CASUAL CRUISE';
  };

  const getDriveConsistency = () => {
    if (!lastTrip) return { throttle: 0, brake: 0 };
    const avgRatio = lastTrip.avgSpeed > 0 ? Math.min((lastTrip.avgSpeed / lastTrip.topSpeed) * 100, 100) : 50;
    const throttle = Math.round(Math.min(avgRatio + 20, 99));
    const brake = Math.round(Math.min(100 - (lastTrip.corners * 2), 99));
    return { throttle: Math.max(throttle, 30), brake: Math.max(brake, 40) };
  };

  if (!lastTrip) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.navHeader}>
          <Text style={styles.navTitle}>Recent Trip</Text>
        </View>
        <View style={styles.emptyState}>
          <Route size={64} color={colors.textLight} />
          <Text style={styles.emptyText}>No recent trip</Text>
          <Text style={styles.emptySubtext}>Start tracking to see your last trip here</Text>
        </View>
      </SafeAreaView>
    );
  }

  const duration = formatDuration(lastTrip.duration);
  const durationStr = duration.hrs > 0
    ? `${duration.hrs}h ${duration.mins}m ${duration.secs}s`
    : `${duration.mins}m ${duration.secs}s`;
  const consistency = getDriveConsistency();
  const time0to100 = formatAccelTime(lastTrip.time0to100);
  const time0to200 = formatAccelTime(lastTrip.time0to200);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navHeader}>
        <Text style={styles.navTitle}>Recent Trip</Text>
      </View>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        <View style={styles.headerCard}>
          <View style={styles.headerTopRow}>
            <View style={styles.headerDot} />
            <Text style={styles.headerLabel}>RECENT TELEMETRY</Text>
          </View>
          <Text style={styles.headerDate}>{formatDateLarge(lastTrip.startTime)}</Text>
          <View style={styles.headerBottomRow}>
            <View>
              <Text style={styles.vehicleStatusLabel}>VEHICLE STATUS</Text>
              <Text style={styles.vehicleStatusValue}>{getPerformanceLabel()}</Text>
            </View>
            <View style={styles.headerIconCircle}>
              <Zap size={20} color={colors.accent} />
            </View>
          </View>
        </View>

        <View style={styles.accentCard}>
          <View style={styles.accentBar} />
          <View style={styles.accentCardContent}>
            <View>
              <View style={styles.accentValueRow}>
                <Text style={styles.accentValue}>{Math.round(convertSpeed(lastTrip.topSpeed))}</Text>
                <Text style={styles.accentUnit}>{getSpeedLabel()}</Text>
              </View>
              <Text style={styles.accentLabel}>TOP SPEED</Text>
            </View>
            <Gauge size={22} color={colors.accent} />
          </View>
        </View>

        <View style={styles.accentCard}>
          <View style={styles.accentBar} />
          <View style={styles.accentCardContent}>
            <View>
              <View style={styles.accentValueRow}>
                <Text style={styles.accentValue}>{convertDistance(lastTrip.distance).toFixed(2)}</Text>
                <Text style={styles.accentUnit}>{getDistanceLabel()}</Text>
              </View>
              <Text style={styles.accentLabel}>TOTAL DISTANCE</Text>
            </View>
            <Navigation size={22} color={colors.accent} />
          </View>
        </View>

        <View style={styles.accentCard}>
          <View style={styles.accentBar} />
          <View style={styles.accentCardContent}>
            <View>
              <Text style={styles.accentValue}>{durationStr}</Text>
              <Text style={styles.accentLabel}>TRIP DURATION</Text>
            </View>
            <Clock size={22} color={colors.accent} />
          </View>
        </View>

        <View style={styles.smallCardsRow}>
          <View style={styles.smallCard}>
            <View style={styles.smallCardValueRow}>
              <Text style={styles.smallCardValue}>{time0to100 ?? '--'}</Text>
              {time0to100 && <Text style={styles.smallCardUnit}>s</Text>}
            </View>
            <Text style={styles.smallCardLabel}>{getAccelerationShortLabel('0-100').toUpperCase()}</Text>
          </View>
          <View style={styles.smallCard}>
            <View style={styles.smallCardValueRow}>
              <Text style={styles.smallCardValue}>{time0to200 ?? '--'}</Text>
              {time0to200 && <Text style={styles.smallCardUnit}>s</Text>}
            </View>
            <Text style={styles.smallCardLabel}>{getAccelerationShortLabel('0-200').toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.smallCardsRow}>
          <View style={styles.smallCard}>
            <View style={styles.smallCardValueRow}>
              <Text style={styles.smallCardValue}>{(lastTrip.maxGForce ?? 0).toFixed(2)}</Text>
              <Text style={styles.smallCardUnit}>G</Text>
            </View>
            <Text style={styles.smallCardLabel}>MAX G-FORCE</Text>
          </View>
          <View style={styles.smallCard}>
            <View style={styles.smallCardValueRow}>
              <Text style={styles.smallCardValue}>{lastTrip.speedCamerasDetected ?? 0}</Text>
            </View>
            <Text style={styles.smallCardLabel}>SPEED CAMERAS</Text>
          </View>
        </View>

        <View style={styles.smallCardsRow}>
          <View style={styles.smallCard}>
            <View style={styles.smallCardValueRow}>
              <Text style={styles.smallCardValue}>{Math.round(convertSpeed(lastTrip.avgSpeed))}</Text>
              <Text style={styles.smallCardUnit}>{getSpeedLabel()}</Text>
            </View>
            <Text style={styles.smallCardLabel}>AVG SPEED</Text>
          </View>
          <View style={styles.smallCard}>
            <Text style={styles.smallCardValue}>{lastTrip.corners}</Text>
            <Text style={styles.smallCardLabel}>CORNERS TAKEN</Text>
          </View>
        </View>

        {routeCoordinates.length >= 2 && mapRegion && (
          <>
            <View style={styles.mapHeader}>
              <Text style={styles.mapTitle}>TRIP ROUTE</Text>
            </View>
            <View style={styles.mapCard}>
              <MapView
                provider={PROVIDER_DEFAULT}
                style={styles.map}
                region={mapRegion}
                scrollEnabled={false}
                zoomEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
                mapType="hybrid"
              >
                <Polyline
                  coordinates={routeCoordinates}
                  strokeColor={colors.accent}
                  strokeWidth={4}
                  lineCap="round"
                  lineJoin="round"
                />
              </MapView>
              {lastTrip.location?.city && (
                <View style={styles.mapLocationBadge}>
                  <MapPin size={12} color={colors.accent} />
                  <Text style={styles.mapLocationText}>{lastTrip.location.city.toUpperCase()}</Text>
                </View>
              )}
            </View>
          </>
        )}

        <View style={styles.consistencyCard}>
          <View style={styles.consistencyHeader}>
            <View style={styles.consistencyDot} />
            <Text style={styles.consistencyTitle}>DRIVE CONSISTENCY</Text>
          </View>
          <View style={styles.consistencyRow}>
            <Text style={styles.consistencyLabel}>Throttle Response Avg</Text>
            <View style={styles.consistencyBarContainer}>
              <View style={styles.consistencyBarTrack}>
                <View style={[styles.consistencyBarFill, { width: `${consistency.throttle}%` }]} />
              </View>
              <Text style={styles.consistencyPercent}>{consistency.throttle}%</Text>
            </View>
          </View>
          <View style={styles.consistencyRow}>
            <Text style={styles.consistencyLabel}>Brake Efficiency</Text>
            <View style={styles.consistencyBarContainer}>
              <View style={styles.consistencyBarTrack}>
                <View style={[styles.consistencyBarFill, { width: `${consistency.brake}%` }]} />
              </View>
              <Text style={styles.consistencyPercent}>{consistency.brake}%</Text>
            </View>
          </View>
        </View>

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
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    alignItems: 'center' as const,
  },
  navTitle: {
    fontSize: 16,
    fontFamily: 'Orbitron_700Bold',
    color: colors.text,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 20,
    fontFamily: 'Orbitron_600SemiBold',
    color: colors.text,
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: 'Orbitron_400Regular',
    color: colors.textLight,
    marginTop: 8,
    textAlign: 'center' as const,
  },

  headerCard: {
    backgroundColor: colors.cardLight,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  headerTopRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 8,
  },
  headerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    marginRight: 8,
  },
  headerLabel: {
    fontSize: 11,
    fontFamily: 'Orbitron_600SemiBold',
    color: colors.textLight,
    letterSpacing: 1,
  },
  headerDate: {
    fontSize: 26,
    fontFamily: 'Orbitron_700Bold',
    color: colors.text,
    marginBottom: 16,
  },
  headerBottomRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  vehicleStatusLabel: {
    fontSize: 10,
    fontFamily: 'Orbitron_400Regular',
    color: colors.textLight,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  vehicleStatusValue: {
    fontSize: 13,
    fontFamily: 'Orbitron_700Bold',
    color: colors.accent,
    letterSpacing: 0.5,
  },
  headerIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent + '15',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },

  accentCard: {
    backgroundColor: colors.cardLight,
    borderRadius: 16,
    marginBottom: 12,
    flexDirection: 'row' as const,
    overflow: 'hidden' as const,
  },
  accentBar: {
    width: 4,
    backgroundColor: colors.accent,
  },
  accentCardContent: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  accentValueRow: {
    flexDirection: 'row' as const,
    alignItems: 'baseline' as const,
  },
  accentValue: {
    fontSize: 30,
    fontFamily: 'Orbitron_700Bold',
    color: colors.text,
  },
  accentUnit: {
    fontSize: 16,
    fontFamily: 'Orbitron_400Regular',
    color: colors.textLight,
    marginLeft: 6,
  },
  accentLabel: {
    fontSize: 11,
    fontFamily: 'Orbitron_600SemiBold',
    color: colors.textLight,
    marginTop: 4,
    letterSpacing: 0.5,
  },

  smallCardsRow: {
    flexDirection: 'row' as const,
    gap: 12,
    marginBottom: 12,
  },
  singleSmallCardRow: {
    flexDirection: 'row' as const,
    marginBottom: 12,
  },
  smallCard: {
    flex: 1,
    backgroundColor: colors.cardLight,
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center' as const,
  },
  smallCardValueRow: {
    flexDirection: 'row' as const,
    alignItems: 'baseline' as const,
  },
  smallCardValue: {
    fontSize: 26,
    fontFamily: 'Orbitron_700Bold',
    color: colors.text,
  },
  smallCardUnit: {
    fontSize: 14,
    fontFamily: 'Orbitron_400Regular',
    color: colors.textLight,
    marginLeft: 4,
  },
  smallCardLabel: {
    fontSize: 10,
    fontFamily: 'Orbitron_600SemiBold',
    color: colors.textLight,
    marginTop: 6,
    letterSpacing: 0.5,
    textAlign: 'center' as const,
  },

  mapHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 12,
    marginTop: 8,
  },
  mapTitle: {
    fontSize: 16,
    fontFamily: 'Orbitron_700Bold',
    color: colors.text,
    letterSpacing: 0.5,
  },
  mapCard: {
    borderRadius: 20,
    overflow: 'hidden' as const,
    height: 220,
    marginBottom: 16,
    position: 'relative' as const,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  mapLocationBadge: {
    position: 'absolute' as const,
    bottom: 14,
    left: 14,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  mapLocationText: {
    fontSize: 10,
    fontFamily: 'Orbitron_600SemiBold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },

  consistencyCard: {
    backgroundColor: colors.cardLight,
    borderRadius: 16,
    padding: 20,
    marginBottom: 8,
  },
  consistencyHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 18,
  },
  consistencyDot: {
    width: 20,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
    marginRight: 10,
  },
  consistencyTitle: {
    fontSize: 12,
    fontFamily: 'Orbitron_700Bold',
    color: colors.text,
    letterSpacing: 1,
  },
  consistencyRow: {
    marginBottom: 14,
  },
  consistencyLabel: {
    fontSize: 13,
    fontFamily: 'Orbitron_400Regular',
    color: colors.textLight,
    marginBottom: 8,
  },
  consistencyBarContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  consistencyBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden' as const,
  },
  consistencyBarFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 4,
  },
  consistencyPercent: {
    fontSize: 14,
    fontFamily: 'Orbitron_700Bold',
    color: colors.text,
    width: 42,
    textAlign: 'right' as const,
  },

  bottomSpacer: {
    height: 40,
  },
});
