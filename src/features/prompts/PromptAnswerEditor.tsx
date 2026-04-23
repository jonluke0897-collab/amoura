import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  TextInput,
  View,
} from 'react-native';
import { X } from 'lucide-react-native';
import { Text } from '~/src/components/ui/Text';
import { Button } from '~/src/components/ui/Button';
import { cn } from '~/src/lib/cn';
import { PROMPTS_SCREEN } from '~/src/features/onboarding/onboardingCopy';

const MAX = PROMPTS_SCREEN.characterLimit;

export type PromptAnswerEditorProps = {
  visible: boolean;
  question: string;
  category: string;
  initialText?: string;
  submitting?: boolean;
  onCancel: () => void;
  onSave: (text: string) => void;
  /**
   * Optional: when supplied, renders a "Change prompt" link that lets the
   * user swap the prompt at this slot. Used by the edit flow; omitted in the
   * onboarding new-answer flow so users don't accidentally wander off-prompt.
   */
  onChangePrompt?: () => void;
  /**
   * Optional: when supplied, renders a destructive "Remove this answer" link
   * at the bottom of the editor. Parent confirms + calls the remove mutation
   * and dismisses the modal. Only makes sense when an existing answer is
   * being edited (server row exists); omitted on fresh picks.
   */
  onRemove?: () => void;
};

export function PromptAnswerEditor({
  visible,
  question,
  category,
  initialText = '',
  submitting,
  onCancel,
  onSave,
  onChangePrompt,
  onRemove,
}: PromptAnswerEditorProps) {
  const [text, setText] = useState(initialText);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setText(initialText);
      // Give the modal a tick to open before focusing, otherwise the keyboard
      // races with the modal animation and sometimes drops the focus request.
      const t = setTimeout(() => inputRef.current?.focus(), 250);
      return () => clearTimeout(t);
    }
  }, [visible, initialText]);

  const length = text.length;
  const overLimit = length > MAX;
  const trimmed = text.trim();
  const canSave = trimmed.length >= 1 && !overLimit && !submitting;
  const isDirty = text !== initialText;

  const confirmDiscard = () => {
    if (!isDirty) return onCancel();
    Alert.alert(PROMPTS_SCREEN.discardTitle, PROMPTS_SCREEN.discardBody, [
      { text: PROMPTS_SCREEN.discardKeep, style: 'cancel' },
      { text: PROMPTS_SCREEN.discardConfirm, style: 'destructive', onPress: onCancel },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={confirmDiscard}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 bg-cream-50"
      >
        <View className="flex-1 pt-14 px-5">
          <View className="flex-row items-center justify-between mb-3">
            <Text variant="caption" className="uppercase text-xs tracking-wider">
              {category}
            </Text>
            <Pressable
              onPress={confirmDiscard}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={12}
            >
              <X color="#6D28D9" size={24} />
            </Pressable>
          </View>
          <Text
            variant="heading"
            className={cn(
              'text-2xl text-plum-900 leading-8',
              onChangePrompt ? 'mb-2' : 'mb-5',
            )}
          >
            {question}
          </Text>
          {onChangePrompt && (
            <Pressable
              onPress={onChangePrompt}
              accessibilityRole="button"
              hitSlop={6}
              className="mb-4 self-start"
            >
              <Text variant="body" className="text-sm text-plum-600 underline">
                {PROMPTS_SCREEN.changePromptLabel}
              </Text>
            </Pressable>
          )}

          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={setText}
            multiline
            placeholder={PROMPTS_SCREEN.editorPlaceholder}
            placeholderTextColor="#A78BFA"
            maxLength={MAX + 50}
            textAlignVertical="top"
            className="flex-1 font-body text-base text-plum-900 bg-cream-100 rounded-md p-4"
          />

          <View className="flex-row items-center justify-between mt-3 mb-4">
            <Text
              className={cn(
                'text-sm',
                overLimit ? 'text-rose-700' : 'text-plum-400',
              )}
            >
              {length}
              {PROMPTS_SCREEN.counterSuffix}
            </Text>
          </View>

          <Button
            label={PROMPTS_SCREEN.saveCta}
            size="lg"
            disabled={!canSave}
            loading={submitting}
            onPress={() => onSave(trimmed)}
            className="mb-3"
          />

          {onRemove && (
            <Pressable
              onPress={onRemove}
              accessibilityRole="button"
              hitSlop={8}
              disabled={submitting}
              className="self-center mb-6 py-2"
            >
              <Text
                variant="body"
                className="text-sm text-rose-700 underline"
              >
                {PROMPTS_SCREEN.removeAnswerLabel}
              </Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
