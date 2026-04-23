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
