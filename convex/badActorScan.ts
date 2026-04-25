/**
 * Bad-actor pattern detection — FR-023 / TASK-065b.
 *
 * Daily scan over reports created in the last 7 days. For each unique
 * `reportedUserId`, count the number of distinct reporters. Two thresholds:
 *
 * - **≥3 unique reporters → high-severity flag.** Inserts (or refreshes)
 *   an open moderationFlags row with flagType='multiple-reports'. The
 *   moderator queue picks it up at the next dashboard sweep.
 * - **≥5 unique reporters → auto-suspend.** Patches the user's
 *   accountStatus to 'suspended'; their next sign-in is rejected at
 *   `requireUserAndProfile` with the ACCOUNT_SUSPENDED error code. The
 *   suspension remains until a moderator reviews and either bans or
 *   reinstates via `convex/moderationOps.ts`.
 *
 * Idempotent: re-running the same day does not create duplicate flag
 * rows. We update an existing open flag's `details` and `severity` rather
 * than inserting again. Banned users are skipped — there's nothing left
 * to do for an already-removed account.
 *
 * Action vs. mutation split: the scan is structured as an action that
 * runs a query then a per-target mutation, rather than one giant
 * mutation. This keeps each transaction small and lets the cron survive
 * future report-volume growth without bumping into the per-mutation
 * read/write document limit.
 */
import { v } from 'convex/values';
import {
  internalAction,
  internalMutation,
  internalQuery,
} from './_generated/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';

const SCAN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const FLAG_THRESHOLD = 3;
const SUSPEND_THRESHOLD = 5;

type RecentReport = {
  reporterId: Id<'users'>;
  reportedUserId: Id<'users'>;
  createdAt: number;
};

export const run = internalAction({
  handler: async (ctx) => {
    const cutoff = Date.now() - SCAN_WINDOW_MS;
    const recent: RecentReport[] = await ctx.runQuery(
      internal.badActorScan.listRecent,
      { since: cutoff },
    );

    // Group reports by target. Set of reporter IDs gives the unique-reporter
    // count regardless of how many reports each individual filed.
    const byTarget = new Map<
      string,
      { reporters: Set<string>; targetId: Id<'users'> }
    >();
    for (const r of recent) {
      const existing = byTarget.get(r.reportedUserId);
      if (existing) {
        existing.reporters.add(r.reporterId);
      } else {
        byTarget.set(r.reportedUserId, {
          reporters: new Set([r.reporterId]),
          targetId: r.reportedUserId,
        });
      }
    }

    let flagged = 0;
    let suspended = 0;
    for (const [, { reporters, targetId }] of byTarget) {
      const count = reporters.size;
      if (count < FLAG_THRESHOLD) continue;
      const shouldSuspend = count >= SUSPEND_THRESHOLD;
      await ctx.runMutation(internal.badActorScan.applyThreshold, {
        targetUserId: targetId,
        uniqueReporterCount: count,
        suspend: shouldSuspend,
      });
      flagged += 1;
      if (shouldSuspend) suspended += 1;
    }

    return { scanned: recent.length, flagged, suspended };
  },
});

export const listRecent = internalQuery({
  args: { since: v.number() },
  handler: async (ctx, args): Promise<RecentReport[]> => {
    const rows = await ctx.db
      .query('reports')
      .withIndex('by_created', (q) => q.gte('createdAt', args.since))
      .collect();
    return rows.map((r) => ({
      reporterId: r.reporterId,
      reportedUserId: r.reportedUserId,
      createdAt: r.createdAt,
    }));
  },
});

export const applyThreshold = internalMutation({
  args: {
    targetUserId: v.id('users'),
    uniqueReporterCount: v.number(),
    suspend: v.boolean(),
  },
  handler: async (ctx, args) => {
    const target = await ctx.db.get(args.targetUserId);
    if (!target) return;
    // Already-banned accounts: skip. Suspending or re-flagging a banned
    // user is wasted work; the terminal state is already worse than what
    // this cron can produce.
    if (target.accountStatus === 'banned') return;

    const now = Date.now();
    const details = `${args.uniqueReporterCount} unique reporters in 7d`;

    // Upsert the open flag rather than duplicating one per scan day.
    const existingFlag = await ctx.db
      .query('moderationFlags')
      .withIndex('by_user_status', (q) =>
        q.eq('userId', args.targetUserId).eq('status', 'open'),
      )
      .filter((q) => q.eq(q.field('flagType'), 'multiple-reports'))
      .first();
    if (existingFlag) {
      await ctx.db.patch(existingFlag._id, {
        severity: 'high',
        details,
      });
    } else {
      await ctx.db.insert('moderationFlags', {
        userId: args.targetUserId,
        flagType: 'multiple-reports',
        severity: 'high',
        details,
        status: 'open',
        createdAt: now,
      });
    }

    if (args.suspend && target.accountStatus !== 'suspended') {
      await ctx.db.patch(args.targetUserId, { accountStatus: 'suspended' });
      await ctx.db.insert('moderationActions', {
        actorUserId: 'system-cron',
        targetUserId: args.targetUserId,
        action: 'auto-suspend',
        reason: `fr-023-threshold: ${details}`,
        createdAt: now,
      });
    }
  },
});
