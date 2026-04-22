import { View } from 'react-native';
import { cn } from '~/src/lib/cn';

type Props = {
  total: number;
  currentIndex: number;
};

export function ProgressDots({ total, currentIndex }: Props) {
  return (
    <View className="flex-row items-center justify-center gap-2" accessibilityRole="progressbar">
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
