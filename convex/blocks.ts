/**
 * Blocks — TASK-064.
 *
 * Bidirectional invisibility: a blocks row from A → B prevents A from seeing
 * B and B from seeing A across feeds, likes, and messages. The query-side
 * filtering already lives in convex/lib/blocks.ts (`isBlockedBetween`,
 * `getBlockedUserIds`); this module is the write-side: insert the row, tear
 * down any active match between the pair, and let the existing helpers do
 * the rest.
 *
 * No notification is sent to the blocked party — that would defeat the
 * point. From their perspective the other person simply disappears.
 */
import { v } from 'convex/values';
import { paginationOptsValidator } from 'convex/server';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { mutation, query } from './_generated/server';
import { requireUserAndProfile } from './lib/currentUser';

/**
 * Locate an existing blocks row for a specific (blocker, blocked) pair via
 * the `by_pair` index. Returns null when no such row exists. Used by
 * `block` (idempotency check) and `unblock` (precondition lookup) so the
 * lookup logic is one place to drift from.
 */
async function findBlockByPair(
  ctx: QueryCtx | MutationCtx,
  blockerId: Id<'users'>,
  blockedUserId: Id<'users'>,
): Promise<Doc<'blocks'> | null> {
  return await ctx.db
    .query('blocks')
    .withIndex('by_pair', (q) =>
      q.eq('blockerId', blockerId).eq('blockedUserId', blockedUserId),
    )
    .first();
}

export const block = mutation({
  args: {
    targetUserId: v.id('users'),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireUserAndProfile(ctx);

    if (args.targetUserId === user._id) {
      throw new Error("You can't block yourself.");
    }

    const target = await ctx.db.get(args.targetUserId);
    if (!target) {
      throw new Error('User not found.');
    }

    // Idempotent: if a block already exists, return its id rather than
    // duplicating. The unique pair index isn't enforced at the schema layer
    // (Convex doesn't expose unique constraints), so we check first.
    const existing = await findBlockByPair(ctx, user._id, args.targetUserId);
    if (existing) {
      return { blockId: existing._id, alreadyBlocked: true };
    }

    const now = Date.now();
    const blockId = await ctx.db.insert('blocks', {
      blockerId: user._id,
      blockedUserId: args.targetUserId,
      reason: args.reason,
      createdAt: now,
    });

    // Flip any active match between the pair to 'unmatched'. We look up
    // both orderings since the matches table stores (userAId, userBId)
    // sorted by clerkId — the caller doesn't know which slot they occupy.
    const [matchAB, matchBA] = await Promise.all([
      ctx.db
        .query('matches')
        .withIndex('by_users', (q) =>
          q.eq('userAId', user._id).eq('userBId', args.targetUserId),
        )
        .first(),
      ctx.db
        .query('matches')
        .withIndex('by_users', (q) =>
          q.eq('userAId', args.targetUserId).eq('userBId', user._id),
        )
        .first(),
    ]);
    const match = matchAB ?? matchBA;
    if (match && match.status === 'active') {
      await ctx.db.patch(match._id, { status: 'unmatched' });
    }

    // Retire any pending likes between the pair (both directions). Without
    // this, a pending like in the recipient's inbox would survive the block
    // — hidden by the inbox's isBlockedBetween filter while blocked, but
    // resurrected as actionable on unblock. That bypasses the "neither
    // user can re-match without a new like" rule and would let an
    // unblock implicitly produce a match. Status='expired' (system-driven,
    // matching the convention in likes.send / likes.respond when an old
    // pending like is superseded) is the cleaner audit verb than 'passed'
    // (user-driven decline).
    //
    // Outbound uses by_from_to_status to bound the lookup to exactly the
    // (sender, recipient, status) slice. Inbound uses by_to_user_status
    // and filters fromUserId — by_from_to_status would also work for
    // inbound but its leading column (fromUserId) doesn't fit the access
    // pattern as cleanly when the caller is the recipient. Either way,
    // both queries are now index-bounded rather than scanning anyone's
    // full like history.
    const [outboundPending, inboundPending] = await Promise.all([
      ctx.db
        .query('likes')
        .withIndex('by_from_to_status', (q) =>
          q
            .eq('fromUserId', user._id)
            .eq('toUserId', args.targetUserId)
            .eq('status', 'pending'),
        )
        .collect(),
      ctx.db
        .query('likes')
        .withIndex('by_to_user_status', (q) =>
          q.eq('toUserId', user._id).eq('status', 'pending'),
        )
        .filter((q) =>
          q.eq(q.field('fromUserId'), args.targetUserId),
        )
        .collect(),
    ]);
    await Promise.all(
      [...outboundPending, ...inboundPending].map((like) =>
        ctx.db.patch(like._id, { status: 'expired' }),
      ),
    );

    return { blockId, alreadyBlocked: false };
  },
});

