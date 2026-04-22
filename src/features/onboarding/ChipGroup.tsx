import { useState } from 'react';
import { Platform, Pressable, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Plus, X } from 'lucide-react-native';
import { Text } from '~/src/components/ui/Text';
import { cn } from '~/src/lib/cn';

type ChipOption = { value: string; label?: string };

type Props = {
  options: readonly (string | ChipOption)[];
  selected: readonly string[];
  onChange: (next: string[]) => void;
  mode?: 'single' | 'multi';
  allowCustom?: boolean;
  customAddLabel?: string;
  customPlaceholder?: string;
  customConfirmLabel?: string;
  disabled?: boolean;
};

function lightHaptic() {
  if (Platform.OS !== 'web') {
    Haptics.selectionAsync().catch(() => {});
  }
}

function toOption(o: string | ChipOption): ChipOption {
  return typeof o === 'string' ? { value: o } : o;
}

export function ChipGroup({
  options,
  selected,
  onChange,
  mode = 'multi',
  allowCustom = false,
  customAddLabel = 'Add',
  customPlaceholder = '',
  customConfirmLabel = 'Add',
  disabled = false,
}: Props) {
  const [customMode, setCustomMode] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const selectedSet = new Set(selected);

  const presetValues = new Set(options.map((o) => toOption(o).value));
  const customChips = selected.filter((v) => !presetValues.has(v));

  const toggle = (value: string) => {
    if (disabled) return;
    lightHaptic();
    if (mode === 'single') {
      onChange(selectedSet.has(value) ? [] : [value]);
      return;
    }
    onChange(
      selectedSet.has(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    );
  };

  const commitCustom = () => {
    const trimmed = customValue.trim();
    if (trimmed.length === 0) {
      setCustomMode(false);
      return;
    }
    if (!selectedSet.has(trimmed)) {
      onChange(mode === 'single' ? [trimmed] : [...selected, trimmed]);
    }
    setCustomValue('');
    setCustomMode(false);
  };

  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((raw) => {
        const { value, label } = toOption(raw);
        const isOn = selectedSet.has(value);
        return (
          <Pressable
            key={value}
            onPress={() => toggle(value)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ selected: isOn, disabled }}
            className={cn(
              'rounded-full px-4 py-2 border',
              isOn ? 'bg-plum-600 border-plum-600' : 'bg-cream-50 border-plum-50',
              disabled && 'opacity-50',
            )}
          >
            <Text
              className={cn(
                'font-body text-sm',
                isOn ? 'text-cream-50' : 'text-plum-900',
              )}
            >
              {label ?? value}
            </Text>
          </Pressable>
        );
      })}

      {customChips.map((value) => (
        <Pressable
          key={value}
          onPress={() => toggle(value)}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${value}`}
          className="flex-row items-center gap-1 rounded-full px-3 py-2 border bg-plum-600 border-plum-600"
        >
          <Text className="font-body text-sm text-cream-50">{value}</Text>
          <X color="#FAFAFF" size={14} />
        </Pressable>
      ))}

      {allowCustom && !customMode ? (
        <Pressable
          onPress={() => {
            lightHaptic();
            setCustomMode(true);
          }}
          disabled={disabled}
          accessibilityRole="button"
          className={cn(
            'flex-row items-center gap-1 rounded-full px-4 py-2 border border-plum-50 bg-cream-50',
            disabled && 'opacity-50',
          )}
        >
          <Plus color="#6D28D9" size={14} />
          <Text className="font-body text-sm text-plum-600">{customAddLabel}</Text>
        </Pressable>
      ) : null}

      {allowCustom && customMode ? (
        <View className="flex-row items-center gap-2 rounded-full px-3 py-1 border border-plum-600 bg-cream-50">
          <TextInput
            value={customValue}
            onChangeText={setCustomValue}
            placeholder={customPlaceholder}
            placeholderTextColor="#8A7F78"
            autoFocus
            autoCapitalize="none"
            onSubmitEditing={commitCustom}
            returnKeyType="done"
            className="font-body text-sm text-plum-900 min-w-[90px]"
          />
          <Pressable
            onPress={commitCustom}
            accessibilityRole="button"
            accessibilityLabel={customConfirmLabel}
            className="rounded-full px-2 py-1 bg-plum-600"
          >
            <Text className="font-body text-xs text-cream-50">{customConfirmLabel}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
