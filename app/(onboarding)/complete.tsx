import { View } from 'react-native';
import { router } from 'expo-router';
import { Text } from '~/src/components/ui/Text';
import { Button } from '~/src/components/ui/Button';
import { WelcomeAnimation } from '~/src/features/onboarding/WelcomeAnimation';
import { COMPLETE_SCREEN } from '~/src/features/onboarding/onboardingCopy';

export default function CompleteScreen() {
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