export const unblock = mutation({
  args: { targetUserId: v.id('users') },
  handler: async (ctx, args) => {
    const { user } = await requireUserAndProfile(ctx);
    const existing = await findBlockByPair(ctx, user._id, args.targetUserId);
    if (!existing) return { unblocked: false };
    await ctx.db.delete(existing._id);
    // Note: we deliberately do NOT auto-restore the unmatched match. The
    // unmatch was a deliberate severance; if the pair want to chat again
    // they need a new like → match cycle. This matches TASK-057's
    // "neither user can re-match without a new like" rule.
    return { unblocked: true };
  },
});

type BlockedUserRow = {
  blockId: Id<'blocks'>;
  userId: Id<'users'>;
  // displayName / firstPhotoUrl can both be null for orphaned blocks where
  // the blocked user's row was purged after the soft-delete window (per
  // FR-029). Surfacing the row anyway lets the user unblock — without it,
  // a purged target's blocks row would be invisible-yet-extant and the
  // user couldn't act on it. UI renders a generic "Account no longer
  // available" label when displayName is null.
  displayName: string | null;
  firstPhotoUrl: string | null;
  blockedAt: number;
};

/**
 * List the blocks the caller initiated (not blocks they're a target of).
 * Powers the Settings → Blocked Users screen so the user can unblock.
 *
 * Paginated via Convex's `paginationOptsValidator`. The previous .take(200)
 * cap silently truncated older blocks once a user accumulated more than
 * 200, which would have hidden some unblock controls forever. Pagination
 * lets the screen load on demand and keeps every block accessible.
 *
 * Per-row enrichment (user → profile → first photo → photo URL) runs in
 * parallel across the page via Promise.all. Within a single row the user→
 * profile→photo chain stays sequential because each step depends on the
 * previous, but cross-row parallelism is what matters at page-size scale.
 */
export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { user } = await requireUserAndProfile(ctx);
    const paged = await ctx.db
      .query('blocks')
      .withIndex('by_blocker', (q) => q.eq('blockerId', user._id))
      .order('desc')
      .paginate(args.paginationOpts);

    const enriched: BlockedUserRow[] = await Promise.all(
      paged.page.map(async (block): Promise<BlockedUserRow> => {
        const blockedUser = await ctx.db.get(block.blockedUserId);
        if (!blockedUser) {
          // User row was purged (FR-029 30-day soft-delete cleanup). Return
          // an orphan-block placeholder so the unblock UI can still act on
          // it; otherwise the block row is invisible-yet-extant.
          return {
            blockId: block._id,
            userId: block.blockedUserId,
            displayName: null,
            firstPhotoUrl: null,
            blockedAt: block.createdAt,
          };
        }
        const profile = await ctx.db
          .query('profiles')
          .withIndex('by_user', (q) => q.eq('userId', blockedUser._id))
          .unique();
        let firstPhotoUrl: string | null = null;
        if (profile) {
          const photo = await ctx.db
            .query('photos')
            .withIndex('by_profile_position', (q) =>
              q.eq('profileId', profile._id),
            )
            .order('asc')
            .first();
          if (photo) {
            firstPhotoUrl = await ctx.storage.getUrl(photo.storageId);
          }
        }
        return {
          blockId: block._id,
          userId: blockedUser._id,
          displayName: blockedUser.displayName,
          firstPhotoUrl,
          blockedAt: block.createdAt,
        };
      }),
    );
    return {
      page: enriched,
      isDone: paged.isDone,
      continueCursor: paged.continueCursor,
    };
  },
});
