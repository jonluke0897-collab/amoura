import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '~/src/components/ui/Text';
import { MatchList } from '~/src/features/matches/MatchList';

export default function MatchesTab() {
  return (
    <View className="flex-1 bg-cream-50">
      <SafeAreaView edges={['top']} className="bg-cream-50">
        <View className="px-5 pt-2 pb-3">
          <Text variant="heading" className="text-2xl text-plum-900">
            Matches
          </Text>
        </View>
      </SafeAreaView>
      <MatchList />
    </View>
  );
}
