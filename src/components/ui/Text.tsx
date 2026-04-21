import { Text as RNText, type TextProps } from 'react-native';
import { cn } from '~/src/lib/cn';

type Variant = 'heading' | 'body' | 'caption' | 'mono';

const variantClasses: Record<Variant, string> = {
  heading: 'font-heading text-plum-900',
  body: 'font-body text-plum-900',
  caption: 'font-body text-plum-400',
  mono: 'font-mono text-plum-900',
};

export type AmouraTextProps = TextProps & {
  variant?: Variant;
  className?: string;
};

export function Text({ variant = 'body', className, ...rest }: AmouraTextProps) {
  return <RNText className={cn(variantClasses[variant], className)} {...rest} />;
}
