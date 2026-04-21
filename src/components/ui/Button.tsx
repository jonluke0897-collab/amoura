import { ActivityIndicator, Platform, Pressable, type PressableProps } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Text } from './Text';
import { cn } from '~/src/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const variantClasses: Record<Variant, { base: string; label: string; pressed: string }> = {
  primary: {
    base: 'bg-plum-600',
    label: 'text-cream-50',
    pressed: 'bg-plum-700',
  },
  secondary: {
    base: 'bg-cream-50 border border-plum-600',
    label: 'text-plum-600',
    pressed: 'bg-plum-50',
  },
  ghost: {
    base: 'bg-transparent',
    label: 'text-plum-600',
    pressed: 'bg-plum-50',
  },
  danger: {
    base: 'bg-rose-700',
    label: 'text-cream-50',
    pressed: 'bg-plum-700',
  },
};

const sizeClasses: Record<Size, { container: string; label: string }> = {
  sm: { container: 'h-10 px-3', label: 'text-sm' },
  md: { container: 'h-12 px-4', label: 'text-base' },
  lg: { container: 'h-14 px-6', label: 'text-lg' },
};

export type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  className?: string;
};

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  onPress,
  className,
  ...rest
}: ButtonProps) {
  const variantStyle = variantClasses[variant];
  const sizeStyle = sizeClasses[size];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={(e) => {
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPress?.(e);
      }}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      className={cn(
        'flex-row items-center justify-center rounded-sm',
        sizeStyle.container,
        variantStyle.base,
        isDisabled && 'opacity-50',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? '#FBF6EE' : '#6B2E4F'} />
      ) : (
        <Text className={cn('font-body', sizeStyle.label, variantStyle.label)}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}
