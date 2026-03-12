import { useCallback, useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Platform, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Play, Square, Map, Gauge } from 'lucide-react-native';
import { useTrips } from '@/providers/TripProvider';
import { useSettings } from '@/providers/SettingsProvider';
import { useUser } from '@/providers/UserProvider';
import TripShareCard from '@/components/TripShareCard';

let MapView: React.ComponentType<any> | null = null;
let Polyline: React.ComponentType<any> | null = null;

if (Platform.OS !== 'web') {
  try {
    const Maps = require('react-native-maps');
    MapView = Maps.default;
    Polyline = Maps.Polyline;
  } catch {
    console.log('react-native-maps not available');
  }
}

type ViewMode = 'standard' | 'map';

export default function TrackScreen() {
  const { isTracking, currentTrip, currentSpeed, currentLocation, startTracking, stopTracking, lastSavedTrip, clearLastSavedTrip } = useTrips();
  const { convertSpeed, convertDistance, getSpeedLabel, getDistanceLabel, getAccelerationLabel, colors } = useSettings();
  const { user } = useUser();
  const [showShareCard, setShowShareCard] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('standard');
  const mapRef = useRef<any>(null);
  const toggleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (lastSavedTrip && !isTracking) {
      setShowShareCard(true);
    }
  }, [lastSavedTrip, isTracking]);

  useEffect(() => {
    Animated.timing(toggleAnim, {
      toValue: viewMode === 'map' ? 1 : 0,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [viewMode, toggleAnim]);

  useEffect(() => {
    if (viewMode === 'map' && currentLocation && mapRef.current) {
      try {
        mapRef.current.animateToRegion({
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }, 500);
      } catch (e) {
        console.log('Failed to animate map:', e);
      }
    }
  }, [currentLocation, viewMode]);

  const handleCloseShareCard = useCallback(() => {
    setShowShareCard(false);
    clearLastSavedTrip();
  }, [clearLastSavedTrip]);

  const isDark = colors.background === '#000000';

  const getSpeedColor = useCallback((speed: number) => {
    const maxSpeed = 200;
    const clampedSpeed = Math.min(Math.max(speed, 0), maxSpeed);
    const ratio = clampedSpeed / maxSpeed;
    
    const startR = 0, startG = 200, startB = 83;
    const endR = 255, endG = 71, endB = 87;
    
    const r = Math.round(startR + (endR - startR) * ratio);
    const g = Math.round(startG + (endG - startG) * ratio);
    const b = Math.round(startB + (endB - startB) * ratio);
    
    return `rgb(${r}, ${g}, ${b})`;
  }, []);

  const getUserCarModel = useCallback(() => {
    if (user?.cars && user.cars.length > 0) {
      const primary = user.cars.find(c => c.isPrimary) || user.cars[0];
      return `${primary.brand} ${primary.model}`;
    }
    if (user?.carBrand) {
      return `${user.carBrand} ${user.carModel || ''}`;
    }
    return undefined;
  }, [user?.cars, user?.carBrand, user?.carModel]);

  const handleStopTracking = useCallback(() => {
    const carModel = getUserCarModel();
    void stopTracking(carModel);
  }, [stopTracking, getUserCarModel]);

  const toggleViewMode = useCallback(() => {
    setViewMode(prev => prev === 'standard' ? 'map' : 'standard');
  }, []);

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins}m ${secs}s`;
  };

  const displaySpeed = isTracking ? Math.round(convertSpeed(currentSpeed)) : 0;
  const speedColor = isTracking ? getSpeedColor(currentSpeed) : colors.success;
  const canShowMap = MapView !== null && Platform.OS !== 'web';

  const routeCoords = currentTrip?.locations?.map(loc => ({
    latitude: loc.latitude,
    longitude: loc.longitude,
  })) ?? [];

  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#000000' : colors.background,
    },
    speedometerCircle: {
      width: 240,
      height: 240,
      borderRadius: 120,
      backgroundColor: isDark ? '#1A1A1A' : colors.cardLight,
      borderWidth: 4,
      borderColor: speedColor,
      alignItems: 'center',
      justifyContent: 'center',
    },
    speedValue: {
      fontSize: 67,
      fontFamily: 'Orbitron_700Bold',
      color: colors.text,
    },
    speedUnit: {
      fontSize: 19,
      fontFamily: 'Orbitron_600SemiBold',
      color: colors.textLight,
      textTransform: 'uppercase' as const,
      marginTop: 4,
    },
    statCard: {
      backgroundColor: isDark ? '#1A1A1A' : colors.cardLight,
      borderRadius: 12,
      padding: 14,
      flex: 1,
      minWidth: '30%',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: isDark ? '#2A2A2A' : colors.border,
    },
    statValue: {
      fontSize: 22,
      fontFamily: 'Orbitron_600SemiBold',
      color: colors.text,
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 11,
      fontFamily: 'Orbitron_500Medium',
      color: colors.textLight,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.3,
    },
    buttonContainer: {
      padding: 20,
      paddingBottom: 30,
    },
    miniSpeedCircle: {
      width: 140,
      height: 140,
      borderRadius: 70,
      backgroundColor: 'rgba(0,0,0,0.85)',
      borderWidth: 3,
      borderColor: speedColor,
      alignItems: 'center',
      justifyContent: 'center',
    },
    miniSpeedValue: {
      fontSize: 40,
      fontFamily: 'Orbitron_700Bold',
      color: '#FFFFFF',
    },
    miniSpeedUnit: {
      fontSize: 12,
      fontFamily: 'Orbitron_600SemiBold',
      color: 'rgba(255,255,255,0.6)',
      textTransform: 'uppercase' as const,
      marginTop: 2,
    },
  });

  const renderMapView = () => {
    if (!canShowMap || !MapView) return null;

    const mapRegion = currentLocation ? {
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
      latitudeDelta: 0.005,
      longitudeDelta: 0.005,
    } : {
      latitude: 45.815,
      longitude: 15.982,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };

    return (
      <View style={mapStyles.mapContainer}>
        <MapView
          ref={mapRef}
          style={mapStyles.map}
          initialRegion={mapRegion}
          showsUserLocation={true}
          showsMyLocationButton={false}
          showsCompass={false}
          customMapStyle={isDark ? darkMapStyle : []}
          mapType="standard"
        >

          {routeCoords.length > 1 && Polyline && (
            <Polyline
              coordinates={routeCoords}
              strokeColor={colors.accent}
              strokeWidth={3}
            />
          )}
        </MapView>

        <View style={mapStyles.speedOverlay}>
          <View style={dynamicStyles.miniSpeedCircle}>
            <Text style={dynamicStyles.miniSpeedValue}>{displaySpeed}</Text>
            <Text style={dynamicStyles.miniSpeedUnit}>{getSpeedLabel()}</Text>
          </View>
        </View>

        <View style={mapStyles.statsOverlay}>
          <View style={mapStyles.statsRow}>
            <View style={mapStyles.mapStatItem}>
              <Text style={mapStyles.mapStatValue}>
                {currentTrip ? Math.round(convertSpeed(currentTrip.topSpeed)) : '0'}
              </Text>
              <Text style={mapStyles.mapStatLabel}>Top {getSpeedLabel()}</Text>
            </View>
            <View style={mapStyles.mapStatDivider} />
            <View style={mapStyles.mapStatItem}>
              <Text style={mapStyles.mapStatValue}>
                {currentTrip ? convertDistance(currentTrip.distance).toFixed(2) : '0.00'}
              </Text>
              <Text style={mapStyles.mapStatLabel}>{getDistanceLabel()}</Text>
            </View>
            <View style={mapStyles.mapStatDivider} />
            <View style={mapStyles.mapStatItem}>
              <Text style={mapStyles.mapStatValue}>
                {currentTrip ? formatDuration(currentTrip.duration) : '0:00'}
              </Text>
              <Text style={mapStyles.mapStatLabel}>Duration</Text>
            </View>
          </View>
        </View>

        <View style={[mapStyles.mapButtonContainer, { backgroundColor: 'transparent' }]}>
          {!isTracking ? (
            <TouchableOpacity
              style={[styles.button, styles.startButton]}
              onPress={startTracking}
              activeOpacity={0.8}
            >
              <Play size={24} color="#FFFFFF" fill="#FFFFFF" />
              <Text style={styles.buttonText}>Start Trip</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.button, styles.stopButton]}
              onPress={handleStopTracking}
              activeOpacity={0.8}
            >
              <Square size={24} color="#FFFFFF" fill="#FFFFFF" />
              <Text style={styles.buttonText}>Stop Trip</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderStandardView = () => (
    <>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.speedometerSection}>
          <View style={dynamicStyles.speedometerCircle}>
            <Text style={dynamicStyles.speedValue}>{displaySpeed}</Text>
            <Text style={dynamicStyles.speedUnit}>{getSpeedLabel()}</Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statsRow}>
            <View style={dynamicStyles.statCard}>
              <Text style={dynamicStyles.statValue}>
                {currentTrip ? Math.round(convertSpeed(currentTrip.topSpeed)) : '0'}
              </Text>
              <Text style={dynamicStyles.statLabel}>Top ({getSpeedLabel()})</Text>
            </View>
            <View style={dynamicStyles.statCard}>
              <Text style={dynamicStyles.statValue}>
                {currentTrip ? convertDistance(currentTrip.distance).toFixed(2) : '0.00'}
              </Text>
              <Text style={dynamicStyles.statLabel}>Distance ({getDistanceLabel()})</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={dynamicStyles.statCard}>
              <Text style={dynamicStyles.statValue}>
                {currentTrip?.time0to100 ? currentTrip.time0to100.toFixed(1) + 's' : '--'}
              </Text>
              <Text style={dynamicStyles.statLabel}>{getAccelerationLabel('0-100')}</Text>
            </View>
            <View style={dynamicStyles.statCard}>
              <Text style={dynamicStyles.statValue}>
                {currentTrip?.time0to200 ? currentTrip.time0to200.toFixed(1) + 's' : '--'}
              </Text>
              <Text style={dynamicStyles.statLabel}>{getAccelerationLabel('0-200')}</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={dynamicStyles.statCard}>
              <Text style={dynamicStyles.statValue}>
                {currentTrip ? (currentTrip.maxGForce ?? 0).toFixed(2) : '0.00'}
              </Text>
              <Text style={dynamicStyles.statLabel}>G-Force</Text>
            </View>
            <View style={dynamicStyles.statCard}>
              <Text style={dynamicStyles.statValue}>
                {currentTrip ? formatDuration(currentTrip.duration) : '0m 0s'}
              </Text>
              <Text style={dynamicStyles.statLabel}>Duration</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={dynamicStyles.buttonContainer}>
        {!isTracking ? (
          <TouchableOpacity
            style={[styles.button, styles.startButton]}
            onPress={startTracking}
            activeOpacity={0.8}
          >
            <Play size={24} color="#FFFFFF" fill="#FFFFFF" />
            <Text style={styles.buttonText}>Start Trip</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.button, styles.stopButton]}
            onPress={handleStopTracking}
            activeOpacity={0.8}
          >
            <Square size={24} color="#FFFFFF" fill="#FFFFFF" />
            <Text style={styles.buttonText}>Stop Trip</Text>
          </TouchableOpacity>
        )}
      </View>
    </>
  );

  return (
    <SafeAreaView style={dynamicStyles.container} edges={['top']}>
      <View style={styles.navHeader}>
        {canShowMap && (
          <TouchableOpacity
            style={[
              styles.viewToggle,
              { backgroundColor: isDark ? '#1A1A1A' : colors.cardLight, borderColor: isDark ? '#2A2A2A' : colors.border },
            ]}
            onPress={toggleViewMode}
            activeOpacity={0.7}
            testID="view-mode-toggle"
          >
            {viewMode === 'standard' ? (
              <Map size={18} color={colors.text} />
            ) : (
              <Gauge size={18} color={colors.text} />
            )}
          </TouchableOpacity>
        )}
        <Text style={[styles.navTitle, { color: colors.text }]}>Track</Text>
        {canShowMap && <View style={styles.viewTogglePlaceholder} />}
      </View>

      {viewMode === 'map' && canShowMap ? renderMapView() : renderStandardView()}

      {lastSavedTrip && (
        <TripShareCard
          trip={lastSavedTrip}
          visible={showShareCard}
          onClose={handleCloseShareCard}
        />
      )}
    </SafeAreaView>
  );
}

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#212121' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#757575' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#181818' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#2C2C2C' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212121' }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#3C3C3C' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
];

const styles = StyleSheet.create({
  navHeader: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    alignItems: 'center' as const,
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
  },
  navTitle: {
    fontSize: 16,
    fontFamily: 'Orbitron_700Bold',
    flex: 1,
    textAlign: 'center' as const,
  },
  viewToggle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
  },
  viewTogglePlaceholder: {
    width: 36,
    height: 36,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  speedometerSection: {
    alignItems: 'center',
    marginVertical: 20,
  },
  statsGrid: {
    gap: 10,
    marginTop: 32,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10,
  },
  startButton: {
    backgroundColor: '#00C853',
  },
  stopButton: {
    backgroundColor: '#CC0000',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Orbitron_600SemiBold',
  },
});

const mapStyles = StyleSheet.create({
  mapContainer: {
    flex: 1,
    position: 'relative' as const,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  speedOverlay: {
    position: 'absolute' as const,
    bottom: 180,
    left: 20,
  },
  statsOverlay: {
    position: 'absolute' as const,
    bottom: 100,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  statsRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-around' as const,
  },
  mapStatItem: {
    flex: 1,
    alignItems: 'center' as const,
  },
  mapStatValue: {
    fontSize: 18,
    fontFamily: 'Orbitron_600SemiBold',
    color: '#FFFFFF',
  },
  mapStatLabel: {
    fontSize: 10,
    fontFamily: 'Orbitron_500Medium',
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase' as const,
    marginTop: 2,
  },
  mapStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  mapButtonContainer: {
    position: 'absolute' as const,
    bottom: 30,
    left: 20,
    right: 20,
  },
  markerOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,200,83,0.3)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  markerInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});
