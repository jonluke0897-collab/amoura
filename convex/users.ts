import { v } from 'convex/values';
import { internalMutation, query } from './_generated/server';

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

    return {
      user,
      profile,
      onboardingComplete: user.onboardingComplete,
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
      await ctx.db.patch(existing._id, {
        email: args.email,
        phoneNumber: args.phoneNumber,
        displayName: args.displayName,
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
