import { useCallback, useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Platform, Alert, Dimensions } from 'react-native';
import * as ExpoLocation from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Play, Square, Map, Gauge, X, Camera } from 'lucide-react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { useTrips } from '@/providers/TripProvider';
import { useSettings } from '@/providers/SettingsProvider';
import { useUser } from '@/providers/UserProvider';
import TripShareCard from '@/components/TripShareCard';

let MapViewComponent: React.ComponentType<any> | null = null;
let PolylineComponent: React.ComponentType<any> | null = null;
let MarkerComponent: React.ComponentType<any> | null = null;

if (Platform.OS !== 'web') {
  try {
    const Maps = require('react-native-maps');
    MapViewComponent = Maps.default;
    PolylineComponent = Maps.Polyline;
    MarkerComponent = Maps.Marker;
  } catch {
    console.log('react-native-maps not available');
  }
}

type ViewMode = 'standard' | 'map';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SPEEDOMETER_SIZE = Math.min(SCREEN_WIDTH * 0.52, 220);
const STROKE_WIDTH = 6;
const RADIUS = (SPEEDOMETER_SIZE - STROKE_WIDTH) / 2;
const CENTER = SPEEDOMETER_SIZE / 2;
const ARC_ANGLE = 270;
const START_ANGLE = 135;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const ARC_LENGTH = (ARC_ANGLE / 360) * CIRCUMFERENCE;

