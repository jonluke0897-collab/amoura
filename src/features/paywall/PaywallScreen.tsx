import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery } from 'convex/react';
import { Check, Heart, X } from 'lucide-react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import { api } from '~/convex/_generated/api';
import { ScreenContainer } from '~/src/components/ui/ScreenContainer';
import { Text } from '~/src/components/ui/Text';
import { Button } from '~/src/components/ui/Button';
import { AnalyticsEvents, useTrack } from '~/src/lib/analytics';
import {
  getDefaultOfferings,
  isConfigured,
  purchasePackage,
  restorePurchases,
} from '~/src/lib/purchases';
import { PlanCard } from './PlanCard';

/**
 * Paywall trigger labels. Shape the hero copy so each entry point reads
 * like a continuation of what the user just did, not a context-free pitch.
 *
 *   - likes_inbox       — opened the Likes tab as a free user
 *   - verified_filter   — toggled "Verified only" in the filter sheet
 *   - daily_cap         — hit the 10-likes/day rate limit
 *   - manage_subscription — visited Manage Subscription as a free user
 *   - browse            — generic / unknown trigger
 */
type Trigger =
  | 'likes_inbox'
  | 'verified_filter'
  | 'daily_cap'
  | 'manage_subscription'
  | 'browse';

const HERO_COPY: Record<Trigger, { headline: string; subhead: string }> = {
  likes_inbox: {
    headline: 'See who likes you.',
    subhead:
      'Free shows the count. Pro shows the people — and what they said.',
  },
  verified_filter: {
    headline: 'Filter for verified profiles.',
    subhead:
      'See only people who completed photo verification. Pro-only.',
  },
  daily_cap: {
    headline: 'More likes today.',
    subhead:
      "You've used your daily likes. Pro lifts the cap so you can keep going.",
  },
  manage_subscription: {
    headline: 'Love without limits.',
    subhead: 'See who likes you, send unlimited likes, and filter for verified profiles.',
  },
  browse: {
    headline: 'Love without limits.',
    subhead: 'See who likes you, send unlimited likes, and filter for verified profiles.',
  },
};

const FEATURES: { label: string; description: string }[] = [
  { label: 'See who likes you', description: 'Unblur the people in your inbox.' },
  { label: 'Send 10× more likes', description: 'No daily cap. Keep meeting people.' },
  { label: 'Filter for verified profiles', description: 'Photo-verified accounts only.' },
  { label: 'Read receipts', description: 'Know when your message was seen.' },
  { label: 'Typing indicators', description: "See when they're writing back." },
];

const TERMS_URL = 'https://amoura.app/terms';
const PRIVACY_URL = 'https://amoura.app/privacy';

