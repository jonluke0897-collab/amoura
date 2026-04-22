import { useEffect } from 'react';
import { Dimensions, Modal, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { X } from 'lucide-react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

export type FullScreenPhoto = {
  _id: string;
  url: string | null;
};

export type PhotoFullScreenProps = {
  visible: boolean;
  photo: FullScreenPhoto | null;
  onClose: () => void;
};

const AnimatedImage = Animated.createAnimatedComponent(Image);
const DISMISS_THRESHOLD = 120;

export function PhotoFullScreen({ visible, photo, onClose }: PhotoFullScreenProps) {
  const { width, height } = Dimensions.get('window');

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateY = useSharedValue(0);
  const backdropOpacity = useSharedValue(1);

  useEffect(() => {
    if (visible) {
      scale.value = 1;
      savedScale.value = 1;
      translateY.value = 0;
      backdropOpacity.value = 1;
    }
  }, [visible, scale, savedScale, translateY, backdropOpacity]);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(1, Math.min(savedScale.value * e.scale, 4));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value < 1.05) {
        scale.value = withSpring(1);
        savedScale.value = 1;
      }
    });

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      // Dismiss gesture only engages when the image is not zoomed in; at
      // scale > 1 pan should move the zoomed image, not close the modal.
      if (savedScale.value <= 1.01 && e.translationY > 0) {
        translateY.value = e.translationY;
        backdropOpacity.value = Math.max(0.3, 1 - e.translationY / 400);
      }
    })
    .onEnd((e) => {
      if (savedScale.value <= 1.01 && e.translationY > DISMISS_THRESHOLD) {
        runOnJS(onClose)();
      } else {
        translateY.value = withSpring(0);
        backdropOpacity.value = withSpring(1);
      }
    });

  const composed = Gesture.Simultaneous(pinch, pan);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Animated.View
        style={[{ flex: 1, backgroundColor: '#1E0838' }, backdropStyle]}
      >
        <View className="flex-1 items-center justify-center">
          <GestureDetector gesture={composed}>
            <AnimatedImage
              source={{ uri: photo?.url ?? undefined }}
              style={[{ width, height: height * 0.8 }, imageStyle]}
              contentFit="contain"
            />
          </GestureDetector>
        </View>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={16}
          className="absolute top-14 right-5"
        >
          <X color="#FAFAFF" size={28} />
        </Pressable>
      </Animated.View>
    </Modal>
  );
}
