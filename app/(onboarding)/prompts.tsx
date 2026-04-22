import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from '~/convex/_generated/api';
import type { Id } from '~/convex/_generated/dataModel';
import { Text } from '~/src/components/ui/Text';
import { Button } from '~/src/components/ui/Button';
import { PromptPicker, type PromptSummary } from '~/src/features/prompts/PromptPicker';
import { PromptAnswerEditor } from '~/src/features/prompts/PromptAnswerEditor';
import { PROMPTS_SCREEN } from '~/src/features/onboarding/onboardingCopy';
import { AnalyticsEvents, useTrack } from '~/src/lib/analytics';

type SlotState =
  | { open: false }
  | { open: true; position: number; prompt: PromptSummary; initialText: string };

export default function PromptsScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const isEditMode = params.mode === 'edit';

  const activePrompts = useQuery(api.profilePrompts.listActive) ?? [];
  const myAnswers = useQuery(api.profilePrompts.listMine) ?? [];
  const answerPrompt = useMutation(api.profilePrompts.answerPrompt);
  const track = useTrack();

  const [pickerOpen, setPickerOpen] = useState<{ open: boolean; position: number }>({
    open: false,
    position: 0,
  });
  const [editorState, setEditorState] = useState<SlotState>({ open: false });
  const [submitting, setSubmitting] = useState(false);

  const answered = useMemo(
    () =>
      [0, 1, 2].map((pos) => myAnswers.find((a) => a.position === pos)),
    [myAnswers],
  );

  // Picker's disabled set excludes the slot currently being swapped from, so
  // the user can re-pick the same prompt without hitting the "already
  // answered" gate. The server still rejects true duplicates across other
  // positions.
  const pickerDisabledIds = myAnswers
    .filter((a) => a.position !== pickerOpen.position)
    .map((a) => a.promptId);

  const openPicker = (position: number) =>
    setPickerOpen({ open: true, position });

  const handlePromptPick = (prompt: PromptSummary) => {
    const pos = pickerOpen.position;
    setPickerOpen({ open: false, position: 0 });
    setEditorState({ open: true, position: pos, prompt, initialText: '' });
  };

  const editExisting = (position: number) => {
    const existing = answered[position];
    if (!existing) return;
    const prompt = activePrompts.find((p) => p._id === existing.promptId);
    if (!prompt) return;
    setEditorState({
      open: true,
      position,
      prompt,
      initialText: existing.answerText,
    });
  };

  const changePromptFromEditor = () => {
    if (!editorState.open) return;
    const pos = editorState.position;
    setEditorState({ open: false });
    setPickerOpen({ open: true, position: pos });
  };

  const handleSave = async (text: string) => {
    if (!editorState.open) return;
    setSubmitting(true);
    try {
      await answerPrompt({
        promptId: editorState.prompt._id,
        answerText: text,
        position: editorState.position,
      });
      setEditorState({ open: false });
    } catch (e) {
      if (__DEV__) console.error('[prompts] save failed:', e);
    } finally {
      setSubmitting(false);
    }
  };

  const answerCount = myAnswers.length;
  const continueLabel = isEditMode
    ? PROMPTS_SCREEN.saveCta
    : answerCount === 0
      ? PROMPTS_SCREEN.skipCta
      : PROMPTS_SCREEN.continueCta;

  const handleContinue = () => {
    track(AnalyticsEvents.ONBOARDING_STEP_COMPLETED, {
      step: 'prompts',
      answeredCount: answerCount,
    });
    if (isEditMode) router.back();
    else router.replace('/(onboarding)/complete');
  };

  return (
    <View className="flex-1 px-5 pt-4">
      <Text variant="heading" className="text-3xl text-plum-600 mb-2">
        {PROMPTS_SCREEN.heading}
      </Text>
      <Text variant="body" className="text-base text-plum-900 mb-5 leading-6">
        {PROMPTS_SCREEN.subhead}
      </Text>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {[0, 1, 2].map((position) => {
          const existing = answered[position];
          const prompt = existing
            ? activePrompts.find((p) => p._id === existing.promptId)
            : null;
          const question = prompt?.question ?? existing?.question ?? '';
          const category = prompt?.category ?? existing?.category ?? '';
          return (
            <Pressable
              key={position}
              onPress={() =>
                existing ? editExisting(position) : openPicker(position)
              }
              accessibilityRole="button"
              className="bg-cream-100 rounded-md p-4 mb-3"
            >
              {existing ? (
                <>
                  <Text variant="caption" className="uppercase text-xs tracking-wider mb-1">
                    {category}
                  </Text>
                  <Text variant="heading" className="text-lg text-plum-900 mb-2">
                    {question}
                  </Text>
                  <Text variant="body" className="text-base text-plum-900" numberOfLines={3}>
                    {existing.answerText}
                  </Text>
                </>
              ) : (
                <View className="py-4 items-center">
                  <Text variant="body" className="text-plum-600 text-base">
                    {PROMPTS_SCREEN.emptySlotLabel}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      <Button
        label={continueLabel}
        size="lg"
        variant={answerCount === 0 && !isEditMode ? 'secondary' : 'primary'}
        disabled={submitting}
        onPress={handleContinue}
        className="my-4"
      />

      <PromptPicker
        visible={pickerOpen.open}
        prompts={activePrompts}
        alreadyAnsweredIds={pickerDisabledIds}
        onPick={handlePromptPick}
        onClose={() => setPickerOpen({ open: false, position: 0 })}
      />

      {editorState.open && (
        <PromptAnswerEditor
          visible={editorState.open}
          question={editorState.prompt.question}
          category={editorState.prompt.category}
          initialText={editorState.initialText}
          submitting={submitting}
          onCancel={() => setEditorState({ open: false })}
          onSave={handleSave}
          onChangePrompt={changePromptFromEditor}
        />
      )}
    </View>
  );
}
