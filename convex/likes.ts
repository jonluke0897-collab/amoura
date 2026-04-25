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
    // Discriminated union ties targetType to its matching ID type. The
    // previous flat (targetType, targetId) shape let a client claim
    // `targetType: 'prompt', targetId: <photos_id>` and the validator
    // would accept it — runtime owner-check still rejected, but the
    // failure mode was a content error rather than a schema error.
    target: v.union(
      v.object({ type: v.literal('prompt'), id: v.id('profilePrompts') }),
      v.object({ type: v.literal('photo'), id: v.id('photos') }),
    ),
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

    // Moderation: like comments are conversation-openers from a stranger,
    // so the deliver-but-flag pattern used in messages.send doesn't apply
    // here — a flagged opener is rejected outright. Reclaimed in-community
    // language belongs inside an established thread, not in cold outreach.
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
    if (args.target.type === 'prompt') {
      const prompt = await ctx.db.get(args.target.id);
      if (!prompt || prompt.userId !== args.toUserId) {
        throw new Error('Target prompt does not belong to this profile');
      }
    } else {
      const photo = await ctx.db.get(args.target.id);
      if (!photo || photo.userId !== args.toUserId) {
        throw new Error('Target photo does not belong to this profile');
      }
    }

    // Lifetime: pending rows expire after LIKE_TTL_MS (7 days), but the
    // expiration cron is deferred so a row's `status` stays 'pending'
    // even past expiresAt. Treat status='pending' AND expiresAt > now as
    // the only "live" state. Without this, a 7-day-old like would block a
    // fresh one, auto-create a stale match, or be actionable from cached
    // UI. Lazy-transition the status on read where it's a mutation
    // context (here in send + in respond), so the data converges.
    const now = Date.now();

    // Dedupe: one pending like per (sender → recipient). If the sender
    // has already liked this profile and is still waiting for a response,
    // block a duplicate. Expired prior likes do not block — they're as
    // good as not-there.
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
      if (existingFromSender.expiresAt > now) {
        throw new Error('You already have a pending like on this profile');
      }
      // Lazy transition: prior pending row has expired silently — flip it
      // so it stops appearing in any inbox query and free up the dedupe
      // slot for the new like.
      await ctx.db.patch(existingFromSender._id, { status: 'expired' });
    }

    // Rate limit. Subscription lookup is cheap (single by_user index); keep
    // it inline rather than a preflight so the rollback guarantees still
    // apply if we throw later.
    const isPaid = await hasActiveSubscription(ctx, sender._id);
    const maxPerDay = isPaid ? PAID_LIKES_PER_DAY : FREE_LIKES_PER_DAY;
    await checkAndIncrement(ctx, sender._id, 'likes-daily', maxPerDay);

    // Reciprocal check: did the recipient already like the sender? If so
    // we match atomically instead of leaving the sender's like pending.
    // Expired reciprocals don't count — same lazy-transition rule as above.
    const reciprocalCandidate = await ctx.db
      .query('likes')
      .withIndex('by_to_user_status', (q) =>
        q.eq('toUserId', sender._id).eq('status', 'pending'),
      )
      .filter((q) => q.eq(q.field('fromUserId'), args.toUserId))
      .first();
    let reciprocal: Doc<'likes'> | null = null;
    if (reciprocalCandidate) {
      if (reciprocalCandidate.expiresAt > now) {
        reciprocal = reciprocalCandidate;
      } else {
        await ctx.db.patch(reciprocalCandidate._id, { status: 'expired' });
      }
    }

    const likeId = await ctx.db.insert('likes', {
      fromUserId: sender._id,
      toUserId: args.toUserId,
      targetType: args.target.type,
      targetId: args.target.id,
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
    const numItems = args.paginationOpts.numItems;

    // Skip-forward pagination: resolveInboundLike drops expired / blocked
    // / inactive senders, so a naive single .paginate() can return an
    // empty page with isDone=false while older valid likes sit hidden.
    // Walk the cursor forward in fixed-size batches until we have
    // numItems live rows or exhaust the underlying query. Same shape as
    // matches.listMine.
    const page: InboundLikeItem[] = [];
    let cursor: string | null = args.paginationOpts.cursor;
    let isDone = false;
    let continueCursor = '';
    while (page.length < numItems && !isDone) {
      const remaining = numItems - page.length;
      // Fetch exactly `remaining` per pass — over-fetching would skip
      // unconsumed live rows because Convex's continueCursor points to
      // the end of the batch we requested, not to the last row we
      // actually consumed. We pay an extra round-trip when filters drop
      // rows, which is the right tradeoff for correctness.
      const batch = await ctx.db
        .query('likes')
        .withIndex('by_to_user_status', (q) =>
          q.eq('toUserId', user._id).eq('status', 'pending'),
        )
        .order('desc')
        .paginate({ ...args.paginationOpts, cursor, numItems: remaining });
      const resolved = await Promise.all(
        batch.page.map((like) =>
          resolveInboundLike(ctx, user._id, like, now),
        ),
      );
      for (const row of resolved) {
        if (row) page.push(row);
      }
      cursor = batch.continueCursor;
      continueCursor = batch.continueCursor;
      isDone = batch.isDone;
    }

    return { page, isDone, continueCursor };
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
// Cap how far we'll scan for the banner count. Beyond this we display
// "100+" and nudge to upgrade — the exact number doesn't matter once a
// user has triple-digit likes. Bound is what protects this query from
// becoming an O(N) hot-path scan on popular accounts: at the cap the
// query does at most 100 sender + block lookups, regardless of how many
// pending rows the user has accumulated.
const COUNT_INBOUND_CAP = 100;

export const countInbound = query({
  handler: async (ctx) => {
    const { user } = await requireUserAndProfile(ctx);
    const now = Date.now();
    let live = 0;
    let scanned = 0;
    let isCapped = false;
    // Stream the index range and stop early once we've found CAP live
    // rows. Skip-counting (rather than .collect() then filter) is what
    // keeps the worst case bounded — a user with 5,000 unread pending
    // likes still pays just `CAP` lookups.
    for await (const like of ctx.db
      .query('likes')
      .withIndex('by_to_user_status', (q) =>
        q.eq('toUserId', user._id).eq('status', 'pending'),
      )) {
      scanned += 1;
      if (like.expiresAt <= now) continue;
      const sender = await ctx.db.get(like.fromUserId);
      if (!sender || sender.accountStatus !== 'active') continue;
      if (await isBlockedBetween(ctx, user._id, like.fromUserId)) continue;
      live += 1;
      if (live >= COUNT_INBOUND_CAP) {
        isCapped = true;
        break;
      }
    }
    return { pending: live, isCapped, scanned };
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
    // Lazy-transition expired pending rows. Stops a 7-day-old like from
    // being acted on via cached UI (the inbox already filters expired
    // out, but a stale push notification could still link to one).
    if (like.expiresAt <= Date.now()) {
      await ctx.db.patch(like._id, { status: 'expired' });
      return { matchId: null as Id<'matches'> | null };
    }
    // Re-check blocks. send() and listInbound() both enforce this, but a
    // block placed AFTER the like was sent leaves a stale row that's
    // still actionable from cached client state or a push deep link.
    // Treat post-block actions as soft-pass: clear the row from the
    // recipient's inbox without telling the sender they were matched.
    if (await isBlockedBetween(ctx, like.fromUserId, user._id)) {
      await ctx.db.patch(like._id, { status: 'passed' });
      return { matchId: null as Id<'matches'> | null };
    }

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

