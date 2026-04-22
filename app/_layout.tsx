import '../global.css';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Fraunces_400Regular, Fraunces_500Medium, Fraunces_600SemiBold, Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono';
import * as SplashScreen from 'expo-splash-screen';
import { ClerkProvider } from '~/src/providers/ClerkProvider';
import { ConvexProvider } from '~/src/providers/ConvexProvider';
import { AnalyticsProvider } from '~/src/providers/AnalyticsProvider';
import { AnalyticsEvents, useTrack } from '~/src/lib/analytics';

SplashScreen.preventAutoHideAsync();

function AppOpenedEvent() {
  const track = useTrack();
  useEffect(() => {
    track(AnalyticsEvents.APP_OPENED);
  }, [track]);
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
    <ClerkProvider>
      <ConvexProvider>
        <AnalyticsProvider>
          <SafeAreaProvider>
            <AppOpenedEvent />
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false }} />
          </SafeAreaProvider>
        </AnalyticsProvider>
      </ConvexProvider>
    </ClerkProvider>
  );
}
