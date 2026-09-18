import { Pressable, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { cn } from '~/src/lib/cn';
import { Text } from '~/src/components/ui/Text';

/**
 * Plan-selector card for the paywall. Two states: selected (plum-600
 * border + plum-50 background) and unselected (plum-50 border, cream
 * background). The whole card is tappable so the hit target is large
 * — radio-button-with-tiny-circle would fight finger ergonomics on a
 * thumb-only screen.
 *
 * `savingsLabel` renders as a "Save 44%" pill in the top-right corner
 * for the annual plan. Pass `null` for the monthly card.
 */
export type PlanCardProps = {
  title: string;
  pricePrimary: string;        // e.g. "$14.99"
  priceSecondary: string;      // e.g. "/month" or "billed yearly"
  perMonthEquivalent?: string; // e.g. "$8.33/mo" for annual plan
  savingsLabel: string | null; // e.g. "Save 44%"
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
};

export function PlanCard({
  title,
  pricePrimary,
  priceSecondary,
  perMonthEquivalent,
  savingsLabel,
  selected,
  onPress,
  disabled = false,
}: PlanCardProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={`${title}, ${pricePrimary} ${priceSecondary}${
        savingsLabel ? `, ${savingsLabel}` : ''
      }`}
      className={cn(
        'rounded-md border-2 px-4 py-4 mb-3',
        selected
          ? 'border-plum-600 bg-plum-50'
          : 'border-plum-50 bg-cream-50',
        disabled && 'opacity-50',
      )}
    >
      <View className="flex-row items-start">
        {/* Radio dot — pure visual; the whole card is the hit target. */}
        <View
          className={cn(
            'w-5 h-5 rounded-full border-2 mt-0.5',
            selected ? 'border-plum-600 bg-plum-600' : 'border-plum-400',
          )}
        >
          {selected && (
            <View className="flex-1 items-center justify-center">
              <Check color="#FAFAFF" size={12} />
            </View>
          )}
        </View>
        <View className="flex-1 ml-3">
          <View className="flex-row items-center justify-between">
            <Text variant="heading" className="text-lg text-plum-900">
              {title}
            </Text>
            {savingsLabel && (
              <View className="bg-plum-600 px-2 py-0.5 rounded-full">
                <Text variant="caption" className="text-xs text-cream-50">
                  {savingsLabel}
                </Text>
              </View>
            )}
          </View>
          <View className="flex-row items-baseline mt-1">
            <Text variant="heading" className="text-2xl text-plum-900">
              {pricePrimary}
            </Text>
            <Text variant="body" className="text-sm text-plum-600 ml-1">
              {priceSecondary}
            </Text>
          </View>
          {perMonthEquivalent && (
            <Text variant="caption" className="text-xs text-plum-400 mt-0.5">
              {perMonthEquivalent}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}
