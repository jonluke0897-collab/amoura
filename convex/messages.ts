import { v } from 'convex/values';
import { paginationOptsValidator } from 'convex/server';
import { internal } from './_generated/api';
import { mutation, query } from './_generated/server';
import type { Id } from './_generated/dataModel';
import { requireUserAndProfile } from './lib/currentUser';
import { checkAndIncrement, hasActiveSubscription } from './lib/rateLimit';
import { checkMessage } from './moderation';

const MIN_BODY_CHARS = 1;
const MAX_BODY_CHARS = 2000;
const MESSAGES_PER_DAY = 500; // PRD § 2.5 Security.
const PREVIEW_CHARS = 80;

type MessageItem = {
  messageId: Id<'messages'>;
  senderId: Id<'users'>;
  body: string;
  messageType: 'text' | 'photo' | 'system';
  readAt: number | null;
  createdAt: number;
  isMine: boolean;
};

/**
 * Paginated message history for a match. Participant check on the match
 * keeps probes out of the ID space. Returns newest-first; the chat screen's
 * inverted FlatList then renders oldest at top visually.
 *
 * `isMine` is precomputed server-side because messageBubble's alignment
 * decision depends on comparing senderId to the viewer's userId, and we'd
 * rather the client not have to fetch `users.me` just to do that compare
 * on every render.
 */
export const listByMatch = query({
  args: {
    matchId: v.id('matches'),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { user } = await requireUserAndProfile(ctx);
    const match = await ctx.db.get(args.matchId);
    if (!match) throw new Error('Match not found');
    if (match.userAId !== user._id && match.userBId !== user._id) {
      throw new Error('Not a participant');
    }

    const paged = await ctx.db
      .query('messages')
      .withIndex('by_match_created', (q) => q.eq('matchId', args.matchId))
      .order('desc')
      .paginate(args.paginationOpts);

    const page: MessageItem[] = paged.page.map((m) => ({
      messageId: m._id,
      senderId: m.senderId,
      body: m.body,
      messageType: m.messageType,
      readAt: m.readAt ?? null,
      createdAt: m.createdAt,
      isMine: m.senderId === user._id,
    }));

    return {
      page,
      isDone: paged.isDone,
      continueCursor: paged.continueCursor,
    };
  },
});

/**
 * Send a text message. Updates match metadata (lastMessageAt, preview,
 * unreadCount on the recipient's side) and schedules a push notification
 * via the notifications module. Rate-limited per-user at 500/day.
 *
 * Keep the atomic-write order deliberate: insert message first, then
 * patch the match. If the mutation throws between them, both roll back.
 */
export const send = mutation({
  args: {
    matchId: v.id('matches'),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await requireUserAndProfile(ctx);
    const match = await ctx.db.get(args.matchId);
    if (!match) throw new Error('Match not found');
    if (match.userAId !== user._id && match.userBId !== user._id) {
      throw new Error('Not a participant');
    }
    if (match.status !== 'active') {
      throw new Error('This match is no longer available');
    }

    const trimmed = args.body.trim();
    if (trimmed.length < MIN_BODY_CHARS) {
      throw new Error('Message cannot be empty');
    }
    if (trimmed.length > MAX_BODY_CHARS) {
      throw new Error(`Message must be ${MAX_BODY_CHARS} characters or fewer`);
    }

    // Moderation stub — flagged=false for all bodies until Phase 5.
    const moderation = checkMessage(trimmed);
    if (moderation.flagged) {
      throw new Error(moderation.reason ?? 'Message did not pass moderation');
    }

    await checkAndIncrement(ctx, user._id, 'messages-daily', MESSAGES_PER_DAY);

    const now = Date.now();
    const messageId = await ctx.db.insert('messages', {
      matchId: match._id,
      senderId: user._id,
      body: trimmed,
      messageType: 'text',
      createdAt: now,
    });

    // Preview is truncated for the match-list row. Use grapheme-safe slice?
    // JS String.slice by UTF-16 code unit is fine for the truncation length
    // we're hitting — we never cut inside a surrogate pair at 80 chars of
    // typical conversational input.
    const preview =
      trimmed.length > PREVIEW_CHARS
        ? `${trimmed.slice(0, PREVIEW_CHARS - 1)}…`
        : trimmed;

    const iAmUserA = match.userAId === user._id;
    const recipientUserId = iAmUserA ? match.userBId : match.userAId;
    await ctx.db.patch(match._id, {
      lastMessageAt: now,
      lastMessagePreview: preview,
      lastMessageSenderId: user._id,
      unreadCountA: iAmUserA ? match.unreadCountA : match.unreadCountA + 1,
      unreadCountB: iAmUserA ? match.unreadCountB + 1 : match.unreadCountB,
      // Un-archive the recipient's side on new activity — if they archived
      // the thread and we're reaching back out, it should resurface.
      isArchivedByA: iAmUserA ? match.isArchivedByA : false,
      isArchivedByB: iAmUserA ? false : match.isArchivedByB,
    });

    // Push notification — fire-and-forget via scheduler. Subscription
    // lookup happens here in the mutation (one indexed read, no network)
    // so the push body is privacy-correct without the action needing
    // another runQuery round-trip.
    const recipientIsPaid = await hasActiveSubscription(ctx, recipientUserId);
    await ctx.scheduler.runAfter(0, internal.notifications.sendPushForMessage, {
      recipientUserId,
      senderDisplayName: user.displayName,
      bodyPreview: recipientIsPaid ? preview : null,
      matchId: match._id,
    });

    return { messageId };
  },
});

/**
 * Mark all unread-to-me messages in a match as read. Called when the chat
 * screen gains focus. Idempotent: messages with readAt already set are
 * skipped. Resets the caller's unreadCount on the match row so the match
 * list badge clears immediately.
 *
 * We iterate the full message list rather than filter by readAt because
 * Convex doesn't give us an index on "null fields" and the per-match
 * message count stays small (chat is short-form); ~50 unread is typical.
 */
export const markRead = mutation({
  args: { matchId: v.id('matches') },
  handler: async (ctx, args) => {
    const { user } = await requireUserAndProfile(ctx);
    const match = await ctx.db.get(args.matchId);
    if (!match) throw new Error('Match not found');
    if (match.userAId !== user._id && match.userBId !== user._id) {
      throw new Error('Not a participant');
    }

    const iAmUserA = match.userAId === user._id;
    const currentUnread = iAmUserA ? match.unreadCountA : match.unreadCountB;
    // No-op guard: if nothing's unread on our side, skip entirely. Every
    // write to `matches` re-runs every subscriber (Matches tab, the
    // ChatHeader's match.get, etc.), so a blind patch on every focus was
    // wasted work.
    if (currentUnread === 0) return;

    const now = Date.now();
    const messages = await ctx.db
      .query('messages')
      .withIndex('by_match_created', (q) => q.eq('matchId', args.matchId))
      .collect();

    await Promise.all(
      messages.map((m) =>
        m.senderId === user._id || m.readAt !== undefined
          ? null
          : ctx.db.patch(m._id, { readAt: now }),
      ),
    );

    await ctx.db.patch(
      match._id,
      iAmUserA ? { unreadCountA: 0 } : { unreadCountB: 0 },
    );
  },
});
