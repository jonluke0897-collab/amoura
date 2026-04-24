import { FlatList, View } from 'react-native';
import { useRouter } from 'expo-router';
import { usePaginatedQuery } from 'convex/react';
import { MessageCircle } from 'lucide-react-native';
import { api } from '~/convex/_generated/api';
import { Text } from '~/src/components/ui/Text';
import { MatchRow } from './MatchRow';

const PAGE_SIZE = 20;

export function MatchList() {
  const router = useRouter();
  const matches = usePaginatedQuery(
    api.matches.listMine,
    {},
    { initialNumItems: PAGE_SIZE },
  );

  if (matches.status === 'LoadingFirstPage') {
    return (
      <View className="flex-1 items-center justify-center bg-cream-50 px-6">
        <MessageCircle color="#A78BFA" size={40} />
        <Text variant="body" className="text-base text-plum-400 mt-3">
          Loading matches…
        </Text>
      </View>
    );
  }

  if (matches.results.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-cream-50 px-6">
        <MessageCircle color="#A78BFA" size={40} />
        <Text variant="heading" className="text-2xl text-plum-900 mt-4 text-center">
          No matches yet.
        </Text>
        <Text variant="body" className="text-base text-plum-600 mt-2 text-center">
          When someone likes you back, you'll talk here.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={matches.results}
      keyExtractor={(item) => item.matchId}
      className="flex-1 bg-cream-50"
      ItemSeparatorComponent={() => (
        <View className="h-px bg-plum-50 ml-20" />
      )}
      contentContainerStyle={{ paddingBottom: 32 }}
      onEndReached={() => {
        if (matches.status === 'CanLoadMore') matches.loadMore(PAGE_SIZE);
      }}
      onEndReachedThreshold={0.4}
      renderItem={({ item }) => (
        <MatchRow
          displayName={item.counterpartyDisplayName}
          photoUrl={item.counterpartyPhotoUrl}
          lastMessagePreview={item.lastMessagePreview}
          lastMessageAt={item.lastMessageAt}
          unreadCount={item.unreadCount}
          onPress={() => router.push(`/chat/${item.matchId}` as never)}
        />
      )}
    />
  );
}
