/**
 * Subscription state — the server-side ledger of paid entitlements.
 *
 * RevenueCat is the *purchase pipeline* (it owns receipt validation,
 * grace periods, billing retries). Convex's `subscriptions` table is
 * our *entitlement ledger* (PRD § 11) — the single source of truth the
 * client and other Convex functions read for gating. The flow is:
 *
 *     Apple/Play → RevenueCat → POST /revenuecat-webhook → handleWebhook
 *       → upsert subscriptions row → reactive subscriptions.me query
 *       → client UI flips
 *
 * The webhook handler in convex/http.ts authenticates via a shared
 * `Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>` header (RC's own
 * webhook auth model — they don't sign payloads, just gate the URL
 * behind a secret).
 *
 * Idempotency: handleWebhook is upsert-by-userId. RC may re-deliver
 * the same event on transient delivery failures; running it twice with
 * the same payload is a no-op except for `updatedAt`.
 *
 * Cancellations: per PRD § 12, we DO NOT revoke entitlement on
 * CANCELLATION. The subscriber paid through the period; flip
 * `willRenew: false` and leave `isActive: true` until either an
 * EXPIRATION event arrives or `currentPeriodEnd` passes (the
 * `hasActiveSubscription` helper enforces the latter as a clock-side
 * fallback in case the EXPIRATION webhook is delayed).
 */
import { v } from 'convex/values';
import { internalMutation, mutation, query } from './_generated/server';
import type { MutationCtx, QueryCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { hasActiveSubscription } from './lib/rateLimit';

/**
 * Read the caller's current entitlement state. Returns null when the
 * user has never subscribed; otherwise returns the latest snapshot
 * from the ledger. The client paywall + Manage Subscription screen
 * both subscribe to this query and react when `isActive` flips.
 *
 * Important: `isActive` reflects the persisted webhook state, but the
 * derived `isCurrentlyActive` field also consults the wall clock so a
 * row that's `isActive: true` past `currentPeriodEnd` (delayed
 * EXPIRATION webhook) presents as inactive. This is the same logic
 * `hasActiveSubscription` applies for server-side gating, exposed to
 * the client so UI gating matches.
 */
export const me = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();
    if (!user) return null;

    const sub = await ctx.db
      .query('subscriptions')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .unique();
    if (!sub) return null;

    const now = Date.now();
    const isCurrentlyActive = sub.isActive && sub.currentPeriodEnd >= now;
    return {
      isActive: isCurrentlyActive,
      productId: sub.productId,
      entitlementId: sub.entitlementId,
      willRenew: sub.willRenew,
      currentPeriodStart: sub.currentPeriodStart,
      currentPeriodEnd: sub.currentPeriodEnd,
      platform: sub.platform,
      updatedAt: sub.updatedAt,
    };
  },
});

/**
 * Throw if the caller is not currently entitled to "pro". Mirrors the
 * `requireModerator` pattern in moderationOps.ts. Used by paid-only
 * mutations / queries (e.g. inbound-likes detail view, verified-only
 * filter on the feed). The client catches the structured error code
 * and routes to the paywall.
 */
export async function requirePro(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
  trigger: string,
): Promise<void> {
  const ok = await hasActiveSubscription(ctx, userId);
  if (!ok) {
    // Client switches on this prefix to route to /paywall with the
    // matching `trigger` query param. Keep the format stable —
    // changing it requires updating the client switch sites.
    throw new Error(`PAYWALL:${trigger}`);
  }
}

