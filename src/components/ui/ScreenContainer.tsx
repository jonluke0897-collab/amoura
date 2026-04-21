import { SafeAreaView } from 'react-native-safe-area-context';
import type { ViewProps } from 'react-native';
import { cn } from '~/src/lib/cn';

export type ScreenContainerProps = ViewProps & {
  className?: string;
  edges?: ('top' | 'right' | 'bottom' | 'left')[];
};

export function ScreenContainer({ className, children, edges, ...rest }: ScreenContainerProps) {
  return (
    <SafeAreaView
      className={cn('flex-1 bg-cream-50 px-5 py-4', className)}
      edges={edges}
      {...rest}
    >
      {children}
    </SafeAreaView>
  );
}
