import { View } from 'react-native';
import { useQuery } from 'convex/react';
import { api } from '~/convex/_generated/api';
import type { Id } from '~/convex/_generated/dataModel';
import { Text } from '~/src/components/ui/Text';
import { Button } from '~/src/components/ui/Button';
import { ProfileView } from './ProfileView';

export type ProfileDetailScreenProps = {
  userId: Id<'users'>;
};

export function ProfileDetailScreen({ userId }: ProfileDetailScreenProps) {
  const profile = useQuery(api.profiles.getPublic, { userId });

  if (profile === undefined) {
    return <View className="flex-1 bg-cream-50" />;
  }
  if (profile === null) {
    return (
      <View className="flex-1 items-center justify-center bg-cream-50 px-5">
        <Text variant="heading" className="text-2xl text-plum-600 mb-2">
          Profile unavailable
        </Text>
        <Text variant="body" className="text-base text-plum-900 text-center">
          This profile can't be shown right now.
        </Text>
      </View>
    );
  }

  return (
    <ProfileView
      displayName={profile.displayName}
      age={profile.age}
      pronouns={profile.pronouns}
      identityLabel={profile.identityLabel}
      intentions={profile.intentions}
      city={profile.city}
      photos={profile.photos.map((p) => ({
        _id: p._id,
        url: p.url,
        width: p.width,
        height: p.height,
        isVerified: p.isVerified,
      }))}
      prompts={profile.prompts.map((p) => ({
        _id: p._id,
        question: p.question,
        category: p.category,
        answerText: p.answerText,
      }))}
      variant="public"
      bottomSlot={
        <Button
          label="Like with a comment — coming soon"
          variant="secondary"
          disabled
        />
      }
    />
  );
}
