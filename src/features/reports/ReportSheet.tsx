import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useMutation } from 'convex/react';
import { Check, X } from 'lucide-react-native';
import { api } from '~/convex/_generated/api';
import type { Id } from '~/convex/_generated/dataModel';
import { BottomSheet } from '~/src/components/ui/BottomSheet';
import { Button } from '~/src/components/ui/Button';
import { Text } from '~/src/components/ui/Text';
import { AnalyticsEvents, useTrack } from '~/src/lib/analytics';
import {
  ReportReasonPicker,
  type ReportReason,
} from './ReportReasonPicker';

const MAX_CONTEXT_CHARS = 1000;

export type ReportSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** The user being reported. */
  reportedUserId: Id<'users'>;
  /** Display name of the reported user. Used in the sheet title. */
  reportedDisplayName: string;
  /**
   * If reporting from a chat surface, pass the match id so the moderator
   * can pull the conversation context. The "Share conversation" toggle
   * decides whether the matchId is actually sent on submit. Reports from
   * non-chat surfaces (profile detail) leave this undefined.
   */
  matchId?: Id<'matches'>;
};

type Step = 'pickReason' | 'compose' | 'confirmation';

/**
 * Multi-step report flow. Sits in the BottomSheet primitive used elsewhere
 * (FilterSheet, CityPickerSheet) for consistency. Steps:
 *
 *   1. pickReason — choose one of the 9 schema-aligned categories.
 *   2. compose — optional 1000-char context + (chat-only) toggle to share
 *      the conversation. Submit button enabled once a reason is set.
 *   3. confirmation — "Thanks. Our team reviews every report within 48 hours."
 *      per FR-024 SLA. Done button dismisses.
 *
 * Errors from `reports.submit` (rate limit, self-report, invalid links)
 * surface inline in step 2 — the sheet stays in compose state so the user
 * can adjust and retry. The 5/day rate-limit error is intentionally shown
 * verbatim because the message contains the reset timestamp.
 *
 * The "share conversation" toggle controls whether `relatedMatchId` is
 * included on submit. When on, the moderator can pull the full thread via
 * the matchId; we do not bundle messages directly because the schema only
 * stores one optional `relatedMessageId` (PRD § 3 reports table) and the
 * matchId path gives the moderator access to all of them anyway.
 */
