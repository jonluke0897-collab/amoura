import { useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { cn } from '~/src/lib/cn';

export type CarouselPhoto = {
  _id: string;
  url: string | null;
  width?: number;
  height?: number;
};

export type PhotoCarouselProps = {
  photos: CarouselPhoto[];
  aspectRatio?: number;
  onPhotoTap?: (index: number) => void;
};

export function PhotoCarousel({
  photos,
  aspectRatio = 1,
  onPhotoTap,
}: PhotoCarouselProps) {
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<CarouselPhoto>>(null);
  // useWindowDimensions reacts to orientation/resize; Dimensions.get('window')
  // would cache the value at first render. App is locked to portrait today,
  // but keeping this reactive is cheap insurance.
  const { width } = useWindowDimensions();
  const height = width / aspectRatio;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== index) setIndex(next);
  };

  if (photos.length === 0) return null;

  return (
    <View>
      <FlatList
        ref={listRef}
        data={photos}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyExtractor={(item) => item._id}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item, index: i }) => (
          <Pressable
            onPress={() => onPhotoTap?.(i)}
            accessibilityRole="imagebutton"
            accessibilityLabel={`Photo ${i + 1} of ${photos.length}`}
          >
            <Image
              source={{ uri: item.url ?? undefined }}
              style={{ width, height }}
              contentFit="cover"
              transition={150}
            />
          </Pressable>
        )}
      />
      {photos.length > 1 && (
        <View className="absolute bottom-3 w-full flex-row items-center justify-center">
          {photos.map((p, i) => (
            <View
              key={p._id}
              className={cn(
                'mx-1 rounded-full',
                i === index ? 'bg-plum-600 w-2 h-2' : 'bg-cream-50/70 w-1.5 h-1.5',
              )}
            />
          ))}
        </View>
      )}
    </View>
  );
}
