import { useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';
import { Text } from './Text';
import { cn } from '~/src/lib/cn';

export type InputProps = TextInputProps & {
  label?: string;
  error?: string;
  className?: string;
};

export function Input({ label, error, className, onFocus, onBlur, ...rest }: InputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View className={cn('w-full', className)}>
      {label ? (
        <Text variant="caption" className="mb-2 text-plum-600">
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor="#8A7F78"
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        className={cn(
          'font-body text-base text-plum-900',
          'h-12 rounded-md px-4',
          'bg-cream-50',
          'border',
          focused ? 'border-plum-600' : 'border-plum-50',
          error && 'border-rose-700',
        )}
        {...rest}
      />
      {error ? (
        <Text variant="caption" className="mt-1 text-rose-700">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
