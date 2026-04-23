import { View } from 'react-native';
import { Compass, MapPin, SlidersHorizontal } from 'lucide-react-native';
import { Text } from '~/src/components/ui/Text';
import { Button } from '~/src/components/ui/Button';

/**
 * Empty states for the browse feed. All copy is placeholder pending
 * paid-trans-advisor sign-off (see CLAUDE.md § Advisor gate). Group here so
 * the review pass can swap strings without hunting through component files.
 */

export function LoadingFeed() {
  return (
    <View className="flex-1 items-center justify-center bg-cream-50 px-6">
      <Compass color="#A78BFA" size={40} />
      <Text variant="body" className="text-base text-plum-400 mt-3">
        Warming up the feed…
      </Text>
    </View>
  );
}

export function NoMatches({ onAdjustFilters }: { onAdjustFilters?: () => void }) {
  return (
    <View className="flex-1 items-center justify-center bg-cream-50 px-6">
      <Compass color="#A78BFA" size={40} />
      <Text variant="heading" className="text-2xl text-plum-900 mt-4 text-center">
        No one new to show right now.
      </Text>
      <Text variant="body" className="text-base text-plum-600 mt-2 text-center">
        We're growing — check back tomorrow.
      </Text>
      {onAdjustFilters && (
        <Button
          label="Adjust filters"
          variant="secondary"
          onPress={onAdjustFilters}
          className="mt-6"
        />
      )}
    </View>
  );
}

export function EndOfFeed({
  city,
  onAdjustFilters,
}: {
  city: string | null;
  onAdjustFilters?: () => void;
}) {
  return (
    <View className="flex-1 items-center justify-center bg-cream-50 px-6 py-12">
      <SlidersHorizontal color="#A78BFA" size={40} />
      <Text variant="heading" className="text-2xl text-plum-900 mt-4 text-center">
        You've met everyone in {city ?? 'your city'} for now.
      </Text>
      <Text variant="body" className="text-base text-plum-600 mt-2 text-center">
        We add new profiles daily.
      </Text>
      {onAdjustFilters && (
        <Button
          label="Adjust filters"
          variant="secondary"
          onPress={onAdjustFilters}
          className="mt-6"
        />
      )}
    </View>
  );
}

/**
 * Shown before the viewer has a city set. The real picker / permission flow
 * lives in TASK-042 (src/features/location/useLocationCity.ts); this is the
 * passive state the browse tab falls back to before that lands.
 */
export function NoCityYet({ onSetCity }: { onSetCity?: () => void }) {
  return (
    <View className="flex-1 items-center justify-center bg-cream-50 px-6">
      <MapPin color="#A78BFA" size={40} />
      <Text variant="heading" className="text-2xl text-plum-900 mt-4 text-center">
        Where are you based?
      </Text>
      <Text variant="body" className="text-base text-plum-600 mt-2 text-center">
        Amoura shows you people in your city. We never store your exact location — just the city name.
      </Text>
      {onSetCity && (
        <Button
          label="Set my city"
          variant="primary"
          onPress={onSetCity}
          className="mt-6"
        />
      )}
    </View>
  );
}
