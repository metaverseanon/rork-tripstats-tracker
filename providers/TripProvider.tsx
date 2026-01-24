import createContextHook from '@nkzw/create-context-hook';
import * as ExpoLocation from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TripStats, Location as LocationType, TripLocation } from '@/types/trip';

const TRIPS_KEY = 'trips';
const CURRENT_TRIP_KEY = 'current_trip';
const TRACKING_STATE_KEY = 'tracking_state';
const CORNER_THRESHOLD = 15;
const CORNER_ACCUMULATION_THRESHOLD = 45;
const CORNER_RESET_TIMEOUT = 3000;
const SPEED_NOISE_THRESHOLD = 5;
const BACKGROUND_LOCATION_TASK = 'background-location-task';

let backgroundLocationCallback: ((location: ExpoLocation.LocationObject) => void) | null = null;
let taskDefined = false;
let processLocationRef: ((location: ExpoLocation.LocationObject) => void) | null = null;

const defineBackgroundTask = () => {
  if (taskDefined || Platform.OS === 'web') return;
  try {
    TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
      if (error) {
        console.error('Background location task error:', error);
        return;
      }
      if (data) {
        const { locations } = data as { locations: ExpoLocation.LocationObject[] };
        if (locations && locations.length > 0) {
          console.log('Background task received locations:', locations.length);
          for (const location of locations) {
            if (processLocationRef) {
              processLocationRef(location);
            } else if (backgroundLocationCallback) {
              backgroundLocationCallback(location);
            }
          }
        }
      }
    });
    taskDefined = true;
  } catch (error) {
    console.error('Failed to define background task:', error);
  }
};

if (Platform.OS !== 'web') {
  defineBackgroundTask();
}

