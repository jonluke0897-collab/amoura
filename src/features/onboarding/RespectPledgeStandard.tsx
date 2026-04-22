import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { Text } from '~/src/components/ui/Text';
import { Button } from '~/src/components/ui/Button';
import { cn } from '~/src/lib/cn';
import {
  STANDARD_COMMITMENTS,
  STANDARD_PLEDGE_CTA,
  STANDARD_PLEDGE_HEADING,
  STANDARD_PLEDGE_SUBHEAD,
} from './pledgeCopy';

type Props = {
  submitting?: boolean;
  errorMessage?: string | null;
  onAccept: () => void;
};

export function RespectPledgeStandard({ submitting = false, errorMessage = null, onAccept }: Props) {
  const [checked, setChecked] = useState<boolean[]>(STANDARD_COMMITMENTS.map(() => false));

  const toggle = (i: number) => {
    setChecked((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  };

  const allChecked = checked.every(Boolean);

  return (
    <ScrollView className="flex-1" contentContainerClassName="pb-10">
      <Text variant="heading" className="text-3xl mb-2">
        {STANDARD_PLEDGE_HEADING}
      </Text>
      <Text variant="body" className="text-plum-400 mb-8">
        {STANDARD_PLEDGE_SUBHEAD}
      </Text>

      <View className="gap-4 mb-8">
        {STANDARD_COMMITMENTS.map((commitment, i) => {
          const isOn = checked[i];
          return (
            <Pressable
              key={i}
              onPress={() => toggle(i)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isOn }}
              className={cn(
                'rounded-md border p-4 flex-row items-start gap-3',
                isOn ? 'border-plum-600 bg-plum-50' : 'border-plum-50 bg-cream-50',
              )}
            >
              <View
                className={cn(
                  'h-6 w-6 rounded-sm border items-center justify-center mt-0.5',
                  isOn ? 'border-plum-600 bg-plum-600' : 'border-plum-400 bg-cream-50',
                )}
              >
                {isOn ? <Check color="#FAFAFF" size={16} /> : null}
              </View>
              <Text className="font-body text-base text-plum-900 flex-1 leading-6">
                {commitment}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {errorMessage ? (
        <Text variant="caption" className="text-rose-700 mb-3">
          {errorMessage}
        </Text>
      ) : null}

      <Button
        label={STANDARD_PLEDGE_CTA}
        onPress={onAccept}
        disabled={!allChecked || submitting}
        loading={submitting}
        size="lg"
      />
    </ScrollView>
  );
}
