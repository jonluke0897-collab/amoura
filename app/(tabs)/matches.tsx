import { View } from 'react-native';
import { ScreenContainer } from '~/src/components/ui/ScreenContainer';
import { Text } from '~/src/components/ui/Text';

export default function Matches() {
  return (
    <ScreenContainer>
      <View className="flex-1 items-center justify-center">
        <Text variant="heading" className="text-3xl">Matches</Text>
        <Text variant="caption" className="mt-2">Chat list lands in Phase 4.</Text>
      </View>
    </ScreenContainer>
  );
}
