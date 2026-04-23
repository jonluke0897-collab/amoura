import { type ReactNode, useCallback } from 'react';
import { Modal, Pressable, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

export type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  /**
   * Content rendered inside the grabber-handle header area. The drag-to-
   * dismiss gesture is attached to this region only — any ScrollView in
   * `children` can scroll independently without the sheet re-interpreting
   * the swipe as a dismiss.
   */
  header: ReactNode;
  /**
   * Content below the header. Typically a `ScrollView` with `flex-1`
   * followed by a fixed-height footer row; the sheet's outer container is
   * a flex column so the body fills the remaining space automatically.
   */
  children: ReactNode;
  /**
   * When false, drag / backdrop / Android-back dismissal are all ignored.
   * Used by callers that have an async save in flight — prevents the user
   * from backing out while `updatePreferences` is committing.
   */
  dismissible?: boolean;
  /** Sheet height as a percentage of window height. Default 80. */
  heightPercent?: number;
};

const DRAG_DISMISS_PX = 120;
const DRAG_DISMISS_VELOCITY = 500;

/**
 * Shared bottom-sheet primitive used by Phase 3's FilterSheet and
 * CityPickerSheet. Replaces the earlier ad-hoc `Modal + Pressable overlay`
 * pattern with:
 *   - a fixed sheet height (no more content-hugging, so it feels substantial)
 *   - a flex-column layout so a ScrollView body actually scrolls
 *   - a pan gesture on the grabber-handle header that translates the sheet
 *     while dragging and dismisses on release past a threshold
 * Backdrop tap and Android back still work as a fallback when the drag is
 * not discoverable.
 */
export function BottomSheet({
  visible,
  onClose,
  header,
  children,
  dismissible = true,
  heightPercent = 80,
}: BottomSheetProps) {
  const { height: windowHeight } = useWindowDimensions();
  const translateY = useSharedValue(0);

  const tryClose = useCallback(() => {
    if (!dismissible) return;
    onClose();
  }, [dismissible, onClose]);

  // activeOffsetY prevents the gesture from "stealing" taps on the header
  // (the Filters title, the X button) — only after ~15px of vertical drag
  // does the pan take over. Horizontal moves below that threshold pass
  // through to touchables.
  const pan = Gesture.Pan()
    .enabled(dismissible)
    .activeOffsetY([-15, 15])
    .onUpdate((e) => {
      'worklet';
      if (e.translationY > 0) translateY.value = e.translationY;
    })
    .onEnd((e) => {
      'worklet';
      if (
        e.translationY > DRAG_DISMISS_PX ||
        e.velocityY > DRAG_DISMISS_VELOCITY
      ) {
        runOnJS(tryClose)();
      }
      translateY.value = withTiming(0);
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={tryClose}
    >
      <View className="flex-1 bg-plum-900/40 justify-end">
        <Pressable
          className="absolute inset-0"
          onPress={tryClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <Animated.View
          style={[
            { height: (windowHeight * heightPercent) / 100 },
            sheetStyle,
          ]}
          className="bg-cream-50 rounded-t-lg shadow-modal"
        >
          <GestureDetector gesture={pan}>
            <View>
              <View className="items-center pt-2 pb-1">
                <View className="w-10 h-1 rounded-full bg-plum-50" />
              </View>
              {header}
            </View>
          </GestureDetector>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}
