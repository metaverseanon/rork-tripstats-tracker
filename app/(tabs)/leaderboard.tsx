import { useState, useMemo, useCallback, ReactNode, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Modal, Pressable, TextInput, Image, Platform, Alert, ActivityIndicator, Linking } from 'react-native';
import { Trophy, Zap, Navigation, Gauge, ChevronDown, X, MapPin, Car, Filter, Activity, Route, Search, Clock, Calendar, CornerDownRight, ChevronRight, Timer, Users, Send, Bell, Check, XCircle, Share2, Navigation2, MessageCircle } from 'lucide-react-native';
import * as Location from 'expo-location';
import type { DriveMeetup } from '@/types/meetup';
import * as Haptics from 'expo-haptics';
import { trpc } from '@/lib/trpc';
import MapView, { Polyline, Marker } from 'react-native-maps';
import { useTrips } from '@/providers/TripProvider';
import { useSettings } from '@/providers/SettingsProvider';
import { useUser } from '@/providers/UserProvider';
import { COUNTRIES, getCountryByCode } from '@/constants/countries';
import { CAR_BRANDS, getModelsForBrand } from '@/constants/cars';
import { LeaderboardCategory, LeaderboardFilters, TripStats } from '@/types/trip';
import { ThemeColors } from '@/constants/colors';

type FilterType = 'country' | 'city' | 'carBrand' | 'carModel';
type TimePeriod = 'today' | 'week' | 'month' | 'year' | 'all';

