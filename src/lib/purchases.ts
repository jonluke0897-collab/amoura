import { Linking, Platform } from 'react-native';
import { useEffect, useState } from 'react';
import Purchases, {
  type CustomerInfo,
  type PurchasesPackage,
  type PurchasesOffering,
  type MakePurchaseResult,
  type PurchasesError,
} from 'react-native-purchases';

/**
 * Thin wrappers around RevenueCat's SDK so the rest of the app doesn't
 * import `react-native-purchases` directly. Every call funnels through
 * here, which means:
 *
 *   - The "no-op when keys missing" pattern lives in one place
 *     (RevenueCatProvider configures or no-ops; these helpers throw a
 *     `PURCHASES_NOT_CONFIGURED` Error if the SDK was never set up).
 *   - Phase 7 swap-outs (e.g. paywall A/B test, custom paywall UI from
 *     the RC dashboard) only touch this file.
 *   - The Convex `subscriptions.me` query stays the source of truth for
 *     entitlement state on the UI; these client-side helpers are for
 *     purchase actions only, not for gating.
 */

export const ENTITLEMENT_ID = 'pro';

/**
 * The RevenueCat offering we expect the dashboard to expose. PRD § 11
 * pins this to `default` with `monthly` + `annual` packages backed by
 * `amoura_pro_monthly` / `amoura_pro_annual` store SKUs (rebranded
 * from "Premium" to "Pro" during Phase 6 implementation).
 */
export const OFFERING_ID = 'default';

/**
 * TEMP — App Store Connect "Review Information" screenshot helper.
 *
 * Apple's subscription product flow requires a paywall screenshot
 * before the product flips from "Missing Metadata" → "Ready to
 * Submit". The real RevenueCat keys aren't wired yet, so without
 * this flag the paywall renders the "Subscriptions are unavailable
 * in this build" empty state — useless for a review screenshot.
 *
 * Set to `true`, run the app, navigate to `/paywall`, screenshot,
 * then set BACK TO `false` and ship. Never commit with this `true`
 * — would mean a paywall renders fake $14.99 / $99.99 prices for
 * real users on a build that can't actually transact.
 */
const SCREENSHOT_MODE = false;

/**
 * Throws a structured error if `Purchases.configure(...)` was never
 * called — happens when the env keys are missing (graceful no-op
 * pattern). Callers in the paywall surface this as "purchases are
 * unavailable in this build" rather than crashing.
 */
class PurchasesNotConfiguredError extends Error {
  code = 'PURCHASES_NOT_CONFIGURED' as const;
  constructor() {
    super('RevenueCat is not configured. Add the SDK keys and rebuild.');
  }
}

let configured = false;
let configuredUserId: string | null = null;

export function markConfigured(userId: string | null) {
  configured = true;
  configuredUserId = userId;
}

export function markUnconfigured() {
  configured = false;
  configuredUserId = null;
}

export function getConfiguredUserId(): string | null {
  return configuredUserId;
}

export function isConfigured(): boolean {
  // SCREENSHOT_MODE: pretend we're configured so the paywall renders
  // its full UI for App Store Connect review screenshots.
  return SCREENSHOT_MODE || configured;
}

function ensureConfigured() {
  if (SCREENSHOT_MODE) return;
  if (!configured) throw new PurchasesNotConfiguredError();
}

/**
 * Mock packages for SCREENSHOT_MODE. Shape matches the fields
 * `PaywallScreen.tsx` actually reads — RC's PurchasesPackage is much
 * wider but we only need `product.identifier`, `product.priceString`,
 * and `product.price`. The `as unknown as PurchasesPackage` cast lets
 * us skip the rest without disabling type-checking everywhere else
 * in this file.
 */
const MOCK_MONTHLY_PACKAGE = {
  identifier: '$rc_monthly',
  packageType: 'MONTHLY',
  offeringIdentifier: OFFERING_ID,
  product: {
    identifier: 'amoura_pro_monthly',
    priceString: '$14.99',
    price: 14.99,
    currencyCode: 'USD',
    title: 'Amia Pro Monthly',
    description: 'See who likes you, unlimited likes, verified filter.',
  },
} as unknown as PurchasesPackage;

const MOCK_ANNUAL_PACKAGE = {
  identifier: '$rc_annual',
  packageType: 'ANNUAL',
  offeringIdentifier: OFFERING_ID,
  product: {
    identifier: 'amoura_pro_annual',
    priceString: '$99.99',
    price: 99.99,
    currencyCode: 'USD',
    title: 'Amia Pro Annual',
    description: 'See who likes you, unlimited likes, verified filter.',
  },
} as unknown as PurchasesPackage;

export type PurchaseFlowResult =
  | { kind: 'success'; customerInfo: CustomerInfo; productId: string }
  | { kind: 'cancelled' }
  | { kind: 'error'; message: string };

/**
 * Fetch the `default` offering and return its monthly + annual packages.
 * Either may be null if the dashboard hasn't published them yet — the
 * paywall renders a loading/empty state in that case.
 */
