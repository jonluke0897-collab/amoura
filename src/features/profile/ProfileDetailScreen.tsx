import { useEffect, useMemo, useState } from 'react';
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
import { LikeWithCommentModal } from '~/src/features/likes/LikeWithCommentModal';
import { ProfileView, type LikeTarget } from './ProfileView';

export type ProfileDetailScreenProps = {
  userId: Id<'users'>;
};

export function ProfileDetailScreen({ userId }: ProfileDetailScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const track = useTrack();
  const profile = useQuery(api.profiles.getPublic, { userId });

  // Target + modal state. Selection persists across re-renders but resets
  // if the user navigates away (screen unmounts).
  const [selectedTarget, setSelectedTarget] = useState<LikeTarget | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    track(AnalyticsEvents.PROFILE_DETAIL_VIEWED);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Derive a short description of the selected target for the modal header.
  // Computed from the profile data rather than carried on the target — keeps
  // selection state minimal (just type + id).
  const targetDescription = useMemo(() => {
    if (!selectedTarget || !profile) return '';
    if (selectedTarget.type === 'prompt') {
      const prompt = profile.prompts.find((p) => p._id === selectedTarget.id);
      return prompt ? prompt.question : 'Their prompt';
    }
    return 'Their photo';
  }, [selectedTarget, profile]);

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
        selectableTargets
        selectedTarget={selectedTarget}
        onSelectTarget={setSelectedTarget}
        bottomSlot={
          <Button
            label={
              selectedTarget
                ? 'Like with a comment'
                : 'Tap a photo or prompt to start'
            }
            disabled={!selectedTarget}
            onPress={() => setModalVisible(true)}
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

      <LikeWithCommentModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        toUserId={profile.userId}
        toDisplayName={profile.displayName}
        target={selectedTarget}
        targetDescription={targetDescription}
        onSuccess={({ matchId }) => {
          setModalVisible(false);
          setSelectedTarget(null);
          if (matchId) {
            // Reciprocal like produced a match — route straight into chat.
            // Use replace so the back button from chat returns to browse
            // rather than bouncing back to this profile detail.
            router.replace(`/chat/${matchId}`);
          } else {
            // Pending like — go back to browse. The Likes Inbox will show
            // the liked-profile's response when it comes.
            router.back();
          }
        }}
      />
    </View>
  );
}
