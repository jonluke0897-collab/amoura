import { Pressable, View } from 'react-native';
import { Avatar } from '~/src/components/ui/Avatar';
import { Text } from '~/src/components/ui/Text';
import { formatMatchListActivity } from '~/src/lib/dateFormat';

export type MatchRowProps = {
  displayName: string;
  photoUrl: string | null;
  lastMessagePreview: string | null;
  lastMessageAt: number | null;
  unreadCount: number;
  onPress: () => void;
};

/**
 * Single row in the Matches tab list. Unread state is indicated by both a
 * plum dot next to the timestamp AND bolder body text — redundant by
 * design so the state reads at a glance without relying on color alone.
 */
export function MatchRow({
  displayName,
  photoUrl,
  lastMessagePreview,
  lastMessageAt,
  unreadCount,
  onPress,
}: MatchRowProps) {
  const hasUnread = unreadCount > 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open chat with ${displayName}`}
      className="flex-row items-center px-4 py-3 bg-cream-50"
    >
      <Avatar displayName={displayName} photoUrl={photoUrl} size={56} />
      <View className="flex-1 ml-3">
        <View className="flex-row items-center">
          <Text
            variant="heading"
            className="text-base text-plum-900 flex-1"
            numberOfLines={1}
          >
            {displayName}
          </Text>
          {lastMessageAt !== null && (
            <Text variant="caption" className="text-xs ml-2">
              {formatMatchListActivity(lastMessageAt)}
            </Text>
          )}
        </View>
        <View className="flex-row items-center mt-1">
          <Text
            variant="body"
            numberOfLines={1}
            className={`flex-1 text-sm ${
              hasUnread ? 'text-plum-900 font-semibold' : 'text-plum-600'
            }`}
          >
            {lastMessagePreview ?? 'New match — say hi.'}
          </Text>
          {hasUnread && (
            <View className="ml-2 w-2 h-2 rounded-full bg-plum-600" />
          )}
        </View>
      </View>
    </Pressable>
  );
}

