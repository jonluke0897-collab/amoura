import { View, type ViewProps } from 'react-native';
import { cn } from '~/src/lib/cn';

export type CardProps = ViewProps & {
  className?: string;
};

export function Card({ className, style, children, ...rest }: CardProps) {
  return (
    <View
      className={cn('bg-cream-100 rounded-md p-6', className)}
      style={[
        {
          shadowColor: '#6D28D9',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 2,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}
