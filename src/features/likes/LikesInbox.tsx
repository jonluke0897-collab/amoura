import { FlatList, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, usePaginatedQuery } from 'convex/react';
import { Heart } from 'lucide-react-native';
import { api } from '~/convex/_generated/api';
import { Text } from '~/src/components/ui/Text';
import { Button } from '~/src/components/ui/Button';
import { LikeCard } from './LikeCard';

const PAGE_SIZE = 10;

export function LikesInbox() {
  const router = useRouter();
  const me = useQuery(api.users.me);
  const inbox = usePaginatedQuery(
    api.likes.listInbound,
    {},
    { initialNumItems: PAGE_SIZE },
  );

  const isPaidTier = me?.hasActiveSubscription ?? false;

  // Loading state — both queries resolve in parallel; wait for both so the
  // paywall banner decision is right on first paint instead of flipping.
  if (me === undefined || inbox.status === 'LoadingFirstPage') {
    return (
      <View className="flex-1 items-center justify-center bg-cream-50 px-6">
        <Heart color="#A78BFA" size={40} />
        <Text variant="body" className="text-base text-plum-400 mt-3">
          Loading likes…
        </Text>
      </View>
    );
  }

  if (inbox.results.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-cream-50 px-6">
        <Heart color="#A78BFA" size={40} />
        <Text variant="heading" className="text-2xl text-plum-900 mt-4 text-center">
          Nothing yet.
        </Text>
        <Text variant="body" className="text-base text-plum-600 mt-2 text-center">
          When someone likes one of your prompts or photos, it'll land here.
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-cream-50">
      {!isPaidTier && (
        <View className="mx-4 mt-4 mb-1 rounded-md border border-plum-600 bg-plum-50 p-4">
          <Text variant="heading" className="text-lg text-plum-900">
            {inbox.results.length}
            {inbox.results.length === 1 ? ' person' : ' people'} liked you.
          </Text>
          <Text variant="body" className="text-sm text-plum-900 mt-1 mb-3">
            Go Premium to see who they are and what they said.
          </Text>
          {/* Paywall nav lands in Phase 6 (RevenueCat). Until then the
              button is cosmetic — kept visible so the design reads as
              complete, and wired to a /paywall route that 404s gracefully
              for now. */}
          <Button
            label="Unlock who liked you"
            onPress={() => router.push('/paywall' as never)}
          />
        </View>
      )}
      <FlatList
        data={inbox.results}
        keyExtractor={(item) => item.likeId}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 32 }}
        onEndReached={() => {
          if (inbox.status === 'CanLoadMore') inbox.loadMore(PAGE_SIZE);
        }}
        onEndReachedThreshold={0.4}
        renderItem={({ item }) => (
          <LikeCard
            likeId={item.likeId}
            fromDisplayName={item.fromDisplayName}
            fromAge={item.fromAge}
            fromPhotoUrl={item.fromPhotoUrl}
            fromCity={item.fromCity}
            fromPronouns={item.fromPronouns}
            comment={item.comment}
            targetType={item.targetType}
            targetDescription={item.targetDescription}
            isPaidTier={isPaidTier}
            onMatched={(matchId) => router.push(`/chat/${matchId}` as never)}
          />
        )}
      />
    </View>
  );
}
