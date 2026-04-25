import { v } from 'convex/values';
import { paginationOptsValidator } from 'convex/server';
import { mutation, query } from './_generated/server';
import type { QueryCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { requireUserAndProfile } from './lib/currentUser';
import { createMatch } from './matches';
import {
  checkAndIncrement,
  hasActiveSubscription,
  DAY_MS,
} from './lib/rateLimit';
import { checkLikeComment } from './moderation';
import { computeAge } from './lib/age';
import { isBlockedBetween } from './lib/blocks';
import { LIKE_COMMENT_MAX_CHARS, LIKE_COMMENT_MIN_CHARS } from './lib/likeBounds';

// Per PRD § 2.5 Security. Free tier gets 100/day, paid 1000/day. The roadmap
// (TASK-048) mentions 8/day but that appears to be a paywall-messaging number
// — 100 is the technical cap. Flagged in the Phase 4 PR for explicit sign-off.
const FREE_LIKES_PER_DAY = 100;
const PAID_LIKES_PER_DAY = 1000;


const LIKE_TTL_MS = 7 * DAY_MS; // Matches schema's expiresAt semantics.

/**
 * Send a like-with-comment. The only way to initiate contact in the product
 * (FR-014 — "architectural anti-fetish gate"). Validates the target, the
 * comment length, blocks, rate limit, and self-like. If the recipient
 * already has a pending like back to us, this mutation atomically creates
 * the match and flips both like rows to 'matched' — caller gets matchId in
 * the return and can route straight into chat.
 *
 * Convex mutations are transactional, so the entire validate → rate-limit →
 * insert → optional-match sequence either commits as a unit or rolls back.
 * That's why the rate-limit increment happens after the cheap validation
 * rejects but before the insert: if we fail after the increment for any
 * reason, the rollback unwinds the bucket count too.
 */
export const send = mutation({
  args: {
    toUserId: v.id('users'),
    targetType: v.union(v.literal('prompt'), v.literal('photo')),
    targetId: v.union(v.id('profilePrompts'), v.id('photos')),
    comment: v.string(),
  },
  handler: async (ctx, args) => {
    const { user: sender } = await requireUserAndProfile(ctx);

    if (args.toUserId === sender._id) {
      throw new Error('You cannot like your own profile');
    }

    const trimmedComment = args.comment.trim();
    if (trimmedComment.length < LIKE_COMMENT_MIN_CHARS) {
      throw new Error(
        `Comment must be at least ${LIKE_COMMENT_MIN_CHARS} characters`,
      );
    }
    if (trimmedComment.length > LIKE_COMMENT_MAX_CHARS) {
      throw new Error(
        `Comment must be ${LIKE_COMMENT_MAX_CHARS} characters or fewer`,
      );
    }

    // Moderation: Phase 5 stub returns flagged=false for all bodies today.
    // When the real check lands, this branch rejects before the insert so
    // no flagged comment ever persists.
    const moderation = checkLikeComment(trimmedComment);
    if (moderation.flagged) {
      throw new Error(moderation.reason ?? 'Comment did not pass moderation');
    }

    const recipient = await ctx.db.get(args.toUserId);
    if (!recipient || recipient.accountStatus !== 'active') {
      throw new Error('Profile unavailable');
    }

    // Blocks in either direction. A blocked user must not even be able to
    // send a like that would otherwise sit in limbo if the recipient later
    // unblocks.
    if (await isBlockedBetween(ctx, sender._id, args.toUserId)) {
      throw new Error('Profile unavailable');
    }

    // Target ownership: the prompt answer or photo has to belong to the
    // recipient. Prevents a client from liking photo X on profile B while
    // claiming X belongs to profile A — schema IDs are opaque and clients
    // can construct them from anywhere, so the owner check happens here.
    if (args.targetType === 'prompt') {
      const prompt = await ctx.db.get(args.targetId as Id<'profilePrompts'>);
      if (!prompt || prompt.userId !== args.toUserId) {
        throw new Error('Target prompt does not belong to this profile');
      }
    } else {
      const photo = await ctx.db.get(args.targetId as Id<'photos'>);
      if (!photo || photo.userId !== args.toUserId) {
        throw new Error('Target photo does not belong to this profile');
      }
    }

    // Dedupe: one pending like per (sender → recipient). If the sender has
    // already liked this profile and is still waiting for a response,
    // update the existing like rather than insert a second row. This keeps
    // the recipient's inbox from spamming if the sender taps send twice.
    const existingFromSender = await ctx.db
      .query('likes')
      .withIndex('by_from_user', (q) => q.eq('fromUserId', sender._id))
      .filter((q) =>
        q.and(
          q.eq(q.field('toUserId'), args.toUserId),
          q.eq(q.field('status'), 'pending'),
        ),
      )
      .first();
    if (existingFromSender) {
      throw new Error('You already have a pending like on this profile');
    }

    // Rate limit. Subscription lookup is cheap (single by_user index); keep
    // it inline rather than a preflight so the rollback guarantees still
    // apply if we throw later.
    const isPaid = await hasActiveSubscription(ctx, sender._id);
    const maxPerDay = isPaid ? PAID_LIKES_PER_DAY : FREE_LIKES_PER_DAY;
    await checkAndIncrement(ctx, sender._id, 'likes-daily', maxPerDay);

    // Reciprocal check: did the recipient already like the sender? If so
    // we match atomically instead of leaving the sender's like pending.
    const reciprocal = await ctx.db
      .query('likes')
      .withIndex('by_to_user_status', (q) =>
        q.eq('toUserId', sender._id).eq('status', 'pending'),
      )
      .filter((q) => q.eq(q.field('fromUserId'), args.toUserId))
      .first();

    const now = Date.now();
    const likeId = await ctx.db.insert('likes', {
      fromUserId: sender._id,
      toUserId: args.toUserId,
      targetType: args.targetType,
      targetId: args.targetId,
      comment: trimmedComment,
      status: reciprocal ? 'matched' : 'pending',
      createdAt: now,
      expiresAt: now + LIKE_TTL_MS,
    });

    let matchId: Id<'matches'> | null = null;
    if (reciprocal) {
      // The reciprocal like was the true initiator — it came first. The
      // system message in the chat references THEIR comment, not the one
      // the sender just wrote. (If A liked B last week and B likes A now,
      // A's comment is the conversation-opener; B's is "I agree".)
      const reciprocalSender = await ctx.db.get(reciprocal.fromUserId);
      matchId = await createMatch(ctx, {
        initiatorUserId: reciprocal.fromUserId,
        initiatorDisplayName: reciprocalSender?.displayName ?? 'Someone',
        recipientUserId: sender._id,
        initiatedByLikeId: reciprocal._id,
        openingComment: reciprocal.comment,
      });
      await ctx.db.patch(reciprocal._id, { status: 'matched', matchId });
      await ctx.db.patch(likeId, { matchId });
    }

    return { likeId, matchId };
  },
});

type InboundLikeItem = {
  likeId: Id<'likes'>;
  fromUserId: Id<'users'>;
  fromDisplayName: string;
  fromAge: number | null;
  fromPhotoUrl: string | null;
  fromCity: string | null;
  fromPronouns: string[];
  comment: string;
  targetType: 'prompt' | 'photo';
  targetDescription: string;
  createdAt: number;
};

/**
 * Likes Inbox query. Returns pending likes sent to the caller, sorted
 * newest-first. Joins sender's display info and a short target description
 * so the LikeCard can render without per-row fan-out on the client.
 *
 * Expired likes are filtered at read time (schema has `expiresAt`); a
 * scheduled cron to actively flip status='expired' is deferred per the
 * plan — not a correctness issue as long as this query excludes them.
 */
export const listInbound = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { user } = await requireUserAndProfile(ctx);
    const now = Date.now();

    const paged = await ctx.db
      .query('likes')
      .withIndex('by_to_user_status', (q) =>
        q.eq('toUserId', user._id).eq('status', 'pending'),
      )
      .order('desc')
      .paginate(args.paginationOpts);

    // Resolve each row in parallel. Per-row work is independent (sender
    // doc, block check, profile, photo URL, target description), and
    // Convex queries batch underlying storage calls well. At 10 rows
    // this cuts the visible "open likes tab" latency roughly in half
    // vs. the original sequential loop.
    const maybePage = await Promise.all(
      paged.page.map((like) => resolveInboundLike(ctx, user._id, like, now)),
    );
    const page = maybePage.filter((x): x is InboundLikeItem => x !== null);

    return {
      page,
      isDone: paged.isDone,
      continueCursor: paged.continueCursor,
    };
  },
});

