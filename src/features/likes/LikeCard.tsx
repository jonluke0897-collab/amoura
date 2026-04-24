import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useMutation } from 'convex/react';
import { Heart, X } from 'lucide-react-native';
import { api } from '~/convex/_generated/api';
import type { Id } from '~/convex/_generated/dataModel';
import { Avatar } from '~/src/components/ui/Avatar';
import { Text } from '~/src/components/ui/Text';
import { AnalyticsEvents, useTrack } from '~/src/lib/analytics';
import { promptForPushPermissionIfNeeded } from '~/src/providers/NotificationProvider';

export type LikeCardProps = {
  likeId: Id<'likes'>;
  fromDisplayName: string;
  fromAge: number | null;
  fromPhotoUrl: string | null;
  fromCity: string | null;
  fromPronouns: string[];
  comment: string;
  targetDescription: string;
  isPaidTier: boolean;
  /**
   * Caller navigates to chat on match. Separating navigation from the
   * respond mutation lets the parent decide routing semantics (push vs.
   * replace) — inbox uses `replace` so the back button from chat returns
   * to the tabs, not to an empty inbox row.
   */
  onMatched: (matchId: Id<'matches'>) => void;
};

export function LikeCard({
  likeId,
  fromDisplayName,
  fromAge,
  fromPhotoUrl,
  fromCity,
  fromPronouns,
  comment,
  targetDescription,
  isPaidTier,
  onMatched,
}: LikeCardProps) {
  const respond = useMutation(api.likes.respond);
  const track = useTrack();
  const [busy, setBusy] = useState<'match' | 'pass' | null>(null);

  async function handleRespond(action: 'match' | 'pass') {
    if (busy) return;
    setBusy(action);
    try {
      const result = await respond({ likeId, action });
      if (action === 'match') {
        track(AnalyticsEvents.LIKE_RESPONDED_MATCH);
        track(AnalyticsEvents.MATCH_CREATED, { via: 'like_responded' });
        promptForPushPermissionIfNeeded();
        if (result.matchId) onMatched(result.matchId);
      } else {
        track(AnalyticsEvents.LIKE_PASSED);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert(
        'Something went wrong',
        msg.includes('Like not found')
          ? 'This like is no longer available.'
          : "We couldn't complete that action. Try again.",
      );
      setBusy(null);
    }
  }

  return (
    <View className="mx-4 my-3 rounded-md bg-cream-50 border border-plum-50 shadow-card overflow-hidden">
      <View className="flex-row p-4">
        {/* Free tier gets reduced photo opacity + "Premium" overlay so the
            silhouette is visible but not identifiable. No native blur
            dependency for one screen. */}
        <View className="relative">
          <Avatar
            displayName={fromDisplayName}
            photoUrl={fromPhotoUrl}
            size={64}
            photoOpacity={isPaidTier ? 1 : 0.35}
          />
          {!isPaidTier && (
            <View
              className="absolute inset-0 bg-plum-900/10 items-center justify-center rounded-full"
              pointerEvents="none"
            >
              <Text variant="caption" className="text-[10px] text-plum-900">
                Premium
              </Text>
            </View>
          )}
        </View>
        <View className="flex-1 ml-3">
          <View className="flex-row items-center flex-wrap">
            <Text variant="heading" className="text-lg text-plum-900 mr-2">
              {isPaidTier ? fromDisplayName : 'Someone'}
            </Text>
            {isPaidTier && fromAge !== null && (
              <Text variant="body" className="text-base text-plum-600">
                {fromAge}
              </Text>
            )}
          </View>
          {isPaidTier && (fromPronouns.length > 0 || fromCity) && (
            <Text
              variant="body"
              numberOfLines={1}
              className="text-xs text-plum-600 mt-0.5"
            >
              {[fromPronouns.join(' / '), fromCity].filter(Boolean).join(' · ')}
            </Text>
          )}
          <Text
            variant="caption"
            numberOfLines={1}
            className="text-xs text-plum-400 mt-1"
          >
            liked {targetDescription}
          </Text>
        </View>
      </View>

      <View className="px-4 pb-3">
        <View className="bg-plum-50 rounded-md px-3 py-3">
          <Text variant="body" className="text-base text-plum-900 leading-6">
            “{comment}”
          </Text>
        </View>
      </View>

      <View className="flex-row border-t border-plum-50">
        <Pressable
          onPress={() => handleRespond('pass')}
          disabled={busy !== null}
          accessibilityRole="button"
          accessibilityLabel="Pass on this like"
          className="flex-1 py-4 flex-row items-center justify-center border-r border-plum-50"
          style={{ opacity: busy === 'pass' ? 0.5 : 1 }}
        >
          <X color="#6B2E4F" size={18} />
          <Text variant="body" className="ml-2 text-plum-900">
            Pass
          </Text>
        </Pressable>
        <Pressable
          onPress={() => handleRespond('match')}
          disabled={busy !== null}
          accessibilityRole="button"
          accessibilityLabel="Match with this person"
          className="flex-1 py-4 flex-row items-center justify-center bg-plum-600"
          style={{ opacity: busy === 'match' ? 0.7 : 1 }}
        >
          <Heart color="#FAFAFF" size={18} fill="#FAFAFF" />
          <Text variant="body" className="ml-2 text-cream-50 font-semibold">
            Match
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
