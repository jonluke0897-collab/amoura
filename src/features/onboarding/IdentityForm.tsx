import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '~/src/components/ui/Text';
import { Input } from '~/src/components/ui/Input';
import { Button } from '~/src/components/ui/Button';
import { cn } from '~/src/lib/cn';
import { ChipGroup } from './ChipGroup';
import { IDENTITY_SCREEN } from './onboardingCopy';
import {
  GENDER_SUGGESTIONS,
  MODALITY_OPTIONS,
  ModalityValue,
  ORIENTATION_PRESETS,
  PRONOUN_PRESETS,
  T4T_OPTIONS,
  T4TValue,
} from './identityOptions';

const GENDER_IDENTITY_MAX = 40;

export type IdentityFormValues = {
  pronouns: string[];
  genderIdentity: string;
  genderModality: ModalityValue | null;
  orientation: string[];
  t4tPreference: T4TValue | null;
};

type Props = {
  submitting?: boolean;
  errorMessage?: string | null;
  onSubmit: (values: IdentityFormValues & { genderModality: ModalityValue; t4tPreference: T4TValue }) => void;
};

type RadioRowProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

function RadioRow({ label, selected, onPress }: RadioRowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      className={cn(
        'rounded-md border p-4 flex-row items-center gap-3',
        selected ? 'border-plum-600 bg-plum-50' : 'border-plum-50 bg-cream-50',
      )}
    >
      <View
        className={cn(
          'h-5 w-5 rounded-full border items-center justify-center',
          selected ? 'border-plum-600 bg-plum-600' : 'border-plum-400 bg-cream-50',
        )}
      >
        {selected ? <View className="h-2 w-2 rounded-full bg-cream-50" /> : null}
      </View>
      <Text className="font-body text-base text-plum-900 flex-1">{label}</Text>
    </Pressable>
  );
}

