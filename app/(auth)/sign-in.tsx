import { View } from 'react-native';
import { router } from 'expo-router';
import { ScreenContainer } from '~/src/components/ui/ScreenContainer';
import { Text } from '~/src/components/ui/Text';
import { Button } from '~/src/components/ui/Button';

export default function SignIn() {
  return (
    <ScreenContainer>
      <View className="flex-1 justify-center">
        <Text variant="heading" className="text-4xl text-plum-600">Amoura</Text>
        <Text variant="body" className="mt-2">You're welcome here.</Text>

        <View className="mt-12 gap-3">
          <Button label="Continue with Apple" onPress={() => router.replace('/(tabs)/browse')} />
          <Button label="Continue with Google" variant="secondary" onPress={() => router.replace('/(tabs)/browse')} />
          <Button label="Continue with email" variant="ghost" onPress={() => router.replace('/(tabs)/browse')} />
        </View>

        <Text variant="caption" className="mt-6 text-xs">
          Clerk OAuth lands in TASK-009. Buttons currently route straight to the tab shell for QA.
        </Text>
      </View>
    </ScreenContainer>
  );
}
