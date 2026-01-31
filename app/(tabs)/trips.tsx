import { StyleSheet, Text, View, ScrollView, Dimensions } from 'react-native';
import { Clock, Gauge, TrendingUp, Navigation, Calendar, Route, Activity, Timer } from 'lucide-react-native';
import MapView, { Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { useMemo } from 'react';
import { useTrips } from '@/providers/TripProvider';
import { useSettings } from '@/providers/SettingsProvider';

export default function RecentScreen() {
  const { trips } = useTrips();
  const { convertSpeed, convertDistance, getSpeedLabel, getDistanceLabel, getAccelerationLabel, colors } = useSettings();
  const screenWidth = Dimensions.get('window').width;
  
  const lastTrip = trips.length > 0 ? trips[0] : null;

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
    if (time === undefined || time === null) return '--';
    return time.toFixed(1) + 's';
  };

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}h ${mins}m ${secs}s`;
    }
    return `${mins}m ${secs}s`;
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    emptyText: {
      fontSize: 20,
      fontWeight: '600' as const,
      color: colors.text,
      marginTop: 20,
    },
    emptySubtext: {
      fontSize: 14,
      color: colors.textLight,
      marginTop: 8,
      textAlign: 'center',
    },
    headerCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 20,
      padding: 20,
      marginBottom: 20,
    },
    headerDate: {
      fontSize: 15,
      fontWeight: '600' as const,
      color: '#FFFFFF',
    },
    headerTime: {
      fontSize: 14,
      color: 'rgba(255,255,255,0.7)',
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: '700' as const,
      color: '#FFFFFF',
    },
    mainStatCard: {
      flex: 1,
      backgroundColor: colors.cardLight,
      borderRadius: 20,
      padding: 20,
      alignItems: 'center',
    },
    mainStatValue: {
      fontSize: 32,
      fontWeight: '700' as const,
      color: colors.text,
      marginTop: 12,
    },
    mainStatLabel: {
      fontSize: 13,
      color: colors.textLight,
      marginTop: 4,
    },
    statCard: {
      backgroundColor: colors.cardLight,
      borderRadius: 16,
      padding: 16,
      flex: 1,
      minWidth: '30%',
      alignItems: 'center',
    },
    statIconWrapper: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    statValue: {
      fontSize: 24,
      fontWeight: '700' as const,
      color: colors.text,
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 11,
      color: colors.textLight,
      textAlign: 'center',
    },
  });

  if (!lastTrip) {
    return (
      <View style={dynamicStyles.container}>
        <View style={styles.emptyState}>
          <Route size={64} color={colors.textLight} />
          <Text style={dynamicStyles.emptyText}>No recent trip</Text>
          <Text style={dynamicStyles.emptySubtext}>Start tracking to see your last trip here</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={dynamicStyles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={dynamicStyles.headerCard}>
          <View style={styles.headerRow}>
            <Calendar size={18} color={colors.accent} />
            <Text style={dynamicStyles.headerDate}>{formatDate(lastTrip.startTime)}</Text>
            <Text style={dynamicStyles.headerTime}>{formatTime(lastTrip.startTime)}</Text>
          </View>
          <Text style={dynamicStyles.headerTitle}>Last Trip</Text>
        </View>

        <View style={styles.mainStatsRow}>
          <View style={dynamicStyles.mainStatCard}>
            <Navigation size={24} color={colors.accent} />
            <Text style={dynamicStyles.mainStatValue}>{convertDistance(lastTrip.distance).toFixed(2)}</Text>
            <Text style={dynamicStyles.mainStatLabel}>{getDistanceLabel()}</Text>
          </View>
          <View style={dynamicStyles.mainStatCard}>
            <Clock size={24} color={colors.accent} />
            <Text 
              style={dynamicStyles.mainStatValue} 
              numberOfLines={1} 
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {formatDuration(lastTrip.duration)}
            </Text>
            <Text style={dynamicStyles.mainStatLabel}>Duration</Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={dynamicStyles.statCard}>
            <View style={dynamicStyles.statIconWrapper}>
              <Gauge size={20} color={colors.accent} />
            </View>
            <Text style={dynamicStyles.statValue}>{Math.round(convertSpeed(lastTrip.topSpeed))}</Text>
            <Text style={dynamicStyles.statLabel}>Top Speed ({getSpeedLabel()})</Text>
          </View>
          
          <View style={dynamicStyles.statCard}>
            <View style={dynamicStyles.statIconWrapper}>
              <TrendingUp size={20} color={colors.accent} />
            </View>
            <Text style={dynamicStyles.statValue}>{Math.round(convertSpeed(lastTrip.avgSpeed))}</Text>
            <Text style={dynamicStyles.statLabel}>Avg Speed ({getSpeedLabel()})</Text>
          </View>
          
          <View style={dynamicStyles.statCard}>
            <View style={dynamicStyles.statIconWrapper}>
              <Route size={20} color={colors.accent} />
            </View>
            <Text style={dynamicStyles.statValue}>{lastTrip.corners}</Text>
            <Text style={dynamicStyles.statLabel}>Corners Taken</Text>
          </View>

          <View style={dynamicStyles.statCard}>
            <View style={dynamicStyles.statIconWrapper}>
              <Activity size={20} color={colors.accent} />
            </View>
            <Text style={dynamicStyles.statValue}>{(lastTrip.maxGForce ?? 0).toFixed(2)}</Text>
            <Text style={dynamicStyles.statLabel}>Max G-Force</Text>
          </View>

          <View style={dynamicStyles.statCard}>
            <View style={dynamicStyles.statIconWrapper}>
              <Timer size={20} color={colors.accent} />
            </View>
            <Text style={dynamicStyles.statValue}>{formatAccelTime(lastTrip.time0to100)}</Text>
            <Text style={dynamicStyles.statLabel}>{getAccelerationLabel('0-100')}</Text>
          </View>

          <View style={dynamicStyles.statCard}>
            <View style={dynamicStyles.statIconWrapper}>
              <Timer size={20} color={colors.accent} />
            </View>
            <Text style={dynamicStyles.statValue}>{formatAccelTime(lastTrip.time0to200)}</Text>
            <Text style={dynamicStyles.statLabel}>{getAccelerationLabel('0-200')}</Text>
          </View>
        </View>

        {routeCoordinates.length >= 2 && mapRegion && (
          <View style={[styles.mapSection, { backgroundColor: colors.cardLight }]}>
            <Text style={[styles.mapTitle, { color: colors.text }]}>Trip Route</Text>
            <View style={styles.mapContainer}>
              <MapView
                provider={PROVIDER_DEFAULT}
                style={styles.map}
                region={mapRegion}
                scrollEnabled={false}
                zoomEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
              >
                <Polyline
                  coordinates={routeCoordinates}
                  strokeColor={colors.accent}
                  strokeWidth={4}
                  lineCap="round"
                  lineJoin="round"
                />
              </MapView>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  mainStatsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  mapSection: {
    marginTop: 20,
    borderRadius: 20,
    padding: 16,
    overflow: 'hidden',
  },
  mapTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    marginBottom: 12,
  },
  mapContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    height: 200,
  },
  map: {
    width: '100%',
    height: '100%',
  },
});
