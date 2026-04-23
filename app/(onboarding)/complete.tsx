import { useEffect, useRef } from 'react';
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

  // useTrack returns a fresh fn identity each render, and useMutation can too;
  // if either ends up as a dep the effect would re-fire and emit duplicate
  // ONBOARDING_COMPLETED events plus a second idempotent mutation. Refs keep
  // the mount-once semantics without stale-closure risk.
  const trackRef = useRef(track);
  trackRef.current = track;
  const markRef = useRef(markOnboardingComplete);
  markRef.current = markOnboardingComplete;

  useEffect(() => {
    trackRef.current(AnalyticsEvents.ONBOARDING_COMPLETED);
    markRef.current().catch(() => {});
  }, []);

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
