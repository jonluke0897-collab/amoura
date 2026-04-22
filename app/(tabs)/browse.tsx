import { View } from 'react-native';
import { ScreenContainer } from '~/src/components/ui/ScreenContainer';
import { Text } from '~/src/components/ui/Text';

export default function Browse() {
  return (
    <ScreenContainer>
      <View className="flex-1 items-center justify-center">
        <Text variant="heading" className="text-3xl">Browse</Text>
        <Text variant="caption" className="mt-2">Feed lands in Phase 3.</Text>
      </View>
    </ScreenContainer>
  );
}
