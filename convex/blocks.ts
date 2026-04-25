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
import { mutation, query } from './_generated/server';
import { requireUserAndProfile } from './lib/currentUser';

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
    const existing = await ctx.db
      .query('blocks')
      .withIndex('by_pair', (q) =>
        q.eq('blockerId', user._id).eq('blockedUserId', args.targetUserId),
      )
      .first();
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

    return { blockId, alreadyBlocked: false };
  },
});

export const unblock = mutation({
  args: { targetUserId: v.id('users') },
  handler: async (ctx, args) => {
    const { user } = await requireUserAndProfile(ctx);
    const existing = await ctx.db
      .query('blocks')
      .withIndex('by_pair', (q) =>
        q.eq('blockerId', user._id).eq('blockedUserId', args.targetUserId),
      )
      .first();
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
  blockId: string;
  userId: string;
  displayName: string;
  firstPhotoUrl: string | null;
  blockedAt: number;
};

/**
 * List the blocks the caller initiated (not blocks they're a target of).
 * Powers the Settings → Blocked Users screen so the user can unblock.
 * Returns up to 200 rows — anyone with more blocks than that has bigger
 * problems than scrolling.
 */
export const list = query({
  handler: async (ctx): Promise<BlockedUserRow[]> => {
    const { user } = await requireUserAndProfile(ctx);
    const rows = await ctx.db
      .query('blocks')
      .withIndex('by_blocker', (q) => q.eq('blockerId', user._id))
      .order('desc')
      .take(200);

    const out: BlockedUserRow[] = [];
    for (const block of rows) {
      const blockedUser = await ctx.db.get(block.blockedUserId);
      if (!blockedUser) continue;
      // Pull the first profile photo for visual recognition in the list.
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
      out.push({
        blockId: block._id,
        userId: blockedUser._id,
        displayName: blockedUser.displayName,
        firstPhotoUrl,
        blockedAt: block.createdAt,
      });
    }
    return out;
  },
});
