import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from 'convex/react';
import { ChevronLeft } from 'lucide-react-native';
import { api } from '~/convex/_generated/api';
import type { Id } from '~/convex/_generated/dataModel';
import { Text } from '~/src/components/ui/Text';
import { Button } from '~/src/components/ui/Button';
import { AnalyticsEvents, useTrack } from '~/src/lib/analytics';
import { ProfileView } from './ProfileView';

export type ProfileDetailScreenProps = {
  userId: Id<'users'>;
};

export function ProfileDetailScreen({ userId }: ProfileDetailScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const track = useTrack();
  const profile = useQuery(api.profiles.getPublic, { userId });

  useEffect(() => {
    track(AnalyticsEvents.PROFILE_DETAIL_VIEWED, { targetUserId: userId });
    // Intentionally narrow deps: we want one event per navigation, not one
    // per render. `track` is stable across renders via usePostHog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (profile === undefined) {
    return <View className="flex-1 bg-cream-50" />;
  }
  if (profile === null) {
    return (
      <View className="flex-1 items-center justify-center bg-cream-50 px-5">
        <Text variant="heading" className="text-2xl text-plum-600 mb-2">
          Profile unavailable
        </Text>
        <Text variant="body" className="text-base text-plum-900 text-center mb-6">
          This profile can't be shown right now.
        </Text>
        <Button label="Go back" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-cream-50">
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
          // Placeholder until Phase 4 TASK-047 wires Like-with-comment. Styling
          // (peach accent, cream label) previews the real CTA so the slot
          // reads as intentional rather than disabled/broken.
          <Button
            label="Like with a comment — coming soon"
            variant="secondary"
            disabled
          />
        }
      />

      {/* Sticky back button overlaid on the hero photo. Absolute-positioned so
          it sits above the ScrollView inside ProfileView. The plum-tinted
          cream pill keeps it readable over any photo without a heavier
          gradient overlay. */}
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={12}
        style={{ top: insets.top + 12 }}
        className="absolute left-4 h-10 w-10 rounded-full bg-cream-50/90 items-center justify-center shadow-card"
      >
        <ChevronLeft color="#6D28D9" size={22} />
      </Pressable>
    </View>
  );
}
