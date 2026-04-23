import { ActivityIndicator, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { Plus } from 'lucide-react-native';
import { cn } from '~/src/lib/cn';

export type PhotoSlotProps = {
  url?: string | null;
  uploading?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  dragging?: boolean;
  accessibilityLabel?: string;
};

export function PhotoSlot({
  url,
  uploading,
  onPress,
  onLongPress,
  dragging,
  accessibilityLabel,
}: PhotoSlotProps) {
  const isFilled = !!url;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={uploading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className={cn(
        'aspect-square w-full rounded-md overflow-hidden',
        isFilled ? 'bg-plum-50' : 'bg-transparent border-2 border-dashed border-plum-400',
        dragging && 'opacity-80',
      )}
    >
      {isFilled && (
        <Image
          source={{ uri: url }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          transition={150}
        />
      )}
      {!isFilled && !uploading && (
        <View className="flex-1 items-center justify-center">
          <Plus color="#A78BFA" size={28} />
        </View>
      )}
      {uploading && (
        <View className="absolute inset-0 items-center justify-center bg-plum-50/70">
          <ActivityIndicator color="#6D28D9" />
        </View>
      )}
    </Pressable>
  );
}
