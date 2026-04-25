import type { Doc } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';

/**
 * Resolve the Clerk-authenticated user and their profile. The two documents
 * are the foundation for nearly every authenticated handler — photos,
 * profilePrompts, profiles, the Phase 3 feed — so the lookup lives here to
 * keep the error messages and index usage identical across callers. Identity
 * comes from the Clerk JWT (subject = clerkId), then we look up users by
 * `by_clerk_id` and profiles by `by_user`. The thrown errors are the
 * user-visible copy the client surfaces, in order of onboarding progress.
 *
 * Phase 5: suspended and banned users are rejected before any handler runs
 * so the FR-023 cron's auto-suspend takes effect on the next sign-in. The
 * ACCOUNT_SUSPENDED / ACCOUNT_BANNED prefixes let the client switch error
 * UX (suspended → "your account is under review", banned → "your account
 * has been removed"); deleted users are treated the same as suspended
 * because the soft-delete window keeps the row addressable until the
 * 30-day purge. Paused users are NOT rejected — pause is user-initiated
 * and reversible from within the app.
 */
export async function requireUserAndProfile(
  ctx: MutationCtx | QueryCtx,
): Promise<{ user: Doc<'users'>; profile: Doc<'profiles'> }> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('Not authenticated');
  const user = await ctx.db
    .query('users')
    .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
    .unique();
  if (!user) throw new Error('User not found — account sync in progress');
  if (user.accountStatus === 'suspended') {
    throw new Error('ACCOUNT_SUSPENDED:Your account is under review.');
  }
  if (user.accountStatus === 'banned') {
    throw new Error('ACCOUNT_BANNED:This account has been removed.');
  }
  if (user.accountStatus === 'deleted') {
    throw new Error('ACCOUNT_DELETED:This account has been deleted.');
  }
  const profile = await ctx.db
    .query('profiles')
    .withIndex('by_user', (q) => q.eq('userId', user._id))
    .unique();
  if (!profile) throw new Error('Complete identity step first');
  return { user, profile };
}
