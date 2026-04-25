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
    // Single NSCameraUsageDescription that covers both flows. iOS only
    // supports one camera-permission string per app — when both
    // expo-image-picker and expo-camera plugins set their own
    // `cameraPermission`, the last plugin's string wins silently. Owning
    // the key here means the merged copy can't drift, and the plugin
    // configs below intentionally drop their per-plugin overrides.
    infoPlist: {
      NSCameraUsageDescription:
        'Amoura uses the camera to take new profile photos and to capture quick verification selfies. Photos are only uploaded when you choose to share them; selfies are deleted right after we check them.',
    },
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
    [
      'expo-image-picker',
      {
        photosPermission:
          'Amoura needs access to your photos so you can share your best self — only the ones you pick are uploaded.',
        // cameraPermission intentionally omitted — the merged
        // NSCameraUsageDescription lives in ios.infoPlist above so the
        // two camera-using plugins can't fight over the same key.
      },
    ],
    [
      'expo-camera',
      {
        // Same: cameraPermission intentionally omitted, see the
        // NSCameraUsageDescription on ios.infoPlist. We still configure
        // the rest of the plugin (mic disabled — verification is photo-
        // only — and Android audio recording off) because those map to
        // separate AndroidManifest entries.
        microphonePermission: false,
        recordAudioAndroid: false,
      },
    ],
    [
      'expo-location',
      {
        // Foreground-only — matches requestForegroundPermissionsAsync in
        // useLocationCity. Using locationWhenInUsePermission maps to
        // NSLocationWhenInUseUsageDescription on iOS, which is what the
        // system surfaces for a one-shot city resolution.
        locationWhenInUsePermission:
          'Amoura uses your location only to detect your city. We store the city name — never your exact coordinates.',
      },
    ],
    [
      'onesignal-expo-plugin',
      {
        // 'development' wires the APNs sandbox cert path; 'production'
        // switches to the APNs production cert. EAS release profiles set
        // ONESIGNAL_MODE=production at build time; local dev defaults to
        // sandbox. No other value is accepted.
        mode: process.env.ONESIGNAL_MODE === 'production' ? 'production' : 'development',
        // iOS dev team + iPhoneDeploymentTarget would go here once we have
        // signing set up in EAS. Not required for Android dev builds.
      },
    ],
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
    oneSignalAppId: process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID,
  },
};

export default config;
