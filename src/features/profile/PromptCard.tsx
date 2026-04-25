import { Pressable, View } from 'react-native';
import { Heart } from 'lucide-react-native';
import { Text } from '~/src/components/ui/Text';
import { cn } from '~/src/lib/cn';

export type PromptCardProps = {
  question: string;
  category: string;
  answerText: string;
  variant?: 'self' | 'public';
  /**
   * When present, the whole card is pressable and fires this handler.
   * Used by Phase 4's Like-with-Comment target selection flow on the
   * profile detail screen — tapping the card marks this prompt as the
   * "like target" (then the sticky footer opens the comment modal).
   * The heart icon stays visible as an affordance but the entire card is
   * the hit area so the target is easy to pick with one thumb.
   */
  onLike?: () => void;
  /**
   * Visual state for selection mode: when true, the heart fills and the
   * card gains a plum ring. Only meaningful in the `public` variant.
   */
  selected?: boolean;
};

export function PromptCard({
  question,
  category,
  answerText,
  variant = 'self',
  onLike,
  selected = false,
}: PromptCardProps) {
  const content = (
    <>
      <Text variant="caption" className="uppercase text-xs tracking-wider mb-1">
        {category}
      </Text>
      <Text variant="heading" className="text-xl text-plum-900 mb-3 leading-7">
        {question}
      </Text>
      <Text variant="body" className="text-base text-plum-900 leading-6">
        {answerText}
      </Text>
      {variant === 'public' && (
        <View className="flex-row justify-end mt-3">
          <Heart
            color={selected ? '#6D28D9' : '#6D28D9'}
            fill={selected ? '#6D28D9' : 'transparent'}
            size={22}
          />
        </View>
      )}
    </>
  );

  const containerClass = cn(
    'rounded-md p-4 mx-5 my-3 shadow-card',
    selected
      ? 'bg-plum-50 border-2 border-plum-600'
      : 'bg-cream-50 border border-plum-50',
  );

  if (variant === 'public' && onLike) {
    return (
      <Pressable
        onPress={onLike}
        accessibilityRole="button"
        accessibilityLabel={
          selected ? 'Selected prompt for like' : 'Select this prompt'
        }
        accessibilityState={{ selected }}
        className={containerClass}
      >
        {content}
      </Pressable>
    );
  }

  return <View className={containerClass}>{content}</View>;
}
