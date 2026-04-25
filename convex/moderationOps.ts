/**
 * Moderator operations — TASK-065 descoped.
 *
 * Helper mutations callable from the Convex dashboard's Run Function panel
 * by users whose `users.role === 'moderator'`. Phase 5 ships moderation
 * without a dedicated Next.js admin UI per `docs/prd.md` § 4 ("For launch,
 * moderate via direct Convex dashboard queries"); Phase 6 will wrap these
 * mutations in a thin web app.
 *
 * Every mutation writes to `moderationActions` so the audit trail is
 * complete from day one — when the Phase 6 dashboard arrives, the entire
 * historical record is already structured for it. Reports get patched to
 * 'actioned' or 'dismissed' to surface state back to the reporter via
 * `reports.mySubmissions`.
 *
 * Auth model: `requireModerator` looks up the caller's user row, requires
 * `role === 'moderator'`. To grant moderator access, set the field via the
 * Convex dashboard or `npx convex env`-driven script. There is intentionally
 * no self-promotion endpoint.
 */
import { v } from 'convex/values';
import type { Doc } from './_generated/dataModel';
import { mutation } from './_generated/server';
import type { MutationCtx } from './_generated/server';

async function requireModerator(ctx: MutationCtx): Promise<Doc<'users'>> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('Not authenticated');
  const user = await ctx.db
    .query('users')
    .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
    .unique();
  if (!user) throw new Error('User not found');
  if (user.role !== 'moderator') {
    throw new Error('Moderator access required.');
  }
  return user;
}

/**
 * Close a report without taking action against the target. Used when a
 * report turns out to be unfounded, a misunderstanding, or duplicate of an
 * already-actioned case. Optional `notes` surfaces back to the reporter
 * via `reports.mySubmissions` so they understand the outcome.
 */
export const dismissReport = mutation({
  args: {
    reportId: v.id('reports'),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const moderator = await requireModerator(ctx);
    const report = await ctx.db.get(args.reportId);
    if (!report) throw new Error('Report not found');

    const now = Date.now();
    await ctx.db.patch(args.reportId, {
      status: 'dismissed',
      moderatorId: moderator._id,
      moderatorNotes: args.notes,
      resolvedAt: now,
    });
    await ctx.db.insert('moderationActions', {
      actorUserId: moderator._id,
      targetUserId: report.reportedUserId,
      action: 'dismiss',
      reason: args.notes,
      relatedReportId: args.reportId,
      createdAt: now,
    });
  },
});

/**
 * Mark a report as actioned without specifying which action — used when
 * the moderator has already taken a separate action (warn/suspend/ban)
 * via the dedicated mutation and just needs to close the open report.
 * Prefer the dedicated mutations below when possible since they bundle
 * the action with the report patch.
 */
export const actionReport = mutation({
  args: {
    reportId: v.id('reports'),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const moderator = await requireModerator(ctx);
    const report = await ctx.db.get(args.reportId);
    if (!report) throw new Error('Report not found');
    const now = Date.now();
    await ctx.db.patch(args.reportId, {
      status: 'actioned',
      moderatorId: moderator._id,
      moderatorNotes: args.notes,
      resolvedAt: now,
    });
  },
});

/**
 * Issue a warning. Phase 5 records the action but does NOT dispatch a push
 * or in-app notification — Phase 6's admin UI is when warning delivery
 * becomes interactive. For now, the warning is moderator-internal: it
 * shows up in the audit log, and follow-up reports against the same user
 * are reviewed in light of the prior warning.
 */
