import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Amoura',
  slug: 'amoura',
  scheme: 'amoura',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/IconOnly_Transparent_NoBuffer.png',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  splash: {
    image: './assets/IconOnly_Transparent_NoBuffer.png',
    resizeMode: 'contain',
    backgroundColor: '#FAFAFF',
  },
  ios: {
    bundleIdentifier: 'com.amoura.app',
    supportsTablet: false,
  },
  android: {
    package: 'com.amoura.app',
    adaptiveIcon: {
      foregroundImage: './assets/IconOnly_Transparent_NoBuffer.png',
      backgroundColor: '#FAFAFF',
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-secure-store',
    'expo-web-browser',
  ],
  extra: {
    eas: {
      projectId: 'e7a7022d-86df-4588-ad13-e8cce39aebbe',
    },
    convexUrl: process.env.EXPO_PUBLIC_CONVEX_URL,
    clerkPublishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
    revenueCatIosKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
    revenueCatAndroidKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
    posthogKey: process.env.EXPO_PUBLIC_POSTHOG_KEY,
  },
};

export default config;