export function IdentityForm({ submitting = false, errorMessage = null, onSubmit }: Props) {
  const [pronouns, setPronouns] = useState<string[]>([]);
  const [genderIdentity, setGenderIdentity] = useState('');
  const [genderModality, setGenderModality] = useState<ModalityValue | null>(null);
  const [orientation, setOrientation] = useState<string[]>([]);
  const [t4tPreference, setT4tPreference] = useState<T4TValue | null>(null);

  const showT4T = genderModality !== null && genderModality !== 'cis';

  const canSubmit = useMemo(() => {
    if (pronouns.length === 0) return false;
    if (genderIdentity.trim().length === 0) return false;
    if (genderModality === null) return false;
    if (orientation.length === 0) return false;
    if (showT4T && t4tPreference === null) return false;
    return true;
  }, [pronouns, genderIdentity, genderModality, orientation, showT4T, t4tPreference]);

  const handleSubmit = () => {
    if (!canSubmit || genderModality === null) return;
    // Cis users: t4tPreference is hidden and silently set to "open" (structurally blocks T4T-only selection).
    const resolvedT4T: T4TValue = genderModality === 'cis' ? 'open' : (t4tPreference ?? 'open');
    onSubmit({
      pronouns,
      genderIdentity: genderIdentity.trim(),
      genderModality,
      orientation,
      t4tPreference: resolvedT4T,
    });
  };

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="pb-10"
      keyboardShouldPersistTaps="handled"
    >
      <Text variant="heading" className="text-3xl mb-2">
        {IDENTITY_SCREEN.heading}
      </Text>
      <Text variant="body" className="text-plum-400 mb-8">
        {IDENTITY_SCREEN.subhead}
      </Text>

      {/* Pronouns */}
      <View className="mb-8">
        <Text variant="body" className="text-plum-900 mb-1 font-semibold">
          {IDENTITY_SCREEN.pronounsLabel}
        </Text>
        <Text variant="caption" className="mb-3">
          {IDENTITY_SCREEN.pronounsHelper}
        </Text>
        <ChipGroup
          options={PRONOUN_PRESETS}
          selected={pronouns}
          onChange={setPronouns}
          mode="multi"
          allowCustom
          customAddLabel={IDENTITY_SCREEN.pronounsAddCustom}
          customPlaceholder={IDENTITY_SCREEN.pronounsAddPlaceholder}
          customConfirmLabel={IDENTITY_SCREEN.pronounsAddConfirm}
        />
      </View>

      {/* Gender identity */}
      <View className="mb-8">
        <Text variant="body" className="text-plum-900 mb-1 font-semibold">
          {IDENTITY_SCREEN.genderIdentityLabel}
        </Text>
        <Text variant="caption" className="mb-3">
          {IDENTITY_SCREEN.genderIdentityHelper}
        </Text>
        <Input
          value={genderIdentity}
          onChangeText={(t) => setGenderIdentity(t.slice(0, GENDER_IDENTITY_MAX))}
          placeholder={IDENTITY_SCREEN.genderIdentityPlaceholder}
          maxLength={GENDER_IDENTITY_MAX}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text variant="caption" className="text-plum-400 text-xs mt-1 self-end">
          {genderIdentity.length}/{GENDER_IDENTITY_MAX}
        </Text>
        <View className="mt-3">
          <ChipGroup
            options={GENDER_SUGGESTIONS}
            selected={GENDER_SUGGESTIONS.includes(genderIdentity) ? [genderIdentity] : []}
            // Deselecting a suggestion clears the input — matches the user's intent
            // more cleanly than silently preserving the previous text.
            onChange={(next) => setGenderIdentity(next[0] ?? '')}
            mode="single"
          />
        </View>
      </View>

      {/* Modality */}
      <View className="mb-8">
        <Text variant="body" className="text-plum-900 mb-1 font-semibold">
          {IDENTITY_SCREEN.modalityLabel}
        </Text>
        <Text variant="caption" className="mb-3">
          {IDENTITY_SCREEN.modalityHelper}
        </Text>
        <View className="gap-2">
          {MODALITY_OPTIONS.map((opt) => (
            <RadioRow
              key={opt.value}
              label={opt.label}
              selected={genderModality === opt.value}
              onPress={() => {
                setGenderModality(opt.value);
                if (opt.value === 'cis') setT4tPreference(null);
              }}
            />
          ))}
        </View>
      </View>

      {/* Orientation */}
      <View className="mb-8">
        <Text variant="body" className="text-plum-900 mb-1 font-semibold">
          {IDENTITY_SCREEN.orientationLabel}
        </Text>
        <Text variant="caption" className="mb-3">
          {IDENTITY_SCREEN.orientationHelper}
        </Text>
        <ChipGroup
          options={ORIENTATION_PRESETS}
          selected={orientation}
          onChange={setOrientation}
          mode="multi"
          allowCustom
          customAddLabel={IDENTITY_SCREEN.orientationAddCustom}
          customPlaceholder={IDENTITY_SCREEN.orientationAddPlaceholder}
          customConfirmLabel={IDENTITY_SCREEN.orientationAddConfirm}
        />
      </View>

      {/* T4T preference — hidden for cis users */}
      {showT4T ? (
        <View className="mb-8">
          <Text variant="body" className="text-plum-900 mb-1 font-semibold">
            {IDENTITY_SCREEN.t4tLabel}
          </Text>
          <Text variant="caption" className="mb-3">
            {IDENTITY_SCREEN.t4tHelper}
          </Text>
          <View className="gap-2">
            {T4T_OPTIONS.map((opt) => (
              <RadioRow
                key={opt.value}
                label={opt.label}
                selected={t4tPreference === opt.value}
                onPress={() => setT4tPreference(opt.value)}
              />
            ))}
          </View>
        </View>
      ) : null}

      {errorMessage ? (
        <Text variant="caption" className="text-rose-700 mb-3">
          {errorMessage}
        </Text>
      ) : null}

      <Button
        label={IDENTITY_SCREEN.continueCta}
        onPress={handleSubmit}
        disabled={!canSubmit || submitting}
        loading={submitting}
        size="lg"
      />
    </ScrollView>
  );
}
