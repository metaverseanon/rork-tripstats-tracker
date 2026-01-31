import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { Play, Square } from 'lucide-react-native';
import { useTrips } from '@/providers/TripProvider';
import { useSettings } from '@/providers/SettingsProvider';
import { useUser } from '@/providers/UserProvider';
import TripShareCard from '@/components/TripShareCard';

export default function TrackScreen() {
  const { isTracking, currentTrip, currentSpeed, startTracking, stopTracking, lastSavedTrip, clearLastSavedTrip } = useTrips();
  const { convertSpeed, convertDistance, getSpeedLabel, getDistanceLabel, getAccelerationLabel, colors } = useSettings();
  const { user } = useUser();
  const [showShareCard, setShowShareCard] = useState(false);

  useEffect(() => {
    if (lastSavedTrip && !isTracking) {
      setShowShareCard(true);
    }
  }, [lastSavedTrip, isTracking]);

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
    stopTracking(carModel);
  }, [stopTracking, getUserCarModel]);

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins}m ${secs}s`;
  };

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
      borderColor: isTracking ? getSpeedColor(currentSpeed) : colors.success,
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
      backgroundColor: isDark ? '#000000' : colors.background,
    },
  });

  return (
    <View style={dynamicStyles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.speedometerSection}>
          <View style={dynamicStyles.speedometerCircle}>
            <Text style={dynamicStyles.speedValue}>
              {isTracking ? Math.round(convertSpeed(currentSpeed)) : 0}
            </Text>
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

      {lastSavedTrip && (
        <TripShareCard
          trip={lastSavedTrip}
          visible={showShareCard}
          onClose={handleCloseShareCard}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
