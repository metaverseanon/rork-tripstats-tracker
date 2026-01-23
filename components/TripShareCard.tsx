import React, { useRef, useMemo, useCallback, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  Platform,
  Alert,
  Dimensions,
  Image,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { X, Download, Share2 } from 'lucide-react-native';
import Svg, { Polyline, Defs, LinearGradient, Stop } from 'react-native-svg';
import ViewShot from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { TripStats } from '@/types/trip';
import { useTrips } from '@/providers/TripProvider';
import { useSettings } from '@/providers/SettingsProvider';

interface TripShareCardProps {
  trip: TripStats;
  visible: boolean;
  onClose: () => void;
}

interface RankingInfo {
  rank: number;
  category: string;
  scope: string;
  period: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = Math.min(SCREEN_WIDTH - 48, 360);
const CARD_GAP = 16;
const SNAP_INTERVAL = CARD_WIDTH + CARD_GAP;

export default function TripShareCard({ trip, visible, onClose }: TripShareCardProps) {
  const viewShotRef = useRef<ViewShot>(null);
  const viewShotRef2 = useRef<ViewShot>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const { trips } = useTrips();
  const { convertSpeed, convertDistance, getSpeedLabel, getDistanceLabel, settings } = useSettings();
  const isLight = settings.theme === 'light';

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const page = Math.round(offsetX / SNAP_INTERVAL);
    setCurrentPage(page);
  }, []);

  const routePathData = useMemo(() => {
    if (!trip.locations || trip.locations.length < 2) return null;
    
    const lats = trip.locations.map(l => l.latitude);
    const lngs = trip.locations.map(l => l.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    
    const padding = 30;
    const svgWidth = CARD_WIDTH - 56;
    const svgHeight = 260;
    const drawWidth = svgWidth - padding * 2;
    const drawHeight = svgHeight - padding * 2;
    
    const latRange = maxLat - minLat || 0.001;
    const lngRange = maxLng - minLng || 0.001;
    
    const points = trip.locations.map(loc => {
      const x = padding + ((loc.longitude - minLng) / lngRange) * drawWidth;
      const y = padding + ((maxLat - loc.latitude) / latRange) * drawHeight;
      return `${x},${y}`;
    }).join(' ');
    
    return { points, svgWidth, svgHeight };
  }, [trip.locations]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}. ${date.getFullYear()}`;
  };

  const getLocationString = () => {
    if (trip.location?.city && trip.location?.country) {
      return `${trip.location.city}, ${trip.location.country}`;
    }
    if (trip.location?.country) {
      return trip.location.country;
    }
    return 'Unknown Location';
  };

  const rankingInfo = useMemo((): RankingInfo | null => {
    if (!trip || trips.length === 0) return null;

    const tripCountry = trip.location?.country;
    const tripCity = trip.location?.city;
    
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

    const checkRanking = (
      filterFn: (t: TripStats) => boolean,
      scope: string,
      period: string
    ): RankingInfo | null => {
      const filtered = trips.filter(filterFn);
      
      const topSpeedSorted = [...filtered].sort((a, b) => b.topSpeed - a.topSpeed);
      const topSpeedRank = topSpeedSorted.findIndex(t => t.id === trip.id) + 1;
      if (topSpeedRank > 0 && topSpeedRank <= 10) {
        return { rank: topSpeedRank, category: 'Top speed', scope, period };
      }

      const distanceSorted = [...filtered].sort((a, b) => b.distance - a.distance);
      const distanceRank = distanceSorted.findIndex(t => t.id === trip.id) + 1;
      if (distanceRank > 0 && distanceRank <= 10) {
        return { rank: distanceRank, category: 'Distance', scope, period };
      }

      const gForceSorted = [...filtered].sort((a, b) => (b.maxGForce ?? 0) - (a.maxGForce ?? 0));
      const gForceRank = gForceSorted.findIndex(t => t.id === trip.id) + 1;
      if (gForceRank > 0 && gForceRank <= 10) {
        return { rank: gForceRank, category: 'G-Force', scope, period };
      }

      return null;
    };

    if (tripCity && tripCity !== 'Unknown') {
      const cityTodayRank = checkRanking(
        t => t.location?.city === tripCity && t.startTime > oneDayAgo,
        `in ${tripCity}`,
        'today'
      );
      if (cityTodayRank) return cityTodayRank;

      const cityWeekRank = checkRanking(
        t => t.location?.city === tripCity && t.startTime > oneWeekAgo,
        `in ${tripCity}`,
        'this week'
      );
      if (cityWeekRank) return cityWeekRank;
    }

    if (tripCountry && tripCountry !== 'Unknown') {
      const countryTodayRank = checkRanking(
        t => t.location?.country === tripCountry && t.startTime > oneDayAgo,
        `in ${tripCountry}`,
        'today'
      );
      if (countryTodayRank) return countryTodayRank;

      const countryWeekRank = checkRanking(
        t => t.location?.country === tripCountry && t.startTime > oneWeekAgo,
        `in ${tripCountry}`,
        'this week'
      );
      if (countryWeekRank) return countryWeekRank;

      const countryAllTimeRank = checkRanking(
        t => t.location?.country === tripCountry,
        `in ${tripCountry}`,
        'all-time'
      );
      if (countryAllTimeRank) return countryAllTimeRank;
    }

    const globalTodayRank = checkRanking(
      t => t.startTime > oneDayAgo,
      'globally',
      'today'
    );
    if (globalTodayRank) return globalTodayRank;

    const globalAllTimeRank = checkRanking(
      () => true,
      'globally',
      'all-time'
    );
    return globalAllTimeRank;
  }, [trip, trips]);

  const getRankSuffix = (rank: number) => {
    if (rank === 1) return 'st';
    if (rank === 2) return 'nd';
    if (rank === 3) return 'rd';
    return 'th';
  };

  const handleSaveToDevice = useCallback(async () => {
    try {
      if (Platform.OS === 'web') {
        Alert.alert('Not Available', 'Saving to device is not available on web.');
        return;
      }

      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant media library permission to save images.');
        return;
      }

      const activeRef = currentPage === 0 ? viewShotRef : viewShotRef2;
      if (activeRef.current?.capture) {
        const uri = await activeRef.current.capture();
        await MediaLibrary.saveToLibraryAsync(uri);
        Alert.alert('Success', 'Trip card saved to your gallery!');
      }
    } catch (error) {
      console.error('Failed to save image:', error);
      Alert.alert('Error', 'Failed to save image. Please try again.');
    }
  }, [currentPage]);

  const handleShare = useCallback(async () => {
    try {
      if (Platform.OS === 'web') {
        Alert.alert('Not Available', 'Sharing is not available on web.');
        return;
      }

      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Not Available', 'Sharing is not available on this device.');
        return;
      }

      const activeRef = currentPage === 0 ? viewShotRef : viewShotRef2;
      if (activeRef.current?.capture) {
        const uri = await activeRef.current.capture();
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Share your trip',
        });
      }
    } catch (error) {
      console.error('Failed to share:', error);
      Alert.alert('Error', 'Failed to share. Please try again.');
    }
  }, [currentPage]);

  const speedValue = Math.round(convertSpeed(trip.topSpeed));
  const speedLabel = getSpeedLabel();
  const distanceValue = convertDistance(trip.distance);
  const distanceLabel = getDistanceLabel();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
            <X size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            style={styles.carouselContainer}
            contentContainerStyle={styles.carouselContent}
            snapToInterval={SNAP_INTERVAL}
            decelerationRate="fast"
            snapToAlignment="start"
          >
            <ViewShot
              ref={viewShotRef}
              options={{ format: 'png', quality: 1 }}
              style={styles.viewShotContainer}
            >
              <View style={[styles.card, isLight && styles.cardLight]}>
                <View style={styles.cardGradientOverlay} />
                
                <Image
                  source={{ uri: isLight 
                    ? 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/qrv9h3jhh7ukh7woc2r68' 
                    : 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/9ts3c4tgfcrqhgxwwrqfk' }}
                  style={styles.logoImage}
                  resizeMode="contain"
                />

                <View style={[styles.statsGrid, isLight && styles.statsGridLight]}>
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, isLight && styles.statValueLight]}>
                      {distanceValue < 1 ? distanceValue.toFixed(2) : Math.round(distanceValue)} {distanceLabel === 'mi' ? 'Mi' : 'Km'}
                    </Text>
                    <Text style={[styles.statLabel, isLight && styles.statLabelLight]}>Distance</Text>
                  </View>

                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, isLight && styles.statValueLight]}>{formatDuration(trip.duration)}</Text>
                    <Text style={[styles.statLabel, isLight && styles.statLabelLight]}>Total time</Text>
                  </View>

                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, isLight && styles.statValueLight]}>{trip.corners} time{trip.corners !== 1 ? 's' : ''}</Text>
                    <Text style={[styles.statLabel, isLight && styles.statLabelLight]}>Corners taken</Text>
                  </View>

                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, isLight && styles.statValueLight]}>{Math.round(convertSpeed(trip.avgSpeed))} {speedLabel}</Text>
                    <Text style={[styles.statLabel, isLight && styles.statLabelLight]}>Avg speed</Text>
                  </View>

                  <View style={[styles.statItem, styles.statItemCenter]}>
                    <Text style={[styles.statValue, isLight && styles.statValueLight]}>
                      {trip.time0to100 ? `${trip.time0to100.toFixed(1)}s` : '--'}
                    </Text>
                    <Text style={[styles.statLabel, isLight && styles.statLabelLight]}>0-100 km/h</Text>
                  </View>
                </View>

                <View style={[styles.highlightBox, isLight && styles.highlightBoxLight]}>
                  <Text style={[styles.highlightLabel, isLight && styles.highlightLabelLight]}>Top speed</Text>
                  <Text style={[styles.highlightValue, isLight && styles.highlightValueLight]}>{speedValue} {speedLabel}</Text>
                  
                  {rankingInfo && (
                    <View style={styles.rankingContainer}>
                      <Text style={styles.rankingText}>
                        <Text style={styles.rankingNumber}>
                          {rankingInfo.rank}{getRankSuffix(rankingInfo.rank)}
                        </Text>
                        {'\n'}
                        <Text style={[styles.rankingDescription, isLight && styles.rankingDescriptionLight]}>
                          {rankingInfo.category.toLowerCase()} {rankingInfo.scope} {rankingInfo.period}
                        </Text>
                      </Text>
                    </View>
                  )}
                </View>

                <Text style={[styles.dateLocation, isLight && styles.dateLocationLight]}>
                  {formatDate(trip.startTime)} - {getLocationString()}
                </Text>
              </View>
            </ViewShot>

            <ViewShot
              ref={viewShotRef2}
              options={{ format: 'png', quality: 1 }}
              style={[styles.viewShotContainer, styles.secondCard]}
            >
              <View style={[styles.card, styles.routeCard, isLight && styles.cardLight]}>
                <Image
                  source={{ uri: isLight 
                    ? 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/qrv9h3jhh7ukh7woc2r68' 
                    : 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/9ts3c4tgfcrqhgxwwrqfk' }}
                  style={styles.logoImageSmall}
                  resizeMode="contain"
                />

                <View style={styles.routeStatsRow}>
                  <View style={styles.routeStatItem}>
                    <Text style={[styles.routeStatValue, isLight && styles.statValueLight]}>
                      {distanceValue < 1 ? distanceValue.toFixed(2) : Math.round(distanceValue)} {distanceLabel === 'mi' ? 'Mi' : 'Km'}
                    </Text>
                    <Text style={[styles.routeStatLabel, isLight && styles.statLabelLight]}>Distance</Text>
                  </View>
                  <View style={styles.routeStatItem}>
                    <Text style={[styles.routeStatValue, isLight && styles.statValueLight]}>{formatDuration(trip.duration)}</Text>
                    <Text style={[styles.routeStatLabel, isLight && styles.statLabelLight]}>Time</Text>
                  </View>
                </View>

                <View style={styles.routeStatsRow}>
                  <View style={styles.routeStatItem}>
                    <Text style={[styles.routeStatValue, isLight && styles.statValueLight]}>{Math.round(convertSpeed(trip.avgSpeed))} {speedLabel}</Text>
                    <Text style={[styles.routeStatLabel, isLight && styles.statLabelLight]}>Avg Speed</Text>
                  </View>
                  <View style={styles.routeStatItem}>
                    <Text style={[styles.routeStatValue, isLight && styles.statValueLight]}>{trip.corners}</Text>
                    <Text style={[styles.routeStatLabel, isLight && styles.statLabelLight]}>Corners</Text>
                  </View>
                </View>

                <View style={[styles.routeMapContainer, isLight && styles.routeMapContainerLight]}>
                  {routePathData ? (
                    <Svg width={routePathData.svgWidth} height={routePathData.svgHeight}>
                      <Defs>
                        <LinearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <Stop offset="0%" stopColor="#CC0000" stopOpacity="1" />
                          <Stop offset="100%" stopColor="#CC0000" stopOpacity="1" />
                        </LinearGradient>
                      </Defs>
                      <Polyline
                        points={routePathData.points}
                        fill="none"
                        stroke="url(#routeGradient)"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  ) : (
                    <Text style={[styles.noRouteText, isLight && styles.noRouteTextLight]}>No route data</Text>
                  )}
                </View>

                <Text style={[styles.dateLocation, isLight && styles.dateLocationLight]}>
                  {formatDate(trip.startTime)} - {getLocationString()}
                </Text>
              </View>
            </ViewShot>
          </ScrollView>

          <View style={styles.pageIndicatorContainer}>
            <View style={[styles.pageIndicator, currentPage === 0 && styles.pageIndicatorActive]} />
            <View style={[styles.pageIndicator, currentPage === 1 && styles.pageIndicatorActive]} />
          </View>

          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleSaveToDevice}
              activeOpacity={0.7}
            >
              <Download size={20} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Save</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.shareButton]}
              onPress={handleShare}
              activeOpacity={0.7}
            >
              <Share2 size={20} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
  },
  closeButton: {
    position: 'absolute',
    top: -40,
    right: 0,
    padding: 8,
    zIndex: 10,
  },
  carouselContainer: {
    maxHeight: 520,
    width: CARD_WIDTH,
  },
  carouselContent: {
    paddingRight: CARD_GAP,
  },
  viewShotContainer: {
    borderRadius: 20,
    overflow: 'hidden',
    width: CARD_WIDTH,
  },
  secondCard: {
    marginLeft: CARD_GAP,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#0A0A0A',
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardGradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    borderRadius: 20,
  },
  logoImage: {
    width: 210,
    height: 63,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 28,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 24,
    paddingLeft: 25,
  },
  statItem: {
    width: '50%',
    marginBottom: 24,
  },
  statItemCenter: {
    width: '100%',
    alignItems: 'center',
    marginLeft: -12,
  },
  statValue: {
    fontFamily: 'Orbitron_700Bold',
    fontSize: 20,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  statLabel: {
    fontFamily: 'Orbitron_400Regular',
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'capitalize',
  },
  highlightBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  highlightLabel: {
    fontFamily: 'Orbitron_400Regular',
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 8,
  },
  highlightValue: {
    fontFamily: 'Orbitron_700Bold',
    fontSize: 42,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  rankingContainer: {
    marginTop: 12,
    alignItems: 'center',
  },
  rankingText: {
    textAlign: 'center',
  },
  rankingNumber: {
    fontFamily: 'Orbitron_700Bold',
    fontSize: 18,
    color: '#FFD700',
  },
  rankingDescription: {
    fontFamily: 'Orbitron_400Regular',
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  dateLocation: {
    fontFamily: 'Orbitron_400Regular',
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.4)',
    textAlign: 'center',
  },
  dateLocationLight: {
    color: 'rgba(0, 0, 0, 0.5)',
  },
  cardLight: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  routeCard: {
    paddingVertical: 24,
  },
  logoImageSmall: {
    width: 160,
    height: 48,
    alignSelf: 'center',
    marginBottom: 20,
  },
  routeStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  routeStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  routeStatValue: {
    fontFamily: 'Orbitron_700Bold',
    fontSize: 18,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  routeStatLabel: {
    fontFamily: 'Orbitron_400Regular',
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  routeMapContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    marginHorizontal: 0,
    marginVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 260,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  routeMapContainerLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  noRouteText: {
    fontFamily: 'Orbitron_400Regular',
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.3)',
  },
  noRouteTextLight: {
    color: 'rgba(0, 0, 0, 0.3)',
  },
  pageIndicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
    gap: 8,
  },
  pageIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  pageIndicatorActive: {
    backgroundColor: '#FF3B30',
  },
  statsGridLight: {},
  statValueLight: {
    color: '#1A1A1A',
  },
  statLabelLight: {
    color: 'rgba(0, 0, 0, 0.5)',
  },
  highlightBoxLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  highlightLabelLight: {
    color: 'rgba(0, 0, 0, 0.6)',
  },
  highlightValueLight: {
    color: '#1A1A1A',
  },
  rankingDescriptionLight: {
    color: 'rgba(0, 0, 0, 0.5)',
  },
  actionsContainer: {
    flexDirection: 'row',
    marginTop: 24,
    gap: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    gap: 8,
    flex: 1,
  },
  shareButton: {
    backgroundColor: '#00C853',
  },
  actionButtonText: {
    fontFamily: 'Orbitron_600SemiBold',
    fontSize: 14,
    color: '#FFFFFF',
  },
});