export default function TrackScreen() {
  const { isTracking, currentTrip, currentSpeed, currentLocation, startTracking, stopTracking, cancelTracking, lastSavedTrip, clearLastSavedTrip, speedCameraBlocked } = useTrips();
  const { convertSpeed, convertDistance, getSpeedLabel, getDistanceLabel, getAccelerationLabel, colors } = useSettings();
  const { user } = useUser();
  const [showShareCard, setShowShareCard] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('standard');
  const mapRef = useRef<any>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const locationFetched = useRef(false);

  useEffect(() => {
    if (lastSavedTrip && !isTracking) {
      setShowShareCard(true);
    }
  }, [lastSavedTrip, isTracking]);

  useEffect(() => {
    if (viewMode === 'map' && !locationFetched.current && Platform.OS !== 'web') {
      locationFetched.current = true;
      void (async () => {
        try {
          const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
          if (status !== 'granted') return;
          const loc = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.High });
          setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
          if (mapRef.current) {
            mapRef.current.animateToRegion({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              latitudeDelta: 0.012,
              longitudeDelta: 0.012,
            }, 500);
          }
        } catch (e) {
          console.log('Failed to fetch user location:', e);
        }
      })();
    }
  }, [viewMode]);

  useEffect(() => {
    if (viewMode === 'map' && currentLocation && mapRef.current) {
      try {
        mapRef.current.animateToRegion({
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          latitudeDelta: 0.012,
          longitudeDelta: 0.012,
        }, 300);
      } catch (e) {
        console.log('Failed to animate map:', e);
      }
    }
  }, [currentLocation, viewMode]);

  useEffect(() => {
    if (viewMode !== 'map' || Platform.OS === 'web') return;
    let sub: ExpoLocation.LocationSubscription | null = null;
    void (async () => {
      try {
        const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        sub = await ExpoLocation.watchPositionAsync(
          { accuracy: ExpoLocation.Accuracy.High, distanceInterval: 5, timeInterval: 2000 },
          (loc) => {
            const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
            setUserLocation(coords);
            if (mapRef.current) {
              mapRef.current.animateToRegion({ ...coords, latitudeDelta: 0.012, longitudeDelta: 0.012 }, 300);
            }
          },
        );
      } catch (e) {
        console.log('Watch position error:', e);
      }
    })();
    return () => { sub?.remove(); };
  }, [viewMode]);

  const handleCloseShareCard = useCallback(() => {
    setShowShareCard(false);
    clearLastSavedTrip();
  }, [clearLastSavedTrip]);

  const isDark = colors.background === '#000000';

  const getSpeedColor = useCallback((speed: number) => {
    const maxSpeed = 200;
    const ratio = Math.min(Math.max(speed, 0), maxSpeed) / maxSpeed;
    const r = Math.round(34 + (204 - 34) * ratio);
    const g = Math.round(197 + (0 - 197) * ratio);
    const b = Math.round(94 + (0 - 94) * ratio);
    return `rgb(${r}, ${g}, ${b})`;
  }, []);

  const getUserCarModel = useCallback(() => {
    if (user?.cars && user.cars.length > 0) {
      const primary = user.cars.find(c => c.isPrimary) || user.cars[0];
      return `${primary.brand} ${primary.model}`;
    }
    if (user?.carBrand) return `${user.carBrand} ${user.carModel || ''}`;
    return undefined;
  }, [user?.cars, user?.carBrand, user?.carModel]);

  const handleStopTracking = useCallback(() => {
    void stopTracking(getUserCarModel());
  }, [stopTracking, getUserCarModel]);

  const handleCancelTracking = useCallback(() => {
    Alert.alert('Discard Trip', 'Are you sure you want to exit without saving this trip?', [
      { text: 'Keep Tracking', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => void cancelTracking() },
    ]);
  }, [cancelTracking]);

  const toggleViewMode = useCallback(() => {
    setViewMode(prev => prev === 'standard' ? 'map' : 'standard');
  }, []);

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  };

  const displaySpeed = isTracking ? Math.round(convertSpeed(currentSpeed)) : 0;
  const speedColor = isTracking ? getSpeedColor(currentSpeed) : '#E53935';
  const canShowMap = MapViewComponent !== null && Platform.OS !== 'web';

  const routeCoords = currentTrip?.locations?.map(loc => ({
    latitude: loc.latitude,
    longitude: loc.longitude,
  })) ?? [];

  const speedRatio = Math.min(displaySpeed / 300, 1);
  const activeArcLength = speedRatio * ARC_LENGTH;
  const dashOffset = ARC_LENGTH - activeArcLength;

  const bgColor = isDark ? '#000000' : '#F2F4F6';
  const cardBg = isDark ? '#1A1A1A' : '#FFFFFF';
  const cardBorder = isDark ? '#2A2A2A' : '#E8EBF0';
  const labelColor = isDark ? '#888888' : '#8E8E93';
  const valueColor = isDark ? '#FFFFFF' : '#1A1A1A';
  const subtitleColor = isDark ? '#555555' : '#B0B4BC';
  const speedometerBg = isDark ? '#111111' : '#F0F5F0';

  const renderSpeedometer = () => (
    <View style={[s.speedometerWrap, { width: SPEEDOMETER_SIZE, height: SPEEDOMETER_SIZE }]}>
      <Svg width={SPEEDOMETER_SIZE} height={SPEEDOMETER_SIZE}>
        <G rotation={START_ANGLE} origin={`${CENTER}, ${CENTER}`}>
          <Circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            stroke={isDark ? '#1A1A1A' : '#E4EBE4'}
            strokeWidth={STROKE_WIDTH}
            fill={speedometerBg}
            strokeDasharray={`${ARC_LENGTH} ${CIRCUMFERENCE}`}
            strokeDashoffset={0}
            strokeLinecap="round"
          />
          <Circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            stroke={speedColor}
            strokeWidth={STROKE_WIDTH}
            fill="none"
            strokeDasharray={`${ARC_LENGTH} ${CIRCUMFERENCE}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
          />
        </G>
      </Svg>
      <View style={s.speedTextWrap}>
        <Text style={[s.speedValue, { color: valueColor, fontSize: SPEEDOMETER_SIZE * 0.28 }]}>
          {displaySpeed}
        </Text>
        <Text style={[s.speedUnit, { color: labelColor }]}>{getSpeedLabel()}</Text>
      </View>
    </View>
  );

  const renderStatusBadge = () => (
    <View style={[s.statusBadge, { backgroundColor: isDark ? '#1A1A1A' : '#FFFFFF', borderColor: cardBorder }]}>
      <View style={[s.statusDot, { backgroundColor: isTracking ? '#E53935' : '#22C55E' }]} />
      <Text style={[s.statusText, { color: labelColor }]}>
        {isTracking ? 'TRACKING • GPS ACTIVE' : 'SYSTEM READY • GPS LOCKED'}
      </Text>
    </View>
  );

  const renderStatCard = (
    label: string,
    value: string,
    subtitle: string,
    flex: number = 1,
    icon?: React.ReactNode
  ) => (
    <View style={[s.statCard, { backgroundColor: cardBg, borderColor: cardBorder, flex }]}>
      <Text style={[s.statLabel, { color: labelColor }]}>{label}</Text>
      <View style={s.statValueRow}>
        <Text style={[s.statValue, { color: valueColor }]}>{value}</Text>
        <Text style={[s.statSuffix, { color: subtitleColor }]}>{subtitle}</Text>
        {icon}
      </View>
    </View>
  );

  const renderStandardView = () => (
    <View style={s.contentWrap}>
      <View style={s.speedSection}>
        {renderSpeedometer()}
        {renderStatusBadge()}
      </View>

      <View style={s.statsSection}>
        <View style={s.statsRow}>
          {renderStatCard(
            `TOP ${getSpeedLabel().toUpperCase()}`,
            currentTrip ? Math.round(convertSpeed(currentTrip.topSpeed)).toString() : '0',
            'MAX'
          )}
          {renderStatCard(
            `DISTANCE ${getDistanceLabel().toUpperCase()}`,
            currentTrip ? convertDistance(currentTrip.distance).toFixed(1) : '0.0',
            'TRIP'
          )}
        </View>

        <View style={s.statsRow}>
          {renderStatCard(
            getAccelerationLabel('0-100').toUpperCase(),
            currentTrip?.time0to100 ? currentTrip.time0to100.toFixed(2) : '--',
            's'
          )}
          {!speedCameraBlocked && renderStatCard(
            'CAMERAS',
            (currentTrip?.speedCamerasDetected ?? 0).toString(),
            '',
            1,
            <Camera size={14} color={labelColor} style={{ marginLeft: 4 }} />
          )}
          {renderStatCard(
            getAccelerationLabel('0-200').toUpperCase(),
            currentTrip?.time0to200 ? currentTrip.time0to200.toFixed(2) : '--',
            'SEC'
          )}
        </View>

        <View style={s.statsRow}>
          {renderStatCard(
            'G-FORCE',
            currentTrip ? (currentTrip.maxGForce ?? 0).toFixed(2) : '0.00',
            'LAT'
          )}
          {renderStatCard(
            'DURATION',
            formatDuration(currentTrip?.duration ?? 0),
            ''
          )}
        </View>
      </View>

      <View style={s.buttonWrap}>
        {!isTracking ? (
          <TouchableOpacity
            style={s.startButton}
            onPress={startTracking}
            activeOpacity={0.85}
            testID="start-trip-button"
          >
            <Text style={s.startButtonText}>START TRIP</Text>
            <Play size={18} color="#FFFFFF" fill="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={s.stopButton}
            onPress={handleStopTracking}
            activeOpacity={0.85}
            testID="stop-trip-button"
          >
            <Square size={18} color="#FFFFFF" fill="#FFFFFF" />
            <Text style={s.stopButtonText}>STOP TRIP</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderMapView = () => {
    if (!canShowMap || !MapViewComponent) return null;
    const effectiveLocation = currentLocation || userLocation;
    const mapRegion = effectiveLocation
      ? { latitude: effectiveLocation.latitude, longitude: effectiveLocation.longitude, latitudeDelta: 0.012, longitudeDelta: 0.012 }
      : { latitude: 45.815, longitude: 15.982, latitudeDelta: 0.012, longitudeDelta: 0.012 };

    return (
      <View style={mapS.container}>
        <MapViewComponent
          ref={mapRef}
          style={mapS.map}
          initialRegion={mapRegion}
          showsUserLocation={false}
          showsMyLocationButton={false}
          followsUserLocation={false}
          showsCompass={false}
          customMapStyle={isDark ? darkMapStyle : []}
          mapType="standard"
        >
          {effectiveLocation && MarkerComponent && (
            <MarkerComponent
              coordinate={{ latitude: effectiveLocation.latitude, longitude: effectiveLocation.longitude }}
              anchor={{ x: 0.5, y: 0.5 }}
              flat
            >
              <View style={mapS.dotOuter}>
                <View style={mapS.dotInner} />
              </View>
            </MarkerComponent>
          )}
          {routeCoords.length > 1 && PolylineComponent && (
            <PolylineComponent coordinates={routeCoords} strokeColor={colors.accent} strokeWidth={3} />
          )}
        </MapViewComponent>

        <View style={mapS.speedOverlay}>
          <View style={[mapS.miniSpeed, { borderColor: speedColor }]}>
            <Text style={mapS.miniSpeedVal}>{displaySpeed}</Text>
            <Text style={mapS.miniSpeedUnit}>{getSpeedLabel()}</Text>
          </View>
        </View>

        <View style={mapS.statsOverlay}>
          <View style={mapS.statsRow}>
            <View style={mapS.statItem}>
              <Text style={mapS.statVal}>{currentTrip ? Math.round(convertSpeed(currentTrip.topSpeed)) : '0'}</Text>
              <Text style={mapS.statLbl}>Top {getSpeedLabel()}</Text>
            </View>
            <View style={mapS.divider} />
            <View style={mapS.statItem}>
              <Text style={mapS.statVal}>{currentTrip ? convertDistance(currentTrip.distance).toFixed(2) : '0.00'}</Text>
              <Text style={mapS.statLbl}>{getDistanceLabel()}</Text>
            </View>
            <View style={mapS.divider} />
            <View style={mapS.statItem}>
              <Text style={mapS.statVal}>{currentTrip ? formatDuration(currentTrip.duration) : '00:00:00'}</Text>
              <Text style={mapS.statLbl}>Duration</Text>
            </View>
          </View>
        </View>

        <View style={mapS.btnWrap}>
          {!isTracking ? (
            <TouchableOpacity style={s.startButton} onPress={startTracking} activeOpacity={0.85}>
              <Text style={s.startButtonText}>START TRIP</Text>
              <Play size={18} color="#FFFFFF" fill="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={s.stopButton} onPress={handleStopTracking} activeOpacity={0.85}>
              <Square size={18} color="#FFFFFF" fill="#FFFFFF" />
              <Text style={s.stopButtonText}>STOP TRIP</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[s.container, { backgroundColor: bgColor }]} edges={['top']}>
      <View style={s.navHeader}>
        {canShowMap ? (
          <TouchableOpacity
            style={[s.navBtn, { backgroundColor: cardBg, borderColor: cardBorder }]}
            onPress={toggleViewMode}
            activeOpacity={0.7}
            testID="view-mode-toggle"
          >
            {viewMode === 'standard' ? <Map size={18} color={valueColor} /> : <Gauge size={18} color={valueColor} />}
          </TouchableOpacity>
        ) : <View style={s.navBtnPlaceholder} />}
        <Text style={[s.navTitle, { color: valueColor }]}>Track</Text>
        {isTracking ? (
          <TouchableOpacity
            style={[s.navBtn, { backgroundColor: isDark ? '#2A1A1A' : '#FFF0F0', borderColor: isDark ? '#3A2A2A' : '#FFCCCC' }]}
            onPress={handleCancelTracking}
            activeOpacity={0.7}
            testID="cancel-tracking-button"
          >
            <X size={18} color="#CC0000" />
          </TouchableOpacity>
        ) : (
          <View style={s.navBtnPlaceholder} />
        )}
      </View>

      {viewMode === 'map' && canShowMap ? renderMapView() : renderStandardView()}

      {lastSavedTrip && (
        <TripShareCard trip={lastSavedTrip} visible={showShareCard} onClose={handleCloseShareCard} />
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

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  navHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  navTitle: {
    fontSize: 15,
    fontFamily: 'Orbitron_700Bold',
    flex: 1,
    textAlign: 'center' as const,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
  },
  navBtnPlaceholder: {
    width: 36,
    height: 36,
  },
  contentWrap: {
    flex: 1,
    justifyContent: 'space-between' as const,
  },
  speedSection: {
    alignItems: 'center' as const,
    paddingTop: 8,
  },
  speedometerWrap: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  speedTextWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  speedValue: {
    fontFamily: 'Orbitron_700Bold',
    includeFontPadding: false,
  },
  speedUnit: {
    fontSize: 13,
    fontFamily: 'Orbitron_600SemiBold',
    textTransform: 'uppercase' as const,
    marginTop: 2,
    letterSpacing: 1,
  },
  statusBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 10,
    borderWidth: 1,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 9,
    fontFamily: 'Orbitron_600SemiBold',
    letterSpacing: 1.2,
  },
  statsSection: {
    paddingHorizontal: 14,
    gap: 6,
  },
  statsRow: {
    flexDirection: 'row' as const,
    gap: 6,
  },
  statCard: {
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
  },
  statLabel: {
    fontSize: 8,
    fontFamily: 'Orbitron_600SemiBold',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  statValueRow: {
    flexDirection: 'row' as const,
    alignItems: 'baseline' as const,
  },
  statValue: {
    fontSize: 22,
    fontFamily: 'Orbitron_700Bold',
  },
  statSuffix: {
    fontSize: 10,
    fontFamily: 'Orbitron_500Medium',
    marginLeft: 4,
    textTransform: 'uppercase' as const,
  },
  buttonWrap: {
    paddingHorizontal: 14,
    paddingBottom: 16,
    paddingTop: 8,
  },
  startButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: '#E53935',
    gap: 10,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'Orbitron_700Bold',
    letterSpacing: 2,
  },
  stopButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: '#CC0000',
    gap: 10,
  },
  stopButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'Orbitron_700Bold',
    letterSpacing: 2,
  },
});

const mapS = StyleSheet.create({
  container: {
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
  miniSpeed: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderWidth: 3,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  miniSpeedVal: {
    fontSize: 38,
    fontFamily: 'Orbitron_700Bold',
    color: '#FFFFFF',
  },
  miniSpeedUnit: {
    fontSize: 11,
    fontFamily: 'Orbitron_600SemiBold',
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase' as const,
    marginTop: 2,
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
  statItem: {
    flex: 1,
    alignItems: 'center' as const,
  },
  statVal: {
    fontSize: 17,
    fontFamily: 'Orbitron_600SemiBold',
    color: '#FFFFFF',
  },
  statLbl: {
    fontSize: 9,
    fontFamily: 'Orbitron_500Medium',
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase' as const,
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  btnWrap: {
    position: 'absolute' as const,
    bottom: 30,
    left: 20,
    right: 20,
  },
  dotOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 122, 255, 0.2)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  dotInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#007AFF',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
});
