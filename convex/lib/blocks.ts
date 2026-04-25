import type { Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';

/**
 * True if `a` has blocked `b` OR `b` has blocked `a`. The block relation
 * is bidirectionally enforced — a blocked user must be invisible in both
 * directions regardless of who initiated. Both directions are checked in
 * parallel so the helper adds roughly one DB round-trip's latency rather
 * than two.
 */
export async function isBlockedBetween(
  ctx: QueryCtx | MutationCtx,
  a: Id<'users'>,
  b: Id<'users'>,
): Promise<boolean> {
  const [aBlockedB, bBlockedA] = await Promise.all([
    ctx.db
      .query('blocks')
      .withIndex('by_pair', (q) =>
        q.eq('blockerId', a).eq('blockedUserId', b),
      )
      .first(),
    ctx.db
      .query('blocks')
      .withIndex('by_pair', (q) =>
        q.eq('blockerId', b).eq('blockedUserId', a),
      )
      .first(),
  ]);
  return !!aBlockedB || !!bBlockedA;
}

/**
 * Union of user IDs the caller has blocked AND user IDs that have blocked
 * the caller. Used by list endpoints (feed, likes inbox) to filter out
 * rows involving any blocked counterparty in one set-lookup per row.
 */
export async function getBlockedUserIds(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
): Promise<Set<string>> {
  const [blockedByMe, blockingMe] = await Promise.all([
    ctx.db
      .query('blocks')
      .withIndex('by_blocker', (q) => q.eq('blockerId', userId))
      .collect(),
    ctx.db
      .query('blocks')
      .withIndex('by_blocked', (q) => q.eq('blockedUserId', userId))
      .collect(),
  ]);
  const out = new Set<string>();
  for (const b of blockedByMe) out.add(b.blockedUserId);
  for (const b of blockingMe) out.add(b.blockerId);
  return out;
}
