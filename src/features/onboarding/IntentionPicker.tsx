import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '~/src/components/ui/Text';
import { Button } from '~/src/components/ui/Button';
import { cn } from '~/src/lib/cn';
import { INTENTION_OPTIONS, INTENTIONS_MAX_SELECTION, IntentionValue } from './identityOptions';
import { INTENTIONS_SCREEN } from './onboardingCopy';

type Props = {
  initialSelection?: readonly IntentionValue[];
  submitting?: boolean;
  errorMessage?: string | null;
  onSubmit: (intentions: IntentionValue[]) => void;
};

export function IntentionPicker({
  initialSelection = [],
  submitting = false,
  errorMessage = null,
  onSubmit,
}: Props) {
  const [selected, setSelected] = useState<IntentionValue[]>([...initialSelection]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const toggle = (value: IntentionValue) => {
    if (selectedSet.has(value)) {
      setSelected(selected.filter((v) => v !== value));
      return;
    }
    if (selected.length >= INTENTIONS_MAX_SELECTION) return;
    setSelected([...selected, value]);
  };

  const canSubmit = selected.length > 0 && selected.length <= INTENTIONS_MAX_SELECTION;
  const atMax = selected.length >= INTENTIONS_MAX_SELECTION;

  return (
    <ScrollView className="flex-1" contentContainerClassName="pb-10">
      <Text variant="heading" className="text-3xl mb-2">
        {INTENTIONS_SCREEN.heading}
      </Text>
      <Text variant="body" className="text-plum-400 mb-6">
        {INTENTIONS_SCREEN.subhead}
      </Text>

      <View className="gap-3 mb-6">
        {INTENTION_OPTIONS.map((opt) => {
          const isOn = selectedSet.has(opt.value);
          const isDisabled = !isOn && atMax;
          return (
            <Pressable
              key={opt.value}
              onPress={() => toggle(opt.value)}
              disabled={isDisabled}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isOn, disabled: isDisabled }}
              className={cn(
                'rounded-md border p-4 flex-row items-center gap-3',
                isOn ? 'border-plum-600 bg-plum-50' : 'border-plum-50 bg-cream-50',
                isDisabled && 'opacity-40',
              )}
            >
              <View
                className={cn(
                  'h-5 w-5 rounded-sm border items-center justify-center',
                  isOn ? 'border-plum-600 bg-plum-600' : 'border-plum-400 bg-cream-50',
                )}
              >
                {isOn ? <View className="h-2.5 w-2.5 rounded-[2px] bg-cream-50" /> : null}
              </View>
              <Text className="font-body text-base text-plum-900 flex-1">{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text variant="caption" className="text-plum-400 text-xs mb-4">
        {INTENTIONS_SCREEN.maxSelectionHint}
      </Text>

      {errorMessage ? (
        <Text variant="caption" className="text-rose-700 mb-3">
          {errorMessage}
        </Text>
      ) : null}

      <Button
        label={INTENTIONS_SCREEN.continueCta}
        onPress={() => canSubmit && onSubmit(selected)}
        disabled={!canSubmit || submitting}
        loading={submitting}
        size="lg"
      />
    </ScrollView>
  );
}
