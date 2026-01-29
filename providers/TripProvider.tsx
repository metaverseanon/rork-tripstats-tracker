import createContextHook from '@nkzw/create-context-hook';
import * as ExpoLocation from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Alert, AppState, AppStateStatus } from 'react-native';
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
const SPEED_STALE_TIMEOUT = 3000;
const CURRENT_SPEED_KEY = 'current_speed';
const LAST_LOCATION_TIME_KEY = 'last_location_time';

let backgroundLocationCallback: ((location: ExpoLocation.LocationObject) => void) | null = null;
let taskDefined = false;
let processLocationRef: ((location: ExpoLocation.LocationObject) => void) | null = null;

const saveBackgroundSpeed = async (speed: number, timestamp: number) => {
  try {
    await AsyncStorage.multiSet([
      [CURRENT_SPEED_KEY, speed.toString()],
      [LAST_LOCATION_TIME_KEY, timestamp.toString()],
    ]);
  } catch (e) {
    console.error('Failed to save background speed:', e);
  }
};

const defineBackgroundTask = () => {
  if (taskDefined || Platform.OS === 'web') return;
  
  // Mark as defined immediately to prevent multiple attempts
  taskDefined = true;
  
  try {
    // Check if TaskManager is available
    if (!TaskManager || typeof TaskManager.defineTask !== 'function') {
      console.warn('TaskManager not available');
      return;
    }
    
    TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
      if (error) {
        console.error('Background location task error:', error);
        return;
      }
      if (data) {
        const { locations } = data as { locations: ExpoLocation.LocationObject[] };
        if (locations && locations.length > 0) {
          console.log('Background task received locations:', locations.length);
          const latestLocation = locations[locations.length - 1];
          const rawSpeed = Math.max(0, (latestLocation.coords.speed ?? 0) * 3.6);
          const speed = rawSpeed < 5 ? 0 : rawSpeed;
          
          await saveBackgroundSpeed(speed, Date.now());
          
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
    console.log('Background task defined successfully');
  } catch (error) {
    console.warn('Failed to define background task:', error);
  }
};

// Define task safely - only on native and with proper guards
if (Platform.OS !== 'web') {
  // Use a longer delay and wrap in try-catch
  try {
    setTimeout(() => {
      try {
        defineBackgroundTask();
      } catch (e) {
        console.warn('Background task definition failed:', e);
      }
    }, 500);
  } catch (e) {
    console.warn('Failed to schedule background task definition:', e);
  }
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
  const lastLocationUpdateTime = useRef<number>(0);
  const staleSpeedInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const isTrackingRef = useRef<boolean>(false);

  const refreshSpeedFromStorage = useCallback(async () => {
    if (!isTrackingRef.current) return;
    
    try {
      const [[, speedStr], [, timeStr]] = await AsyncStorage.multiGet([CURRENT_SPEED_KEY, LAST_LOCATION_TIME_KEY]);
      const storedSpeed = speedStr ? parseFloat(speedStr) : 0;
      const storedTime = timeStr ? parseInt(timeStr, 10) : 0;
      const now = Date.now();
      
      console.log('Refreshing speed from storage:', storedSpeed, 'time since update:', now - storedTime, 'ms');
      
      if (storedTime > 0 && (now - storedTime) < SPEED_STALE_TIMEOUT) {
        setCurrentSpeed(storedSpeed);
        currentSpeedRef.current = storedSpeed;
        lastLocationUpdateTime.current = storedTime;
      } else {
        console.log('Stored speed is stale or missing, setting to 0');
        setCurrentSpeed(0);
        currentSpeedRef.current = 0;
      }
      
      const savedTrip = await AsyncStorage.getItem(CURRENT_TRIP_KEY);
      if (savedTrip) {
        const trip = JSON.parse(savedTrip) as TripStats;
        setCurrentTrip(trip);
      }
    } catch (e) {
      console.error('Failed to refresh speed from storage:', e);
    }
  }, []);

  const fetchFreshLocation = useCallback(async () => {
    if (!isTrackingRef.current || Platform.OS === 'web') return;
    
    try {
      console.log('Fetching fresh location after app resume');
      const location = await ExpoLocation.getCurrentPositionAsync({
        accuracy: ExpoLocation.Accuracy.BestForNavigation,
      });
      
      const rawSpeed = Math.max(0, (location.coords.speed ?? 0) * 3.6);
      const speed = rawSpeed < SPEED_NOISE_THRESHOLD ? 0 : rawSpeed;
      
      console.log('Fresh location speed:', speed);
      
      const now = Date.now();
      lastLocationUpdateTime.current = now;
      setCurrentSpeed(speed);
      currentSpeedRef.current = speed;
      
      await saveBackgroundSpeed(speed, now);
      
      processLocationUpdateBackground(location);
    } catch (error) {
      console.error('Failed to fetch fresh location:', error);
      setCurrentSpeed(0);
      currentSpeedRef.current = 0;
    }
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
      console.log('AppState changed from', appState.current, 'to', nextAppState);
      
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('App came to foreground, refreshing speed and fetching fresh location');
        
        await refreshSpeedFromStorage();
        
        fetchFreshLocation();
        
        if (isTrackingRef.current && staleSpeedInterval.current === null) {
          startStaleSpeedDetection();
        }
      }
      
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [refreshSpeedFromStorage, fetchFreshLocation]);

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
        try {
          const parsedTrips = JSON.parse(stored) as TripStats[];
          // Validate the data structure
          if (Array.isArray(parsedTrips)) {
            // Clean up oversized location arrays to prevent future issues
            const cleanedTrips = parsedTrips.map(trip => ({
              ...trip,
              locations: Array.isArray(trip.locations) 
                ? trip.locations.slice(-500) // Keep only last 500 locations per trip
                : [],
            }));
            setTrips(cleanedTrips);
            // Save cleaned data back
            await AsyncStorage.setItem(TRIPS_KEY, JSON.stringify(cleanedTrips));
          } else {
            console.error('Invalid trips data format, resetting');
            setTrips([]);
            await AsyncStorage.removeItem(TRIPS_KEY);
          }
        } catch (parseError) {
          console.error('Failed to parse trips JSON, data may be corrupted:', parseError);
          // Data is corrupted, reset it
          setTrips([]);
          await AsyncStorage.removeItem(TRIPS_KEY);
          Alert.alert(
            'Data Recovery',
            'Some trip data was corrupted and has been reset. Your future trips will be saved normally.',
            [{ text: 'OK' }]
          );
        }
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
        isTrackingRef.current = true;
        
        if (Platform.OS === 'web') {
          resumeTracking(trip);
          return;
        }
        
        let hasTask = false;
        try {
          hasTask = await ExpoLocation.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
        } catch (e) {
          console.warn('Could not check background task status:', e);
        }
        
        if (hasTask) {
          console.log('Restoring active background tracking');
          isBackgroundEnabled.current = true;
          setupBackgroundCallback();
          startDurationTimer(trip.startTime);
          
          try {
            const currentLocation = await ExpoLocation.getCurrentPositionAsync({
              accuracy: ExpoLocation.Accuracy.BestForNavigation,
            });
            processLocationUpdateBackground(currentLocation);
          } catch (locError) {
            console.warn('Could not get current position:', locError);
          }
        } else {
          resumeTracking(trip);
        }
      }
    } catch (error) {
      console.error('Failed to restore tracking state:', error);
      // Reset tracking state on error to prevent crash loops
      try {
        await AsyncStorage.removeItem(TRACKING_STATE_KEY);
        await AsyncStorage.removeItem(CURRENT_TRIP_KEY);
      } catch (e) {
        console.warn('Could not clear tracking state:', e);
      }
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

  const startStaleSpeedDetection = () => {
    if (staleSpeedInterval.current) {
      clearInterval(staleSpeedInterval.current);
    }
    lastLocationUpdateTime.current = Date.now();
    staleSpeedInterval.current = setInterval(() => {
      const timeSinceLastUpdate = Date.now() - lastLocationUpdateTime.current;
      if (lastLocationUpdateTime.current > 0 && timeSinceLastUpdate > SPEED_STALE_TIMEOUT && currentSpeedRef.current > 0) {
        console.log('Speed stale detected, no location update for', timeSinceLastUpdate, 'ms, setting speed to 0');
        setCurrentSpeed(0);
        currentSpeedRef.current = 0;
      }
    }, 1000);
  };

  const stopStaleSpeedDetection = () => {
    if (staleSpeedInterval.current) {
      clearInterval(staleSpeedInterval.current);
      staleSpeedInterval.current = null;
    }
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

    const now = Date.now();
    lastLocationUpdateTime.current = now;
    setCurrentSpeed(speed);
    setCurrentLocation(newLocation);
    
    currentSpeedRef.current = speed;
    
    saveBackgroundSpeed(speed, now).catch(console.error);

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

    const now = Date.now();
    lastLocationUpdateTime.current = now;
    setCurrentSpeed(speed);
    currentSpeedRef.current = speed;
    setCurrentLocation(newLocation);
    
    saveBackgroundSpeed(speed, now).catch(console.error);

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
      // Limit locations to prevent data bloat
      const tripsToSave = newTrips.map(trip => ({
        ...trip,
        locations: Array.isArray(trip.locations) 
          ? trip.locations.slice(-500) // Keep only last 500 locations
          : [],
      }));
      await AsyncStorage.setItem(TRIPS_KEY, JSON.stringify(tripsToSave));
      setTrips(tripsToSave);
    } catch (error) {
      console.error('Failed to save trips:', error);
      // If save fails due to size, try saving without locations
      try {
        const minimalTrips = newTrips.map(trip => ({
          ...trip,
          locations: [],
        }));
        await AsyncStorage.setItem(TRIPS_KEY, JSON.stringify(minimalTrips));
        setTrips(minimalTrips);
        console.log('Saved trips without locations due to storage constraints');
      } catch (fallbackError) {
        console.error('Failed to save even minimal trips:', fallbackError);
      }
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
        distanceInterval: 1,
        showsBackgroundLocationIndicator: true,
        activityType: ExpoLocation.ActivityType.AutomotiveNavigation,
        pausesUpdatesAutomatically: false,
        foregroundService: {
          notificationTitle: 'TripStats Tracking',
          notificationBody: 'Recording your trip in the background',
          notificationColor: '#CC0000',
        },
      });
      startStaleSpeedDetection();
    } else {
      console.log('Background location not granted, using foreground only');
      isBackgroundEnabled.current = false;
      
      locationSubscription.current = await ExpoLocation.watchPositionAsync(
        {
          accuracy: ExpoLocation.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 0,
        },
        (location) => processLocationUpdate(location)
      );
      startStaleSpeedDetection();
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
      isTrackingRef.current = true;
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

    stopStaleSpeedDetection();

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
    isTrackingRef.current = false;
    setCurrentTrip(null);
    setCurrentSpeed(0);
    setCurrentLocation(null);
    await saveTrackingState(false, null);
    await AsyncStorage.multiRemove([CURRENT_SPEED_KEY, LAST_LOCATION_TIME_KEY]).catch(console.error);
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
    lastLocationUpdateTime.current = 0;
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
