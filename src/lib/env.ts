import Constants from 'expo-constants';

type Extra = {
  convexUrl?: string;
  clerkPublishableKey?: string;
  revenueCatIosKey?: string;
  revenueCatAndroidKey?: string;
  posthogKey?: string;
  oneSignalAppId?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

function read(envKey: string, extraValue: string | undefined): string | undefined {
  const v = process.env[envKey] ?? extraValue;
  return v && v.length > 0 ? v : undefined;
}

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required env var: ${name}. Add it to .env and rebuild.`);
  }
  return value;
}

export const env = {
  // Required for runtime. Throws if missing.
  get convexUrl() {
    return required('EXPO_PUBLIC_CONVEX_URL', read('EXPO_PUBLIC_CONVEX_URL', extra.convexUrl));
  },

  // Optional during bootstrap (Phase 0). Required by the time Clerk wiring is complete.
  get clerkPublishableKey() {
    return read('EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY', extra.clerkPublishableKey);
  },
  get revenueCatIosKey() {
    return read('EXPO_PUBLIC_REVENUECAT_IOS_KEY', extra.revenueCatIosKey);
  },
  get revenueCatAndroidKey() {
    return read('EXPO_PUBLIC_REVENUECAT_ANDROID_KEY', extra.revenueCatAndroidKey);
  },
  get posthogKey() {
    return read('EXPO_PUBLIC_POSTHOG_KEY', extra.posthogKey);
  },
  // Optional. When absent, NotificationProvider no-ops so the app boots for
  // UI QA without push. Setting this requires a new EAS dev build — OneSignal
  // is a native module.
  get oneSignalAppId() {
    return read('EXPO_PUBLIC_ONESIGNAL_APP_ID', extra.oneSignalAppId);
  },
};
