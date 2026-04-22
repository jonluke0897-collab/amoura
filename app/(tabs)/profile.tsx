import { View } from 'react-native';
import { router } from 'expo-router';
import { ScreenContainer } from '~/src/components/ui/ScreenContainer';
import { Text } from '~/src/components/ui/Text';
import { Button } from '~/src/components/ui/Button';

export default function Profile() {
  return (
    <ScreenContainer>
      <View className="flex-1 items-center justify-center">
        <Text variant="heading" className="text-3xl">Profile</Text>
        <Text variant="caption" className="mt-2">Profile editor lands in Phase 2.</Text>
        <Button
          label="Sign out"
          variant="secondary"
          className="mt-8"
          onPress={() => router.replace('/(auth)/sign-in')}
        />
      </View>
    </ScreenContainer>
  );
}
