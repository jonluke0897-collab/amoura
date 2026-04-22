import { useEffect } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useMutation } from 'convex/react';
import { api } from '~/convex/_generated/api';
import { Text } from '~/src/components/ui/Text';
import { Button } from '~/src/components/ui/Button';
import { WelcomeAnimation } from '~/src/features/onboarding/WelcomeAnimation';
import { COMPLETE_SCREEN } from '~/src/features/onboarding/onboardingCopy';
import { AnalyticsEvents, useTrack } from '~/src/lib/analytics';

export default function CompleteScreen() {
  const track = useTrack();
  const markOnboardingComplete = useMutation(api.profiles.markOnboardingComplete);

  // Complete screen is the true onboarding terminus — photos have landed and
  // the user has passed through the optional prompts step. Fire analytics +
  // flip onboardingComplete on the server here (idempotent; swallow errors
  // so network blips don't block the CTA).
  useEffect(() => {
    track(AnalyticsEvents.ONBOARDING_COMPLETED);
    markOnboardingComplete().catch(() => {});
  }, [track, markOnboardingComplete]);

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
