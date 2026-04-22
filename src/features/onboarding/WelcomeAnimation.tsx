import { useEffect } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

type Props = {
  children: React.ReactNode;
  delayMs?: number;
  durationMs?: number;
};

export function WelcomeAnimation({ children, delayMs = 120, durationMs = 520 }: Props) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(16);

  useEffect(() => {
    opacity.value = withDelay(delayMs, withTiming(1, { duration: durationMs }));
    translateY.value = withDelay(delayMs, withTiming(0, { duration: durationMs }));
    // Reanimated shared values are stable refs across renders — including them in
    // deps would be harmless but misleading. Only animation timing params matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delayMs, durationMs]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}
