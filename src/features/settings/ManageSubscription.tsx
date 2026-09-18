import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from 'convex/react';
import { ChevronLeft, ExternalLink, Sparkles } from 'lucide-react-native';
import { api } from '~/convex/_generated/api';
import { Text } from '~/src/components/ui/Text';
import { Button } from '~/src/components/ui/Button';
import {
  isConfigured,
  openManageSubscription,
  restorePurchases,
} from '~/src/lib/purchases';
import { AnalyticsEvents, useTrack } from '~/src/lib/analytics';

/**
 * Manage Subscription screen — FR-027 / TASK-076.
 *
 * Two states based on `subscriptions.me`:
 *
 *   - Active subscriber: shows plan, renewal date, platform-source
 *     label, and a "Manage in App Store / Play Store" deep link.
 *     Cancellations have to happen in the store per Apple/Google
 *     policy; this screen is essentially a routing surface.
 *
 *   - Free user: shows "You're on the free plan" plus a CTA back to
 *     the paywall with `trigger=manage_subscription`.
 *
 * Restore Purchases is always present — useful for fresh installs
 * where RC's customer is new but the App Store / Play Store account
 * already owns the subscription.
 */
export function ManageSubscription() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const subscription = useQuery(api.subscriptions.me);
  const track = useTrack();
  const [restoring, setRestoring] = useState(false);

  const handleRestore = async () => {
    if (restoring) return;
    setRestoring(true);
    const result = await restorePurchases();
    setRestoring(false);
    if (result.kind === 'success') {
      if (result.hasPro) {
        track(AnalyticsEvents.PURCHASE_RESTORED, { trigger: 'manage_subscription' });
        Alert.alert(
          'Pro restored',
          'Your subscription is active. Your features should unlock within a moment.',
        );
      } else {
        Alert.alert(
          'No purchase found',
          "We couldn't find an active subscription on this account.",
        );
      }
    } else {
      Alert.alert(
        "Couldn't restore",
        result.message,
      );
    }
  };

  return (
    <View className="flex-1 bg-cream-50" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center px-3 py-2 border-b border-plum-50">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={12}
          className="h-10 w-10 items-center justify-center"
        >
          <ChevronLeft color="#6D28D9" size={22} />
        </Pressable>
        <Text variant="heading" className="text-lg text-plum-900 ml-1">
          Subscription
        </Text>
      </View>

      {subscription === undefined ? (
        // Initial query load — render an empty container instead of a
        // spinner so a slow network doesn't flicker the placeholder
        // copy in. The screen is read-mostly; a quarter-second of
        // stillness is fine.
        <View className="flex-1" />
      ) : subscription === null || !subscription.isActive ? (
        <FreeTierState />
      ) : (
        <ActiveSubscriberState
          productId={subscription.productId}
          willRenew={subscription.willRenew}
          currentPeriodEnd={subscription.currentPeriodEnd}
          platform={subscription.platform}
        />
      )}

      <View className="px-5 pb-6">
        <Button
          label="Restore purchases"
          variant="ghost"
          onPress={handleRestore}
          loading={restoring}
          disabled={!isConfigured() || restoring}
        />
      </View>
    </View>
  );
}

function FreeTierState() {
  const router = useRouter();
  const track = useTrack();

  const goToPaywall = () => {
    track(AnalyticsEvents.PAYWALL_VIEWED, { trigger: 'manage_subscription' });
    router.push('/paywall?trigger=manage_subscription' as never);
  };

  return (
    <View className="flex-1 px-5">
      <View className="items-center mt-12 mb-8">
        <View className="w-16 h-16 rounded-full bg-plum-50 items-center justify-center">
          <Sparkles color="#6D28D9" size={28} />
        </View>
        <Text
          variant="heading"
          className="text-xl text-plum-900 mt-4 text-center"
        >
          You're on the free plan.
        </Text>
        <Text
          variant="body"
          className="text-sm text-plum-600 mt-2 text-center"
        >
          Pro unlocks who liked you, more daily likes, and verified-only
          filtering.
        </Text>
      </View>
      <Button label="See Pro" onPress={goToPaywall} />
    </View>
  );
}

function ActiveSubscriberState({
  productId,
  willRenew,
  currentPeriodEnd,
  platform,
}: {
  productId: string;
  willRenew: boolean;
  currentPeriodEnd: number;
  platform: 'ios' | 'android';
}) {
  const planName = describeProduct(productId);
  const renewalLabel = formatRenewalDate(currentPeriodEnd);
  const storeLabel = platform === 'ios' ? 'App Store' : 'Play Store';

  return (
    <View className="flex-1 px-5 pt-6">
      <View className="rounded-md border border-plum-50 bg-cream-50 p-5">
        <Text
          variant="caption"
          className="text-xs uppercase tracking-wider text-plum-400"
        >
          Current plan
        </Text>
        <Text variant="heading" className="text-2xl text-plum-900 mt-1">
          Amia Pro · {planName}
        </Text>
        <View className="mt-4 flex-row items-baseline">
          <Text variant="caption" className="text-xs text-plum-400 w-28">
            {willRenew ? 'Renews' : 'Ends'}
          </Text>
          <Text variant="body" className="text-base text-plum-900">
            {renewalLabel}
          </Text>
        </View>
        <View className="mt-2 flex-row items-baseline">
          <Text variant="caption" className="text-xs text-plum-400 w-28">
            Billed via
          </Text>
          <Text variant="body" className="text-base text-plum-900">
            {storeLabel}
          </Text>
        </View>
        {!willRenew && (
          <Text variant="body" className="text-sm text-rose-700 mt-3">
            Your subscription is set to end on {renewalLabel}. You'll keep
            Pro until then.
          </Text>
        )}
      </View>

      <View className="mt-5">
        <Pressable
          onPress={openManageSubscription}
          accessibilityRole="button"
          accessibilityLabel={`Manage subscription in ${storeLabel}`}
          className="flex-row items-center justify-between rounded-md border border-plum-50 bg-cream-50 px-4 py-4"
        >
          <View className="flex-1">
            <Text variant="body" className="text-base text-plum-900">
              Manage in {storeLabel}
            </Text>
            <Text variant="caption" className="text-xs text-plum-400 mt-0.5">
              {/* Per Apple / Google policy, cancellations must happen in
                  the store. Don't try to bury this — make the
                  consequence obvious. */}
              Change plan, cancel, or update payment method.
            </Text>
          </View>
          <ExternalLink color="#6D28D9" size={20} />
        </Pressable>
      </View>
    </View>
  );
}

function describeProduct(productId: string): string {
  // Map RC product IDs to human-readable plan names. The two products
  // are `amoura_pro_monthly` and `amoura_pro_annual`. Fall back to the
  // raw ID for resilience if the dashboard adds a SKU we haven't
  // accounted for here yet.
  if (productId.endsWith('monthly')) return 'Monthly';
  if (productId.endsWith('annual') || productId.endsWith('yearly')) {
    return 'Annual';
  }
  return productId;
}

function formatRenewalDate(timestampMs: number): string {
  const date = new Date(timestampMs);
  if (Number.isNaN(date.getTime())) return 'soon';
  // Localized medium date. Avoids hardcoding "Mar 14, 2026" format —
  // the user's locale probably wants it differently.
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
