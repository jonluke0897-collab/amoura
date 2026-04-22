import { View } from 'react-native';
import { cn } from '~/src/lib/cn';

type Props = {
  total: number;
  currentIndex: number;
};

export function ProgressDots({ total, currentIndex }: Props) {
  const stepNumber = currentIndex + 1;
  return (
    <View
      className="flex-row items-center justify-center gap-2"
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${stepNumber} of ${total}`}
      accessibilityValue={{ min: 1, max: total, now: stepNumber }}
    >
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          className={cn(
            'h-2 rounded-full',
            i === currentIndex ? 'w-6 bg-plum-600' : 'w-2 bg-plum-50',
          )}
        />
      ))}
    </View>
  );
}