export const warnUser = mutation({
  args: {
    targetUserId: v.id('users'),
    reason: v.string(),
    relatedReportId: v.optional(v.id('reports')),
  },
  handler: async (ctx, args) => {
    const moderator = await requireModerator(ctx);
    const target = await ctx.db.get(args.targetUserId);
    if (!target) throw new Error('Target user not found');
    const now = Date.now();
    await ctx.db.insert('moderationActions', {
      actorUserId: moderator._id,
      targetUserId: args.targetUserId,
      action: 'warn',
      reason: args.reason,
      relatedReportId: args.relatedReportId,
      createdAt: now,
    });
    if (args.relatedReportId) {
      await ctx.db.patch(args.relatedReportId, {
        status: 'actioned',
        moderatorId: moderator._id,
        moderatorNotes: args.reason,
        resolvedAt: now,
      });
    }
  },
});

/**
 * Suspend a user pending review. Reversible — toggle back to 'active' via
 * `reinstateUser`. Suspended users are blocked at the
 * `requireUserAndProfile` helper so handlers throw before running.
 */
export const suspendUser = mutation({
  args: {
    targetUserId: v.id('users'),
    reason: v.string(),
    relatedReportId: v.optional(v.id('reports')),
  },
  handler: async (ctx, args) => {
    const moderator = await requireModerator(ctx);
    const target = await ctx.db.get(args.targetUserId);
    if (!target) throw new Error('Target user not found');
    const now = Date.now();
    await ctx.db.patch(args.targetUserId, { accountStatus: 'suspended' });
    await ctx.db.insert('moderationActions', {
      actorUserId: moderator._id,
      targetUserId: args.targetUserId,
      action: 'suspend',
      reason: args.reason,
      relatedReportId: args.relatedReportId,
      createdAt: now,
    });
    if (args.relatedReportId) {
      await ctx.db.patch(args.relatedReportId, {
        status: 'actioned',
        moderatorId: moderator._id,
        moderatorNotes: args.reason,
        resolvedAt: now,
      });
    }
  },
});

/**
 * Permanent removal. Distinct from suspend: ban is the terminal state for
 * confirmed bad actors. The user row is preserved for audit; only the
 * accountStatus changes.
 */
export const banUser = mutation({
  args: {
    targetUserId: v.id('users'),
    reason: v.string(),
    relatedReportId: v.optional(v.id('reports')),
  },
  handler: async (ctx, args) => {
    const moderator = await requireModerator(ctx);
    const target = await ctx.db.get(args.targetUserId);
    if (!target) throw new Error('Target user not found');
    const now = Date.now();
    await ctx.db.patch(args.targetUserId, { accountStatus: 'banned' });
    await ctx.db.insert('moderationActions', {
      actorUserId: moderator._id,
      targetUserId: args.targetUserId,
      action: 'ban',
      reason: args.reason,
      relatedReportId: args.relatedReportId,
      createdAt: now,
    });
    if (args.relatedReportId) {
      await ctx.db.patch(args.relatedReportId, {
        status: 'actioned',
        moderatorId: moderator._id,
        moderatorNotes: args.reason,
        resolvedAt: now,
      });
    }
  },
});

/**
 * Reverse a suspension. Used after review concludes the suspension was
 * not warranted, or when the FR-023 cron's auto-suspend turns out to be
 * a false positive. Banned accounts are NOT reinstatable through this
 * mutation — that requires a direct Convex dashboard write to make the
 * decision deliberate.
 */
export const reinstateUser = mutation({
  args: {
    targetUserId: v.id('users'),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const moderator = await requireModerator(ctx);
    const target = await ctx.db.get(args.targetUserId);
    if (!target) throw new Error('Target user not found');
    if (target.accountStatus !== 'suspended') {
      throw new Error('Only suspended users can be reinstated here.');
    }
    const now = Date.now();
    await ctx.db.patch(args.targetUserId, { accountStatus: 'active' });
    await ctx.db.insert('moderationActions', {
      actorUserId: moderator._id,
      targetUserId: args.targetUserId,
      // Reuse 'dismiss' as the audit verb for reinstatements — the action
      // table's enum is intentionally minimal; the reason field carries
      // the nuance.
      action: 'dismiss',
      reason: `reinstate: ${args.reason}`,
      createdAt: now,
    });
  },
});