export default function LeaderboardScreen() {
  const { trips } = useTrips();
  const { convertSpeed, convertDistance, getSpeedLabel, getDistanceLabel, getAccelerationLabel, colors } = useSettings();
  const { user } = useUser();
  const [activeCategory, setActiveCategory] = useState<LeaderboardCategory>('topSpeed');
  const [filters, setFilters] = useState<LeaderboardFilters>({});
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [activeFilterType, setActiveFilterType] = useState<FilterType | null>(null);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [selectedTrip, setSelectedTrip] = useState<TripStats | null>(null);
  const [showTripDetail, setShowTripDetail] = useState(false);
  const [showNearbyDrivers, setShowNearbyDrivers] = useState(false);
  const [pingingUserId, setPingingUserId] = useState<string | null>(null);
  const [showMeetupsModal, setShowMeetupsModal] = useState(false);
  const [respondingMeetupId, setRespondingMeetupId] = useState<string | null>(null);
  const [sharingLocationMeetupId, setSharingLocationMeetupId] = useState<string | null>(null);
  const [selectedMeetup, setSelectedMeetup] = useState<DriveMeetup | null>(null);
  const [showMeetupDetail, setShowMeetupDetail] = useState(false);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('all');

  const styles = useMemo(() => createStyles(colors), [colors]);

  const nearbyUsersQuery = trpc.user.getNearbyUsers.useQuery(
    {
      userId: user?.id || '',
      country: user?.country,
      city: user?.city,
    },
    {
      enabled: !!user?.id && !!(user?.country || user?.city),
    }
  );

  const meetupsQuery = trpc.notifications.getMeetups.useQuery(
    { userId: user?.id || '' },
    { enabled: !!user?.id, refetchInterval: 30000 }
  );

  const sendPingMutation = trpc.notifications.sendDrivePing.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Ping Sent!', 'Your drive invite has been sent.');
        meetupsQuery.refetch();
      } else {
        Alert.alert('Could not send', data.message || 'User may not have notifications enabled.');
      }
      setPingingUserId(null);
    },
    onError: (error) => {
      console.error('Failed to send ping:', error);
      Alert.alert('Error', 'Failed to send drive invite. Please try again.');
      setPingingUserId(null);
    },
  });

  const respondToPingMutation = trpc.notifications.respondToPing.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        meetupsQuery.refetch();
        if (data.status === 'accepted') {
          Alert.alert('Meetup Confirmed!', 'You can now share your location with the driver.');
        }
      }
      setRespondingMeetupId(null);
    },
    onError: (error) => {
      console.error('Failed to respond to ping:', error);
      Alert.alert('Error', 'Failed to respond. Please try again.');
      setRespondingMeetupId(null);
    },
  });

  const shareLocationMutation = trpc.notifications.shareLocation.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Location Shared!', 'The other driver can now see your location.');
        meetupsQuery.refetch();
      } else {
        Alert.alert('Error', data.message || 'Failed to share location.');
      }
      setSharingLocationMeetupId(null);
    },
    onError: (error) => {
      console.error('Failed to share location:', error);
      Alert.alert('Error', 'Failed to share location. Please try again.');
      setSharingLocationMeetupId(null);
    },
  });

  const cancelMeetupMutation = trpc.notifications.cancelMeetup.useMutation({
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      meetupsQuery.refetch();
      setShowMeetupDetail(false);
      setSelectedMeetup(null);
    },
  });

  const handlePingUser = useCallback((targetUserId: string, targetUserName: string, targetUserCar?: string) => {
    if (!user) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPingingUserId(targetUserId);
    
    const carInfo = user.carBrand && user.carModel 
      ? `${user.carBrand} ${user.carModel}` 
      : undefined;
    
    sendPingMutation.mutate({
      fromUserId: user.id,
      fromUserName: user.displayName,
      fromUserCar: carInfo,
      toUserId: targetUserId,
      toUserName: targetUserName,
      toUserCar: targetUserCar,
    });
  }, [user, sendPingMutation]);

  const handleRespondToPing = useCallback((meetupId: string, response: 'accepted' | 'declined') => {
    if (!user) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRespondingMeetupId(meetupId);
    
    respondToPingMutation.mutate({
      meetupId,
      response,
      responderId: user.id,
      responderName: user.displayName,
    });
  }, [user, respondToPingMutation]);

  const handleShareLocation = useCallback(async (meetup: DriveMeetup) => {
    if (!user) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSharingLocationMeetupId(meetup.id);
    
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to share your location.');
        setSharingLocationMeetupId(null);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      shareLocationMutation.mutate({
        meetupId: meetup.id,
        userId: user.id,
        userName: user.displayName,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (error) {
      console.error('Failed to get location:', error);
      Alert.alert('Error', 'Failed to get your location. Please try again.');
      setSharingLocationMeetupId(null);
    }
  }, [user, shareLocationMutation]);

  const handleNavigateToLocation = useCallback((latitude: number, longitude: number) => {
    const url = Platform.select({
      ios: `maps://app?daddr=${latitude},${longitude}`,
      android: `google.navigation:q=${latitude},${longitude}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
    });
    
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`);
    });
  }, []);

  const handleCancelMeetup = useCallback((meetup: DriveMeetup) => {
    if (!user) return;
    
    Alert.alert(
      'Cancel Meetup',
      'Are you sure you want to cancel this meetup?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: () => {
            cancelMeetupMutation.mutate({
              meetupId: meetup.id,
              userId: user.id,
              userName: user.displayName,
            });
          },
        },
      ]
    );
  }, [user, cancelMeetupMutation]);

  const nearbyUsers = nearbyUsersQuery.data || [];
  const meetups = meetupsQuery.data || [];

  const pendingIncomingPings = useMemo(() => {
    return meetups.filter(m => m.status === 'pending' && m.toUserId === user?.id);
  }, [meetups, user?.id]);

  const activeMeetups = useMemo(() => {
    return meetups.filter(m => m.status === 'accepted');
  }, [meetups]);

  const pendingOutgoingPings = useMemo(() => {
    return meetups.filter(m => m.status === 'pending' && m.fromUserId === user?.id);
  }, [meetups, user?.id]);

  const CATEGORIES = useMemo(() => [
    { key: 'topSpeed' as LeaderboardCategory, label: 'Top Speed', icon: <Zap size={16} color={colors.warning} /> },
    { key: 'distance' as LeaderboardCategory, label: 'Trip Distance', icon: <Navigation size={16} color={colors.accent} /> },
    { key: 'totalDistance' as LeaderboardCategory, label: 'All-Time Distance', icon: <Route size={16} color={colors.primary} /> },
    { key: 'acceleration' as LeaderboardCategory, label: 'Acceleration', icon: <Gauge size={16} color={colors.success} /> },
    { key: 'gForce' as LeaderboardCategory, label: 'Max G-Force', icon: <Activity size={16} color={colors.danger} /> },
    { key: 'zeroToHundred' as LeaderboardCategory, label: getAccelerationLabel('0-100'), icon: <Timer size={16} color={colors.primary} /> },
    { key: 'zeroToTwoHundred' as LeaderboardCategory, label: getAccelerationLabel('0-200'), icon: <Timer size={16} color={colors.accent} /> },
  ], [colors, getAccelerationLabel]);

  const activeCategory_data = useMemo(() => {
    return CATEGORIES.find(c => c.key === activeCategory);
  }, [CATEGORIES, activeCategory]);

  const countries = useMemo(() => COUNTRIES.map(c => ({ code: c.code, name: c.name, flag: c.flag })), []);
  
  const cities = useMemo(() => {
    if (!filters.country) return [];
    const countryData = COUNTRIES.find(c => c.name === filters.country);
    if (countryData) {
      return [...countryData.cities].sort((a, b) => a.localeCompare(b));
    }
    const citiesFromTrips = trips
      .filter(trip => trip.location?.country === filters.country)
      .map(trip => trip.location?.city)
      .filter((city): city is string => !!city && city !== 'Unknown');
    return [...new Set(citiesFromTrips)].sort((a, b) => a.localeCompare(b));
  }, [trips, filters.country]);
  
  const carBrands = useMemo(() => {
    return CAR_BRANDS.map(brand => brand.name);
  }, []);

  const carModels = useMemo(() => {
    if (!filters.carBrand) return [];
    return getModelsForBrand(filters.carBrand);
  }, [filters.carBrand]);

  const TIME_PERIODS: { key: TimePeriod; label: string }[] = useMemo(() => [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'Week' },
    { key: 'month', label: 'Month' },
    { key: 'year', label: 'Year' },
    { key: 'all', label: 'All Time' },
  ], []);

  const getTimePeriodStart = useCallback((period: TimePeriod): number => {
    const now = new Date();
    switch (period) {
      case 'today':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      case 'week':
        const dayOfWeek = now.getDay();
        const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
        return startOfWeek.getTime();
      case 'month':
        return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      case 'year':
        return new Date(now.getFullYear(), 0, 1).getTime();
      case 'all':
      default:
        return 0;
    }
  }, []);

  const matchesCountryFilter = useCallback((tripCountry: string | undefined, filterCountry: string) => {
    if (!tripCountry) return false;
    if (tripCountry === filterCountry) return true;
    
    const tripCountryLower = tripCountry.toLowerCase();
    const filterCountryLower = filterCountry.toLowerCase();
    if (tripCountryLower === filterCountryLower) return true;
    
    const selectedCountry = COUNTRIES.find(c => c.name === filterCountry);
    if (!selectedCountry) return false;
    
    const nativeNames: Record<string, string[]> = {
      'HR': ['hrvatska', 'croatia'],
      'DE': ['deutschland', 'germany'],
      'ES': ['españa', 'spain'],
      'FR': ['france'],
      'IT': ['italia', 'italy'],
      'PL': ['polska', 'poland'],
      'NL': ['nederland', 'netherlands'],
      'PT': ['portugal'],
      'AT': ['österreich', 'austria'],
      'CH': ['schweiz', 'suisse', 'svizzera', 'switzerland'],
      'BE': ['belgique', 'belgië', 'belgium'],
      'CZ': ['česko', 'czech republic', 'czechia'],
      'HU': ['magyarország', 'hungary'],
      'SK': ['slovensko', 'slovakia'],
      'SI': ['slovenija', 'slovenia'],
      'RS': ['srbija', 'serbia'],
      'BA': ['bosna i hercegovina', 'bosnia and herzegovina'],
      'ME': ['crna gora', 'montenegro'],
      'MK': ['северна македонија', 'north macedonia'],
      'AL': ['shqipëria', 'albania'],
      'GR': ['ελλάδα', 'greece'],
      'BG': ['българия', 'bulgaria'],
      'RO': ['românia', 'romania'],
      'UA': ['україна', 'ukraine'],
      'RU': ['россия', 'russia'],
      'TR': ['türkiye', 'turkey'],
      'SE': ['sverige', 'sweden'],
      'NO': ['norge', 'norway'],
      'DK': ['danmark', 'denmark'],
      'FI': ['suomi', 'finland'],
      'JP': ['日本', 'japan'],
      'CN': ['中国', 'china'],
      'KR': ['대한민국', 'south korea'],
      'BR': ['brasil', 'brazil'],
      'MX': ['méxico', 'mexico'],
      'AR': ['argentina'],
    };
    
    const alternateNames = nativeNames[selectedCountry.code] || [];
    return alternateNames.some(name => tripCountryLower === name || tripCountryLower.includes(name));
  }, []);

  const filteredTrips = useMemo(() => {
    const timePeriodStart = getTimePeriodStart(timePeriod);
    
    return trips.filter((trip) => {
      if (timePeriod !== 'all' && trip.startTime < timePeriodStart) return false;
      if (filters.country && !matchesCountryFilter(trip.location?.country, filters.country)) return false;
      if (filters.city && trip.location?.city !== filters.city) return false;
      if (filters.carBrand && filters.carModel) {
        const fullCarModel = `${filters.carBrand} ${filters.carModel}`;
        if (trip.carModel !== fullCarModel) return false;
      } else if (filters.carBrand) {
        if (!trip.carModel?.startsWith(filters.carBrand)) return false;
      }
      return true;
    });
  }, [trips, filters, timePeriod, getTimePeriodStart]);

  const leaderboardData = useMemo(() => {
    let sorted: TripStats[] = [];

    switch (activeCategory) {
      case 'topSpeed':
        sorted = [...filteredTrips]
          .filter((t) => t.topSpeed > 0)
          .sort((a, b) => b.topSpeed - a.topSpeed);
        break;
      case 'distance':
        sorted = [...filteredTrips]
          .filter((t) => t.distance > 0)
          .sort((a, b) => b.distance - a.distance);
        break;
      case 'totalDistance':
        sorted = [...filteredTrips]
          .filter((t) => t.distance > 0)
          .sort((a, b) => b.distance - a.distance);
        break;
      case 'acceleration':
        sorted = [...filteredTrips]
          .filter((t) => (t.acceleration ?? 0) > 0)
          .sort((a, b) => (b.acceleration ?? 0) - (a.acceleration ?? 0));
        break;
      case 'gForce':
        sorted = [...filteredTrips]
          .filter((t) => (t.maxGForce ?? 0) > 0)
          .sort((a, b) => (b.maxGForce ?? 0) - (a.maxGForce ?? 0));
        break;
      case 'zeroToHundred':
        sorted = [...filteredTrips]
          .filter((t) => (t.time0to100 ?? 0) > 0)
          .sort((a, b) => (a.time0to100 ?? Infinity) - (b.time0to100 ?? Infinity));
        break;
      case 'zeroToTwoHundred':
        sorted = [...filteredTrips]
          .filter((t) => (t.time0to200 ?? 0) > 0)
          .sort((a, b) => (a.time0to200 ?? Infinity) - (b.time0to200 ?? Infinity));
        break;
    }

    return sorted.slice(0, 10);
  }, [filteredTrips, activeCategory]);

  const getMedalColor = (rank: number) => {
    switch (rank) {
      case 1:
        return '#FFD700';
      case 2:
        return '#C0C0C0';
      case 3:
        return '#CD7F32';
      default:
        return colors.textLight;
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatValue = (trip: TripStats) => {
    switch (activeCategory) {
      case 'topSpeed':
        return `${Math.round(convertSpeed(trip.topSpeed))} ${getSpeedLabel()}`;
      case 'distance':
      case 'totalDistance':
        return `${convertDistance(trip.distance).toFixed(2)} ${getDistanceLabel()}`;
      case 'acceleration':
        return `${(trip.acceleration ?? 0).toFixed(2)} m/s²`;
      case 'gForce':
        return `${(trip.maxGForce ?? 0).toFixed(2)} G`;
      case 'zeroToHundred':
        return `${(trip.time0to100 ?? 0).toFixed(2)}s`;
      case 'zeroToTwoHundred':
        return `${(trip.time0to200 ?? 0).toFixed(2)}s`;
    }
  };

  const openTripDetail = useCallback((trip: TripStats) => {
    setSelectedTrip(trip);
    setShowTripDetail(true);
  }, []);

  const closeTripDetail = useCallback(() => {
    setShowTripDetail(false);
    setSelectedTrip(null);
  }, []);

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}h ${mins}m ${secs}s`;
    }
    return `${mins}m ${secs}s`;
  };

  const getMapRegion = (locations: { latitude: number; longitude: number }[]) => {
    if (locations.length === 0) {
      return { latitude: 0, longitude: 0, latitudeDelta: 0.01, longitudeDelta: 0.01 };
    }
    const lats = locations.map(l => l.latitude);
    const lngs = locations.map(l => l.longitude);
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
  };

  const getSecondaryStats = (trip: TripStats) => {
    const stats: { label: string; value: string; icon: ReactNode }[] = [];
    
    if (activeCategory !== 'topSpeed' && trip.topSpeed > 0) {
      stats.push({
        label: 'Top Speed',
        value: `${Math.round(convertSpeed(trip.topSpeed))} ${getSpeedLabel()}`,
        icon: <Zap size={12} color={colors.warning} />,
      });
    }
    if (activeCategory !== 'distance' && activeCategory !== 'totalDistance' && trip.distance > 0) {
      stats.push({
        label: 'Distance',
        value: `${convertDistance(trip.distance).toFixed(1)} ${getDistanceLabel()}`,
        icon: <Navigation size={12} color={colors.accent} />,
      });
    }
    if (activeCategory !== 'gForce' && (trip.maxGForce ?? 0) > 0) {
      stats.push({
        label: 'G-Force',
        value: `${(trip.maxGForce ?? 0).toFixed(2)} G`,
        icon: <Activity size={12} color={colors.danger} />,
      });
    }
    if (activeCategory !== 'acceleration' && (trip.acceleration ?? 0) > 0) {
      stats.push({
        label: 'Accel',
        value: `${(trip.acceleration ?? 0).toFixed(1)} m/s²`,
        icon: <Gauge size={12} color={colors.success} />,
      });
    }

    return stats;
  };

  const openFilterModal = useCallback((type: FilterType) => {
    setActiveFilterType(type);
    setCountrySearch('');
    setShowFilterModal(true);
  }, []);

  const selectFilter = useCallback((value: string | undefined) => {
    if (!activeFilterType) return;

    setFilters((prev) => {
      const newFilters = { ...prev };
      
      if (value === undefined) {
        delete newFilters[activeFilterType];
        if (activeFilterType === 'country') {
          delete newFilters.city;
        }
        if (activeFilterType === 'carBrand') {
          delete newFilters.carModel;
        }
      } else {
        newFilters[activeFilterType] = value;
        if (activeFilterType === 'country') {
          delete newFilters.city;
        }
        if (activeFilterType === 'carBrand') {
          delete newFilters.carModel;
        }
      }
      
      return newFilters;
    });
    
    setShowFilterModal(false);
    setActiveFilterType(null);
  }, [activeFilterType]);

  const getFilterOptions = (): { value: string; label: string }[] => {
    switch (activeFilterType) {
      case 'country':
        const filteredCountries = countrySearch
          ? countries.filter(c => c.name.toLowerCase().includes(countrySearch.toLowerCase()))
          : countries;
        return filteredCountries.map(c => ({ value: c.name, label: `${c.flag} ${c.name}` }));
      case 'city':
        return cities.map(c => ({ value: c, label: c }));
      case 'carBrand':
        return carBrands.map(b => ({ value: b, label: b }));
      case 'carModel':
        return carModels.map(m => ({ value: m, label: m }));
      default:
        return [];
    }
  };

  const getFilterTitle = () => {
    switch (activeFilterType) {
      case 'country':
        return 'Select Country';
      case 'city':
        return 'Select City';
      case 'carBrand':
        return 'Select Brand';
      case 'carModel':
        return 'Select Model';
      default:
        return '';
    }
  };

  const activeFiltersCount = Object.keys(filters).length;

  const userLocation = useMemo(() => {
    if (user?.city && user?.country) {
      return `${user.city}, ${user.country}`;
    } else if (user?.city) {
      return user.city;
    } else if (user?.country) {
      return user.country;
    }
    return null;
  }, [user?.city, user?.country]);

  const userPrimaryCar = useMemo(() => {
    if (user?.cars && user.cars.length > 0) {
      const primary = user.cars.find(c => c.isPrimary);
      return primary || user.cars[0];
    }
    if (user?.carBrand) {
      return { brand: user.carBrand, model: user.carModel || '' };
    }
    return null;
  }, [user?.cars, user?.carBrand, user?.carModel]);

  const getCarInfo = useCallback((trip: TripStats) => {
    if (trip.carModel) {
      const parts = trip.carModel.split(' ');
      const brand = parts[0];
      const model = parts.slice(1).join(' ');
      return { brand, model, full: trip.carModel };
    }
    if (userPrimaryCar) {
      return { 
        brand: userPrimaryCar.brand, 
        model: userPrimaryCar.model, 
        full: `${userPrimaryCar.brand} ${userPrimaryCar.model}` 
      };
    }
    return null;
  }, [userPrimaryCar]);

  return (
    <View style={styles.container}>
      {userLocation && (
        <View style={styles.userLocationBanner}>
          <MapPin size={14} color={colors.primary} />
          <Text style={styles.userLocationText}>{userLocation}</Text>
          <View style={styles.bannerButtonsRow}>
            {(pendingIncomingPings.length > 0 || activeMeetups.length > 0) && (
              <TouchableOpacity
                style={[styles.nearbyDriversButton, styles.meetupsButton]}
                onPress={() => setShowMeetupsModal(true)}
                activeOpacity={0.7}
              >
                <MessageCircle size={14} color={colors.textInverted} />
                <Text style={styles.nearbyDriversButtonText}>
                  {pendingIncomingPings.length > 0 ? `${pendingIncomingPings.length} New` : `${activeMeetups.length} Active`}
                </Text>
              </TouchableOpacity>
            )}
            {nearbyUsers.length > 0 && (
              <TouchableOpacity
                style={styles.nearbyDriversButton}
                onPress={() => setShowNearbyDrivers(true)}
                activeOpacity={0.7}
              >
                <Users size={14} color={colors.textInverted} />
                <Text style={styles.nearbyDriversButtonText}>{nearbyUsers.length} Nearby</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      <View style={styles.filtersContainer}>
        <Text style={styles.sectionLabel}>Choose Category</Text>
        <TouchableOpacity
          style={styles.categoryDropdownButton}
          onPress={() => setShowCategoryDropdown(true)}
          activeOpacity={0.7}
        >
          <View style={styles.categoryDropdownLeft}>
            {activeCategory_data?.icon}
            <Text style={styles.categoryDropdownText}>{activeCategory_data?.label}</Text>
          </View>
          <ChevronDown size={18} color={colors.text} />
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>Time Period</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timePeriodScroll} contentContainerStyle={styles.timePeriodContent}>
          {TIME_PERIODS.map((period) => (
            <TouchableOpacity
              key={period.key}
              style={[styles.timePeriodChip, timePeriod === period.key && styles.timePeriodChipActive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setTimePeriod(period.key);
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.timePeriodChipText, timePeriod === period.key && styles.timePeriodChipTextActive]}>
                {period.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.sectionLabel}>Filters</Text>
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterChip, filters.country && styles.filterChipActive]}
            onPress={() => openFilterModal('country')}
            activeOpacity={0.7}
          >
            <MapPin size={14} color={filters.country ? colors.textInverted : colors.text} />
            <Text style={[styles.filterChipText, filters.country && styles.filterChipTextActive]} numberOfLines={1}>
              {filters.country || 'Country'}
            </Text>
            <ChevronDown size={12} color={filters.country ? colors.textInverted : colors.textLight} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filters.city && styles.filterChipActive, !filters.country && styles.filterChipDisabled]}
            onPress={() => filters.country && openFilterModal('city')}
            activeOpacity={0.7}
            disabled={!filters.country}
          >
            <Text style={[styles.filterChipText, filters.city && styles.filterChipTextActive, !filters.country && styles.filterChipTextDisabled]} numberOfLines={1}>
              {filters.city || 'City'}
            </Text>
            <ChevronDown size={12} color={filters.city ? colors.textInverted : colors.textLight} />
          </TouchableOpacity>
        </View>

        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterChip, filters.carBrand && styles.filterChipActive]}
            onPress={() => openFilterModal('carBrand')}
            activeOpacity={0.7}
          >
            <Car size={14} color={filters.carBrand ? colors.textInverted : colors.text} />
            <Text style={[styles.filterChipText, filters.carBrand && styles.filterChipTextActive]} numberOfLines={1}>
              {filters.carBrand || 'Brand'}
            </Text>
            <ChevronDown size={12} color={filters.carBrand ? colors.textInverted : colors.textLight} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filters.carModel && styles.filterChipActive, !filters.carBrand && styles.filterChipDisabled]}
            onPress={() => filters.carBrand && openFilterModal('carModel')}
            activeOpacity={0.7}
            disabled={!filters.carBrand}
          >
            <Text style={[styles.filterChipText, filters.carModel && styles.filterChipTextActive, !filters.carBrand && styles.filterChipTextDisabled]} numberOfLines={1}>
              {filters.carModel || 'Model'}
            </Text>
            <ChevronDown size={12} color={filters.carModel ? colors.textInverted : colors.textLight} />
          </TouchableOpacity>

          {activeFiltersCount > 0 && (
            <TouchableOpacity
              style={styles.clearFiltersChip}
              onPress={() => setFilters({})}
              activeOpacity={0.7}
            >
              <X size={12} color={colors.danger} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {leaderboardData.length === 0 ? (
          <View style={styles.emptyState}>
            <Filter size={48} color={colors.textLight} />
            <Text style={styles.emptyText}>No records found</Text>
            <Text style={styles.emptySubtext}>
              {activeFiltersCount > 0 ? 'Try adjusting your filters' : 'Complete trips to see rankings'}
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {leaderboardData.map((trip, index) => {
              const carInfo = getCarInfo(trip);
              const secondaryStats = getSecondaryStats(trip);
              
              return (
                <TouchableOpacity 
                  key={trip.id || `trip-${index}`} 
                  style={styles.listItem}
                  onPress={() => openTripDetail(trip)}
                  activeOpacity={0.7}
                >
                  <View style={styles.rankAndAvatarContainer}>
                    <View style={styles.rankContainer}>
                      {index < 3 ? (
                        <Trophy size={24} color={getMedalColor(index + 1)} fill={getMedalColor(index + 1)} />
                      ) : (
                        <View style={styles.rankCircle}>
                          <Text style={styles.rankText}>{index + 1}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.avatarContainer}>
                      {user?.profilePicture ? (
                        <Image source={{ uri: user.profilePicture }} style={styles.avatar} />
                      ) : (
                        <View style={styles.avatarPlaceholder}>
                          <Text style={styles.avatarInitial}>
                            {(user?.displayName || 'D')[0].toUpperCase()}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <View style={styles.itemContent}>
                    <View style={styles.itemHeader}>
                      <Text style={styles.userName}>{user?.displayName || 'Driver'}</Text>
                      <Text style={styles.itemDate}>{formatDate(trip.startTime)}</Text>
                    </View>
                    
                    <Text style={styles.mainValue}>{formatValue(trip)}</Text>
                    
                    {secondaryStats.length > 0 && (
                      <View style={styles.secondaryStatsRow}>
                        {secondaryStats.map((stat, statIndex) => (
                          <View key={statIndex} style={styles.secondaryStat}>
                            {stat.icon}
                            <Text style={styles.secondaryStatValue}>{stat.value}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {trip.location?.city && trip.location.city !== 'Unknown' && (
                      <View style={styles.locationBadge}>
                        <MapPin size={10} color={colors.textLight} />
                        <Text style={styles.locationText}>
                          {trip.location.city}{trip.location.country && trip.location.country !== 'Unknown' ? `, ${trip.location.country}` : ''}
                        </Text>
                      </View>
                    )}

                    {carInfo && (
                      <View style={styles.carInfoContainer}>
                        <Car size={14} color={colors.primary} />
                        <Text style={styles.carBrandModelText}>
                          <Text style={styles.carBrandHighlight}>{carInfo.brand}</Text>
                          {carInfo.model ? <Text>{` ${carInfo.model}`}</Text> : null}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.chevronContainer}>
                    <ChevronRight size={18} color={colors.textLight} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showFilterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowFilterModal(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{getFilterTitle()}</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)} activeOpacity={0.7}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {activeFilterType === 'country' && (
              <View style={styles.searchContainer}>
                <Search size={18} color={colors.textLight} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search country..."
                  placeholderTextColor={colors.textLight}
                  value={countrySearch}
                  onChangeText={setCountrySearch}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {countrySearch.length > 0 && (
                  <TouchableOpacity onPress={() => setCountrySearch('')} activeOpacity={0.7}>
                    <X size={18} color={colors.textLight} />
                  </TouchableOpacity>
                )}
              </View>
            )}

            <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <TouchableOpacity
                style={styles.modalOption}
                onPress={() => selectFilter(undefined)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalOptionText}>All</Text>
              </TouchableOpacity>

              {getFilterOptions().map((option, optionIndex) => (
                <TouchableOpacity
                  key={option.value || `option-${optionIndex}`}
                  style={[
                    styles.modalOption,
                    filters[activeFilterType!] === option.value && styles.modalOptionActive,
                  ]}
                  onPress={() => selectFilter(option.value)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      filters[activeFilterType!] === option.value && styles.modalOptionTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}

              {getFilterOptions().length === 0 && (
                <View style={styles.modalEmpty}>
                  <Text style={styles.modalEmptyText}>No options available</Text>
                </View>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showTripDetail}
        transparent
        animationType="slide"
        onRequestClose={closeTripDetail}
      >
        <View style={styles.tripDetailOverlay}>
          <View style={styles.tripDetailContent}>
            <View style={styles.tripDetailHeader}>
              <Text style={styles.tripDetailTitle}>Trip Details</Text>
              <TouchableOpacity onPress={closeTripDetail} activeOpacity={0.7} style={styles.closeButton}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {selectedTrip && (
              <ScrollView style={styles.tripDetailScroll} showsVerticalScrollIndicator={false}>
                {selectedTrip.locations && selectedTrip.locations.length > 1 && Platform.OS !== 'web' ? (
                  <View style={styles.mapContainer}>
                    <MapView
                      style={styles.map}
                      initialRegion={getMapRegion(selectedTrip.locations)}
                      scrollEnabled={false}
                      zoomEnabled={false}
                      rotateEnabled={false}
                      pitchEnabled={false}
                    >
                      <Polyline
                        coordinates={selectedTrip.locations.map(l => ({ latitude: l.latitude, longitude: l.longitude }))}
                        strokeColor={colors.primary}
                        strokeWidth={4}
                      />
                      <Marker
                        coordinate={{
                          latitude: selectedTrip.locations[0].latitude,
                          longitude: selectedTrip.locations[0].longitude,
                        }}
                        title="Start"
                        pinColor="green"
                      />
                      <Marker
                        coordinate={{
                          latitude: selectedTrip.locations[selectedTrip.locations.length - 1].latitude,
                          longitude: selectedTrip.locations[selectedTrip.locations.length - 1].longitude,
                        }}
                        title="End"
                        pinColor="red"
                      />
                    </MapView>
                  </View>
                ) : (
                  <View style={styles.noMapContainer}>
                    <Route size={32} color={colors.textLight} />
                    <Text style={styles.noMapText}>Route map not available</Text>
                  </View>
                )}

                <View style={styles.tripDetailSection}>
                  <View style={styles.tripDetailRow}>
                    <View style={styles.tripDetailItem}>
                      <Calendar size={16} color={colors.primary} />
                      <Text style={styles.tripDetailLabel}>Date</Text>
                      <Text style={styles.tripDetailValue}>{formatDate(selectedTrip.startTime)}</Text>
                    </View>
                    <View style={styles.tripDetailItem}>
                      <Clock size={16} color={colors.accent} />
                      <Text style={styles.tripDetailLabel}>Duration</Text>
                      <Text style={styles.tripDetailValue}>{formatDuration(selectedTrip.duration)}</Text>
                    </View>
                  </View>

                  <View style={styles.tripDetailRow}>
                    <View style={styles.tripDetailItem}>
                      <Zap size={16} color={colors.warning} />
                      <Text style={styles.tripDetailLabel}>Top Speed</Text>
                      <Text style={styles.tripDetailValue}>
                        {Math.round(convertSpeed(selectedTrip.topSpeed))} {getSpeedLabel()}
                      </Text>
                    </View>
                    <View style={styles.tripDetailItem}>
                      <Navigation size={16} color={colors.accent} />
                      <Text style={styles.tripDetailLabel}>Distance</Text>
                      <Text style={styles.tripDetailValue}>
                        {convertDistance(selectedTrip.distance).toFixed(2)} {getDistanceLabel()}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.tripDetailRow}>
                    <View style={styles.tripDetailItem}>
                      <Gauge size={16} color={colors.success} />
                      <Text style={styles.tripDetailLabel}>Avg Speed</Text>
                      <Text style={styles.tripDetailValue}>
                        {Math.round(convertSpeed(selectedTrip.avgSpeed))} {getSpeedLabel()}
                      </Text>
                    </View>
                    <View style={styles.tripDetailItem}>
                      <CornerDownRight size={16} color={colors.textLight} />
                      <Text style={styles.tripDetailLabel}>Corners</Text>
                      <Text style={styles.tripDetailValue}>{selectedTrip.corners}</Text>
                    </View>
                  </View>

                  {((selectedTrip.acceleration ?? 0) > 0 || (selectedTrip.maxGForce ?? 0) > 0) && (
                    <View style={styles.tripDetailRow}>
                      <View style={styles.tripDetailItem}>
                        <Gauge size={16} color={colors.success} />
                        <Text style={styles.tripDetailLabel}>Max Accel</Text>
                        <Text style={styles.tripDetailValue}>
                          {(selectedTrip.acceleration ?? 0).toFixed(2)} m/s²
                        </Text>
                      </View>
                      <View style={styles.tripDetailItem}>
                        <Activity size={16} color={colors.danger} />
                        <Text style={styles.tripDetailLabel}>Max G-Force</Text>
                        <Text style={styles.tripDetailValue}>
                          {(selectedTrip.maxGForce ?? 0).toFixed(2)} G
                        </Text>
                      </View>
                    </View>
                  )}
                </View>

                {selectedTrip.location?.city && selectedTrip.location.city !== 'Unknown' && (
                  <View style={styles.tripDetailLocationCard}>
                    <MapPin size={18} color={colors.primary} />
                    <View style={styles.tripDetailLocationInfo}>
                      <Text style={styles.tripDetailLocationLabel}>Location</Text>
                      <Text style={styles.tripDetailLocationValue}>
                        {selectedTrip.location.city}
                        {selectedTrip.location.country && selectedTrip.location.country !== 'Unknown' 
                          ? `, ${selectedTrip.location.country}` 
                          : ''}
                      </Text>
                    </View>
                  </View>
                )}

                {(() => {
                  const tripCarInfo = getCarInfo(selectedTrip);
                  if (!tripCarInfo) return null;
                  const carPicture = userPrimaryCar && 'picture' in userPrimaryCar ? userPrimaryCar.picture : undefined;
                  return (
                    <View style={styles.tripDetailCarCard}>
                      {carPicture ? (
                        <Image source={{ uri: carPicture }} style={styles.tripDetailCarImage} />
                      ) : (
                        <View style={styles.tripDetailCarIconContainer}>
                          <Car size={28} color={colors.primary} />
                        </View>
                      )}
                      <View style={styles.tripDetailCarInfo}>
                        <Text style={styles.tripDetailCarLabel}>Vehicle</Text>
                        <Text style={styles.tripDetailCarBrand}>{tripCarInfo.brand}</Text>
                        {tripCarInfo.model ? (
                          <Text style={styles.tripDetailCarModel}>{tripCarInfo.model}</Text>
                        ) : null}
                      </View>
                    </View>
                  );
                })()}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showNearbyDrivers}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNearbyDrivers(false)}
      >
        <View style={styles.nearbyDriversOverlay}>
          <View style={styles.nearbyDriversContent}>
            <View style={styles.nearbyDriversHeader}>
              <View style={styles.nearbyDriversHeaderLeft}>
                <Users size={22} color={colors.primary} />
                <Text style={styles.nearbyDriversTitle}>Nearby Drivers</Text>
              </View>
              <TouchableOpacity onPress={() => setShowNearbyDrivers(false)} activeOpacity={0.7}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.nearbyDriversSubtitle}>
              Drivers in {user?.city || user?.country || 'your area'}
            </Text>

            <ScrollView style={styles.nearbyDriversList} showsVerticalScrollIndicator={false}>
              {nearbyUsersQuery.isLoading ? (
                <View style={styles.nearbyLoadingContainer}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.nearbyLoadingText}>Finding drivers...</Text>
                </View>
              ) : nearbyUsers.length === 0 ? (
                <View style={styles.nearbyEmptyContainer}>
                  <Users size={40} color={colors.textLight} />
                  <Text style={styles.nearbyEmptyText}>No nearby drivers yet</Text>
                  <Text style={styles.nearbyEmptySubtext}>Be the first in your area!</Text>
                </View>
              ) : (
                nearbyUsers.map((driver) => (
                  <View key={driver.id} style={styles.nearbyDriverItem}>
                    <View style={styles.nearbyDriverAvatar}>
                      <Text style={styles.nearbyDriverInitial}>
                        {driver.displayName[0].toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.nearbyDriverInfo}>
                      <Text style={styles.nearbyDriverName}>{driver.displayName}</Text>
                      {driver.city && (
                        <View style={styles.nearbyDriverLocationRow}>
                          <MapPin size={10} color={colors.textLight} />
                          <Text style={styles.nearbyDriverLocation}>
                            {driver.city}{driver.country ? `, ${driver.country}` : ''}
                          </Text>
                        </View>
                      )}
                      {driver.carBrand && (
                        <View style={styles.nearbyDriverCarRow}>
                          <Car size={10} color={colors.primary} />
                          <Text style={styles.nearbyDriverCar}>
                            {driver.carBrand} {driver.carModel || ''}
                          </Text>
                        </View>
                      )}
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.pingButton,
                        !driver.hasPushToken && styles.pingButtonDisabled,
                      ]}
                      onPress={() => handlePingUser(driver.id, driver.displayName, driver.carBrand && driver.carModel ? `${driver.carBrand} ${driver.carModel}` : undefined)}
                      disabled={!driver.hasPushToken || pingingUserId === driver.id}
                      activeOpacity={0.7}
                    >
                      {pingingUserId === driver.id ? (
                        <ActivityIndicator size="small" color={colors.textInverted} />
                      ) : (
                        <>
                          <Send size={14} color={driver.hasPushToken ? colors.textInverted : colors.textLight} />
                          <Text style={[
                            styles.pingButtonText,
                            !driver.hasPushToken && styles.pingButtonTextDisabled,
                          ]}>
                            Ping
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
            
            <View style={styles.nearbyDriversFooter}>
              <Bell size={14} color={colors.textLight} />
              <Text style={styles.nearbyDriversFooterText}>
                Ping to invite for a drive!
              </Text>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showMeetupsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMeetupsModal(false)}
      >
        <View style={styles.nearbyDriversOverlay}>
          <View style={styles.nearbyDriversContent}>
            <View style={styles.nearbyDriversHeader}>
              <View style={styles.nearbyDriversHeaderLeft}>
                <MessageCircle size={22} color={colors.primary} />
                <Text style={styles.nearbyDriversTitle}>Drive Meetups</Text>
              </View>
              <TouchableOpacity onPress={() => setShowMeetupsModal(false)} activeOpacity={0.7}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.nearbyDriversList} showsVerticalScrollIndicator={false}>
              {pendingIncomingPings.length > 0 && (
                <View style={styles.meetupSection}>
                  <Text style={styles.meetupSectionTitle}>Incoming Invites</Text>
                  {pendingIncomingPings.map((meetup) => (
                    <View key={meetup.id} style={styles.meetupItem}>
                      <View style={styles.meetupItemHeader}>
                        <View style={styles.nearbyDriverAvatar}>
                          <Text style={styles.nearbyDriverInitial}>
                            {meetup.fromUserName[0].toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.meetupItemInfo}>
                          <Text style={styles.meetupItemName}>{meetup.fromUserName}</Text>
                          {meetup.fromUserCar && (
                            <View style={styles.nearbyDriverCarRow}>
                              <Car size={10} color={colors.primary} />
                              <Text style={styles.nearbyDriverCar}>{meetup.fromUserCar}</Text>
                            </View>
                          )}
                          <Text style={styles.meetupItemTime}>
                            {new Date(meetup.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.meetupActions}>
                        <TouchableOpacity
                          style={styles.acceptButton}
                          onPress={() => handleRespondToPing(meetup.id, 'accepted')}
                          disabled={respondingMeetupId === meetup.id}
                          activeOpacity={0.7}
                        >
                          {respondingMeetupId === meetup.id ? (
                            <ActivityIndicator size="small" color={colors.textInverted} />
                          ) : (
                            <>
                              <Check size={16} color={colors.textInverted} />
                              <Text style={styles.acceptButtonText}>Accept</Text>
                            </>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.declineButton}
                          onPress={() => handleRespondToPing(meetup.id, 'declined')}
                          disabled={respondingMeetupId === meetup.id}
                          activeOpacity={0.7}
                        >
                          <XCircle size={16} color={colors.danger} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {activeMeetups.length > 0 && (
                <View style={styles.meetupSection}>
                  <Text style={styles.meetupSectionTitle}>Active Meetups</Text>
                  {activeMeetups.map((meetup) => {
                    const isAccepter = meetup.toUserId === user?.id;
                    const otherUserName = isAccepter ? meetup.fromUserName : meetup.toUserName;
                    const otherUserCar = isAccepter ? meetup.fromUserCar : meetup.toUserCar;
                    const myLocation = isAccepter ? meetup.toUserLocation : meetup.fromUserLocation;
                    const theirLocation = isAccepter ? meetup.fromUserLocation : meetup.toUserLocation;

                    return (
                      <TouchableOpacity
                        key={meetup.id}
                        style={styles.activeMeetupItem}
                        onPress={() => {
                          setSelectedMeetup(meetup);
                          setShowMeetupDetail(true);
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={styles.meetupItemHeader}>
                          <View style={[styles.nearbyDriverAvatar, styles.activeAvatar]}>
                            <Text style={styles.nearbyDriverInitial}>
                              {otherUserName[0].toUpperCase()}
                            </Text>
                          </View>
                          <View style={styles.meetupItemInfo}>
                            <Text style={styles.meetupItemName}>{otherUserName}</Text>
                            {otherUserCar && (
                              <View style={styles.nearbyDriverCarRow}>
                                <Car size={10} color={colors.primary} />
                                <Text style={styles.nearbyDriverCar}>{otherUserCar}</Text>
                              </View>
                            )}
                            <View style={styles.locationStatusRow}>
                              {theirLocation ? (
                                <View style={styles.locationSharedBadge}>
                                  <MapPin size={10} color={colors.success} />
                                  <Text style={styles.locationSharedText}>Location shared</Text>
                                </View>
                              ) : (
                                <Text style={styles.waitingLocationText}>Waiting for location...</Text>
                              )}
                            </View>
                          </View>
                        </View>
                        <View style={styles.meetupQuickActions}>
                          {isAccepter && !myLocation && (
                            <TouchableOpacity
                              style={styles.shareLocationButton}
                              onPress={() => handleShareLocation(meetup)}
                              disabled={sharingLocationMeetupId === meetup.id}
                              activeOpacity={0.7}
                            >
                              {sharingLocationMeetupId === meetup.id ? (
                                <ActivityIndicator size="small" color={colors.textInverted} />
                              ) : (
                                <>
                                  <Share2 size={14} color={colors.textInverted} />
                                  <Text style={styles.shareLocationButtonText}>Share</Text>
                                </>
                              )}
                            </TouchableOpacity>
                          )}
                          {theirLocation && (
                            <TouchableOpacity
                              style={styles.navigateButton}
                              onPress={() => handleNavigateToLocation(theirLocation.latitude, theirLocation.longitude)}
                              activeOpacity={0.7}
                            >
                              <Navigation2 size={14} color={colors.textInverted} />
                            </TouchableOpacity>
                          )}
                          <ChevronRight size={18} color={colors.textLight} />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {pendingOutgoingPings.length > 0 && (
                <View style={styles.meetupSection}>
                  <Text style={styles.meetupSectionTitle}>Pending Invites</Text>
                  {pendingOutgoingPings.map((meetup) => (
                    <View key={meetup.id} style={styles.pendingMeetupItem}>
                      <View style={styles.meetupItemHeader}>
                        <View style={[styles.nearbyDriverAvatar, styles.pendingAvatar]}>
                          <Text style={styles.nearbyDriverInitial}>
                            {meetup.toUserName[0].toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.meetupItemInfo}>
                          <Text style={styles.meetupItemName}>{meetup.toUserName}</Text>
                          {meetup.toUserCar && (
                            <View style={styles.nearbyDriverCarRow}>
                              <Car size={10} color={colors.primary} />
                              <Text style={styles.nearbyDriverCar}>{meetup.toUserCar}</Text>
                            </View>
                          )}
                          <Text style={styles.pendingStatusText}>Waiting for response...</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {pendingIncomingPings.length === 0 && activeMeetups.length === 0 && pendingOutgoingPings.length === 0 && (
                <View style={styles.nearbyEmptyContainer}>
                  <MessageCircle size={40} color={colors.textLight} />
                  <Text style={styles.nearbyEmptyText}>No meetups yet</Text>
                  <Text style={styles.nearbyEmptySubtext}>Ping nearby drivers to start!</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showMeetupDetail}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowMeetupDetail(false);
          setSelectedMeetup(null);
        }}
      >
        <View style={styles.tripDetailOverlay}>
          <View style={styles.tripDetailContent}>
            <View style={styles.tripDetailHeader}>
              <Text style={styles.tripDetailTitle}>Meetup Details</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowMeetupDetail(false);
                  setSelectedMeetup(null);
                }}
                activeOpacity={0.7}
                style={styles.closeButton}
              >
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {selectedMeetup && (() => {
              const isAccepter = selectedMeetup.toUserId === user?.id;
              const otherUserName = isAccepter ? selectedMeetup.fromUserName : selectedMeetup.toUserName;
              const otherUserCar = isAccepter ? selectedMeetup.fromUserCar : selectedMeetup.toUserCar;
              const myLocation = isAccepter ? selectedMeetup.toUserLocation : selectedMeetup.fromUserLocation;
              const theirLocation = isAccepter ? selectedMeetup.fromUserLocation : selectedMeetup.toUserLocation;

              return (
                <ScrollView style={styles.tripDetailScroll} showsVerticalScrollIndicator={false}>
                  <View style={styles.meetupDetailCard}>
                    <View style={styles.meetupDetailAvatar}>
                      <Text style={styles.meetupDetailAvatarText}>
                        {otherUserName[0].toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.meetupDetailName}>{otherUserName}</Text>
                    {otherUserCar && (
                      <View style={styles.meetupDetailCarRow}>
                        <Car size={16} color={colors.primary} />
                        <Text style={styles.meetupDetailCarText}>{otherUserCar}</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.meetupDetailSection}>
                    <Text style={styles.meetupDetailSectionTitle}>Location Status</Text>
                    
                    <View style={styles.locationStatusCard}>
                      <View style={styles.locationStatusItem}>
                        <Text style={styles.locationStatusLabel}>Your Location</Text>
                        {myLocation ? (
                          <View style={styles.locationSharedBadge}>
                            <Check size={12} color={colors.success} />
                            <Text style={styles.locationSharedText}>Shared</Text>
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={styles.shareLocationButtonLarge}
                            onPress={() => handleShareLocation(selectedMeetup)}
                            disabled={sharingLocationMeetupId === selectedMeetup.id}
                            activeOpacity={0.7}
                          >
                            {sharingLocationMeetupId === selectedMeetup.id ? (
                              <ActivityIndicator size="small" color={colors.textInverted} />
                            ) : (
                              <>
                                <Share2 size={16} color={colors.textInverted} />
                                <Text style={styles.shareLocationButtonText}>Share Location</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        )}
                      </View>

                      <View style={styles.locationDivider} />

                      <View style={styles.locationStatusItem}>
                        <Text style={styles.locationStatusLabel}>{otherUserName}'s Location</Text>
                        {theirLocation ? (
                          <TouchableOpacity
                            style={styles.navigateButtonLarge}
                            onPress={() => handleNavigateToLocation(theirLocation.latitude, theirLocation.longitude)}
                            activeOpacity={0.7}
                          >
                            <Navigation2 size={16} color={colors.textInverted} />
                            <Text style={styles.navigateButtonText}>Navigate</Text>
                          </TouchableOpacity>
                        ) : (
                          <Text style={styles.waitingLocationText}>Waiting...</Text>
                        )}
                      </View>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.cancelMeetupButton}
                    onPress={() => handleCancelMeetup(selectedMeetup)}
                    activeOpacity={0.7}
                  >
                    <XCircle size={18} color={colors.danger} />
                    <Text style={styles.cancelMeetupButtonText}>Cancel Meetup</Text>
                  </TouchableOpacity>
                </ScrollView>
              );
            })()}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showCategoryDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCategoryDropdown(false)}
      >
        <Pressable style={styles.categoryDropdownOverlay} onPress={() => setShowCategoryDropdown(false)}>
          <View style={styles.categoryDropdownContent}>
            <View style={styles.categoryDropdownHeader}>
              <Text style={styles.categoryDropdownTitle}>Select Category</Text>
              <TouchableOpacity onPress={() => setShowCategoryDropdown(false)} activeOpacity={0.7}>
                <X size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.categoryDropdownList}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.key}
                  style={[
                    styles.categoryDropdownItem,
                    activeCategory === cat.key && styles.categoryDropdownItemActive,
                  ]}
                  onPress={() => {
                    setActiveCategory(cat.key);
                    setShowCategoryDropdown(false);
                  }}
                  activeOpacity={0.7}
                >
                  {cat.icon}
                  <Text
                    style={[
                      styles.categoryDropdownItemText,
                      activeCategory === cat.key && styles.categoryDropdownItemTextActive,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  userLocationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: colors.cardLight,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  userLocationText: {
    fontSize: 13,
    fontFamily: 'Orbitron_600SemiBold',
    color: colors.text,
    flex: 1,
  },
  nearbyDriversButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
  },
  nearbyDriversButtonText: {
    fontSize: 11,
    fontFamily: 'Orbitron_600SemiBold',
    color: colors.textInverted,
  },
  filtersContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Orbitron_500Medium',
    color: colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  timePeriodScroll: {
    marginHorizontal: -16,
    marginBottom: 4,
  },
  timePeriodContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  timePeriodChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: colors.cardLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timePeriodChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  timePeriodChipText: {
    fontSize: 12,
    fontFamily: 'Orbitron_500Medium',
    color: colors.text,
  },
  timePeriodChipTextActive: {
    color: colors.textInverted,
  },
  categoryDropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.cardLight,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  categoryDropdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  categoryDropdownText: {
    fontSize: 14,
    fontFamily: 'Orbitron_600SemiBold',
    color: colors.text,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.cardLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipDisabled: {
    opacity: 0.5,
  },
  filterChipText: {
    fontSize: 11,
    fontFamily: 'Orbitron_500Medium',
    color: colors.text,
    flex: 1,
  },
  filterChipTextActive: {
    color: colors.textInverted,
  },
  filterChipTextDisabled: {
    color: colors.textLight,
  },
  clearFiltersChip: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.cardLight,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 4,
  },
  emptyState: {
    backgroundColor: colors.cardLight,
    borderRadius: 16,
    padding: 48,
    alignItems: 'center',
    marginTop: 20,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Orbitron_600SemiBold',
    color: colors.text,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: 'Orbitron_400Regular',
    color: colors.textLight,
    marginTop: 4,
    textAlign: 'center',
  },
  list: {
    gap: 8,
  },
  listItem: {
    backgroundColor: colors.cardLight,
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#CC0000',
  },
  chevronContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 4,
  },
  rankAndAvatarContainer: {
    alignItems: 'center',
    gap: 6,
    paddingTop: 2,
  },
  rankContainer: {
    width: 40,
    alignItems: 'center',
  },
  avatarContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    overflow: 'hidden',
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  avatarPlaceholder: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 14,
    fontFamily: 'Orbitron_700Bold',
    color: colors.textInverted,
  },
  rankCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 14,
    fontFamily: 'Orbitron_700Bold',
    color: colors.text,
  },
  itemContent: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 2,
  },
  userName: {
    fontSize: 12,
    fontFamily: 'Orbitron_600SemiBold',
    color: colors.text,
  },
  itemDate: {
    fontSize: 11,
    fontFamily: 'Orbitron_400Regular',
    color: colors.textLight,
  },
  mainValue: {
    fontSize: 20,
    fontFamily: 'Orbitron_700Bold',
    color: colors.text,
    marginBottom: 4,
  },
  secondaryStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 2,
  },
  secondaryStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.background,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  secondaryStatValue: {
    fontSize: 11,
    fontFamily: 'Orbitron_500Medium',
    color: colors.textLight,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
    paddingVertical: 2,
    paddingHorizontal: 5,
    backgroundColor: colors.background,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  locationText: {
    fontSize: 11,
    fontFamily: 'Orbitron_400Regular',
    color: colors.textLight,
  },
  carInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  carBrandModelText: {
    fontSize: 11,
    fontFamily: 'Orbitron_400Regular',
    color: colors.textLight,
  },
  carBrandHighlight: {
    fontFamily: 'Orbitron_600SemiBold',
    color: colors.text,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
    paddingTop: 100,
  },
  modalContent: {
    backgroundColor: colors.cardLight,
    borderRadius: 24,
    marginHorizontal: 16,
    maxHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Orbitron_600SemiBold',
    color: colors.text,
  },
  modalScroll: {
    padding: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'Orbitron_400Regular',
    color: colors.text,
  },
  modalOption: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  modalOptionActive: {
    backgroundColor: colors.primary,
  },
  modalOptionText: {
    fontSize: 16,
    fontFamily: 'Orbitron_400Regular',
    color: colors.text,
  },
  modalOptionTextActive: {
    color: colors.textInverted,
    fontFamily: 'Orbitron_600SemiBold',
  },
  modalEmpty: {
    padding: 24,
    alignItems: 'center',
  },
  modalEmptyText: {
    fontSize: 14,
    fontFamily: 'Orbitron_400Regular',
    color: colors.textLight,
  },
  tripDetailOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  tripDetailContent: {
    backgroundColor: colors.cardLight,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  tripDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tripDetailTitle: {
    fontSize: 20,
    fontFamily: 'Orbitron_700Bold',
    color: colors.text,
  },
  closeButton: {
    padding: 4,
  },
  tripDetailScroll: {
    padding: 16,
  },
  mapContainer: {
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  map: {
    flex: 1,
  },
  noMapContainer: {
    height: 120,
    borderRadius: 16,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 8,
  },
  noMapText: {
    fontSize: 13,
    fontFamily: 'Orbitron_400Regular',
    color: colors.textLight,
  },
  tripDetailSection: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    gap: 16,
  },
  tripDetailRow: {
    flexDirection: 'row',
    gap: 12,
  },
  tripDetailItem: {
    flex: 1,
    backgroundColor: colors.cardLight,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 6,
  },
  tripDetailLabel: {
    fontSize: 10,
    fontFamily: 'Orbitron_400Regular',
    color: colors.textLight,
    textTransform: 'uppercase',
  },
  tripDetailValue: {
    fontSize: 16,
    fontFamily: 'Orbitron_700Bold',
    color: colors.text,
    textAlign: 'center',
  },
  tripDetailLocationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    gap: 14,
  },
  tripDetailLocationInfo: {
    flex: 1,
  },
  tripDetailLocationLabel: {
    fontSize: 11,
    fontFamily: 'Orbitron_400Regular',
    color: colors.textLight,
    marginBottom: 2,
  },
  tripDetailLocationValue: {
    fontSize: 15,
    fontFamily: 'Orbitron_600SemiBold',
    color: colors.text,
  },
  tripDetailCarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 16,
    marginBottom: 32,
    gap: 14,
  },
  tripDetailCarImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
  },
  tripDetailCarIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: colors.cardLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tripDetailCarInfo: {
    flex: 1,
  },
  tripDetailCarLabel: {
    fontSize: 11,
    fontFamily: 'Orbitron_400Regular',
    color: colors.textLight,
    marginBottom: 4,
  },
  tripDetailCarBrand: {
    fontSize: 17,
    fontFamily: 'Orbitron_700Bold',
    color: colors.text,
  },
  tripDetailCarModel: {
    fontSize: 14,
    fontFamily: 'Orbitron_400Regular',
    color: colors.textLight,
    marginTop: 2,
  },
  categoryDropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  categoryDropdownContent: {
    backgroundColor: colors.cardLight,
    borderRadius: 16,
    overflow: 'hidden',
  },
  categoryDropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  categoryDropdownTitle: {
    fontSize: 16,
    fontFamily: 'Orbitron_600SemiBold',
    color: colors.text,
  },
  categoryDropdownList: {
    maxHeight: 350,
  },
  categoryDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  categoryDropdownItemActive: {
    backgroundColor: colors.primary,
  },
  categoryDropdownItemText: {
    fontSize: 14,
    fontFamily: 'Orbitron_500Medium',
    color: colors.text,
  },
  categoryDropdownItemTextActive: {
    color: colors.textInverted,
    fontFamily: 'Orbitron_600SemiBold',
  },
  nearbyDriversOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  nearbyDriversContent: {
    backgroundColor: colors.cardLight,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  nearbyDriversHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  nearbyDriversHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  nearbyDriversTitle: {
    fontSize: 18,
    fontFamily: 'Orbitron_700Bold',
    color: colors.text,
  },
  nearbyDriversSubtitle: {
    fontSize: 12,
    fontFamily: 'Orbitron_400Regular',
    color: colors.textLight,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  nearbyDriversList: {
    paddingHorizontal: 16,
  },
  nearbyLoadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  nearbyLoadingText: {
    fontSize: 13,
    fontFamily: 'Orbitron_400Regular',
    color: colors.textLight,
  },
  nearbyEmptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  nearbyEmptyText: {
    fontSize: 15,
    fontFamily: 'Orbitron_600SemiBold',
    color: colors.text,
    marginTop: 8,
  },
  nearbyEmptySubtext: {
    fontSize: 13,
    fontFamily: 'Orbitron_400Regular',
    color: colors.textLight,
  },
  nearbyDriverItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  nearbyDriverAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nearbyDriverInitial: {
    fontSize: 18,
    fontFamily: 'Orbitron_700Bold',
    color: colors.textInverted,
  },
  nearbyDriverInfo: {
    flex: 1,
    gap: 2,
  },
  nearbyDriverName: {
    fontSize: 14,
    fontFamily: 'Orbitron_600SemiBold',
    color: colors.text,
  },
  nearbyDriverLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  nearbyDriverLocation: {
    fontSize: 11,
    fontFamily: 'Orbitron_400Regular',
    color: colors.textLight,
  },
  nearbyDriverCarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  nearbyDriverCar: {
    fontSize: 11,
    fontFamily: 'Orbitron_500Medium',
    color: colors.primary,
  },
  pingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  pingButtonDisabled: {
    backgroundColor: colors.border,
  },
  pingButtonText: {
    fontSize: 12,
    fontFamily: 'Orbitron_600SemiBold',
    color: colors.textInverted,
  },
  pingButtonTextDisabled: {
    color: colors.textLight,
  },
  nearbyDriversFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 16,
    paddingHorizontal: 20,
  },
  nearbyDriversFooterText: {
    fontSize: 12,
    fontFamily: 'Orbitron_400Regular',
    color: colors.textLight,
  },
  bannerButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  meetupsButton: {
    backgroundColor: colors.success,
  },
  meetupSection: {
    marginBottom: 20,
  },
  meetupSectionTitle: {
    fontSize: 12,
    fontFamily: 'Orbitron_600SemiBold',
    color: colors.textLight,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 10,
  },
  meetupItem: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  meetupItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  meetupItemInfo: {
    flex: 1,
    gap: 2,
  },
  meetupItemName: {
    fontSize: 14,
    fontFamily: 'Orbitron_600SemiBold',
    color: colors.text,
  },
  meetupItemTime: {
    fontSize: 10,
    fontFamily: 'Orbitron_400Regular',
    color: colors.textLight,
    marginTop: 2,
  },
  meetupActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.success,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  acceptButtonText: {
    fontSize: 13,
    fontFamily: 'Orbitron_600SemiBold',
    color: colors.textInverted,
  },
  declineButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.cardLight,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  activeMeetupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.success,
  },
  activeAvatar: {
    backgroundColor: colors.success,
  },
  pendingMeetupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    opacity: 0.7,
  },
  pendingAvatar: {
    backgroundColor: colors.textLight,
  },
  pendingStatusText: {
    fontSize: 11,
    fontFamily: 'Orbitron_400Regular',
    color: colors.textLight,
    fontStyle: 'italic',
  },
  locationStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  locationSharedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${colors.success}20`,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  locationSharedText: {
    fontSize: 10,
    fontFamily: 'Orbitron_500Medium',
    color: colors.success,
  },
  waitingLocationText: {
    fontSize: 10,
    fontFamily: 'Orbitron_400Regular',
    color: colors.textLight,
    fontStyle: 'italic',
  },
  meetupQuickActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shareLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accent,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
  },
  shareLocationButtonText: {
    fontSize: 11,
    fontFamily: 'Orbitron_600SemiBold',
    color: colors.textInverted,
  },
  navigateButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
  },
  meetupDetailCard: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
  },
  meetupDetailAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  meetupDetailAvatarText: {
    fontSize: 32,
    fontFamily: 'Orbitron_700Bold',
    color: colors.textInverted,
  },
  meetupDetailName: {
    fontSize: 20,
    fontFamily: 'Orbitron_700Bold',
    color: colors.text,
    marginBottom: 4,
  },
  meetupDetailCarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  meetupDetailCarText: {
    fontSize: 14,
    fontFamily: 'Orbitron_500Medium',
    color: colors.primary,
  },
  meetupDetailSection: {
    marginBottom: 16,
  },
  meetupDetailSectionTitle: {
    fontSize: 12,
    fontFamily: 'Orbitron_600SemiBold',
    color: colors.textLight,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  locationStatusCard: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 16,
  },
  locationStatusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  locationStatusLabel: {
    fontSize: 13,
    fontFamily: 'Orbitron_500Medium',
    color: colors.text,
  },
  locationDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  shareLocationButtonLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accent,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  navigateButtonLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  navigateButtonText: {
    fontSize: 12,
    fontFamily: 'Orbitron_600SemiBold',
    color: colors.textInverted,
  },
  cancelMeetupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.cardLight,
    borderWidth: 1,
    borderColor: colors.danger,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 32,
  },
  cancelMeetupButtonText: {
    fontSize: 14,
    fontFamily: 'Orbitron_600SemiBold',
    color: colors.danger,
  },
});
