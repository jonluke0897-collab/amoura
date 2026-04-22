import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '~/src/components/ui/Text';
import { Button } from '~/src/components/ui/Button';
import { cn } from '~/src/lib/cn';
import {
  EXTENDED_COMMITMENTS,
  EXTENDED_PLEDGE_AGREE_LABEL,
  EXTENDED_PLEDGE_CTA,
  EXTENDED_PLEDGE_DISAGREE_LABEL,
  EXTENDED_PLEDGE_HEADING,
  EXTENDED_PLEDGE_MIN_READ_MS,
  EXTENDED_PLEDGE_SUBHEAD,
} from './pledgeCopy';

type Choice = 'agree' | 'disagree' | null;

type Props = {
  submitting?: boolean;
  errorMessage?: string | null;
  onAccept: () => void;
  onDisagree: () => void;
};

const TIMER_TICK_MS = 100;

type ChoiceButtonProps = {
  label: string;
  variant: 'agree' | 'disagree';
  selected: boolean;
  onPress: () => void;
};

function ChoiceButton({ label, variant, selected, onPress }: ChoiceButtonProps) {
  // Selected states use filled colors (plum for agree, rose for disagree).
  // Unselected state is a soft outline so both choices feel equally available
  // — we deliberately don't pre-select "agree" to avoid a nudge.
  const selectedClass =
    variant === 'agree'
      ? 'bg-plum-600 border-plum-600'
      : 'bg-rose-700 border-rose-700';
  const unselectedClass = 'bg-cream-50 border-plum-50';
  const selectedTextClass = 'text-cream-50';
  const unselectedTextClass = variant === 'agree' ? 'text-plum-900' : 'text-rose-700';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={cn(
        'flex-1 items-center justify-center h-12 rounded-md border',
        selected ? selectedClass : unselectedClass,
      )}
    >
      <Text
        className={cn('font-body text-base', selected ? selectedTextClass : unselectedTextClass)}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function RespectPledgeExtended({
  submitting = false,
  errorMessage = null,
  onAccept,
  onDisagree,
}: Props) {
  const [choices, setChoices] = useState<Choice[]>(EXTENDED_COMMITMENTS.map(() => null));
  const [elapsedMs, setElapsedMs] = useState(0);
  const startRef = useRef<number>(Date.now());

  useEffect(() => {
    startRef.current = Date.now();
    const interval = setInterval(() => {
      const el = Date.now() - startRef.current;
      setElapsedMs(el);
      if (el >= EXTENDED_PLEDGE_MIN_READ_MS) clearInterval(interval);
    }, TIMER_TICK_MS);
    return () => clearInterval(interval);
  }, []);

  const timerElapsed = elapsedMs >= EXTENDED_PLEDGE_MIN_READ_MS;
  const progressPct = Math.min(100, (elapsedMs / EXTENDED_PLEDGE_MIN_READ_MS) * 100);
  const allAgreed = choices.every((c) => c === 'agree');
  const canSubmit = timerElapsed && allAgreed;

  const setAt = (i: number, choice: Choice) => {
    // If the user taps Disagree on any commitment, short-circuit to the exit flow
    // — the pledge isn't negotiable per vision doc § 1 (respect is gated, not suggested).
    if (choice === 'disagree') {
      onDisagree();
      return;
    }
    setChoices((prev) => prev.map((v, idx) => (idx === i ? choice : v)));
  };

  return (
    <View className="flex-1">
      {/* Read-time progress bar */}
      <View
        className="h-1 w-full bg-plum-50 rounded-full overflow-hidden mb-4"
        accessibilityRole="progressbar"
        accessibilityLabel="Reading time progress"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(progressPct) }}
      >
        <View
          className={cn('h-full', timerElapsed ? 'bg-plum-600' : 'bg-plum-400')}
          style={{ width: `${progressPct}%` }}
        />
      </View>

      <ScrollView className="flex-1" contentContainerClassName="pb-10">
        <Text variant="heading" className="text-3xl mb-2">
          {EXTENDED_PLEDGE_HEADING}
        </Text>
        <Text variant="body" className="text-plum-400 mb-8">
          {EXTENDED_PLEDGE_SUBHEAD}
        </Text>

        <View className="gap-6 mb-6">
          {EXTENDED_COMMITMENTS.map((commitment, i) => {
            const choice = choices[i];
            return (
              <View key={i} className="gap-3">
                <Text className="font-body text-base text-plum-900 leading-6">
                  {commitment}
                </Text>
                <View className="flex-row gap-2">
                  <ChoiceButton
                    label={EXTENDED_PLEDGE_AGREE_LABEL}
                    variant="agree"
                    selected={choice === 'agree'}
                    onPress={() => setAt(i, 'agree')}
                  />
                  <ChoiceButton
                    label={EXTENDED_PLEDGE_DISAGREE_LABEL}
                    variant="disagree"
                    selected={choice === 'disagree'}
                    onPress={() => setAt(i, 'disagree')}
                  />
                </View>
              </View>
            );
          })}
        </View>

        {!timerElapsed ? (
          <Text variant="caption" className="text-plum-400 text-xs mb-3">
            {Math.max(
              0,
              Math.ceil((EXTENDED_PLEDGE_MIN_READ_MS - elapsedMs) / 1000),
            )}s left before you can continue.
          </Text>
        ) : null}

        {errorMessage ? (
          <Text variant="caption" className="text-rose-700 mb-3">
            {errorMessage}
          </Text>
        ) : null}

        <Button
          label={EXTENDED_PLEDGE_CTA}
          onPress={onAccept}
          disabled={!canSubmit || submitting}
          loading={submitting}
          size="lg"
        />
      </ScrollView>
    </View>
  );
}
