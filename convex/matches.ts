import { v } from 'convex/values';
import { paginationOptsValidator } from 'convex/server';
import { internal } from './_generated/api';
import { mutation, query } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { requireUserAndProfile } from './lib/currentUser';

/**
 * Deterministically order two user IDs for the (userAId, userBId) match key.
 * Convex Ids are branded strings, so a lexical compare is stable. This keeps
 * the by_users index unique on any unordered pair of users — (A,B) and (B,A)
 * always produce the same row, which is what we want: one match per pair.
 */
function orderPair(
  a: Id<'users'>,
  b: Id<'users'>,
): { userAId: Id<'users'>; userBId: Id<'users'> } {
  return a < b ? { userAId: a, userBId: b } : { userAId: b, userBId: a };
}

/**
 * Create a match + seed the opening system message. Called from likes.send
 * (when a reciprocal pending like already exists) and from likes.respond
 * (when the recipient taps "Match"). Idempotent-by-pair: if a match row
 * already exists for this pair, return its id without re-seeding. This
 * matters in a race between two simultaneous reciprocal likes — both sides'
 * mutations would otherwise each try to insert a match.
 *
 * Returns the matchId so callers can route the user directly into the chat.
 */
export async function createMatch(
  ctx: MutationCtx,
  args: {
    initiatorUserId: Id<'users'>;
    initiatorDisplayName: string;
    recipientUserId: Id<'users'>;
    initiatedByLikeId: Id<'likes'>;
    openingComment: string;
  },
): Promise<Id<'matches'>> {
  const { userAId, userBId } = orderPair(
    args.initiatorUserId,
    args.recipientUserId,
  );

  // Dedupe only on ACTIVE rows. An unmatched row is preserved for audit
  // but hidden from both users' listMine/get, so returning it here would
  // route the new match into a permanently-unavailable chat. Historical
  // unmatched rows stay untouched; a fresh row starts a fresh thread.
  const prior = await ctx.db
    .query('matches')
    .withIndex('by_users', (q) =>
      q.eq('userAId', userAId).eq('userBId', userBId),
    )
    .collect();
  const active = prior.find((m) => m.status !== 'unmatched');
  if (active) return active._id;

  const now = Date.now();
  const matchId = await ctx.db.insert('matches', {
    userAId,
    userBId,
    initiatedByLikeId: args.initiatedByLikeId,
    status: 'active',
    unreadCountA: 1,
    unreadCountB: 1,
    isArchivedByA: false,
    isArchivedByB: false,
    lastMessageAt: now,
    // System message is concise on purpose — match list rows show this as
    // the "last message preview" until the first real message lands, so a
    // long paragraph would truncate awkwardly in the match list.
    lastMessagePreview: 'You matched — say hi.',
    createdAt: now,
  });

  // Seed a single system message. Body references the initiating like's
  // comment verbatim so both users see the real context from the jump,
  // without us inserting a fake user message. Per the plan's "match seed"
  // decision.
  await ctx.db.insert('messages', {
    matchId,
    senderId: args.initiatorUserId,
    messageType: 'system',
    body: `You matched. ${args.initiatorDisplayName}'s opening comment: "${args.openingComment}"`,
    createdAt: now,
  });

  // Push goes to the initiator — they're the one who was waiting. The
  // responder just took the action, so their client gets the update via
  // Convex reactivity without needing a push. Action name is passed so the
  // push body can use the responder's display name.
  const responder = await ctx.db.get(args.recipientUserId);
  await ctx.scheduler.runAfter(0, internal.notifications.sendPushForMatch, {
    recipientUserId: args.initiatorUserId,
    matcherDisplayName: responder?.displayName ?? 'someone',
    matchId,
  });

  return matchId;
}

type MatchListItem = {
  matchId: Id<'matches'>;
  counterpartyUserId: Id<'users'>;
  counterpartyDisplayName: string;
  counterpartyPhotoUrl: string | null;
  lastMessageAt: number | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  createdAt: number;
};

