import { ManageSubscription } from '~/src/features/settings/ManageSubscription';

/**
 * Settings → Subscription route. Shows the user's current plan +
 * platform-store deep link, or a free-tier upsell if they haven't
 * subscribed. See `src/features/settings/ManageSubscription.tsx`.
 */
export default function ManageSubscriptionRoute() {
  return <ManageSubscription />;
}
