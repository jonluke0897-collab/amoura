import { v } from 'convex/values';
import { internalMutation, mutation, query } from './_generated/server';
import { hasActiveSubscription } from './lib/rateLimit';

// Current user (joined through Clerk identity → users table).
export const me = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user) return null;

    const profile = await ctx.db
      .query('profiles')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .unique();

    // hasActiveSubscription is the single gate for paid-tier features in
    // Phase 4 (Likes Inbox unblur, read receipts, future unlimited likes).
    // Until Phase 6 wires RevenueCat it always returns false — the gate is
    // in place so the moment subscriptions.* rows populate, every paywall
    // switches on together.
    const isPaid = await hasActiveSubscription(ctx, user._id);

    return {
      user,
      profile,
      onboardingComplete: user.onboardingComplete,
      hasActiveSubscription: isPaid,
    };
  },
});

// Internal: called by the Clerk webhook on user.created / user.updated.
export const syncFromClerk = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    phoneNumber: v.optional(v.string()),
    displayName: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();

    const now = Date.now();

    if (existing) {
      // Preserve displayName on Clerk updates — users can edit their name
      // in-app via the Profile tab, and that should win over whatever
      // Clerk's first_name happens to be on a later webhook. Email and
      // phoneNumber continue to track Clerk; we don't expose in-app
      // editing for those and they're identifier-shaped.
      await ctx.db.patch(existing._id, {
        email: args.email,
        phoneNumber: args.phoneNumber,
        lastActiveAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert('users', {
      clerkId: args.clerkId,
      email: args.email,
      phoneNumber: args.phoneNumber,
      displayName: args.displayName,
      onboardingComplete: false,
      accountStatus: 'active',
      lastActiveAt: now,
      createdAt: now,
    });
  },
});

// User-facing mutation for editing the display name from the Profile tab.
// Once a user sets a name here, it's preserved across Clerk webhook
// updates (see syncFromClerk above) — Convex becomes the source of truth.
export const updateDisplayName = mutation({
  args: { displayName: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();
    if (!user) throw new Error('User not found');

    const trimmed = args.displayName.trim();
    if (trimmed.length === 0) throw new Error('Name cannot be empty');
    if (trimmed.length > 50) throw new Error('Name must be 50 characters or fewer');

    await ctx.db.patch(user._id, {
      displayName: trimmed,
      lastActiveAt: Date.now(),
    });
  },
});

// Internal: called by the Clerk webhook on user.deleted. Soft-delete by default.
export const deleteByClerkId = internalMutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();

    if (!user) return;
    await ctx.db.patch(user._id, { accountStatus: 'deleted' });
  },
});
