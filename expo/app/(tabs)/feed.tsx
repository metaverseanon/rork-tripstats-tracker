import React, { useMemo, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Platform,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Navigation, Clock, MapPin, Search, X, UserPlus, Car, Zap, Users, Plus, Bell, Gauge } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useSettings } from '@/providers/SettingsProvider';
import { useUser } from '@/providers/UserProvider';
import { trpc } from '@/lib/trpc';
import { ThemeColors } from '@/constants/colors';

interface FeedItem {
  id: string;
  userId: string;
  userName: string;
  userProfilePicture?: string;
  type: string;
  tripId?: string;
  carModel?: string;
  topSpeed: number;
  distance: number;
  duration: number;
  country?: string;
  city?: string;
  createdAt: number;
}

interface PostItem {
  id: string;
  userId: string;
  userName: string;
  userProfilePicture?: string;
  userCarBrand?: string;
  userCarModel?: string;
  text?: string;
  imageUrl?: string;
  revCount: number;
  isRevved: boolean;
  createdAt: number;
}

interface SearchUser {
  id: string;
  displayName: string;
  carBrand?: string;
  carModel?: string;
  country?: string;
  city?: string;
}

type CombinedFeedItem =
  | { kind: 'activity'; data: FeedItem }
  | { kind: 'post'; data: PostItem };

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useUser();
  const { convertSpeed, convertDistance, getSpeedLabel, getDistanceLabel, colors } = useSettings();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const styles = useMemo(() => createStyles(colors), [colors]);
  const utils = trpc.useUtils();

  const feedQuery = trpc.social.getFeed.useQuery(
    { userId: user?.id || '', limit: 30 },
    { enabled: !!user?.id, refetchInterval: 60000 }
  );

  const postsQuery = trpc.posts.getFeedPosts.useQuery(
    { userId: user?.id || '', limit: 30 },
    { enabled: !!user?.id, refetchInterval: 60000 }
  );

  const searchUsersQuery = trpc.social.searchUsers.useQuery(
    { query: searchQuery, currentUserId: user?.id || '' },
    { enabled: !!user?.id && searchQuery.length >= 2 }
  );

  const followCountsQuery = trpc.social.getFollowCounts.useQuery(
    { userId: user?.id || '' },
    { enabled: !!user?.id }
  );

  const unreadCountQuery = trpc.posts.getUnreadNotificationCount.useQuery(
    { userId: user?.id || '' },
    { enabled: !!user?.id, refetchInterval: 30000 }
  );

  const revPostMutation = trpc.posts.revPost.useMutation({
    onSuccess: () => {
      void utils.posts.getFeedPosts.invalidate();
    },
  });

  const unrevPostMutation = trpc.posts.unrevPost.useMutation({
    onSuccess: () => {
      void utils.posts.getFeedPosts.invalidate();
    },
  });

  const handleRefresh = useCallback(() => {
    void feedQuery.refetch();
    void postsQuery.refetch();
    void followCountsQuery.refetch();
    void unreadCountQuery.refetch();
  }, [feedQuery, postsQuery, followCountsQuery, unreadCountQuery]);

  const handleUserPress = useCallback((userId: string) => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/user-profile', params: { userId } });
  }, [router]);

  const handleRevPress = useCallback((postId: string, isRevved: boolean) => {
    if (!user?.id) return;
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isRevved) {
      unrevPostMutation.mutate({ postId, userId: user.id });
    } else {
      revPostMutation.mutate({ postId, userId: user.id });
    }
  }, [user?.id, revPostMutation, unrevPostMutation]);

  const toggleSearch = useCallback(() => {
    setIsSearching(prev => !prev);
    setSearchQuery('');
  }, []);

  const combinedFeed = useMemo<CombinedFeedItem[]>(() => {
    const items: CombinedFeedItem[] = [];

    const activityData = feedQuery.data ?? [];
    const postsData = postsQuery.data ?? [];

    for (const a of activityData) {
      items.push({ kind: 'activity', data: a });
    }
    for (const p of postsData) {
      items.push({ kind: 'post', data: p });
    }

    items.sort((a, b) => {
      const aTime = a.kind === 'activity' ? a.data.createdAt : a.data.createdAt;
      const bTime = b.kind === 'activity' ? b.data.createdAt : b.data.createdAt;
      return bTime - aTime;
    });

    return items;
  }, [feedQuery.data, postsQuery.data]);

  const renderActivityItem = useCallback((item: FeedItem) => {
    const initial = item.userName?.[0]?.toUpperCase() || '?';

    return (
      <TouchableOpacity
        style={styles.feedCard}
        onPress={() => handleUserPress(item.userId)}
        activeOpacity={0.7}
      >
        <View style={styles.feedCardHeader}>
          <View style={styles.feedAvatar}>
            {item.userProfilePicture ? (
              <Image source={{ uri: item.userProfilePicture }} style={styles.feedAvatarImage} />
            ) : (
              <Text style={styles.feedAvatarText}>{initial}</Text>
            )}
          </View>
          <View style={styles.feedHeaderInfo}>
            <Text style={styles.feedUserName} numberOfLines={1}>{item.userName}</Text>
            <Text style={styles.feedTime}>{formatTimeAgo(item.createdAt)}</Text>
          </View>
          {item.carModel && (
            <View style={styles.feedCarBadge}>
              <Car size={12} color={colors.accent} />
              <Text style={styles.feedCarText} numberOfLines={1}>{item.carModel}</Text>
            </View>
          )}
        </View>

        <View style={styles.feedCardBody}>
          <Text style={styles.feedActivityText}>Logged a drive</Text>
          {(item.city || item.country) && (
            <View style={styles.feedLocationRow}>
              <MapPin size={12} color={colors.textLight} />
              <Text style={styles.feedLocationText}>
                {item.city}{item.city && item.country ? ', ' : ''}{item.country}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.feedStatsRow}>
          <View style={styles.feedStatItem}>
            <Zap size={14} color={colors.warning} />
            <Text style={styles.feedStatValue}>{Math.round(convertSpeed(item.topSpeed))}</Text>
            <Text style={styles.feedStatUnit}>{getSpeedLabel()}</Text>
          </View>
          <View style={styles.feedStatDivider} />
          <View style={styles.feedStatItem}>
            <Navigation size={14} color={colors.accent} />
            <Text style={styles.feedStatValue}>{convertDistance(item.distance).toFixed(1)}</Text>
            <Text style={styles.feedStatUnit}>{getDistanceLabel()}</Text>
          </View>
          <View style={styles.feedStatDivider} />
          <View style={styles.feedStatItem}>
            <Clock size={14} color={colors.primary} />
            <Text style={styles.feedStatValue}>{formatDuration(item.duration)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [styles, colors, convertSpeed, convertDistance, getSpeedLabel, getDistanceLabel, handleUserPress]);

  const renderPostItem = useCallback((item: PostItem) => {
    const initial = item.userName?.[0]?.toUpperCase() || '?';
    const carDisplay = item.userCarBrand
      ? `${item.userCarBrand}${item.userCarModel ? ` ${item.userCarModel}` : ''}`
      : null;

    return (
      <View style={styles.feedCard}>
        <TouchableOpacity
          style={styles.feedCardHeader}
          onPress={() => handleUserPress(item.userId)}
          activeOpacity={0.7}
        >
          <View style={styles.feedAvatar}>
            {item.userProfilePicture ? (
              <Image source={{ uri: item.userProfilePicture }} style={styles.feedAvatarImage} />
            ) : (
              <Text style={styles.feedAvatarText}>{initial}</Text>
            )}
          </View>
          <View style={styles.feedHeaderInfo}>
            <Text style={styles.feedUserName} numberOfLines={1}>{item.userName}</Text>
            <Text style={styles.feedTime}>{formatTimeAgo(item.createdAt)}</Text>
          </View>
          {carDisplay && (
            <View style={styles.feedCarBadge}>
              <Car size={12} color={colors.accent} />
              <Text style={styles.feedCarText} numberOfLines={1}>{carDisplay}</Text>
            </View>
          )}
        </TouchableOpacity>

        {item.text ? (
          <View style={styles.postTextContainer}>
            <Text style={styles.postText}>{item.text}</Text>
          </View>
        ) : null}

        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.postImage} resizeMode="cover" />
        ) : null}

        <View style={styles.postFooter}>
          <TouchableOpacity
            style={[styles.revButton, item.isRevved && styles.revButtonActive]}
            onPress={() => handleRevPress(item.id, item.isRevved)}
            activeOpacity={0.7}
            testID={`rev-button-${item.id}`}
          >
            <Gauge size={16} color={item.isRevved ? colors.accent : colors.textLight} />
            <Text style={[styles.revCount, item.isRevved && styles.revCountActive]}>
              {item.revCount}
            </Text>
            <Text style={[styles.revLabel, item.isRevved && styles.revLabelActive]}>
              {item.revCount === 1 ? 'rev' : 'revs'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [styles, colors, handleUserPress, handleRevPress]);

  const renderCombinedItem = useCallback(({ item }: { item: CombinedFeedItem }) => {
    if (item.kind === 'activity') {
      return renderActivityItem(item.data);
    }
    return renderPostItem(item.data);
  }, [renderActivityItem, renderPostItem]);

  const renderSearchResult = useCallback(({ item }: { item: SearchUser }) => {
    const carDisplay = item.carBrand
      ? `${item.carBrand}${item.carModel ? ` ${item.carModel}` : ''}`
      : null;

    return (
      <TouchableOpacity
        style={styles.searchResultItem}
        onPress={() => {
          handleUserPress(item.id);
          setIsSearching(false);
          setSearchQuery('');
        }}
        activeOpacity={0.7}
      >
        <View style={styles.searchAvatar}>
          <Text style={styles.searchAvatarText}>{item.displayName[0].toUpperCase()}</Text>
        </View>
        <View style={styles.searchResultInfo}>
          <Text style={styles.searchResultName} numberOfLines={1}>{item.displayName}</Text>
          {carDisplay && (
            <Text style={styles.searchResultCar} numberOfLines={1}>{carDisplay}</Text>
          )}
          {(item.city || item.country) && (
            <Text style={styles.searchResultLocation} numberOfLines={1}>
              {item.city}{item.city && item.country ? ', ' : ''}{item.country}
            </Text>
          )}
        </View>
        <UserPlus size={18} color={colors.textLight} />
      </TouchableOpacity>
    );
  }, [styles, colors, handleUserPress]);

  const emptyFeed = useMemo(() => (
    <View style={styles.emptyContainer}>
      <Users size={48} color={colors.textLight} />
      <Text style={styles.emptyTitle}>Your feed is empty</Text>
      <Text style={styles.emptySubtext}>
        Follow other drivers to see their activity here
      </Text>
      <TouchableOpacity
        style={styles.emptySearchButton}
        onPress={toggleSearch}
        activeOpacity={0.7}
      >
        <Search size={16} color="#fff" />
        <Text style={styles.emptySearchButtonText}>Find Drivers</Text>
      </TouchableOpacity>
    </View>
  ), [styles, colors, toggleSearch]);

  const unreadCount = unreadCountQuery.data?.count ?? 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Feed</Text>
        <View style={styles.headerRight}>
<TouchableOpacity
            style={styles.bellButton}
            onPress={() => router.push('/notifications' as any)}
            activeOpacity={0.7}
            testID="notifications-button"
          >
            <Bell size={20} color={colors.text} />
            {unreadCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.searchToggle, isSearching && styles.searchToggleActive]}
            onPress={toggleSearch}
            activeOpacity={0.7}
          >
            {isSearching ? <X size={18} color={colors.text} /> : <Search size={18} color={colors.text} />}
          </TouchableOpacity>
        </View>
      </View>

      {isSearching && (
        <View style={styles.searchContainer}>
          <View style={styles.searchInputWrapper}>
            <Search size={16} color={colors.textLight} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search drivers..."
              placeholderTextColor={colors.textLight}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              testID="search-input"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={16} color={colors.textLight} />
              </TouchableOpacity>
            )}
          </View>
          {searchQuery.length >= 2 && (
            <FlatList
              data={searchUsersQuery.data ?? []}
              renderItem={renderSearchResult}
              keyExtractor={(item) => item.id}
              style={styles.searchResults}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                searchUsersQuery.isLoading ? (
                  <ActivityIndicator size="small" color={colors.accent} style={{ marginTop: 20 }} />
                ) : (
                  <Text style={styles.searchNoResults}>No drivers found</Text>
                )
              }
            />
          )}
        </View>
      )}

      {(feedQuery.isLoading && postsQuery.isLoading) ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={combinedFeed}
          renderItem={renderCombinedItem}
          keyExtractor={(item) => `${item.kind}_${item.data.id}`}
          contentContainerStyle={[
            styles.feedList,
            combinedFeed.length === 0 && styles.feedListEmpty,
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={feedQuery.isRefetching || postsQuery.isRefetching}
              onRefresh={handleRefresh}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={emptyFeed}
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/create-post' as any)}
        activeOpacity={0.8}
        testID="create-post-fab"
      >
        <Plus size={26} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: 'Orbitron_700Bold',
    color: colors.text,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  headerStats: {
    alignItems: 'center',
  },
  headerStatValue: {
    fontSize: 14,
    fontFamily: 'Orbitron_700Bold',
    color: colors.text,
  },
  headerStatLabel: {
    fontSize: 9,
    fontFamily: 'Orbitron_400Regular',
    color: colors.textLight,
  },
  bellButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.cardLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  bellBadgeText: {
    fontSize: 10,
    fontFamily: 'Orbitron_700Bold',
    color: '#FFFFFF',
  },
  searchToggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.cardLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchToggleActive: {
    backgroundColor: colors.accent + '20',
    borderColor: colors.accent,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    maxHeight: 350,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    fontFamily: 'Orbitron_400Regular',
    padding: 0,
  },
  searchResults: {
    marginTop: 12,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardLight,
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.accent + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchAvatarText: {
    fontSize: 16,
    fontFamily: 'Orbitron_700Bold',
    color: colors.accent,
  },
  searchResultInfo: {
    flex: 1,
    gap: 2,
  },
  searchResultName: {
    fontSize: 14,
    fontFamily: 'Orbitron_600SemiBold',
    color: colors.text,
  },
  searchResultCar: {
    fontSize: 11,
    fontFamily: 'Orbitron_400Regular',
    color: colors.accent,
  },
  searchResultLocation: {
    fontSize: 10,
    fontFamily: 'Orbitron_400Regular',
    color: colors.textLight,
  },
  searchNoResults: {
    textAlign: 'center' as const,
    fontSize: 13,
    fontFamily: 'Orbitron_400Regular',
    color: colors.textLight,
    marginTop: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedList: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 90,
  },
  feedListEmpty: {
    flex: 1,
    justifyContent: 'center',
  },
  feedCard: {
    backgroundColor: colors.cardLight,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  feedCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    paddingBottom: 10,
    gap: 10,
  },
  feedAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent + '15',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.accent + '40',
    overflow: 'hidden',
  },
  feedAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  feedAvatarText: {
    fontSize: 15,
    fontFamily: 'Orbitron_700Bold',
    color: colors.accent,
  },
  feedHeaderInfo: {
    flex: 1,
  },
  feedUserName: {
    fontSize: 14,
    fontFamily: 'Orbitron_600SemiBold',
    color: colors.text,
  },
  feedTime: {
    fontSize: 10,
    fontFamily: 'Orbitron_400Regular',
    color: colors.textLight,
    marginTop: 2,
  },
  feedCarBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accent + '12',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    maxWidth: 130,
  },
  feedCarText: {
    fontSize: 10,
    fontFamily: 'Orbitron_500Medium',
    color: colors.accent,
  },
  feedCardBody: {
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  feedActivityText: {
    fontSize: 13,
    fontFamily: 'Orbitron_500Medium',
    color: colors.text,
    marginBottom: 4,
  },
  feedLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  feedLocationText: {
    fontSize: 11,
    fontFamily: 'Orbitron_400Regular',
    color: colors.textLight,
  },
  feedStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: colors.background,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  feedStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  feedStatValue: {
    fontSize: 13,
    fontFamily: 'Orbitron_600SemiBold',
    color: colors.text,
  },
  feedStatUnit: {
    fontSize: 9,
    fontFamily: 'Orbitron_400Regular',
    color: colors.textLight,
  },
  feedStatDivider: {
    width: 1,
    height: 18,
    backgroundColor: colors.border,
  },
  postTextContainer: {
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  postText: {
    fontSize: 14,
    fontFamily: 'Orbitron_400Regular',
    color: colors.text,
    lineHeight: 22,
  },
  postImage: {
    width: '100%',
    height: 280,
  },
  postFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  revButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.background,
  },
  revButtonActive: {
    backgroundColor: colors.accent + '15',
  },
  revCount: {
    fontSize: 14,
    fontFamily: 'Orbitron_600SemiBold',
    color: colors.textLight,
  },
  revCountActive: {
    color: colors.accent,
  },
  revLabel: {
    fontSize: 12,
    fontFamily: 'Orbitron_400Regular',
    color: colors.textLight,
  },
  revLabelActive: {
    color: colors.accent,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Orbitron_700Bold',
    color: colors.text,
    marginTop: 8,
  },
  emptySubtext: {
    fontSize: 13,
    fontFamily: 'Orbitron_400Regular',
    color: colors.textLight,
    textAlign: 'center' as const,
    lineHeight: 20,
  },
  emptySearchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 12,
  },
  emptySearchButtonText: {
    fontSize: 14,
    fontFamily: 'Orbitron_600SemiBold',
    color: '#FFFFFF',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
});