// RevenueCat webhook event shapes. Only the fields we read are typed;
// RC includes many more (subscriber attributes, transaction IDs, etc.)
// that we discard. See https://www.revenuecat.com/docs/webhooks.
//
// Event types we handle:
//   INITIAL_PURCHASE — first paid purchase by a user
//   RENEWAL         — auto-renewed without lapse
//   UNCANCELLATION  — user reversed a pending cancellation
//   CANCELLATION    — user cancelled; will lapse at period end
//   EXPIRATION      — period ended; entitlement gone
//   BILLING_ISSUE   — payment failed; entitlement gone (or grace)
//   PRODUCT_CHANGE  — switched plan (e.g. monthly → annual)
//
// Events we explicitly ignore: TEST, NON_RENEWING_PURCHASE,
// SUBSCRIPTION_PAUSED, SUBSCRIPTION_EXTENDED, TRANSFER, REFUND.
// All return 200 with no DB write so RC doesn't retry — but we don't
// upsert a stale row from a payload type we haven't designed for.

type RevenueCatStore = 'APP_STORE' | 'MAC_APP_STORE' | 'PLAY_STORE' | 'AMAZON' | 'STRIPE' | 'PROMOTIONAL';

type RevenueCatEvent = {
  type: string;
  id: string;
  app_user_id: string;
  original_app_user_id?: string;
  aliases?: string[];
  product_id: string;
  entitlement_ids?: string[] | null;
  purchased_at_ms?: number;
  expiration_at_ms?: number | null;
  store: RevenueCatStore;
  environment?: 'PRODUCTION' | 'SANDBOX';
  cancel_reason?: string;
  is_trial_conversion?: boolean;
};

const HANDLED_EVENT_TYPES = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'CANCELLATION',
  'EXPIRATION',
  'BILLING_ISSUE',
  'PRODUCT_CHANGE',
]);

/**
 * Internal mutation invoked by the /revenuecat-webhook HTTP action
 * after authentication. Public mutations are never used here — webhook
 * handlers are the only path that should write to `subscriptions`.
 *
 * `event.app_user_id` is the Clerk subject that the client called
 * `Purchases.logIn(clerkUserId)` with. We resolve through users.by_clerk_id
 * to find our internal Id<'users'>. If the user doesn't exist (race
 * between RC purchase and Clerk webhook syncing the user, or test
 * payload from a foreign environment), no-op gracefully — RC retries
 * on 5xx, so we 200 by way of returning `{ ok: false, reason }`.
 */