export async function getDefaultOfferings(): Promise<{
  offering: PurchasesOffering | null;
  monthly: PurchasesPackage | null;
  annual: PurchasesPackage | null;
}> {
  ensureConfigured();
  if (SCREENSHOT_MODE) {
    return {
      offering: null,
      monthly: MOCK_MONTHLY_PACKAGE,
      annual: MOCK_ANNUAL_PACKAGE,
    };
  }
  const offerings = await Purchases.getOfferings();
  // Prefer the explicit OFFERING_ID, fall back to current() for resilience
  // if the dashboard renames the default. Both expose the same package
  // identifiers (`$rc_monthly`, `$rc_annual`).
  const offering = offerings.all[OFFERING_ID] ?? offerings.current ?? null;
  const monthly = offering?.monthly ?? null;
  const annual = offering?.annual ?? null;
  return { offering, monthly, annual };
}

/**
 * Run a purchase. Catches the userCancelled case explicitly so the
 * paywall can fire `paywall_dismissed` instead of `purchase_failed`.
 * Any other error is surfaced with a warm message — never a raw stack
 * trace — and the caller decides whether to retry or close.
 */
export async function purchasePackage(
  pkg: PurchasesPackage,
): Promise<PurchaseFlowResult> {
  ensureConfigured();
  try {
    const result: MakePurchaseResult = await Purchases.purchasePackage(pkg);
    return {
      kind: 'success',
      customerInfo: result.customerInfo,
      productId: result.productIdentifier,
    };
  } catch (e) {
    const err = e as PurchasesError;
    if (err.userCancelled) {
      return { kind: 'cancelled' };
    }
    if (__DEV__) {
      console.warn('[Amia] purchasePackage error', err);
    }
    return {
      kind: 'error',
      message:
        err.underlyingErrorMessage ??
        err.message ??
        "Something didn't go through. Your card is fine — try again?",
    };
  }
}

/**
 * Restore Purchases. Returns the resolved CustomerInfo on success — the
 * caller can inspect `entitlements.active['pro']` to decide whether
 * to flip UI immediately or just show a "we couldn't find a purchase"
 * toast.
 */
export async function restorePurchases(): Promise<
  | { kind: 'success'; customerInfo: CustomerInfo; hasPro: boolean }
  | { kind: 'error'; message: string }
> {
  ensureConfigured();
  try {
    const info = await Purchases.restorePurchases();
    return {
      kind: 'success',
      customerInfo: info,
      hasPro: info.entitlements.active[ENTITLEMENT_ID] !== undefined,
    };
  } catch (e) {
    const err = e as PurchasesError;
    if (__DEV__) console.warn('[Amia] restorePurchases error', err);
    return {
      kind: 'error',
      message:
        err.underlyingErrorMessage ??
        err.message ??
        "We couldn't restore your purchases. Try again in a minute?",
    };
  }
}

/**
 * Read the current customer info. Server-side `subscriptions.me` is the
 * source of truth for gating, but during the brief window between a
 * sandbox purchase and the webhook arriving the client can use this as
 * a fallback (PRD § 12 — "Purchase succeeds but webhook fails").
 *
 * Inspect `info.entitlements.active['pro']` to decide whether the
 * customer is currently entitled.
 */
export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (!configured) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch (e) {
    if (__DEV__) console.warn('[Amia] getCustomerInfo error', e);
    return null;
  }
}

/**
 * Hook that mirrors RC's customer-info update stream. Useful for the
 * Manage Subscription screen so an in-store cancellation flips the UI
 * the next time the app foregrounds even before the Convex webhook
 * lands. Server stays source of truth — this is purely a snappiness
 * affordance.
 */
export function useEntitlement(entitlementId: string = ENTITLEMENT_ID): {
  hasEntitlement: boolean | null;
  loading: boolean;
} {
  const [info, setInfo] = useState<CustomerInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    (async () => {
      const fresh = await getCustomerInfo();
      if (!cancelled) {
        setInfo(fresh);
        setLoading(false);
      }
    })();

    const listener = (next: CustomerInfo) => {
      if (!cancelled) setInfo(next);
    };
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => {
      cancelled = true;
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, []);

  if (!configured) return { hasEntitlement: false, loading: false };
  if (loading || !info) return { hasEntitlement: null, loading };
  return {
    hasEntitlement: info.entitlements.active[entitlementId] !== undefined,
    loading: false,
  };
}

/**
 * Open the platform-native subscription management page. Apple and
 * Google both require cancellations to happen in their respective
 * stores — we cannot revoke an entitlement from inside the app.
 * Linked URLs from PRD § 11 "Subscription Management".
 */
export async function openManageSubscription(): Promise<void> {
  const url =
    Platform.OS === 'ios'
      ? 'itms-apps://apps.apple.com/account/subscriptions'
      : 'https://play.google.com/store/account/subscriptions';
  try {
    await Linking.openURL(url);
  } catch (e) {
    if (__DEV__) console.warn('[Amia] openManageSubscription failed', e);
  }
}