async function resolveInboundLike(
  ctx: QueryCtx,
  viewerId: Id<'users'>,
  like: Doc<'likes'>,
  now: number,
): Promise<InboundLikeItem | null> {
  if (like.expiresAt <= now) return null;

  const [fromUser, blocked, fromProfile] = await Promise.all([
    ctx.db.get(like.fromUserId),
    isBlockedBetween(ctx, viewerId, like.fromUserId),
    ctx.db
      .query('profiles')
      .withIndex('by_user', (q) => q.eq('userId', like.fromUserId))
      .unique(),
  ]);
  if (!fromUser || fromUser.accountStatus !== 'active') return null;
  if (blocked) return null;

  const [photoUrl, targetDescription] = await Promise.all([
    fromProfile ? firstPhotoUrl(ctx, fromProfile._id) : Promise.resolve(null),
    resolveTargetDescription(ctx, like),
  ]);

  return {
    likeId: like._id,
    fromUserId: like.fromUserId,
    fromDisplayName: fromUser.displayName,
    fromAge: computeAge(fromUser.dateOfBirth, now),
    fromPhotoUrl: photoUrl,
    fromCity: fromProfile?.city ?? null,
    fromPronouns: fromProfile?.pronouns ?? [],
    comment: like.comment,
    targetType: like.targetType,
    targetDescription,
    createdAt: like.createdAt,
  };
}

