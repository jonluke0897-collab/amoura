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
} as const;

export type AnalyticsEvent = (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents];

export function useTrack() {
  const posthog = usePostHog();
  return (event: AnalyticsEvent, properties?: EventProperties) => {
    posthog?.capture(event, properties);
  };
}
