import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  View,
  type ListRenderItem,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useQuery } from 'convex/react';
import { api } from '~/convex/_generated/api';
import { AnalyticsEvents, useTrack } from '~/src/lib/analytics';
import { ProfileCard } from './ProfileCard';
import { EndOfFeed, LoadingFeed, NoCityYet, NoMatches } from './EmptyStates';
import type { FeedItem } from './types';
import {
  FEED_PAGE_SIZE,
  useFeedPagination,
  type FeedFilters,
} from './useFeedPagination';

// Once the user is within this many cards of the end, start loading the next
// page. Matches the roadmap guidance of "≈3 cards from the end".
const LOAD_MORE_THRESHOLD = 0.3;

export type BrowseFeedProps = {
  /** Bump this number to reset pagination to page 1. Pull-to-refresh bumps
   *  it internally via `onRequestRefresh`; the FilterSheet-apply flow does
   *  so from the parent so both share one nonce. */
  refreshKey: number;
  onRequestRefresh: () => void;
  onRequestSetCity?: () => void;
  onRequestOpenFilters?: () => void;
};

export function BrowseFeed({
  refreshKey,
  onRequestRefresh,
  onRequestSetCity,
  onRequestOpenFilters,
}: BrowseFeedProps) {
  const router = useRouter();
  const track = useTrack();
  const [listHeight, setListHeight] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Fire feed_viewed on focus; emit feed_session_duration on blur with the
  // elapsed ms. Wrapping track with useCallback inside the effect factory
  // keeps the effect from tearing down every render.
  useFocusEffect(
    useCallback(() => {
      const start = Date.now();
      track(AnalyticsEvents.FEED_VIEWED);
      return () => {
        track(AnalyticsEvents.FEED_SESSION_DURATION, {
          durationMs: Date.now() - start,
        });
      };
    }, [track]),
  );

  const prefs = useQuery(api.profiles.getMinePreferences);

  // Empty filters = use viewer's stored prefs on the server. TASK-041 wires
  // the FilterSheet through — the sheet writes updates to the profile, then
  // the parent bumps refreshKey so pagination restarts on the fresh prefs.
  const filters = useMemo<FeedFilters>(() => ({}), []);
  const feed = useFeedPagination(filters, refreshKey);

  // Clear the pull-to-refresh spinner once Convex transitions out of
  // LoadingFirstPage. Filter-apply refreshes won't set `refreshing`, so the
  // spinner only shows on pull gestures.
  useEffect(() => {
    if (refreshing && feed.status !== 'LoadingFirstPage') {
      setRefreshing(false);
    }
  }, [refreshing, feed.status]);

  const handlePullToRefresh = useCallback(() => {
    setRefreshing(true);
    onRequestRefresh();
  }, [onRequestRefresh]);

  const onEndReached = useCallback(() => {
    if (feed.status === 'CanLoadMore') {
      feed.loadMore(FEED_PAGE_SIZE);
    }
  }, [feed]);

  const renderItem: ListRenderItem<FeedItem> = useCallback(
    ({ item, index }) => (
      <ProfileCard
        item={item}
        height={listHeight}
        onPress={() => {
          track(AnalyticsEvents.PROFILE_CARD_TAPPED, {
            targetUserId: item.userId,
            position: index,
          });
          router.push(`/profile/${item.userId}`);
        }}
      />
    ),
    [listHeight, router, track],
  );

  const keyExtractor = useCallback((item: FeedItem) => item.userId, []);

  const city = prefs?.city ?? null;

  return (
    <View
      className="flex-1 bg-cream-50"
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height;
        if (h > 0 && h !== listHeight) setListHeight(h);
      }}
    >
      {listHeight === 0 ? null : prefs === undefined || prefs === null ? (
        <LoadingFeed />
      ) : !prefs.city ? (
        <NoCityYet onSetCity={onRequestSetCity} />
      ) : feed.status === 'LoadingFirstPage' && !refreshing ? (
        <LoadingFeed />
      ) : feed.results.length === 0 ? (
        <NoMatches onAdjustFilters={onRequestOpenFilters} />
      ) : (
        <FlatList
          data={feed.results as FeedItem[]}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          pagingEnabled
          snapToInterval={listHeight}
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          getItemLayout={(_, index) => ({
            length: listHeight,
            offset: listHeight * index,
            index,
          })}
          removeClippedSubviews
          windowSize={3}
          maxToRenderPerBatch={2}
          initialNumToRender={1}
          onEndReached={onEndReached}
          onEndReachedThreshold={LOAD_MORE_THRESHOLD}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handlePullToRefresh}
              tintColor="#6D28D9"
              colors={['#6D28D9']}
            />
          }
          ListFooterComponent={
            feed.status === 'LoadingMore' ? (
              <View className="py-4 items-center">
                <ActivityIndicator color="#6D28D9" />
              </View>
            ) : feed.status === 'Exhausted' ? (
              <View style={{ height: listHeight }}>
                <EndOfFeed city={city} onAdjustFilters={onRequestOpenFilters} />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}