async function firstPhotoUrl(
  ctx: QueryCtx,
  profileId: Id<'profiles'>,
): Promise<string | null> {
  const firstPhoto = await ctx.db
    .query('photos')
    .withIndex('by_profile_position', (q) => q.eq('profileId', profileId))
    .order('asc')
    .first();
  return firstPhoto ? await ctx.storage.getUrl(firstPhoto.storageId) : null;
}

async function resolveTargetDescription(
  ctx: QueryCtx,
  like: Doc<'likes'>,
): Promise<string> {
  if (like.targetType !== 'prompt') return 'your photo';
  const promptAnswer = await ctx.db.get(like.targetId as Id<'profilePrompts'>);
  if (!promptAnswer) return 'your prompt answer';
  const prompt = await ctx.db.get(promptAnswer.promptId);
  return prompt ? `your answer to "${prompt.question}"` : 'your prompt answer';
}

/**
 * Simple count-only view for the free tier's "X people liked you — upgrade"
 * banner. Splits pending vs. total to let the UI surface "3 new" plus a
 * historical count if we ever want one. Cheap because it operates on an
 * index range without fetching sender data.
 */
export const countInbound = query({
  handler: async (ctx) => {
    const { user } = await requireUserAndProfile(ctx);
    const now = Date.now();
    const pending = await ctx.db
      .query('likes')
      .withIndex('by_to_user_status', (q) =>
        q.eq('toUserId', user._id).eq('status', 'pending'),
      )
      .collect();
    const live = pending.filter((l) => l.expiresAt > now).length;
    return { pending: live };
  },
});

/**
 * The sender's outbound-likes view. Not wired to UI in Phase 4 (the Likes
 * tab is recipient-side only), but exposed so the sender can build a
 * "likes I've sent" settings page in a follow-up. Filtering by status is
 * optional — default returns everything so the sender can see what matched,
 * what's pending, and what got passed.
 */
export const listOutbound = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(
      v.union(
        v.literal('pending'),
        v.literal('matched'),
        v.literal('passed'),
        v.literal('expired'),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const { user } = await requireUserAndProfile(ctx);
    const base = ctx.db
      .query('likes')
      .withIndex('by_from_user', (ix) => ix.eq('fromUserId', user._id))
      .order('desc');
    if (args.status) {
      const wantStatus = args.status;
      return await base
        .filter((f) => f.eq(f.field('status'), wantStatus))
        .paginate(args.paginationOpts);
    }
    return await base.paginate(args.paginationOpts);
  },
});

/**
 * Respond to an inbound like: match back (creates the match + opens chat)
 * or pass (soft-rejects; sender is NOT notified, per US-011). Owner check
 * is enforced — only the recipient of the like can respond. Pre-existing
 * responded-on likes (status != pending) are a no-op return so the client
 * can retry without crashing on double-tap.
 */
export const respond = mutation({
  args: {
    likeId: v.id('likes'),
    action: v.union(v.literal('match'), v.literal('pass')),
  },
  handler: async (ctx, args) => {
    // Helper throws if the user hasn't completed onboarding; that's the
    // correct gate for responding to likes. We only read `user` here.
    const { user } = await requireUserAndProfile(ctx);

    const like = await ctx.db.get(args.likeId);
    if (!like) throw new Error('Like not found');
    if (like.toUserId !== user._id) throw new Error('Not your like');
    if (like.status !== 'pending') return { matchId: like.matchId ?? null };

    if (args.action === 'pass') {
      await ctx.db.patch(like._id, { status: 'passed' });
      return { matchId: null as Id<'matches'> | null };
    }

    // Match: the sender of the original like is the initiator. Their
    // comment seeds the chat's system message.
    const sender = await ctx.db.get(like.fromUserId);
    if (!sender || sender.accountStatus !== 'active') {
      // Sender got suspended / deleted between send and respond — soft-fail
      // by marking passed so the recipient's inbox clears.
      await ctx.db.patch(like._id, { status: 'passed' });
      return { matchId: null as Id<'matches'> | null };
    }
    const matchId = await createMatch(ctx, {
      initiatorUserId: like.fromUserId,
      initiatorDisplayName: sender.displayName,
      recipientUserId: user._id,
      initiatedByLikeId: like._id,
      openingComment: like.comment,
    });
    await ctx.db.patch(like._id, { status: 'matched', matchId });
    return { matchId };
  },
});