/**
 * Chat list for the Matches tab. Returns both user-A and user-B matches
 * merged and sorted by most recent activity. Hides unmatched rows and
 * matches archived by the caller.
 *
 * Convex doesn't have a union-of-two-indexes query, so we run both and
 * merge in-memory — a user's match count is bounded (dating-app usage
 * caps in the hundreds), so the paginate-then-merge trade-off is fine for
 * now. Revisit if a power user crosses ~500 matches.
 */
export const listMine = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { user } = await requireUserAndProfile(ctx);

    // Fetch both sides sorted by activity desc. `by_user_a_activity` keys on
    // [userAId, lastMessageAt], so .order('desc') here gives most-recent-first.
    // TODO(scale): we collect the full set and paginate in memory because a
    // user can be either userA or userB and Convex doesn't support union-of-
    // indexes pagination. For a user with 500+ matches this re-reads 500
    // docs per page + re-runs on every message in any of their chats. The
    // clean fix (add a `participantIds: [userAId, userBId]` array field +
    // index, query by array-contains) is a schema migration; deferred until
    // real usage says it matters.
    const [asUserA, asUserB] = await Promise.all([
      ctx.db
        .query('matches')
        .withIndex('by_user_a_activity', (q) => q.eq('userAId', user._id))
        .order('desc')
        .collect(),
      ctx.db
        .query('matches')
        .withIndex('by_user_b_activity', (q) => q.eq('userBId', user._id))
        .order('desc')
        .collect(),
    ]);

    const all: Doc<'matches'>[] = [...asUserA, ...asUserB];
    // Default-accept by filtering on `status === 'unmatched'` rather than
    // `status !== 'active'`. If a hypothetical pre-migration row lacks the
    // status field (schema requires it now, but defensive against future
    // enum additions) it stays visible instead of getting silently hidden.
    const visible = all.filter((m) => {
      if (m.status === 'unmatched') return false;
      const iAmA = m.userAId === user._id;
      return iAmA ? !m.isArchivedByA : !m.isArchivedByB;
    });
    visible.sort((x, y) => (y.lastMessageAt ?? 0) - (x.lastMessageAt ?? 0));

    // Client-driven pagination on a merged in-memory list. We synthesize a
    // cursor as the numeric offset; Convex's paginationOptsValidator accepts
    // any string, so this is safe as long as we only call it from our own
    // client. If the caller ever needs a stable cursor across mutations,
    // we'll need to move to an offset-indexed paging table — deferred.
    // Cursor is our own stringified offset, but a malformed client could
    // send `'NaN'` or `'-5'`; clamp to 0 so slice() always yields a valid
    // page and continueCursor stays parseable on the next round-trip.
    const parsed = args.paginationOpts.cursor
      ? Number.parseInt(args.paginationOpts.cursor, 10)
      : 0;
    const startIdx = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    const numItems = args.paginationOpts.numItems;

    // Scan forward from startIdx, resolving in parallel batches until we've
    // accumulated `numItems` displayable rows OR exhausted the list. Naive
    // slice-then-filter could return an empty page if every candidate in
    // the slice has a deactivated counterparty, while later valid rows
    // stay hidden until the client manually keeps paginating.
    const page: MatchListItem[] = [];
    let inspected = startIdx;
    while (page.length < numItems && inspected < visible.length) {
      const batchSize = Math.min(
        numItems - page.length,
        visible.length - inspected,
      );
      const batch = visible.slice(inspected, inspected + batchSize);
      const resolved = await Promise.all(batch.map((m) => resolveRow(ctx, user._id, m)));
      for (const row of resolved) if (row) page.push(row);
      inspected += batchSize;
    }
    const isDone = inspected >= visible.length;

    return {
      page,
      isDone,
      continueCursor: isDone ? '' : String(inspected),
    };
  },
});

