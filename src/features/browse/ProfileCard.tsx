import { memo } from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { ChevronDown } from 'lucide-react-native';
import { Text } from '~/src/components/ui/Text';
import type { FeedItem } from './types';

export type ProfileCardProps = {
  item: FeedItem;
  height: number;
  onPress: () => void;
};

function ProfileCardImpl({ item, height, onPress }: ProfileCardProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open profile for ${item.displayName}`}
      style={{ height }}
      className="bg-cream-50"
    >
      {/* Photo — top ~60% of the card. cachePolicy=memory-disk lets a user
          scroll back up without a re-fetch; recyclingKey tells expo-image that
          each user's photo is a separate cache entry even though the same
          <Image> element is reused by FlatList. */}
      <View style={{ flex: 6 }} className="bg-plum-50">
        {item.firstPhotoUrl ? (
          <Image
            source={{ uri: item.firstPhotoUrl }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={150}
            recyclingKey={item.userId}
          />
        ) : null}
      </View>

      {/* Info block — bottom ~40%. Laid out top-down so the tap-to-see-more
          affordance hugs the bottom even on taller devices. */}
      <View style={{ flex: 4 }} className="px-5 pt-4 pb-3">
        <View className="flex-row items-baseline flex-wrap">
          <Text variant="heading" className="text-3xl text-plum-900 mr-2">
            {item.displayName}
          </Text>
          {item.age !== null && (
            <Text variant="heading" className="text-3xl text-plum-600">
              {item.age}
            </Text>
          )}
        </View>
        <Text variant="body" className="text-base text-plum-600 mt-1">
          {item.identityLabel}
          {item.city ? ` · ${item.city}` : ''}
        </Text>

        {item.pronouns.length > 0 && (
          <View className="flex-row flex-wrap mt-2">
            {item.pronouns.map((p) => (
              <View key={p} className="px-3 py-1 rounded-full bg-plum-50 mr-2 mb-1">
                <Text variant="body" className="text-sm text-plum-700">
                  {p}
                </Text>
              </View>
            ))}
          </View>
        )}

        {item.topPrompt && (
          <View className="mt-3 rounded-md border border-plum-50 bg-cream-50 p-3 shadow-card">
            <Text
              variant="heading"
              className="text-base text-plum-900"
              numberOfLines={2}
            >
              {item.topPrompt.question}
            </Text>
            {item.topPrompt.answerText ? (
              <Text
                variant="body"
                className="text-sm text-plum-900 mt-1 opacity-80"
                numberOfLines={3}
              >
                {item.topPrompt.answerText}
              </Text>
            ) : null}
          </View>
        )}

        <View className="flex-1" />
        <View className="items-center">
          <View className="flex-row items-center px-3 py-1.5 rounded-full bg-plum-50">
            <Text variant="body" className="text-sm text-plum-600 mr-1">
              Tap to see more
            </Text>
            <ChevronDown color="#6D28D9" size={16} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

// FlatList recycles renders often; memo avoids re-renders when the same item
// re-passes through renderItem with identical props.
export const ProfileCard = memo(ProfileCardImpl);