export const [TripProvider, useTrips] = createContextHook(() => {
  const [trips, setTrips] = useState<TripStats[]>([]);
  const [currentTrip, setCurrentTrip] = useState<TripStats | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [currentLocation, setCurrentLocation] = useState<LocationType | null>(null);
  const [lastSavedTrip, setLastSavedTrip] = useState<TripStats | null>(null);
  const locationSubscription = useRef<ExpoLocation.LocationSubscription | null>(null);
  const isBackgroundEnabled = useRef<boolean>(false);
  const durationInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const previousHeading = useRef<number | null>(null);
  const accumulatedHeadingChange = useRef<number>(0);
  const lastCornerTime = useRef<number>(0);
  const previousSpeed = useRef<number>(0);
  const previousSpeedTime = useRef<number>(0);
  const currentTripRef = useRef<TripStats | null>(null);
  const tripsRef = useRef<TripStats[]>([]);
  const maxAcceleration = useRef<number>(0);
  const maxGForce = useRef<number>(0);
  const accelStartTime = useRef<number | null>(null);
  const reached100 = useRef<boolean>(false);
  const reached200 = useRef<boolean>(false);
  const reached300 = useRef<boolean>(false);
  const time0to100 = useRef<number | null>(null);
  const time0to200 = useRef<number | null>(null);
  const time0to300 = useRef<number | null>(null);
  const currentSpeedRef = useRef<number>(0);

  useEffect(() => {
    loadTrips();
    restoreTrackingState();
    return () => {
      backgroundLocationCallback = null;
      processLocationRef = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTrips = async () => {
    try {
      const stored = await AsyncStorage.getItem(TRIPS_KEY);
      if (stored) {
        setTrips(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load trips:', error);
    }
  };

  const restoreTrackingState = async () => {
    try {
      const trackingState = await AsyncStorage.getItem(TRACKING_STATE_KEY);
      const savedTrip = await AsyncStorage.getItem(CURRENT_TRIP_KEY);
      
      if (trackingState === 'true' && savedTrip) {
        const trip = JSON.parse(savedTrip) as TripStats;
        setCurrentTrip(trip);
        setIsTracking(true);
        
        const hasTask = await ExpoLocation.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(() => false);
        if (hasTask) {
          console.log('Restoring active background tracking');
          isBackgroundEnabled.current = true;
          setupBackgroundCallback();
          startDurationTimer(trip.startTime);
          
          const currentLocation = await ExpoLocation.getCurrentPositionAsync({
            accuracy: ExpoLocation.Accuracy.BestForNavigation,
          });
          processLocationUpdateBackground(currentLocation);
        } else {
          resumeTracking(trip);
        }
      }
    } catch (error) {
      console.error('Failed to restore tracking state:', error);
    }
  };

  const saveTrackingState = async (tracking: boolean, trip: TripStats | null) => {
    try {
      await AsyncStorage.setItem(TRACKING_STATE_KEY, tracking.toString());
      if (trip) {
        await AsyncStorage.setItem(CURRENT_TRIP_KEY, JSON.stringify(trip));
      } else {
        await AsyncStorage.removeItem(CURRENT_TRIP_KEY);
      }
    } catch (error) {
      console.error('Failed to save tracking state:', error);
    }
  };

  useEffect(() => {
    currentTripRef.current = currentTrip;
  }, [currentTrip]);

  useEffect(() => {
    tripsRef.current = trips;
  }, [trips]);

  const setupBackgroundCallback = useCallback(() => {
    console.log('Setting up background callback');
    backgroundLocationCallback = (location: ExpoLocation.LocationObject) => {
      processLocationUpdateBackground(location);
    };
  }, []);

  useEffect(() => {
    processLocationRef = (location: ExpoLocation.LocationObject) => {
      console.log('Background location update received, speed:', location.coords.speed);
      processLocationUpdateBackground(location);
    };
    return () => {
      processLocationRef = null;
    };
  });

  const startDurationTimer = (startTime: number) => {
    if (durationInterval.current) {
      clearInterval(durationInterval.current);
    }
    durationInterval.current = setInterval(() => {
      setCurrentTrip((prev) => {
        if (!prev) return prev;
        const elapsed = Math.max(0, (Date.now() - startTime) / 1000);
        const updated = { ...prev, duration: elapsed };
        AsyncStorage.setItem(CURRENT_TRIP_KEY, JSON.stringify(updated)).catch(console.error);
        return updated;
      });
    }, 1000);
  };

  const processLocationUpdateBackground = (location: ExpoLocation.LocationObject) => {
    const rawSpeed = Math.max(0, (location.coords.speed ?? 0) * 3.6);
    const speed = rawSpeed < SPEED_NOISE_THRESHOLD ? 0 : rawSpeed;
    const newLocation: LocationType = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      speed: speed,
      timestamp: location.timestamp,
    };

    console.log('Processing background location - raw speed:', rawSpeed, 'filtered speed:', speed);

    setCurrentSpeed(speed);
    setCurrentLocation(newLocation);
    
    currentSpeedRef.current = speed;

    calculateAcceleration(speed, location.timestamp);
    trackAccelerationTimes(speed, location.timestamp);

    setCurrentTrip((prev) => {
      if (!prev) return prev;

      const updatedLocations = [...prev.locations, newLocation];
      let distance = prev.distance;
      let corners = prev.corners;

      if (prev.locations.length > 0) {
        const lastLoc = prev.locations[prev.locations.length - 1];
        const dist = calculateDistance(
          lastLoc.latitude,
          lastLoc.longitude,
          newLocation.latitude,
          newLocation.longitude
        );
        distance += dist;

        if (location.coords.heading !== undefined && location.coords.heading !== null && location.coords.heading !== -1) {
          if (detectCorner(location.coords.heading, location.timestamp)) {
            corners++;
          }
        }
      }

      const duration = (Date.now() - prev.startTime) / 1000;
      const topSpeed = Math.max(prev.topSpeed, speed);
      const avgSpeed = distance > 0 ? (distance / duration) * 3600 : 0;

      const updated = {
        ...prev,
        locations: updatedLocations,
        distance,
        duration,
        topSpeed,
        avgSpeed,
        corners,
        acceleration: maxAcceleration.current,
        maxGForce: maxGForce.current,
        time0to100: time0to100.current ?? undefined,
        time0to200: time0to200.current ?? undefined,
        time0to300: time0to300.current ?? undefined,
      };
      
      AsyncStorage.setItem(CURRENT_TRIP_KEY, JSON.stringify(updated)).catch(console.error);
      return updated;
    });
  };

  const processLocationUpdate = (location: ExpoLocation.LocationObject) => {
    const rawSpeed = Math.max(0, (location.coords.speed ?? 0) * 3.6);
    const speed = rawSpeed < SPEED_NOISE_THRESHOLD ? 0 : rawSpeed;
    const newLocation: LocationType = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      speed: speed,
      timestamp: location.timestamp,
    };

    setCurrentSpeed(speed);
    setCurrentLocation(newLocation);

    calculateAcceleration(speed, location.timestamp);
    trackAccelerationTimes(speed, location.timestamp);

    setCurrentTrip((prev) => {
      if (!prev) return prev;

      const updatedLocations = [...prev.locations, newLocation];
      let distance = prev.distance;
      let corners = prev.corners;

      if (prev.locations.length > 0) {
        const lastLoc = prev.locations[prev.locations.length - 1];
        const dist = calculateDistance(
          lastLoc.latitude,
          lastLoc.longitude,
          newLocation.latitude,
          newLocation.longitude
        );
        distance += dist;

        if (location.coords.heading !== undefined && location.coords.heading !== null && location.coords.heading !== -1) {
          if (detectCorner(location.coords.heading, location.timestamp)) {
            corners++;
          }
        }
      }

      const duration = (Date.now() - prev.startTime) / 1000;
      const topSpeed = Math.max(prev.topSpeed, speed);
      const avgSpeed = distance > 0 ? (distance / duration) * 3600 : 0;

      const updated = {
        ...prev,
        locations: updatedLocations,
        distance,
        duration,
        topSpeed,
        avgSpeed,
        corners,
        acceleration: maxAcceleration.current,
        maxGForce: maxGForce.current,
        time0to100: time0to100.current ?? undefined,
        time0to200: time0to200.current ?? undefined,
        time0to300: time0to300.current ?? undefined,
      };
      
      AsyncStorage.setItem(CURRENT_TRIP_KEY, JSON.stringify(updated)).catch(console.error);
      return updated;
    });
  };

  const resumeTracking = async (trip: TripStats) => {
    try {
      await startLocationUpdates(trip.startTime);
    } catch (error) {
      console.error('Failed to resume tracking:', error);
    }
  };

  const saveTrips = async (newTrips: TripStats[]) => {
    try {
      await AsyncStorage.setItem(TRIPS_KEY, JSON.stringify(newTrips));
      setTrips(newTrips);
    } catch (error) {
      console.error('Failed to save trips:', error);
    }
  };

  const detectCorner = (newHeading: number, currentTime: number): boolean => {
    if (previousHeading.current === null) {
      previousHeading.current = newHeading;
      accumulatedHeadingChange.current = 0;
      return false;
    }

    let diff = Math.abs(newHeading - previousHeading.current);
    if (diff > 180) {
      diff = 360 - diff;
    }

    // Reset accumulation if too much time has passed since last significant change
    if (currentTime - lastCornerTime.current > CORNER_RESET_TIMEOUT) {
      accumulatedHeadingChange.current = 0;
    }

    // Accumulate heading changes for gradual turns
    if (diff >= CORNER_THRESHOLD) {
      accumulatedHeadingChange.current += diff;
      lastCornerTime.current = currentTime;
    }

    previousHeading.current = newHeading;

    // Detect corner when accumulated change exceeds threshold
    if (accumulatedHeadingChange.current >= CORNER_ACCUMULATION_THRESHOLD) {
      accumulatedHeadingChange.current = 0;
      return true;
    }

    return false;
  };

  const reverseGeocode = async (latitude: number, longitude: number): Promise<TripLocation> => {
    try {
      if (Platform.OS === 'web') {
        return { country: 'Unknown', city: 'Unknown' };
      }
      
      const results = await ExpoLocation.reverseGeocodeAsync({ latitude, longitude });
      if (results.length > 0) {
        const result = results[0];
        return {
          country: result.country || 'Unknown',
          city: result.city || result.subregion || result.region || 'Unknown',
        };
      }
    } catch (error) {
      console.error('Reverse geocode failed:', error);
    }
    return { country: 'Unknown', city: 'Unknown' };
  };

  const calculateAcceleration = (currentSpeedKmh: number, currentTime: number): number => {
    if (previousSpeedTime.current === 0) {
      previousSpeed.current = currentSpeedKmh;
      previousSpeedTime.current = currentTime;
      return 0;
    }

    const timeDiff = (currentTime - previousSpeedTime.current) / 1000;
    if (timeDiff <= 0) return 0;

    const speedDiffMs = (currentSpeedKmh - previousSpeed.current) / 3.6;
    const acceleration = speedDiffMs / timeDiff;

    previousSpeed.current = currentSpeedKmh;
    previousSpeedTime.current = currentTime;

    const absAcceleration = Math.abs(acceleration);
    if (absAcceleration > maxAcceleration.current) {
      maxAcceleration.current = absAcceleration;
    }

    const gForce = absAcceleration / 9.81;
    if (gForce > maxGForce.current) {
      maxGForce.current = gForce;
    }

    return acceleration;
  };

  const trackAccelerationTimes = (currentSpeedKmh: number, currentTime: number) => {
    const STANDING_THRESHOLD = 5;

    if (currentSpeedKmh < STANDING_THRESHOLD) {
      accelStartTime.current = currentTime;
      reached100.current = false;
      reached200.current = false;
      reached300.current = false;
    }

    if (accelStartTime.current === null) {
      accelStartTime.current = currentTime;
    }

    if (!reached100.current && currentSpeedKmh >= 100) {
      reached100.current = true;
      const timeSeconds = (currentTime - accelStartTime.current) / 1000;
      if (time0to100.current === null || timeSeconds < time0to100.current) {
        time0to100.current = timeSeconds;
      }
    }

    if (!reached200.current && currentSpeedKmh >= 200) {
      reached200.current = true;
      const timeSeconds = (currentTime - accelStartTime.current) / 1000;
      if (time0to200.current === null || timeSeconds < time0to200.current) {
        time0to200.current = timeSeconds;
      }
    }

    if (!reached300.current && currentSpeedKmh >= 300) {
      reached300.current = true;
      const timeSeconds = (currentTime - accelStartTime.current) / 1000;
      if (time0to300.current === null || timeSeconds < time0to300.current) {
        time0to300.current = timeSeconds;
      }
    }
  };

  const startLocationUpdates = async (startTime: number) => {
    if (Platform.OS === 'web') {
      const mockInterval = setInterval(() => {
        const mockSpeed = Math.random() * 60 + 20;
        setCurrentSpeed(mockSpeed);
        
        calculateAcceleration(mockSpeed, Date.now());
        trackAccelerationTimes(mockSpeed, Date.now());
        
        setCurrentTrip((prev) => {
          if (!prev) return prev;
          
          const duration = (Date.now() - prev.startTime) / 1000;
          const distance = prev.distance + (mockSpeed / 3600) * 1;
          const topSpeed = Math.max(prev.topSpeed, mockSpeed);
          const corners = prev.corners + (Math.random() > 0.95 ? 1 : 0);
          
          return {
            ...prev,
            distance,
            duration,
            topSpeed,
            avgSpeed: distance > 0 ? (distance / duration) * 3600 : 0,
            corners,
            acceleration: maxAcceleration.current,
            maxGForce: maxGForce.current,
            time0to100: time0to100.current ?? undefined,
            time0to200: time0to200.current ?? undefined,
            time0to300: time0to300.current ?? undefined,
          };
        });
      }, 1000);
      
      (locationSubscription as any).current = { remove: () => clearInterval(mockInterval) };
      return;
    }

    const { status: backgroundStatus } = await ExpoLocation.requestBackgroundPermissionsAsync();
    
    if (backgroundStatus === 'granted') {
      console.log('Background location permission granted, starting background updates');
      isBackgroundEnabled.current = true;
      setupBackgroundCallback();
      
      await ExpoLocation.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
        accuracy: ExpoLocation.Accuracy.BestForNavigation,
        timeInterval: 1000,
        distanceInterval: 5,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'TripStats Tracking',
          notificationBody: 'Recording your trip in the background',
          notificationColor: '#CC0000',
        },
      });
    } else {
      console.log('Background location not granted, using foreground only');
      isBackgroundEnabled.current = false;
      
      locationSubscription.current = await ExpoLocation.watchPositionAsync(
        {
          accuracy: ExpoLocation.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 5,
        },
        (location) => processLocationUpdate(location)
      );
    }
    
    startDurationTimer(startTime);
  };

  const startTracking = async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status: foregroundStatus } = await ExpoLocation.requestForegroundPermissionsAsync();
        if (foregroundStatus !== 'granted') {
          Alert.alert('Permission Required', 'Location permission is required to track trips.');
          return;
        }
      }

      const newTrip: TripStats = {
        id: Date.now().toString(),
        startTime: Date.now(),
        distance: 0,
        duration: 0,
        avgSpeed: 0,
        topSpeed: 0,
        corners: 0,
        acceleration: 0,
        maxGForce: 0,
        locations: [],
      };

      setCurrentTrip(newTrip);
      setIsTracking(true);
      await saveTrackingState(true, newTrip);

      previousHeading.current = null;
      accumulatedHeadingChange.current = 0;
      lastCornerTime.current = 0;
      previousSpeed.current = 0;
      previousSpeedTime.current = 0;
      maxAcceleration.current = 0;
      maxGForce.current = 0;
      accelStartTime.current = null;
      reached100.current = false;
      reached200.current = false;
      reached300.current = false;
      time0to100.current = null;
      time0to200.current = null;
      time0to300.current = null;

      await startLocationUpdates(newTrip.startTime);
    } catch (error) {
      console.error('Failed to start tracking:', error);
      Alert.alert('Error', 'Failed to start tracking');
    }
  };

  const stopTracking = useCallback(async (carModel?: string) => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }

    if (isBackgroundEnabled.current && Platform.OS !== 'web') {
      try {
        const hasTask = await ExpoLocation.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
        if (hasTask) {
          await ExpoLocation.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
        }
      } catch (error) {
        console.error('Failed to stop background location:', error);
      }
      isBackgroundEnabled.current = false;
      backgroundLocationCallback = null;
    }

    if (durationInterval.current) {
      clearInterval(durationInterval.current);
      durationInterval.current = null;
    }

    if (currentTrip) {
      let tripLocation: TripLocation = { country: 'Unknown', city: 'Unknown' };
      
      if (currentTrip.locations.length > 0) {
        const firstLocation = currentTrip.locations[0];
        tripLocation = await reverseGeocode(firstLocation.latitude, firstLocation.longitude);
      }

      const finalTrip: TripStats = {
        ...currentTrip,
        endTime: Date.now(),
        acceleration: maxAcceleration.current,
        maxGForce: maxGForce.current,
        location: tripLocation,
        carModel: carModel || currentTrip.carModel,
        time0to100: time0to100.current ?? undefined,
        time0to200: time0to200.current ?? undefined,
        time0to300: time0to300.current ?? undefined,
      };

      const updatedTrips = [finalTrip, ...trips];
      saveTrips(updatedTrips);
      setLastSavedTrip(finalTrip);
    }

    setIsTracking(false);
    setCurrentTrip(null);
    setCurrentSpeed(0);
    setCurrentLocation(null);
    await saveTrackingState(false, null);
    previousHeading.current = null;
    accumulatedHeadingChange.current = 0;
    lastCornerTime.current = 0;
    previousSpeed.current = 0;
    previousSpeedTime.current = 0;
    maxAcceleration.current = 0;
    maxGForce.current = 0;
    accelStartTime.current = null;
    reached100.current = false;
    reached200.current = false;
    reached300.current = false;
    time0to100.current = null;
    time0to200.current = null;
    time0to300.current = null;
  }, [currentTrip, trips]);

  const clearLastSavedTrip = useCallback(() => {
    setLastSavedTrip(null);
  }, []);

  const updateTripCarModel = useCallback(async (tripId: string, carModel: string) => {
    const updatedTrips = trips.map((trip) =>
      trip.id === tripId ? { ...trip, carModel } : trip
    );
    await saveTrips(updatedTrips);
  }, [trips]);

  const getUniqueCountries = useCallback(() => {
    const countries = trips
      .map((trip) => trip.location?.country)
      .filter((country): country is string => !!country && country !== 'Unknown');
    return [...new Set(countries)];
  }, [trips]);

  const getUniqueCities = useCallback((country?: string) => {
    const filteredTrips = country
      ? trips.filter((trip) => trip.location?.country === country)
      : trips;
    const cities = filteredTrips
      .map((trip) => trip.location?.city)
      .filter((city): city is string => !!city && city !== 'Unknown');
    return [...new Set(cities)];
  }, [trips]);

  const getUniqueCarModels = useCallback(() => {
    const models = trips
      .map((trip) => trip.carModel)
      .filter((model): model is string => !!model);
    return [...new Set(models)];
  }, [trips]);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const toRad = (value: number): number => {
    return (value * Math.PI) / 180;
  };

  return {
    trips,
    currentTrip,
    isTracking,
    currentSpeed,
    currentLocation,
    lastSavedTrip,
    startTracking,
    stopTracking,
    updateTripCarModel,
    getUniqueCountries,
    getUniqueCities,
    getUniqueCarModels,
    clearLastSavedTrip,
  };
});