async function resolveRow(
  ctx: QueryCtx,
  viewerId: Id<'users'>,
  match: Doc<'matches'>,
): Promise<MatchListItem | null> {
  const counterpartyId =
    match.userAId === viewerId ? match.userBId : match.userAId;
  const [counterparty, counterpartyProfile] = await Promise.all([
    ctx.db.get(counterpartyId),
    ctx.db
      .query('profiles')
      .withIndex('by_user', (q) => q.eq('userId', counterpartyId))
      .unique(),
  ]);
  if (!counterparty || counterparty.accountStatus !== 'active') return null;
  const photoUrl = counterpartyProfile
    ? await firstPhotoUrlForProfile(ctx, counterpartyProfile._id)
    : null;
  const unreadCount =
    match.userAId === viewerId ? match.unreadCountA : match.unreadCountB;
  return {
    matchId: match._id,
    counterpartyUserId: counterpartyId,
    counterpartyDisplayName: counterparty.displayName,
    counterpartyPhotoUrl: photoUrl,
    lastMessageAt: match.lastMessageAt ?? null,
    lastMessagePreview: match.lastMessagePreview ?? null,
    unreadCount,
    createdAt: match.createdAt,
  };
}

async function firstPhotoUrlForProfile(
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

/**
 * Single-match fetch, used by the chat screen to render the header
 * (counterparty name + photo + identity chips) without needing a second
 * round-trip. Participant check enforced — returning null if the caller
 * isn't a member of the match prevents probe attacks against the match ID
 * space.
 */
export const get = query({
  args: { matchId: v.id('matches') },
  handler: async (ctx, args) => {
    const { user } = await requireUserAndProfile(ctx);
    const match = await ctx.db.get(args.matchId);
    if (!match) return null;
    if (match.userAId !== user._id && match.userBId !== user._id) return null;
    if (match.status === 'unmatched') return null;

    const counterpartyId =
      match.userAId === user._id ? match.userBId : match.userAId;
    const [counterparty, counterpartyProfile] = await Promise.all([
      ctx.db.get(counterpartyId),
      ctx.db
        .query('profiles')
        .withIndex('by_user', (q) => q.eq('userId', counterpartyId))
        .unique(),
    ]);
    // Mirror listMine's active-account guard — a deactivated/suspended
    // counterparty's chat must not reopen via a stale route or push.
    if (!counterparty || counterparty.accountStatus !== 'active') return null;
    const photoUrl = counterpartyProfile
      ? await firstPhotoUrlForProfile(ctx, counterpartyProfile._id)
      : null;

    return {
      matchId: match._id,
      counterpartyUserId: counterpartyId,
      counterpartyDisplayName: counterparty.displayName,
      counterpartyPhotoUrl: photoUrl,
      counterpartyPronouns: counterpartyProfile?.pronouns ?? [],
      counterpartyIdentityLabel:
        counterpartyProfile?.genderIdentity ?? 'person',
      createdAt: match.createdAt,
    };
  },
});

/**
 * Unmatch. Participant check. Flips status to 'unmatched' — both users'
 * listMine queries filter that out, so the thread disappears for everyone
 * without deleting rows (needed for audit + future report attachments).
 * Either party can unmatch; there is no undo, per the roadmap's unmatch
 * semantics (neither user can re-match without a new like).
 */
export const unmatch = mutation({
  args: { matchId: v.id('matches') },
  handler: async (ctx, args) => {
    const { user } = await requireUserAndProfile(ctx);
    const match = await ctx.db.get(args.matchId);
    if (!match) throw new Error('Match not found');
    if (match.userAId !== user._id && match.userBId !== user._id) {
      throw new Error('Not a participant');
    }
    if (match.status !== 'active') return; // Already unmatched — idempotent.
    await ctx.db.patch(match._id, { status: 'unmatched' });
  },
});

/**
 * Archive (hide from list for me only). Unlike unmatch this is unilateral
 * and the other side still sees the thread. Not surfaced in the Phase 4 UI
 * (swipe-to-archive is deferred per the plan), but the mutation lives here
 * so the server contract is complete.
 */
export const archive = mutation({
  args: { matchId: v.id('matches') },
  handler: async (ctx, args) => {
    const { user } = await requireUserAndProfile(ctx);
    const match = await ctx.db.get(args.matchId);
    if (!match) throw new Error('Match not found');
    if (match.userAId !== user._id && match.userBId !== user._id) {
      throw new Error('Not a participant');
    }
    if (match.userAId === user._id) {
      await ctx.db.patch(match._id, { isArchivedByA: true });
    } else {
      await ctx.db.patch(match._id, { isArchivedByB: true });
    }
  },
});
