import '../global.css';
import 'react-native-gesture-handler';
import { useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Fraunces_400Regular, Fraunces_500Medium, Fraunces_600SemiBold, Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono';
import * as SplashScreen from 'expo-splash-screen';
import { useQuery } from 'convex/react';
import { api } from '~/convex/_generated/api';
import { ClerkProvider } from '~/src/providers/ClerkProvider';
import { ConvexProvider } from '~/src/providers/ConvexProvider';
import { AnalyticsProvider } from '~/src/providers/AnalyticsProvider';
import { NotificationProvider } from '~/src/providers/NotificationProvider';
import { RevenueCatProvider } from '~/src/providers/RevenueCatProvider';
import { AnalyticsEvents, useTrack } from '~/src/lib/analytics';

SplashScreen.preventAutoHideAsync();

function AppOpenedEvent() {
  const track = useTrack();
  useEffect(() => {
    track(AnalyticsEvents.APP_OPENED);
  }, [track]);
  return null;
}

/**
 * Phase 6 — fire `subscription_canceled` once when `subscriptions.me`
 * transitions from `willRenew: true` to `willRenew: false` while the
 * subscription is still active (the user opted out before the period
 * ends). Webhook lands on Convex first, the reactive query pushes it
 * here, and we capture the analytics event without needing a
 * server-side PostHog SDK.
 *
 * Won't fire for users who never had a subscription (the transition
 * never happens) or for billing-issue terminations (those go straight
 * to `isActive: false`). Cleanly mounted at the root so the user's
 * current screen doesn't matter — same lifecycle as AppOpenedEvent.
 */
function SubscriptionCancelBeacon() {
  const track = useTrack();
  const subscription = useQuery(api.subscriptions.me);
  const previousWillRenew = useRef<boolean | null>(null);

  useEffect(() => {
    // First emission after query resolves: capture state, don't fire.
    // Otherwise an already-cancelled user opening the app would fire
    // a fresh `subscription_canceled` on every cold start.
    if (!subscription) {
      previousWillRenew.current = null;
      return;
    }
    const prev = previousWillRenew.current;
    if (prev === true && subscription.willRenew === false) {
      track(AnalyticsEvents.SUBSCRIPTION_CANCELED, {
        productId: subscription.productId,
        platform: subscription.platform,
      });
    }
    previousWillRenew.current = subscription.willRenew;
  }, [subscription, track]);

  return null;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Fraunces: Fraunces_400Regular,
    'Fraunces-Medium': Fraunces_500Medium,
    'Fraunces-SemiBold': Fraunces_600SemiBold,
    'Fraunces-Bold': Fraunces_700Bold,
    Inter: Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
    JetBrainsMono: JetBrainsMono_400Regular,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ClerkProvider>
        <ConvexProvider>
          <RevenueCatProvider>
            <AnalyticsProvider>
              <NotificationProvider>
                <SafeAreaProvider>
                  <AppOpenedEvent />
                  <SubscriptionCancelBeacon />
                  <StatusBar style="dark" />
                  <Stack screenOptions={{ headerShown: false }}>
                    {/* Phase 6 paywall: full-screen modal so the close-X
                        in the top-right dismisses back to whatever
                        screen pushed it (Likes inbox, FilterSheet apply,
                        or LikeWithCommentModal daily-cap CTA). */}
                    <Stack.Screen
                      name="paywall"
                      options={{ presentation: 'modal', headerShown: false }}
                    />
                  </Stack>
                </SafeAreaProvider>
              </NotificationProvider>
            </AnalyticsProvider>
          </RevenueCatProvider>
        </ConvexProvider>
      </ClerkProvider>
    </GestureHandlerRootView>
  );
}
