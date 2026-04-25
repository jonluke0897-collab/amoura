import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { X } from 'lucide-react-native';
import { useMutation } from 'convex/react';
import { api } from '~/convex/_generated/api';
import type { Id } from '~/convex/_generated/dataModel';
import {
  LIKE_COMMENT_MAX_CHARS,
  LIKE_COMMENT_MIN_CHARS,
} from '~/convex/lib/likeBounds';
import { BottomSheet } from '~/src/components/ui/BottomSheet';
import { Button } from '~/src/components/ui/Button';
import { Text } from '~/src/components/ui/Text';
import { AnalyticsEvents, useTrack } from '~/src/lib/analytics';
import { promptForPushPermissionIfNeeded } from '~/src/providers/NotificationProvider';
import type { LikeTarget } from '~/src/features/profile/ProfileView';

export type LikeWithCommentModalProps = {
  visible: boolean;
  onClose: () => void;
  toUserId: Id<'users'>;
  toDisplayName: string;
  target: LikeTarget | null;
  /**
   * Human-readable summary of what the target is, shown in the modal
   * header so the user remembers what they're commenting on. For a
   * prompt: the question text. For a photo: "Their photo".
   */
  targetDescription: string;
  /**
   * Called after a successful like. If the server created a match in the
   * same transaction (reciprocal like), `matchId` is non-null and the
   * caller routes directly into chat; otherwise the caller just closes
   * the sheet with a success toast.
   */
  onSuccess: (result: { matchId: Id<'matches'> | null }) => void;
};

// Bounds shared with the server validator via `convex/lib/likeBounds`.
// The UX nudge ("say something specific") lives in the helper text, not
// as a tighter validator, per the plan's comment-length decision.

export function LikeWithCommentModal({
  visible,
  onClose,
  toUserId,
  toDisplayName,
  target,
  targetDescription,
  onSuccess,
}: LikeWithCommentModalProps) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sendLike = useMutation(api.likes.send);
  const track = useTrack();

  // Reset local state whenever the sheet opens so a previous draft doesn't
  // bleed into a new session. We reset on visible transitions rather than
  // on unmount because the sheet stays mounted (Modal visible=false).
  useEffect(() => {
    if (visible) {
      setText('');
      setError(null);
      setSubmitting(false);
    }
  }, [visible]);

  const trimmed = text.trim();
  const charCount = trimmed.length;
  const isValid = charCount >= LIKE_COMMENT_MIN_CHARS && charCount <= LIKE_COMMENT_MAX_CHARS;

  async function handleSubmit() {
    if (!target || !isValid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      // The server's discriminated `target` validator wants {type, id}
      // bundled. LikeTarget is already the matching union, so forward
      // it directly.
      const result = await sendLike({
        toUserId,
        target,
        comment: trimmed,
      });
      // Critical success path first — once the like is in Convex we MUST
      // close the modal cleanly. Non-critical side-effects (haptics,
      // analytics, push prompt) run after and have their own error
      // swallowing so a Haptics throw can't masquerade as a network
      // failure and trigger setError.
      onSuccess({ matchId: result.matchId ?? null });
      try {
        if (Platform.OS !== 'web') {
          void Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          ).catch(() => undefined);
        }
        track(AnalyticsEvents.LIKE_SENT, { targetType: target.type });
        if (result.matchId) {
          track(AnalyticsEvents.MATCH_CREATED, {
            via: 'reciprocal_like_on_send',
          });
        }
        // .catch() because the surrounding try only sees sync throws —
        // a rejected permission promise (user denies, OS quirk) would
        // otherwise propagate as an unhandled rejection in dev.
        void promptForPushPermissionIfNeeded().catch((err) => {
          if (__DEV__) {
            console.warn('[likes] push permission prompt rejected', err);
          }
        });
      } catch (sideErr) {
        if (__DEV__) {
          console.warn('[likes] post-success side-effects failed', sideErr);
        }
      }
    } catch (e) {
      const rawMessage = e instanceof Error ? e.message : String(e);
      setError(mapErrorToCopy(rawMessage));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      dismissible={!submitting}
      heightPercent={75}
      header={
        <View className="px-5 pt-2 pb-3 flex-row items-center">
          <View className="flex-1">
            <Text variant="caption" className="uppercase tracking-wider">
              Like with a comment
            </Text>
            <Text
              variant="heading"
              numberOfLines={2}
              className="text-xl text-plum-900 mt-1"
            >
              {targetDescription}
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={12}
            className="ml-3"
          >
            <X color="#6D28D9" size={24} />
          </Pressable>
        </View>
      }
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={24}
        className="flex-1"
      >
        <View className="flex-1 px-5 pt-2">
          <Text variant="body" className="text-sm text-plum-600 mb-3">
            Comment on what caught your eye. Specificity opens real
            conversations — vague openers rarely get a reply here.
          </Text>
          <View
            className={`flex-1 rounded-md border ${
              error ? 'border-rose-700' : 'border-plum-50'
            } bg-cream-50`}
          >
            <TextInput
              value={text}
              onChangeText={setText}
              multiline
              textAlignVertical="top"
              autoFocus
              editable={!submitting}
              placeholder={`Write to ${toDisplayName}…`}
              placeholderTextColor="#8A7F78"
              maxLength={LIKE_COMMENT_MAX_CHARS}
              style={{
                flex: 1,
                padding: 16,
                fontFamily: 'Inter',
                fontSize: 16,
                color: '#2C1520',
                minHeight: 140,
              }}
            />
          </View>
          <View className="flex-row justify-between items-center mt-2">
            <Text variant="caption" className="text-xs">
              {charCount < LIKE_COMMENT_MIN_CHARS
                ? `${LIKE_COMMENT_MIN_CHARS - charCount} more to send`
                : `${charCount}/${LIKE_COMMENT_MAX_CHARS}`}
            </Text>
            {error && (
              <Text
                variant="caption"
                numberOfLines={2}
                className="flex-1 text-xs text-rose-700 text-right ml-3"
              >
                {error}
              </Text>
            )}
          </View>
        </View>
        <View className="px-5 pt-3 pb-3">
          <Button
            label="Send like"
            onPress={handleSubmit}
            disabled={!isValid || !target}
            loading={submitting}
          />
        </View>
      </KeyboardAvoidingView>
    </BottomSheet>
  );
}

/**
 * Map the raw Error.message from Convex to user-facing copy. The server
 * throws plain Errors (no ConvexError in this codebase), so we match on
 * substrings. Keeping this in the modal keeps one component responsible
 * for all the error paths a like can produce.
 */
function mapErrorToCopy(raw: string): string {
  if (raw.startsWith('RATE_LIMITED:likes-daily')) {
    return "You've used your daily likes. Come back tomorrow — or go Premium for more.";
  }
  if (raw.startsWith('RATE_LIMITED:')) {
    return "You've hit a daily limit. Try again later.";
  }
  if (raw.includes('already have a pending like')) {
    return "You've already liked this profile — wait for a response.";
  }
  if (raw.includes('block') || raw.includes('Profile unavailable')) {
    return "This profile isn't available right now.";
  }
  if (raw.includes('Target')) {
    return "That prompt or photo isn't available anymore.";
  }
  if (raw.includes('Comment must')) {
    return raw;
  }
  if (raw.includes('Not authenticated') || raw.includes('User not found')) {
    return "You need to be signed in to like someone.";
  }
  return 'Something went wrong sending that like. Try again.';
}
