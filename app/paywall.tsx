import { PaywallScreen } from '~/src/features/paywall/PaywallScreen';

/**
 * Paywall route — presented as a full-screen modal (registered with
 * `presentation: 'modal'` in `app/_layout.tsx`'s root Stack).
 *
 * Trigger context arrives via the `trigger` query param:
 *   /paywall?trigger=likes_inbox
 *   /paywall?trigger=verified_filter
 *   /paywall?trigger=daily_cap
 *   /paywall?trigger=manage_subscription
 *   /paywall                     (treated as 'browse' / generic)
 *
 * The screen reads the param via `useLocalSearchParams` to choose the
 * hero copy variant and to forward it as `trigger` to the paywall
 * analytics events.
 */
export default function PaywallRoute() {
  return <PaywallScreen />;
}
