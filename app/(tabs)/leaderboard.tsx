import { useState, useMemo, useCallback, ReactNode } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Modal, Pressable, TextInput, Image, Platform } from 'react-native';
import { Trophy, Zap, Navigation, Gauge, ChevronDown, X, MapPin, Car, Filter, Activity, Route, Search, Clock, Calendar, CornerDownRight, ChevronRight } from 'lucide-react-native';
import MapView, { Polyline, Marker } from 'react-native-maps';
import { useTrips } from '@/providers/TripProvider';
import { useSettings } from '@/providers/SettingsProvider';
import { useUser } from '@/providers/UserProvider';
import { COUNTRIES } from '@/constants/countries';
import { CAR_BRANDS, getModelsForBrand } from '@/constants/cars';
import { LeaderboardCategory, LeaderboardFilters, TripStats } from '@/types/trip';
import { ThemeColors } from '@/constants/colors';

type FilterType = 'country' | 'city' | 'carBrand' | 'carModel';

export default function LeaderboardScreen() {
  const { trips } = useTrips();
  const { convertSpeed, convertDistance, getSpeedLabel, getDistanceLabel, colors } = useSettings();
  const { user } = useUser();
  const [activeCategory, setActiveCategory] = useState<LeaderboardCategory>('topSpeed');
  const [filters, setFilters] = useState<LeaderboardFilters>({});
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [activeFilterType, setActiveFilterType] = useState<FilterType | null>(null);
  const [countrySearch, setCountrySearch] = useState('');
  const [selectedTrip, setSelectedTrip] = useState<TripStats | null>(null);
  const [showTripDetail, setShowTripDetail] = useState(false);

  const styles = useMemo(() => createStyles(colors), [colors]);

  const CATEGORIES = useMemo(() => [
    { key: 'topSpeed' as LeaderboardCategory, label: 'Top Speed', icon: <Zap size={16} color={colors.warning} /> },
    { key: 'distance' as LeaderboardCategory, label: 'Trip Distance', icon: <Navigation size={16} color={colors.accent} /> },
    { key: 'totalDistance' as LeaderboardCategory, label: 'All-Time Distance', icon: <Route size={16} color={colors.primary} /> },
    { key: 'acceleration' as LeaderboardCategory, label: 'Acceleration', icon: <Gauge size={16} color={colors.success} /> },
    { key: 'gForce' as LeaderboardCategory, label: 'Max G-Force', icon: <Activity size={16} color={colors.danger} /> },
  ], [colors]);

  const countries = useMemo(() => COUNTRIES.map(c => ({ code: c.code, name: c.name, flag: c.flag })), []);
  
  const cities = useMemo(() => {
    if (!filters.country) return [];
    const countryData = COUNTRIES.find(c => c.name === filters.country);
    if (countryData) {
      return countryData.cities;
    }
    const citiesFromTrips = trips
      .filter(trip => trip.location?.country === filters.country)
      .map(trip => trip.location?.city)
      .filter((city): city is string => !!city && city !== 'Unknown');
    return [...new Set(citiesFromTrips)];
  }, [trips, filters.country]);
  
  const carBrands = useMemo(() => {
    return CAR_BRANDS.map(brand => brand.name);
  }, []);

  const carModels = useMemo(() => {
    if (!filters.carBrand) return [];
    return getModelsForBrand(filters.carBrand);
  }, [filters.carBrand]);

  const filteredTrips = useMemo(() => {
    return trips.filter((trip) => {
      if (filters.country && trip.location?.country !== filters.country) return false;
      if (filters.city && trip.location?.city !== filters.city) return false;
      if (filters.carBrand && filters.carModel) {
        const fullCarModel = `${filters.carBrand} ${filters.carModel}`;
        if (trip.carModel !== fullCarModel) return false;
      } else if (filters.carBrand) {
        if (!trip.carModel?.startsWith(filters.carBrand)) return false;
      }
      return true;
    });
  }, [trips, filters]);

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
        </View>
      )}

      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={styles.categoryScrollView}
        contentContainerStyle={styles.categoryTabs}
      >
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.key}
            style={[styles.categoryTab, activeCategory === cat.key && styles.categoryTabActive]}
            onPress={() => setActiveCategory(cat.key)}
            activeOpacity={0.7}
          >
            {cat.icon}
            <Text style={[styles.categoryTabText, activeCategory === cat.key && styles.categoryTabTextActive]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.filtersContainer}>
        <View style={styles.filtersRow}>
          <TouchableOpacity
            style={[styles.filterChip, filters.country && styles.filterChipActive]}
            onPress={() => openFilterModal('country')}
            activeOpacity={0.7}
          >
            <MapPin size={14} color={filters.country ? colors.textInverted : colors.text} />
            <Text style={[styles.filterChipText, filters.country && styles.filterChipTextActive]} numberOfLines={1}>
              {filters.country || 'Country'}
            </Text>
            <ChevronDown size={14} color={filters.country ? colors.textInverted : colors.textLight} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filters.carBrand && styles.filterChipActive]}
            onPress={() => openFilterModal('carBrand')}
            activeOpacity={0.7}
          >
            <Car size={14} color={filters.carBrand ? colors.textInverted : colors.text} />
            <Text style={[styles.filterChipText, filters.carBrand && styles.filterChipTextActive]} numberOfLines={1}>
              {filters.carBrand || 'Brand'}
            </Text>
            <ChevronDown size={14} color={filters.carBrand ? colors.textInverted : colors.textLight} />
          </TouchableOpacity>
        </View>

        <View style={styles.filtersRow}>
          <TouchableOpacity
            style={[styles.filterChip, filters.city && styles.filterChipActive, !filters.country && styles.filterChipDisabled]}
            onPress={() => filters.country && openFilterModal('city')}
            activeOpacity={0.7}
            disabled={!filters.country}
          >
            <MapPin size={14} color={filters.city ? colors.textInverted : (filters.country ? colors.text : colors.textLight)} />
            <Text style={[styles.filterChipText, filters.city && styles.filterChipTextActive, !filters.country && styles.filterChipTextDisabled]} numberOfLines={1}>
              {filters.city || 'City'}
            </Text>
            <ChevronDown size={14} color={filters.city ? colors.textInverted : colors.textLight} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filters.carModel && styles.filterChipActive, !filters.carBrand && styles.filterChipDisabled]}
            onPress={() => filters.carBrand && openFilterModal('carModel')}
            activeOpacity={0.7}
            disabled={!filters.carBrand}
          >
            <Car size={14} color={filters.carModel ? colors.textInverted : (filters.carBrand ? colors.text : colors.textLight)} />
            <Text style={[styles.filterChipText, filters.carModel && styles.filterChipTextActive, !filters.carBrand && styles.filterChipTextDisabled]} numberOfLines={1}>
              {filters.carModel || 'Model'}
            </Text>
            <ChevronDown size={14} color={filters.carModel ? colors.textInverted : colors.textLight} />
          </TouchableOpacity>
        </View>

        {activeFiltersCount > 0 && (
          <TouchableOpacity
            style={styles.clearFiltersButton}
            onPress={() => setFilters({})}
            activeOpacity={0.7}
          >
            <X size={14} color={colors.danger} />
            <Text style={styles.clearFiltersText}>Clear all</Text>
          </TouchableOpacity>
        )}
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
                          {carInfo.model ? ` ${carInfo.model}` : ''}
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
  },
  categoryScrollView: {
    flexGrow: 0,
    paddingTop: 12,
    paddingBottom: 8,
  },
  categoryTabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
  },
  categoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.cardLight,
  },
  categoryTabActive: {
    backgroundColor: colors.primary,
  },
  categoryTabText: {
    fontSize: 12,
    fontFamily: 'Orbitron_600SemiBold',
    color: colors.text,
  },
  categoryTabTextActive: {
    color: colors.textInverted,
  },
  filtersContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 20,
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
    maxWidth: 80,
  },
  filterChipTextActive: {
    color: colors.textInverted,
  },
  filterChipTextDisabled: {
    color: colors.textLight,
  },
  clearFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
  },
  clearFiltersText: {
    fontSize: 12,
    fontFamily: 'Orbitron_500Medium',
    color: colors.danger,
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
});
