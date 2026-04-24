import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SlidersHorizontal } from 'lucide-react-native';
import { Text } from '~/src/components/ui/Text';
import { BrowseFeed } from '~/src/features/browse/BrowseFeed';
import { FilterSheet } from '~/src/features/browse/FilterSheet';
import { CityPickerSheet } from '~/src/features/location/CityPickerSheet';

export default function Browse() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [cityPickerOpen, setCityPickerOpen] = useState(false);

  const requestRefresh = useCallback(() => {
    setRefreshKey((n) => n + 1);
  }, []);

  return (
    <View className="flex-1 bg-cream-50">
      <SafeAreaView edges={['top']} className="bg-cream-50">
        <View className="flex-row items-center justify-between px-5 pt-2 pb-3">
          <Text variant="heading" className="text-2xl text-plum-900">
            Browse
          </Text>
          <Pressable
            onPress={() => setFiltersOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Open filters"
            hitSlop={12}
            className="h-10 w-10 rounded-full bg-plum-50 items-center justify-center"
          >
            <SlidersHorizontal color="#6D28D9" size={20} />
          </Pressable>
        </View>
      </SafeAreaView>
      <BrowseFeed
        refreshKey={refreshKey}
        onRequestRefresh={requestRefresh}
        onRequestSetCity={() => setCityPickerOpen(true)}
        onRequestOpenFilters={() => setFiltersOpen(true)}
      />
      <FilterSheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        onApplied={() => {
          setFiltersOpen(false);
          requestRefresh();
        }}
      />
      <CityPickerSheet
        visible={cityPickerOpen}
        onClose={() => setCityPickerOpen(false)}
        onCitySet={() => {
          setCityPickerOpen(false);
          // getMinePreferences auto-invalidates via Convex reactivity. The
          // extra refresh bump resets feed pagination from page 1 so the first
          // results the user sees reflect the new city.
          requestRefresh();
        }}
      />
    </View>
  );
}