export const handleWebhook = internalMutation({
  args: {
    event: v.any(), // RC payload is wide; validate the bits we need below.
  },
  handler: async (ctx, { event: raw }) => {
    const event = raw as RevenueCatEvent;
    const eventType = event?.type;
    if (!eventType || typeof eventType !== 'string') {
      return { ok: false, reason: 'missing event.type' };
    }
    if (!HANDLED_EVENT_TYPES.has(eventType)) {
      // Acknowledge but skip — we don't want to retry for events we
      // don't care about, but we also don't want to silently upsert
      // stale data from an unfamiliar payload.
      return { ok: true, skipped: eventType };
    }
    if (!event.app_user_id) {
      return { ok: false, reason: 'missing event.app_user_id' };
    }

    // Resolve the Clerk subject → users row. RC's `aliases` array can
    // contain prior anonymous IDs from before logIn was called; the
    // canonical mapping lives on `app_user_id`.
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', event.app_user_id))
      .unique();
    if (!user) {
      // User row hasn't synced from the Clerk webhook yet, or the
      // payload is a test from a different RC environment. Don't
      // create a row out of thin air — fail soft so RC sees 200 (no
      // retry) but we leave a breadcrumb in the action result.
      return { ok: false, reason: 'user not found', clerkId: event.app_user_id };
    }

    const platform = mapStoreToPlatform(event.store);
    if (!platform) {
      return { ok: false, reason: `unsupported store: ${event.store}` };
    }

    const now = Date.now();
    const periodStart = event.purchased_at_ms ?? now;
    const periodEnd = event.expiration_at_ms ?? null;

    // Decide isActive + willRenew based on event type. The matrix:
    //
    //   INITIAL_PURCHASE / RENEWAL / UNCANCELLATION / PRODUCT_CHANGE
    //     → active + will renew
    //   CANCELLATION
    //     → active until period end + will NOT renew
    //   EXPIRATION / BILLING_ISSUE
    //     → not active + not renewing
    //
    // BILLING_ISSUE is treated as terminal here. RC's grace-period
    // recovery fires a follow-up RENEWAL event when payment succeeds,
    // which re-flips us to active. If we treated BILLING_ISSUE as
    // "still active in grace," a true expiration would never lower
    // `isActive` because the grace state is the new normal.
    let isActive: boolean;
    let willRenew: boolean;
    switch (eventType) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'UNCANCELLATION':
      case 'PRODUCT_CHANGE':
        isActive = true;
        willRenew = true;
        break;
      case 'CANCELLATION':
        isActive = true;
        willRenew = false;
        break;
      case 'EXPIRATION':
      case 'BILLING_ISSUE':
        isActive = false;
        willRenew = false;
        break;
      default:
        // Should be unreachable thanks to HANDLED_EVENT_TYPES guard,
        // but keep the explicit branch so a future addition to the set
        // forces a compile-error on the missing case.
        return { ok: false, reason: `unhandled event type: ${eventType}` };
    }

    const entitlementId =
      event.entitlement_ids?.[0] ?? defaultEntitlementId(eventType);

    const existing = await ctx.db
      .query('subscriptions')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .unique();

    if (!existing) {
      await ctx.db.insert('subscriptions', {
        userId: user._id,
        revenueCatUserId: event.app_user_id,
        entitlementId,
        productId: event.product_id,
        isActive,
        willRenew,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd ?? periodStart,
        platform,
        updatedAt: now,
        createdAt: now,
      });
      return { ok: true, action: 'inserted', userId: user._id, eventType };
    }

    // Drop out-of-order events. RC delivers in roughly purchase-time
    // order but redelivery-on-failure can interleave. If we already
    // wrote a newer period, ignore an older one — otherwise a delayed
    // RENEWAL for last cycle could overwrite a CANCELLATION for the
    // current cycle.
    if (periodEnd !== null && periodEnd < existing.currentPeriodEnd) {
      return { ok: true, action: 'skipped-older', userId: user._id };
    }

    await ctx.db.patch(existing._id, {
      revenueCatUserId: event.app_user_id,
      entitlementId,
      productId: event.product_id,
      isActive,
      willRenew,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd ?? existing.currentPeriodEnd,
      platform,
      updatedAt: now,
    });
    return { ok: true, action: 'updated', userId: user._id, eventType };
  },
});

function mapStoreToPlatform(
  store: RevenueCatStore | undefined,
): 'ios' | 'android' | null {
  switch (store) {
    case 'APP_STORE':
    case 'MAC_APP_STORE':
      return 'ios';
    case 'PLAY_STORE':
    case 'AMAZON':
      // Treat Amazon as android for the schema's two-value union.
      // Amazon-specific store handling can split this later if we
      // ship to Fire devices.
      return 'android';
    default:
      return null;
  }
}

function defaultEntitlementId(_eventType: string): string {
  // Fallback for events that don't include entitlement_ids (e.g.
  // BILLING_ISSUE in older RC schemas). PRD § 11 pinned the single
  // entitlement; rebranded "premium" → "pro" in Phase 6.
  return 'pro';
}

// Re-export for callers that want to pull the helper from the
// subscription module directly rather than the rate-limit one. Same
// function — just keeps `import { hasActiveSubscription } from './subscriptions'`
// readable in feature-gating sites that aren't about rate limits.
export { hasActiveSubscription } from './lib/rateLimit';

// Use to type-narrow a `Doc<'subscriptions'>` against a known active
// state. The `isActive` Boolean is correct only when read alongside
// `currentPeriodEnd` — exposing this consolidator means callers can't
// accidentally trust `isActive` in isolation.
export function isSubscriptionLive(
  sub: Doc<'subscriptions'> | null,
  now: number = Date.now(),
): boolean {
  if (!sub) return false;
  if (!sub.isActive) return false;
  if (sub.currentPeriodEnd < now) return false;
  return true;
}
