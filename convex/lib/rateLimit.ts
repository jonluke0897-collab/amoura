import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';

/**
 * Daily-rolling rate-limit buckets, keyed by (userId, bucket). The window is
 * a rolling one — the first hit starts a new period, and the bucket resets
 * when the clock rolls past periodStart + periodMs. This matches the
 * `rateLimitBuckets` schema shape from Phase 0 (see convex/schema.ts).
 *
 * We deliberately do NOT align to local midnight. The roadmap's TASK-048
 * mentions a per-user local offset, but there is no tz field on users or
 * profiles today, and adding one for rate-limit precision is scope creep.
 * A rolling 24h window is close enough; flagged in the Phase 4 PR.
 *
 * Throws a plain Error with a RATE_LIMITED:... code embedded in the message
 * so the client can switch on it (see likes.send / messages.send callers).
 * We don't use ConvexError because nothing else in this codebase does —
 * staying consistent with existing handlers keeps client-side error handling
 * uniform.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

export type RateLimitBucket =
  | 'likes-daily'
  | 'messages-daily'
  | 'reports-daily';

export async function checkAndIncrement(
  ctx: MutationCtx,
  userId: Id<'users'>,
  bucket: RateLimitBucket,
  maxCount: number,
  periodMs: number = DAY_MS,
): Promise<void> {
  const now = Date.now();
  const existing = await ctx.db
    .query('rateLimitBuckets')
    .withIndex('by_user_bucket', (q) =>
      q.eq('userId', userId).eq('bucket', bucket),
    )
    .unique();

  if (!existing) {
    await ctx.db.insert('rateLimitBuckets', {
      userId,
      bucket,
      count: 1,
      periodStart: now,
    });
    return;
  }

  const windowExpired = existing.periodStart + periodMs <= now;
  if (windowExpired) {
    await ctx.db.patch(existing._id, { count: 1, periodStart: now });
    return;
  }

  if (existing.count >= maxCount) {
    throw new Error(
      `RATE_LIMITED:${bucket}:${maxCount} — limit resets at ${existing.periodStart + periodMs}`,
    );
  }

  await ctx.db.patch(existing._id, { count: existing.count + 1 });
}

/**
 * Read the caller's active subscription entitlement. Phase 6 (RevenueCat)
 * is when subscriptions rows actually populate; until then this always
 * returns false in dev and the free-tier gates apply uniformly. Pulling the
 * lookup into one place means every rate-limit call site picks up real
 * subscription data the moment Phase 6 lands — no shotgun edit.
 */
export async function hasActiveSubscription(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
): Promise<boolean> {
  const sub: Doc<'subscriptions'> | null = await ctx.db
    .query('subscriptions')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .unique();
  if (!sub) return false;
  if (!sub.isActive) return false;
  if (sub.currentPeriodEnd < Date.now()) return false;
  return true;
}
