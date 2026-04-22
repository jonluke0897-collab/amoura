import { useMemo } from 'react';
import { Modal, Pressable, SectionList, View } from 'react-native';
import { X } from 'lucide-react-native';
import type { Id } from '~/convex/_generated/dataModel';
import { Text } from '~/src/components/ui/Text';
import { cn } from '~/src/lib/cn';
import { PROMPTS_SCREEN } from '~/src/features/onboarding/onboardingCopy';

export type PromptSummary = {
  _id: Id<'prompts'>;
  question: string;
  category: string;
};

export type PromptPickerProps = {
  visible: boolean;
  prompts: PromptSummary[];
  alreadyAnsweredIds: Id<'prompts'>[];
  onPick: (prompt: PromptSummary) => void;
  onClose: () => void;
};

export function PromptPicker({
  visible,
  prompts,
  alreadyAnsweredIds,
  onPick,
  onClose,
}: PromptPickerProps) {
  const answered = useMemo(() => new Set(alreadyAnsweredIds), [alreadyAnsweredIds]);
  const sections = useMemo(() => {
    const grouped = new Map<string, PromptSummary[]>();
    for (const p of prompts) {
      const list = grouped.get(p.category) ?? [];
      list.push(p);
      grouped.set(p.category, list);
    }
    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([title, data]) => ({ title, data }));
  }, [prompts]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-cream-50 pt-14 px-5">
        <View className="flex-row items-center justify-between mb-4">
          <Text variant="heading" className="text-2xl text-plum-600">
            {PROMPTS_SCREEN.pickerTitle}
          </Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={PROMPTS_SCREEN.pickerClose}
            hitSlop={12}
          >
            <X color="#6D28D9" size={24} />
          </Pressable>
        </View>

        <SectionList
          sections={sections}
          keyExtractor={(item) => item._id}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section: { title } }) => (
            <Text variant="caption" className="uppercase text-xs tracking-wider mt-4 mb-2">
              {title}
            </Text>
          )}
          renderItem={({ item }) => {
            const disabled = answered.has(item._id);
            return (
              <Pressable
                onPress={() => !disabled && onPick(item)}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityState={{ disabled }}
                className={cn(
                  'py-3 px-4 rounded-md mb-2 bg-cream-100',
                  disabled && 'opacity-40',
                )}
              >
                <Text variant="heading" className="text-lg text-plum-900">
                  {item.question}
                </Text>
              </Pressable>
            );
          }}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      </View>
    </Modal>
  );
}
