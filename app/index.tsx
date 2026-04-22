import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useOnboardingRoute } from '~/src/features/onboarding/useOnboardingRoute';

export default function Index() {
  const route = useOnboardingRoute();

  if (route.state === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-cream-50">
        <ActivityIndicator color="#6D28D9" />
      </View>
    );
  }

  if (route.state === 'signed-out') {
    return <Redirect href="/(auth)/sign-in" />;
  }

  switch (route.step) {
    case 'identity':
      return <Redirect href="/(onboarding)/identity" />;
    case 'intentions':
      return <Redirect href="/(onboarding)/intentions" />;
    case 'pledge':
      return <Redirect href="/(onboarding)/pledge" />;
    case 'complete':
      return <Redirect href="/(tabs)/browse" />;
    default: {
      // Exhaustiveness: adding a new OnboardingStep variant without a case here
      // will surface as a compile-time error on this line.
      const _exhaustive: never = route.step;
      throw new Error(`Unhandled onboarding step: ${_exhaustive as string}`);
    }
  }
}
