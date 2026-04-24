import { View } from 'react-native';
import { Image } from 'expo-image';
import { Text } from './Text';
import { getInitials } from '~/src/lib/avatarInitials';
import { cn } from '~/src/lib/cn';

export type AvatarProps = {
  displayName: string;
  photoUrl: string | null;
  /** Size in pixels (width == height). Defaults to 40. */
  size?: number;
  /** Opacity applied to the photo; used by the Likes Inbox free-tier blur. */
  photoOpacity?: number;
  className?: string;
};

/**
 * Circular avatar with photo + initials fallback. Shared across LikeCard,
 * MatchRow, ChatHeader so the three treatments stay visually aligned.
 * Size is a prop because the match row uses 56px, the chat header 40px,
 * and the like card 64px — no shared size token needed.
 */
export function Avatar({
  displayName,
  photoUrl,
  size = 40,
  photoOpacity = 1,
  className,
}: AvatarProps) {
  return (
    <View
      className={cn(
        'rounded-full bg-plum-50 overflow-hidden items-center justify-center',
        className,
      )}
      style={{ width: size, height: size }}
    >
      {photoUrl ? (
        <Image
          source={{ uri: photoUrl }}
          style={{ width: '100%', height: '100%', opacity: photoOpacity }}
          contentFit="cover"
        />
      ) : (
        <Text
          variant="heading"
          className="text-plum-600"
          style={{ fontSize: size * 0.32 }}
        >
          {getInitials(displayName)}
        </Text>
      )}
    </View>
  );
}
