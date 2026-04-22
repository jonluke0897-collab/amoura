import { useEffect, useRef, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { Text } from '~/src/components/ui/Text';
import { Button } from '~/src/components/ui/Button';
import { cn } from '~/src/lib/cn';
import {
  EXTENDED_COMMITMENTS,
  EXTENDED_PLEDGE_CTA,
  EXTENDED_PLEDGE_HEADING,
  EXTENDED_PLEDGE_INITIAL_INPUT_LABEL,
  EXTENDED_PLEDGE_MIN_READ_MS,
  EXTENDED_PLEDGE_SUBHEAD,
} from './pledgeCopy';

type Props = {
  submitting?: boolean;
  errorMessage?: string | null;
  onAccept: () => void;
};

const INITIAL_MAX_LEN = 4;
const TIMER_TICK_MS = 100;

export function RespectPledgeExtended({ submitting = false, errorMessage = null, onAccept }: Props) {
  const [initials, setInitials] = useState<string[]>(EXTENDED_COMMITMENTS.map(() => ''));
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
  const allInitialed = initials.every((v) => v.trim().length > 0);
  const canSubmit = timerElapsed && allInitialed;

  const setAt = (i: number, value: string) => {
    const trimmed = value.slice(0, INITIAL_MAX_LEN);
    setInitials((prev) => prev.map((v, idx) => (idx === i ? trimmed : v)));
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

      <ScrollView className="flex-1" contentContainerClassName="pb-10" keyboardShouldPersistTaps="handled">
        <Text variant="heading" className="text-3xl mb-2">
          {EXTENDED_PLEDGE_HEADING}
        </Text>
        <Text variant="body" className="text-plum-400 mb-8">
          {EXTENDED_PLEDGE_SUBHEAD}
        </Text>

        <View className="gap-6 mb-6">
          {EXTENDED_COMMITMENTS.map((commitment, i) => {
            const filled = initials[i].trim().length > 0;
            return (
              <View key={i} className="gap-2">
                <Text className="font-body text-base text-plum-900 leading-6">
                  {commitment}
                </Text>
                <View className="flex-row items-center gap-3">
                  <TextInput
                    value={initials[i]}
                    onChangeText={(t) => setAt(i, t)}
                    placeholder={EXTENDED_PLEDGE_INITIAL_INPUT_LABEL}
                    placeholderTextColor="#8A7F78"
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={INITIAL_MAX_LEN}
                    className={cn(
                      'font-body text-base text-plum-900 h-12 w-28 rounded-md px-3 bg-cream-50 border',
                      filled ? 'border-plum-600' : 'border-plum-50',
                    )}
                  />
                  <Text variant="caption" className="text-plum-400 text-xs flex-1">
                    {EXTENDED_PLEDGE_INITIAL_INPUT_LABEL}
                  </Text>
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