export function ReportSheet({
  visible,
  onClose,
  reportedUserId,
  reportedDisplayName,
  matchId,
}: ReportSheetProps) {
  const submit = useMutation(api.reports.submit);
  const track = useTrack();
  const [step, setStep] = useState<Step>('pickReason');
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [context, setContext] = useState('');
  const [shareConversation, setShareConversation] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetAndClose() {
    setStep('pickReason');
    setReason(null);
    setContext('');
    setShareConversation(true);
    setSubmitting(false);
    setError(null);
    onClose();
  }

  async function handleSubmit() {
    if (!reason) return;
    setError(null);
    setSubmitting(true);
    try {
      await submit({
        reportedUserId,
        reason,
        context: context.trim() || undefined,
        relatedMatchId: matchId && shareConversation ? matchId : undefined,
      });
      track(AnalyticsEvents.REPORT_SUBMITTED, {
        reason,
        from_chat: !!matchId,
        shared_conversation: !!matchId && shareConversation,
      });
      setStep('confirmation');
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      // Rate-limit error from convex/lib/rateLimit carries the reset time
      // in a structured prefix we don't want to show users verbatim — strip
      // it and show the friendly copy instead.
      if (raw.startsWith('RATE_LIMITED:')) {
        setError(
          'Thanks — we’re seeing a lot of reports from you today. Please make sure each is a real concern.',
        );
      } else if (raw.includes("can't report yourself")) {
        setError('You can’t report yourself.');
      } else {
        // Don't surface arbitrary server-side error text to users — those
        // messages are written for debugging (table not found, validator
        // failures, internal IDs) and read poorly mid-flow. Log the raw
        // for triage; show the user a generic apology with a retry path.
        // When Sentry lands in Phase 7, this `console.warn` is the hook
        // a `Sentry.captureException` replaces.
        console.warn('[reports.submit] unexpected error', raw);
        setError('Something went wrong sending your report. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  const trimmedContext = context.trim();
  const overLimit = trimmedContext.length > MAX_CONTEXT_CHARS;

  return (
    <BottomSheet
      visible={visible}
      onClose={submitting ? () => {} : resetAndClose}
      dismissible={!submitting}
      heightPercent={85}
      header={
        <View className="flex-row items-center justify-between px-5 pt-2 pb-3 border-b border-plum-50">
          <Text variant="heading" className="text-xl text-plum-900">
            {step === 'confirmation'
              ? 'Report sent'
              : `Report ${reportedDisplayName}`}
          </Text>
          {!submitting && (
            <Pressable
              onPress={resetAndClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={12}
            >
              <X color="#6D28D9" size={22} />
            </Pressable>
          )}
        </View>
      }
    >
      {step === 'pickReason' && (
        <>
          <ScrollView className="flex-1 px-5 pt-3">
            <Text variant="body" className="text-sm text-plum-600 mb-3">
              What happened? Pick the closest match. The moderator team will
              read every word.
            </Text>
            <ReportReasonPicker selected={reason} onSelect={setReason} />
          </ScrollView>
          <View className="px-5 pt-3 pb-4 border-t border-plum-50">
            <Button
              label="Continue"
              disabled={!reason}
              onPress={() => setStep('compose')}
            />
          </View>
        </>
      )}

      {step === 'compose' && (
        <>
          <ScrollView className="flex-1 px-5 pt-3">
            <Text variant="body" className="text-sm text-plum-600 mb-2">
              Anything you’d like to add? (Optional)
            </Text>
            <TextInput
              value={context}
              onChangeText={setContext}
              multiline
              placeholder="What should the moderator know?"
              placeholderTextColor="#A78BFA"
              maxLength={MAX_CONTEXT_CHARS + 50}
              textAlignVertical="top"
              accessibilityLabel="Report context"
              className="font-body text-base text-plum-900 bg-cream-100 rounded-md p-4 min-h-[140px]"
            />
            <View className="flex-row justify-between mt-1 mb-4">
              <Text variant="caption" className="text-xs text-plum-400">
                Optional — up to {MAX_CONTEXT_CHARS} characters.
              </Text>
              <Text
                variant="caption"
                className={`text-xs ${overLimit ? 'text-rose-700' : 'text-plum-400'}`}
              >
                {trimmedContext.length}/{MAX_CONTEXT_CHARS}
              </Text>
            </View>

            {matchId && (
              <Pressable
                onPress={() => setShareConversation((v) => !v)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: shareConversation }}
                accessibilityLabel="Share this conversation with the moderator"
                className="flex-row items-start py-3 border-t border-plum-50"
              >
                <View
                  className={`mt-1 h-5 w-5 rounded border-2 items-center justify-center ${
                    shareConversation
                      ? 'border-plum-600 bg-plum-600'
                      : 'border-plum-400'
                  }`}
                >
                  {shareConversation && <Check color="#FAFAFF" size={14} />}
                </View>
                <View className="ml-3 flex-1">
                  <Text variant="body" className="text-base text-plum-900">
                    Share this conversation
                  </Text>
                  <Text
                    variant="caption"
                    className="text-xs text-plum-600 mt-0.5"
                  >
                    The moderator will be able to read your messages with this
                    person. We’ll never show them to anyone else.
                  </Text>
                </View>
              </Pressable>
            )}

            {error && (
              <View className="mt-3 rounded-md bg-rose-50 border border-rose-200 p-3">
                <Text variant="body" className="text-sm text-rose-700">
                  {error}
                </Text>
              </View>
            )}
          </ScrollView>
          <View className="flex-row gap-3 px-5 pt-3 pb-4 border-t border-plum-50">
            <View className="flex-1">
              <Button
                label="Back"
                variant="secondary"
                onPress={() => {
                  setError(null);
                  setStep('pickReason');
                }}
                disabled={submitting}
              />
            </View>
            <View className="flex-1">
              <Button
                label="Send report"
                onPress={handleSubmit}
                loading={submitting}
                disabled={submitting || overLimit}
              />
            </View>
          </View>
        </>
      )}

      {step === 'confirmation' && (
        <>
          <View className="flex-1 px-5 pt-6 items-center">
            <View className="h-16 w-16 rounded-full bg-plum-50 items-center justify-center mb-4">
              <Check color="#6D28D9" size={32} />
            </View>
            <Text
              variant="heading"
              className="text-xl text-plum-900 mb-2 text-center"
            >
              Thanks for telling us.
            </Text>
            <Text
              variant="body"
              className="text-sm text-plum-600 text-center mb-6 px-4"
            >
              Our team reviews every report within 48 hours. You can check
              the status anytime in Settings → My reports.
            </Text>
          </View>
          <View className="px-5 pt-3 pb-4 border-t border-plum-50">
            <Button label="Done" onPress={resetAndClose} />
          </View>
        </>
      )}
    </BottomSheet>
  );
}
