import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { ChevronRight, MapPin, X } from 'lucide-react-native';
import { Text } from '~/src/components/ui/Text';
import { Button } from '~/src/components/ui/Button';
import { useLocationCity } from './useLocationCity';

// Per roadmap TASK-042: five soft-launch cities. Real users whose GPS
// resolves to anywhere else still save that city — this list is only the
// manual fallback when the user declines location or wants to set it by
// hand.
const LAUNCH_CITIES = [
  'Austin',
  'Brooklyn',
  'Oakland',
  'Los Angeles',
  'Chicago',
];

export type CityPickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Called once a city has been saved to the profile. */
  onCitySet: (city: string) => void;
};

export function CityPickerSheet({
  visible,
  onClose,
  onCitySet,
}: CityPickerSheetProps) {
  const { status, error, detectAndSave, saveManualCity, reset } =
    useLocationCity();
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      reset();
      setLocalError(null);
    }
  }, [visible, reset]);

  const handleDetect = async () => {
    setLocalError(null);
    const city = await detectAndSave();
    if (city) onCitySet(city);
  };

  const handlePick = async (city: string) => {
    setLocalError(null);
    const ok = await saveManualCity(city);
    if (ok) onCitySet(city);
  };

  const busy = status === 'requesting' || status === 'saving';
  const denied = status === 'denied';
  const unavailable = status === 'unavailable';

  // Block dismissal while an async save is in flight. updatePreferences has
  // already been (or is about to be) sent; letting the user dismiss while
  // that's happening would silently commit a city change after a cancel.
  // Keeping the modal up until the work finishes respects the user action.
  const handleClose = () => {
    if (busy) return;
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View className="flex-1 bg-plum-900/40 justify-end">
        <Pressable
          className="absolute inset-0"
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <View className="bg-cream-50 rounded-t-lg max-h-[85%] pt-2 shadow-modal">
          <View className="items-center pb-2">
            <View className="w-10 h-1 rounded-full bg-plum-50" />
          </View>
          <View className="flex-row items-center justify-between px-5 pb-2">
            <Text variant="heading" className="text-2xl text-plum-900">
              Your city
            </Text>
            <Pressable
              onPress={handleClose}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Close city picker"
              accessibilityState={{ disabled: busy }}
              hitSlop={12}
            >
              <X color={busy ? '#A78BFA' : '#6D28D9'} size={22} />
            </Pressable>
          </View>
          <Text variant="body" className="px-5 pb-4 text-plum-600 text-base">
            Amoura shows you people nearby. We store your city name only — never
            your exact location.
          </Text>

          <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
            <View className="px-5">
              <Button
                label={
                  status === 'requesting'
                    ? 'Requesting permission…'
                    : status === 'saving'
                      ? 'Saving…'
                      : 'Use my current location'
                }
                variant="primary"
                onPress={handleDetect}
                loading={busy}
                disabled={busy}
              />
              {denied && (
                <Text variant="caption" className="text-plum-400 mt-2">
                  Location permission denied. Pick a city below, or enable
                  location in Settings and try again.
                </Text>
              )}
              {unavailable && (
                <Text variant="caption" className="text-plum-400 mt-2">
                  We couldn't determine a city from your location. Pick one
                  below.
                </Text>
              )}
              {(error || localError) && (
                <Text variant="body" className="text-sm text-rose-700 mt-2">
                  {error ?? localError}
                </Text>
              )}
            </View>

            <View className="px-5 mt-6">
              <Text
                variant="caption"
                className="uppercase text-plum-400 mb-2 text-xs"
              >
                Or pick a launch city
              </Text>
              {LAUNCH_CITIES.map((city) => (
                <Pressable
                  key={city}
                  onPress={() => handlePick(city)}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={`Set city to ${city}`}
                  className="flex-row items-center justify-between py-3 border-b border-plum-50"
                >
                  <View className="flex-row items-center">
                    <MapPin color="#A78BFA" size={18} />
                    <Text variant="body" className="text-base text-plum-900 ml-3">
                      {city}
                    </Text>
                  </View>
                  <ChevronRight color="#A78BFA" size={18} />
                </Pressable>
              ))}
              <Text variant="caption" className="text-plum-400 mt-3">
                Other cities unlock as more people join.
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