export function PaywallScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ trigger?: string }>();
  const trigger = normalizeTrigger(params.trigger);
  const track = useTrack();

  const subscription = useQuery(api.subscriptions.me);

  const [monthlyPkg, setMonthlyPkg] = useState<PurchasesPackage | null>(null);
  const [annualPkg, setAnnualPkg] = useState<PurchasesPackage | null>(null);
  const [selected, setSelected] = useState<'monthly' | 'annual'>('annual');
  const [loadingOfferings, setLoadingOfferings] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  // Fetch offerings on mount. RevenueCatProvider has already configured
  // the SDK by the time we're rendered (provider mount runs before this
  // route can be pushed). If `isConfigured()` is false, we hand the
  // user a "subscriptions are unavailable" state — same graceful no-op
  // pattern as the providers.
  useEffect(() => {
    track(AnalyticsEvents.PAYWALL_VIEWED, { trigger });
  }, [track, trigger]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isConfigured()) {
        if (!cancelled) {
          setUnavailable(true);
          setLoadingOfferings(false);
        }
        return;
      }
      try {
        const { monthly, annual } = await getDefaultOfferings();
        if (cancelled) return;
        setMonthlyPkg(monthly);
        setAnnualPkg(annual);
        // Default selection: annual, but only if it actually exists.
        if (!annual && monthly) setSelected('monthly');
      } catch (e) {
        if (!cancelled) {
          if (__DEV__) console.warn('[Amia] paywall offerings load failed', e);
          setError("We couldn't load plans. Try again in a minute.");
        }
      } finally {
        if (!cancelled) setLoadingOfferings(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Server-side entitlement is the source of truth. If the user lands on
  // /paywall and `subscriptions.me` says they're already a Pro subscriber
  // (e.g. they tapped Restore on a previous session, or a webhook landed
  // before this query mounted), close the paywall automatically.
  useEffect(() => {
    if (subscription?.isActive) {
      router.back();
    }
  }, [subscription?.isActive, router]);

  const close = (reason: 'dismiss' | 'success') => {
    if (reason === 'dismiss') {
      track(AnalyticsEvents.PAYWALL_DISMISSED, { trigger });
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      // If the paywall was deep-linked or pushed as the first screen
      // (TestFlight cold-start to a "/paywall?trigger=daily_cap" link),
      // there's nothing to go back to. Drop into the browse tab.
      router.replace('/(tabs)/browse' as never);
    }
  };

  const handlePurchase = async () => {
    const pkg = selected === 'monthly' ? monthlyPkg : annualPkg;
    if (!pkg || purchasing) return;
    setPurchasing(true);
    setError(null);
    track(AnalyticsEvents.CHECKOUT_STARTED, {
      trigger,
      product: pkg.product.identifier,
      price: pkg.product.priceString,
      period: selected,
    });
    const result = await purchasePackage(pkg);
    setPurchasing(false);
    if (result.kind === 'success') {
      track(AnalyticsEvents.PURCHASE_COMPLETED, {
        trigger,
        product: pkg.product.identifier,
        price: pkg.product.priceString,
        period: selected,
      });
      // Don't fire `paywall_dismissed` on success — `purchase_completed`
      // is the win event. Wait a beat so the customer-info update
      // listener has time to push fresh state into RC's cache before
      // we close; UI gating reads from Convex (which the webhook
      // populates) but the close-then-reopen race should never feel
      // jittery.
      close('success');
    } else if (result.kind === 'cancelled') {
      // User cancelled the native sheet — stay on the paywall.
      track(AnalyticsEvents.PAYWALL_DISMISSED, { trigger, reason: 'cancelled_purchase' });
    } else {
      setError(result.message);
    }
  };

  const handleRestore = async () => {
    if (restoring) return;
    setRestoring(true);
    setError(null);
    const result = await restorePurchases();
    setRestoring(false);
    if (result.kind === 'success') {
      if (result.hasPro) {
        track(AnalyticsEvents.PURCHASE_RESTORED, { trigger });
        Alert.alert(
          'Pro restored',
          'Your subscription is active. Welcome back.',
        );
        close('success');
      } else {
        Alert.alert(
          'No purchase found',
          "We couldn't find an Amia Pro subscription on this account. If you bought it on a different account, sign in there to restore.",
        );
      }
    } else {
      setError(result.message);
    }
  };

  const hero = HERO_COPY[trigger];
  const selectedPkg = selected === 'monthly' ? monthlyPkg : annualPkg;
  const canPurchase = !unavailable && !loadingOfferings && selectedPkg !== null;

  return (
    <ScreenContainer className="px-0 py-0">
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Close button — top-right, tap target is generous (hitSlop) */}
        <View className="flex-row items-center justify-end px-5 pt-3 pb-1">
          <Pressable
            onPress={() => close('dismiss')}
            accessibilityRole="button"
            accessibilityLabel="Close paywall"
            hitSlop={16}
          >
            <X color="#6D28D9" size={26} />
          </Pressable>
        </View>

        {/* Hero — soft plum tone, centered icon + headline */}
        <View className="px-5 pt-2 pb-6 items-center">
          <View className="w-20 h-20 rounded-full bg-plum-50 items-center justify-center mb-4">
            <Heart color="#6D28D9" size={40} fill="#6D28D9" />
          </View>
          <Text
            variant="heading"
            className="text-3xl text-plum-900 text-center"
          >
            {hero.headline}
          </Text>
          <Text
            variant="body"
            className="text-base text-plum-600 mt-2 text-center px-4"
          >
            {hero.subhead}
          </Text>
        </View>

        {/* Feature list */}
        <View className="px-5">
          {FEATURES.map((f) => (
            <View key={f.label} className="flex-row items-start mb-3">
              <View className="w-6 h-6 rounded-full bg-plum-600 items-center justify-center mr-3 mt-0.5">
                <Check color="#FAFAFF" size={14} />
              </View>
              <View className="flex-1">
                <Text variant="heading" className="text-base text-plum-900">
                  {f.label}
                </Text>
                <Text variant="caption" className="text-xs text-plum-600 mt-0.5">
                  {f.description}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Plan cards — annual on top so the "Save 44%" badge is the
            first thing scanned. */}
        <View className="px-5 mt-5">
          {unavailable ? (
            <View className="rounded-md border border-rose-700 bg-cream-50 p-4">
              <Text variant="heading" className="text-base text-plum-900 mb-1">
                Subscriptions are unavailable in this build.
              </Text>
              <Text variant="body" className="text-sm text-plum-600">
                Check back after the next update — we're still wiring up the
                store on this device.
              </Text>
            </View>
          ) : loadingOfferings ? (
            <View className="py-6 items-center">
              <Text variant="caption" className="text-plum-400">
                Loading plans…
              </Text>
            </View>
          ) : (
            <>
              <PlanCard
                title="Annual"
                pricePrimary={annualPkg?.product.priceString ?? '$99.99'}
                priceSecondary="/year"
                perMonthEquivalent={
                  annualPkg
                    ? `${perMonthFromAnnual(annualPkg.product.price)} per month`
                    : '$8.33 per month'
                }
                savingsLabel="Save 44%"
                selected={selected === 'annual'}
                onPress={() => setSelected('annual')}
                disabled={!annualPkg || purchasing}
              />
              <PlanCard
                title="Monthly"
                pricePrimary={monthlyPkg?.product.priceString ?? '$14.99'}
                priceSecondary="/month"
                savingsLabel={null}
                selected={selected === 'monthly'}
                onPress={() => setSelected('monthly')}
                disabled={!monthlyPkg || purchasing}
              />
            </>
          )}
        </View>

        {error && (
          <View className="mx-5 mt-2 mb-1">
            <Text variant="body" className="text-sm text-rose-700">
              {error}
            </Text>
          </View>
        )}

        {/* CTA + Restore */}
        <View className="px-5 mt-3">
          <Button
            label={selected === 'annual' ? 'Start Pro — Annual' : 'Start Pro — Monthly'}
            size="lg"
            onPress={handlePurchase}
            loading={purchasing}
            disabled={!canPurchase || purchasing}
          />
          <View className="mt-2">
            <Button
              label="Restore purchases"
              variant="ghost"
              onPress={handleRestore}
              loading={restoring}
              disabled={unavailable || restoring || purchasing}
            />
          </View>
        </View>

        {/* Legal — small text, links open externally */}
        <View className="px-6 mt-6">
          <Text
            variant="caption"
            className="text-[11px] text-plum-400 leading-4 text-center"
          >
            Subscriptions auto-renew until cancelled. Cancel anytime in the App
            Store or Play Store. By continuing you agree to our{' '}
            <Text
              variant="caption"
              className="text-[11px] text-plum-600 underline"
              onPress={() => Linking.openURL(TERMS_URL).catch(() => undefined)}
            >
              Terms
            </Text>
            {' and '}
            <Text
              variant="caption"
              className="text-[11px] text-plum-600 underline"
              onPress={() => Linking.openURL(PRIVACY_URL).catch(() => undefined)}
            >
              Privacy Policy
            </Text>
            .
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function normalizeTrigger(raw: string | string[] | undefined): Trigger {
  const value = Array.isArray(raw) ? raw[0] : raw;
  switch (value) {
    case 'likes_inbox':
    case 'verified_filter':
    case 'daily_cap':
    case 'manage_subscription':
    case 'browse':
      return value;
    default:
      return 'browse';
  }
}

function perMonthFromAnnual(annualPriceCents: number): string {
  // RC's `product.price` is the localized price as a number in the
  // store currency's major unit (e.g. 99.99 USD). Compute the per-month
  // equivalent for the secondary price line on the Annual card.
  // Currency formatting is intentionally simple — we don't try to
  // localize symbol/format here because RC's `priceString` is already
  // localized for the headline price; this is just supplementary copy.
  if (!Number.isFinite(annualPriceCents) || annualPriceCents <= 0) {
    return '$8.33';
  }
  const perMonth = annualPriceCents / 12;
  return `$${perMonth.toFixed(2)}`;
}
