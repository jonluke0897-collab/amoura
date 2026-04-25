import { type ReactNode, useEffect } from 'react';
import { Platform } from 'react-native';
import { useQuery } from 'convex/react';
import { OneSignal, LogLevel } from 'react-native-onesignal';
import { api } from '~/convex/_generated/api';
import { env } from '~/src/lib/env';

/**
 * Wire OneSignal to the app. Bootstrap-friendly:
 *   - If EXPO_PUBLIC_ONESIGNAL_APP_ID isn't set, the provider no-ops
 *     (matches the Clerk/Analytics/Convex provider pattern). The app still
 *     boots, just without push.
 *   - Initialization runs once on mount (OneSignal's SDK is idempotent-ish
 *     but we guard anyway via the `__amouraOneSignalInit` global flag).
 *   - External user ID is set after Convex `users.me` resolves — ties the
 *     push subscription to our backend userId so the Convex scheduled
 *     action can target by `include_aliases: { external_id: [...] }`.
 *   - Permission request is deferred. Roadmap TASK-055 spec: request only
 *     when the user takes a meaningful action (first like, first match,
 *     first message). The callers for that live in LikeCard, the match
 *     modal, and ChatInput — they call `promptForPushPermissionIfNeeded`
 *     which is exported from this module.
 *
 * Web/SSR: OneSignal's RN module requires native modules that aren't
 * present on web. We Platform-guard to keep the web build path (if we ever
 * add one for admin / marketing site) from crashing at import time.
 */

const hasNativeOneSignal = Platform.OS === 'ios' || Platform.OS === 'android';

// Module-level flag because OneSignal.initialize should only ever be called
// once per process — double-init logs a warning and leaks observers.
let initialized = false;

function initializeOneSignal(appId: string) {
  if (initialized) return;
  if (!hasNativeOneSignal) return;

  if (__DEV__) {
    OneSignal.Debug.setLogLevel(LogLevel.Warn);
  }
  OneSignal.initialize(appId);
  // Set the flag AFTER initialize so a throw during init doesn't lock us
  // out of retrying on the next render. `initialize` is documented as
  // fire-and-forget void, but we still don't want to pretend we succeeded
  // if the JS side throws for any reason.
  initialized = true;
}

/**
 * Prompt for push permission if we haven't asked yet. Safe to call multiple
 * times — OneSignal tracks the permission state and won't re-show the OS
 * prompt once it's been answered. Callers should invoke this at meaningful
 * moments (first like sent, first match responded, first message sent).
 */
export async function promptForPushPermissionIfNeeded(): Promise<void> {
  if (!hasNativeOneSignal) return;
  if (!initialized) return;
  // `requestPermission(true)` shows the system prompt on iOS / opens the
  // Android 13+ POST_NOTIFICATIONS prompt. If the user has already
  // accepted/declined, it resolves to the existing state without re-prompting.
  try {
    await OneSignal.Notifications.requestPermission(true);
  } catch (err) {
    if (__DEV__) {
      console.warn('[Amoura] OneSignal permission prompt failed', err);
    }
  }
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const appId = env.oneSignalAppId;
  // `useQuery(api.users.me)` returns `undefined` while loading, `null` when
  // unauthenticated, and `{ user, ... }` when signed-in. We only register
  // the external ID once `user` is non-null — signing out would ideally
  // call `OneSignal.logout()` here, but a fresh login replaces the alias
  // anyway, so the failure mode is bounded.
  const me = useQuery(api.users.me);

  useEffect(() => {
    if (!appId) return;
    initializeOneSignal(appId);
  }, [appId]);

  useEffect(() => {
    if (!appId) return;
    if (!hasNativeOneSignal) return;
    if (!initialized) return;
    // Sign-out: `me === null` means Convex resolved but there's no authed
    // user. Clear the OneSignal external ID so a subsequent sign-in on the
    // same device doesn't receive pushes targeted at the previous user.
    // `me === undefined` (still loading) skips either action.
    if (me === null) {
      OneSignal.logout();
      return;
    }
    if (!me?.user) return;
    // External ID = Convex userId. The Convex notifications action targets
    // this via OneSignal's `include_aliases: { external_id: [...] }`. Keeping
    // the mapping server-side (rather than client-side player IDs) means a
    // fresh install still delivers as soon as the user signs in.
    OneSignal.login(me.user._id);
  }, [appId, me]);

  if (!appId) {
    if (__DEV__) {
      console.warn(
        '[Amoura] EXPO_PUBLIC_ONESIGNAL_APP_ID missing — push is disabled.',
      );
    }
    return <>{children}</>;
  }

  return <>{children}</>;
}
