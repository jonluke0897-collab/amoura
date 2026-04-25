import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePaginatedQuery } from 'convex/react';
import { ChevronLeft, Shield } from 'lucide-react-native';
import { api } from '~/convex/_generated/api';
import { Avatar } from '~/src/components/ui/Avatar';
import { Button } from '~/src/components/ui/Button';
import { Text } from '~/src/components/ui/Text';
import { formatMatchListActivity } from '~/src/lib/dateFormat';
import { useUnblockAction } from '~/src/features/blocks/BlockAction';

const PAGE_SIZE = 20;

export default function BlockedUsersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const list = usePaginatedQuery(api.blocks.list, {}, { initialNumItems: PAGE_SIZE });
  const unblock = useUnblockAction();

  return (
    <View className="flex-1 bg-cream-50" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center px-3 py-2 border-b border-plum-50">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={12}
          className="h-10 w-10 items-center justify-center"
        >
          <ChevronLeft color="#6D28D9" size={22} />
        </Pressable>
        <Text variant="heading" className="text-lg text-plum-900 ml-1">
          Blocked users
        </Text>
      </View>

      {list.status === 'LoadingFirstPage' ? (
        <View
          className="flex-1 items-center justify-center"
          accessibilityRole="progressbar"
          accessibilityLabel="Loading blocked users"
        >
          <ActivityIndicator color="#6D28D9" />
        </View>
      ) : list.results.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Shield color="#A78BFA" size={40} />
          <Text variant="heading" className="text-lg text-plum-900 mt-4 text-center">
            You haven’t blocked anyone.
          </Text>
          <Text variant="body" className="text-sm text-plum-600 mt-2 text-center">
            When you do, they’ll show up here so you can take it back if you change your mind.
          </Text>
        </View>
      ) : (
        <FlatList
          data={list.results}
          keyExtractor={(row) => row.blockId}
          contentContainerStyle={{ paddingVertical: 8 }}
          onEndReached={() => {
            if (list.status === 'CanLoadMore') list.loadMore(PAGE_SIZE);
          }}
          onEndReachedThreshold={0.4}
          renderItem={({ item }) => {
            // Orphaned-block placeholder: the user row was purged after the
            // FR-029 30-day soft-delete window. Render a stripped-down
            // version of the row so the unblock button still works without
            // exposing dangling state.
            const isOrphan = item.displayName === null;
            const label = item.displayName ?? 'Account no longer available';
            return (
              <View className="flex-row items-center px-4 py-3 border-b border-plum-50">
                <Avatar
                  displayName={label}
                  photoUrl={item.firstPhotoUrl}
                  size={48}
                />
                <View className="flex-1 ml-3">
                  <Text
                    variant="body"
                    className={`text-base ${isOrphan ? 'text-plum-600 italic' : 'text-plum-900'}`}
                    numberOfLines={1}
                  >
                    {label}
                  </Text>
                  <Text variant="caption" className="text-xs text-plum-400 mt-0.5">
                    Blocked {formatMatchListActivity(item.blockedAt)}
                  </Text>
                </View>
                <View>
                  <Button
                    label="Unblock"
                    variant="secondary"
                    size="sm"
                    onPress={() =>
                      unblock({
                        targetUserId: item.userId,
                        displayName: item.displayName,
                      })
                    }
                  />
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}
