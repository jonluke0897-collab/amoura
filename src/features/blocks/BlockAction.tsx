import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useMutation } from 'convex/react';
import { api } from '~/convex/_generated/api';
import type { Id } from '~/convex/_generated/dataModel';
import { AnalyticsEvents, useTrack } from '~/src/lib/analytics';

export type BlockArgs = {
  targetUserId: Id<'users'>;
  displayName: string;
  /** Called after the block lands. Use to dismiss menus or navigate away. */
  onSuccess?: () => void;
};

/**
 * Hook for the "block this person" flow on profile detail and chat surfaces.
 * Returns a function that prompts confirmation, calls `blocks.block`, and
 * fires analytics on success. Errors are surfaced via Alert.alert with the
 * raw mutation error message — block errors are rare (target not found,
 * self-block, network), and they're already user-facing copy from the
 * mutation handler.
 *
 * Mirrors the inline `confirmUnmatch` pattern in ChatHeader (which uses
 * Alert.alert + useMutation directly) but extracted because Block is used
 * from two surfaces (chat header menu, profile detail menu) and inlining
 * it twice would drift.
 */
export function useBlockAction() {
  const block = useMutation(api.blocks.block);
  const track = useTrack();

  return useCallback(
    ({ targetUserId, displayName, onSuccess }: BlockArgs) => {
      Alert.alert(
        `Block ${displayName}?`,
        `They won’t be able to find you, like you, or message you. They won’t be told.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Block',
            style: 'destructive',
            onPress: async () => {
              try {
                const result = await block({ targetUserId });
                track(AnalyticsEvents.BLOCK_USER, {
                  already_blocked: result.alreadyBlocked,
                });
                onSuccess?.();
              } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                Alert.alert('Couldn’t block', msg);
              }
            },
          },
        ],
      );
    },
    [block, track],
  );
}

export type UnblockArgs = {
  targetUserId: Id<'users'>;
  displayName: string | null;
  onSuccess?: () => void;
};

/**
 * Counterpart to `useBlockAction`. Used by the BlockedUsers settings
 * screen. Confirmation copy uses the user's name when present and a
 * generic phrasing when the row is an orphan placeholder (purged user).
 */
export function useUnblockAction() {
  const unblock = useMutation(api.blocks.unblock);
  const track = useTrack();

  return useCallback(
    ({ targetUserId, displayName, onSuccess }: UnblockArgs) => {
      const subject = displayName ?? 'this person';
      Alert.alert(
        `Unblock ${subject}?`,
        `${subject} will be able to find you again. Your previous match (if any) won’t come back automatically.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Unblock',
            onPress: async () => {
              try {
                await unblock({ targetUserId });
                track(AnalyticsEvents.UNBLOCK_USER);
                onSuccess?.();
              } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                Alert.alert('Couldn’t unblock', msg);
              }
            },
          },
        ],
      );
    },
    [unblock, track],
  );
}
