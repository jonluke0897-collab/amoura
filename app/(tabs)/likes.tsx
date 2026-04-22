import { View } from 'react-native';
import { ScreenContainer } from '~/src/components/ui/ScreenContainer';
import { Text } from '~/src/components/ui/Text';

export default function Likes() {
  return (
    <ScreenContainer>
      <View className="flex-1 items-center justify-center">
        <Text variant="heading" className="text-3xl">Likes</Text>
        <Text variant="caption" className="mt-2">Inbox lands in Phase 4.</Text>
      </View>
    </ScreenContainer>
  );
}
