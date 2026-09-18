import { type ReactNode, useEffect } from 'react';
import { Platform } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { env } from '~/src/lib/env';
import { markConfigured, markUnconfigured } from '~/src/lib/purchases';

/**
 * Wire RevenueCat into the app. Bootstrap-friendly:
 *   - If the platform-appropriate key is missing, the provider no-ops
 *     (matches Clerk/Convex/Analytics/Notification provider patterns).
 *     The app boots without IAP; the paywall renders an "unavailable
 *     in this build" state instead of crashing on `Purchases.configure`.
 *   - Configure runs once per process. Logging in with the Clerk userId
 *     is what ties RC's customer to our backend user — webhook payloads
 *     carry `app_user_id` set to this same Clerk subject, so the Convex
 *     handleWebhook mutation can resolve through `users.by_clerk_id`.
 *   - Sign-out (Clerk userId disappears) calls `Purchases.logOut()`,
 *     which generates a fresh anonymous app_user_id. That prevents a
 *     subsequent sign-in on the same device from inheriting the
 *     previous user's entitlement before the new user's logIn lands.
 *
 * Source-of-truth for gating remains the Convex `subscriptions.me`
 * query (PRD § 11). RC is the *purchase pipeline*; Convex is the
 * *entitlement ledger*. Don't gate features on RC's CustomerInfo
 * directly.
 */

// Module-level flag: `Purchases.configure` is documented as idempotent
// only when called with the same args. We track config separately so a
// re-mount of the provider tree doesn't re-configure with a stale userId.
let configuredOnce = false;

function readApiKey(): string | undefined {
  return Platform.OS === 'ios'
    ? env.revenueCatIosKey
    : Platform.OS === 'android'
      ? env.revenueCatAndroidKey
      : undefined;
}

export function RevenueCatProvider({ children }: { children: ReactNode }) {
  const apiKey = readApiKey();
  const { isLoaded, userId } = useAuth();

  // Configure once on first mount that has a key. The Clerk userId may
  // not be available yet (cold start before token cache loads) — we
  // configure with `undefined` appUserID and let the logIn effect tie
  // the user later. RC handles this by generating an anonymous ID,
  // which we'll alias when logIn fires.
  useEffect(() => {
    if (!apiKey) return;
    if (configuredOnce) return;
    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.WARN).catch(() => {
        // setLogLevel is fire-and-forget; swallow rejections so a
        // logging-config failure doesn't propagate as an unhandled
        // rejection.
      });
    }
    Purchases.configure({ apiKey, appUserID: userId ?? null });
    configuredOnce = true;
    markConfigured(userId ?? null);
  }, [apiKey, userId]);

  // Tie/untie the Clerk identity. Runs whenever Clerk's auth state
  // resolves. Guarded on `isLoaded` so we don't logOut a user during
  // the initial token-cache rehydration window.
  useEffect(() => {
    if (!apiKey) return;
    if (!isLoaded) return;
    if (!configuredOnce) return;
    if (userId) {
      Purchases.logIn(userId)
        .then(() => markConfigured(userId))
        .catch((e) => {
          if (__DEV__) console.warn('[Amia] Purchases.logIn failed', e);
        });
    } else {
      Purchases.logOut()
        .then(() => markConfigured(null))
        .catch((e) => {
          if (__DEV__) console.warn('[Amia] Purchases.logOut failed', e);
        });
    }
  }, [apiKey, isLoaded, userId]);

  if (!apiKey) {
    if (__DEV__) {
      const expected =
        Platform.OS === 'ios'
          ? 'EXPO_PUBLIC_REVENUECAT_IOS_KEY'
          : Platform.OS === 'android'
            ? 'EXPO_PUBLIC_REVENUECAT_ANDROID_KEY'
            : '(unsupported platform)';
      console.warn(
        `[Amia] ${expected} missing — subscriptions are disabled.`,
      );
    }
    // Make sure downstream lib helpers know we're unconfigured even
    // across hot-reload churn.
    markUnconfigured();
    return <>{children}</>;
  }

  return <>{children}</>;
}
