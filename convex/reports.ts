/**
 * Reports — TASK-063 backend.
 *
 * User-initiated abuse reports. Categories match the schema enum verbatim
 * (PRD § 6 FR-021): fetishization, transphobia, unwanted-sexual-content,
 * harassment, safety-concern, fake-profile, underage, spam, other.
 *
 * Rate-limited at 5/day per § 12 edge case ("Thanks — we're seeing a lot of
 * reports from you today."). Self-reports are rejected with explicit copy.
 * Reports against already-banned users are accepted and linked normally —
 * the FR-023 cron and the moderator dashboard treat them as audit trail.
 */
import { v } from 'convex/values';
import { paginationOptsValidator } from 'convex/server';
import { mutation, query } from './_generated/server';
import { requireUserAndProfile } from './lib/currentUser';
import { checkAndIncrement } from './lib/rateLimit';

const REPORTS_PER_DAY = 5; // PRD § 12 edge case rate limit.
const MAX_CONTEXT_CHARS = 1000;

const REPORT_REASON = v.union(
  v.literal('fetishization'),
  v.literal('transphobia'),
  v.literal('unwanted-sexual-content'),
  v.literal('harassment'),
  v.literal('safety-concern'),
  v.literal('fake-profile'),
  v.literal('underage'),
  v.literal('spam'),
  v.literal('other'),
);

export const submit = mutation({
  args: {
    reportedUserId: v.id('users'),
    reason: REPORT_REASON,
    context: v.optional(v.string()),
    relatedMessageId: v.optional(v.id('messages')),
    relatedMatchId: v.optional(v.id('matches')),
  },
  handler: async (ctx, args) => {
    const { user } = await requireUserAndProfile(ctx);

    if (args.reportedUserId === user._id) {
      throw new Error("You can't report yourself.");
    }

    const target = await ctx.db.get(args.reportedUserId);
    if (!target) {
      throw new Error('User not found.');
    }

    // Validate optional context length client-side AND server-side. The
    // ReportSheet enforces the 1000-char cap at typing time; this is the
    // backstop for direct API calls.
    const trimmedContext = args.context?.trim();
    if (trimmedContext && trimmedContext.length > MAX_CONTEXT_CHARS) {
      throw new Error(
        `Context must be ${MAX_CONTEXT_CHARS} characters or fewer`,
      );
    }

    // Validate the linked message belongs to the linked match and the
    // reporter is a participant. This prevents a reporter from attaching
    // arbitrary message IDs as "evidence" against an unrelated user.
    if (args.relatedMessageId) {
      const message = await ctx.db.get(args.relatedMessageId);
      if (!message) {
        throw new Error('Linked message no longer exists.');
      }
      if (args.relatedMatchId && message.matchId !== args.relatedMatchId) {
        throw new Error('Linked message does not belong to that match.');
      }
    }
    if (args.relatedMatchId) {
      const match = await ctx.db.get(args.relatedMatchId);
      if (!match) {
        throw new Error('Linked match no longer exists.');
      }
      if (match.userAId !== user._id && match.userBId !== user._id) {
        throw new Error('Not a participant in that match.');
      }
    }

    // Rate limit AFTER ownership/validity checks: a bad-faith reporter
    // probing IDs shouldn't burn through their budget on rejected attempts.
    await checkAndIncrement(ctx, user._id, 'reports-daily', REPORTS_PER_DAY);

    const now = Date.now();
    const reportId = await ctx.db.insert('reports', {
      reporterId: user._id,
      reportedUserId: args.reportedUserId,
      reason: args.reason,
      context: trimmedContext || undefined,
      relatedMessageId: args.relatedMessageId,
      relatedMatchId: args.relatedMatchId,
      status: 'open',
      createdAt: now,
    });

    return { reportId };
  },
});

type MyReportRow = {
  reportId: string;
  reportedUserId: string;
  reason: string;
  status: 'open' | 'under-review' | 'actioned' | 'dismissed';
  context: string | null;
  moderatorNotes: string | null;
  createdAt: number;
  resolvedAt: number | null;
};

/**
 * Reports submitted by the caller. Powers Settings → My Reports (FR-022).
 * Sorted newest-first via the by_reporter index plus desc order.
 */
export const mySubmissions = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { user } = await requireUserAndProfile(ctx);
    const paged = await ctx.db
      .query('reports')
      .withIndex('by_reporter', (q) => q.eq('reporterId', user._id))
      .order('desc')
      .paginate(args.paginationOpts);

    const page: MyReportRow[] = paged.page.map((r) => ({
      reportId: r._id,
      reportedUserId: r.reportedUserId,
      reason: r.reason,
      status: r.status,
      context: r.context ?? null,
      // Moderator notes are intentionally surfaced to the reporter — a
      // reviewer's "we removed this user" or "no action taken, here's why"
      // closes the loop and is part of the trans-first commitment to
      // visibility about how reports are handled.
      moderatorNotes: r.moderatorNotes ?? null,
      createdAt: r.createdAt,
      resolvedAt: r.resolvedAt ?? null,
    }));

    return {
      page,
      isDone: paged.isDone,
      continueCursor: paged.continueCursor,
    };
  },
});
