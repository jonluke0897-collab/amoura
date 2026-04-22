import { Pressable, View } from 'react-native';
import { Heart } from 'lucide-react-native';
import { Text } from '~/src/components/ui/Text';

export type PromptCardProps = {
  question: string;
  category: string;
  answerText: string;
  variant?: 'self' | 'public';
  onLike?: () => void;
};

export function PromptCard({
  question,
  category,
  answerText,
  variant = 'self',
  onLike,
}: PromptCardProps) {
  return (
    <View className="rounded-md border border-plum-50 bg-cream-50 p-4 mx-5 my-3 shadow-card">
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
          <Pressable
            onPress={onLike}
            accessibilityRole="button"
            accessibilityLabel="Like this prompt"
            hitSlop={8}
            disabled={!onLike}
          >
            <Heart color="#6D28D9" size={22} />
          </Pressable>
        </View>
      )}
    </View>
  );
}
