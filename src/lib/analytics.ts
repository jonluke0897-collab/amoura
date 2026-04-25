import { useCallback } from 'react';
import { usePostHog } from 'posthog-react-native';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type EventProperties = Record<string, JsonValue>;

export const AnalyticsEvents = {
  APP_OPENED: 'app_opened',
  SIGN_IN_ATTEMPTED: 'sign_in_attempted',
  SIGN_IN_SUCCEEDED: 'sign_in_succeeded',
  SIGN_IN_CANCELLED: 'sign_in_cancelled',
  SIGN_IN_FAILED: 'sign_in_failed',
  ONBOARDING_STEP_COMPLETED: 'onboarding_step_completed',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  ONBOARDING_ABANDONED: 'onboarding_abandoned',
  // Phase 3 — Browse
  FEED_VIEWED: 'feed_viewed',
  PROFILE_CARD_TAPPED: 'profile_card_tapped',
  PROFILE_DETAIL_VIEWED: 'profile_detail_viewed',
  FILTERS_OPENED: 'filters_opened',
  FILTERS_APPLIED: 'filters_applied',
  FEED_SESSION_DURATION: 'feed_session_duration',
  // Phase 4 — Likes, Matches, Messaging. The magic-moment funnel is:
  //   feed_viewed → profile_detail_viewed → like_sent → match_created →
  //   first_message_sent → conversation_has_5_messages
  // Build this funnel manually in the PostHog dashboard once events are
  // flowing end-to-end (TASK-058).
  LIKE_SENT: 'like_sent',
  LIKE_PASSED: 'like_passed',
  LIKE_RESPONDED_MATCH: 'like_responded_match',
  MATCH_CREATED: 'match_created',
  CHAT_OPENED: 'chat_opened',
  FIRST_MESSAGE_SENT: 'first_message_sent',
  MESSAGE_SENT: 'message_sent',
  CONVERSATION_DEPTH_5: 'conversation_has_5_messages',
  UNMATCH: 'unmatch',
  // Phase 5 — Safety. Funnel for moderator load planning:
  //   profile_detail_viewed | chat_opened → report_submitted (with reason)
  //   profile_detail_viewed | chat_opened → block_user
  //   filter_verified_toggled (paid vs free for paywall conversion in P6)
  REPORT_SUBMITTED: 'report_submitted',
  BLOCK_USER: 'block_user',
  UNBLOCK_USER: 'unblock_user',
  FILTER_VERIFIED_TOGGLED: 'filter_verified_toggled',
  // Phase 5 Wave 3 — verification.
  // Tracks the full funnel: prompt → started → approved | rejected | dismissed.
  VERIFICATION_PROMPT_SHOWN: 'verification_prompt_shown',
  VERIFICATION_STARTED: 'verification_started',
  VERIFICATION_APPROVED: 'verification_approved',
  VERIFICATION_REJECTED: 'verification_rejected',
  VERIFICATION_DISMISSED: 'verification_dismissed',
} as const;

export type AnalyticsEvent = (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents];

export function useTrack() {
  const posthog = usePostHog();
  // Memoize on posthog identity so callers can add `track` to useEffect /
  // useCallback deps without re-firing on every render. The Phase 3 browse
  // feed's renderItem memo depends on this stability.
  return useCallback(
    (event: AnalyticsEvent, properties?: EventProperties) => {
      posthog?.capture(event, properties);
    },
    [posthog],
  );
}
