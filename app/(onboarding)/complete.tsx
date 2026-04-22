import { useEffect } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Text } from '~/src/components/ui/Text';
import { Button } from '~/src/components/ui/Button';
import { WelcomeAnimation } from '~/src/features/onboarding/WelcomeAnimation';
import { COMPLETE_SCREEN } from '~/src/features/onboarding/onboardingCopy';
import { AnalyticsEvents, useTrack } from '~/src/lib/analytics';

export default function CompleteScreen() {
  const track = useTrack();

  // Complete screen is the true onboarding terminus in Phase 2+ — photos and
  // prompts have both landed by the time the user reaches here. Fire the
  // completion event on mount so the funnel metric aligns with reality.
  useEffect(() => {
    track(AnalyticsEvents.ONBOARDING_COMPLETED);
  }, [track]);

  return (
    <View className="flex-1 px-5 pt-4 justify-center">
      <WelcomeAnimation>
        <Text variant="heading" className="text-4xl text-plum-600 mb-3">
          {COMPLETE_SCREEN.heading}
        </Text>
        <Text variant="body" className="text-lg text-plum-900 mb-10 leading-7">
          {COMPLETE_SCREEN.subhead}
        </Text>
        <Button
          label={COMPLETE_SCREEN.cta}
          size="lg"
          onPress={() => router.replace('/(tabs)/profile')}
        />
      </WelcomeAnimation>
    </View>
  );
}
