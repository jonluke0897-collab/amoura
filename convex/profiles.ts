import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import type { Doc } from './_generated/dataModel';
import { GENDER_MODALITY, INTENTION, PLEDGE_TYPE, T4T_PREFERENCE } from './validators';

type OnboardingStep = 'identity' | 'intentions' | 'pledge' | 'complete';

function nextStep(
  user: Doc<'users'>,
  profile: Doc<'profiles'> | null,
): OnboardingStep {
  if (!profile) return 'identity';
  if (!profile.genderIdentity || profile.genderIdentity.trim() === '') return 'identity';
  if (profile.pronouns.length === 0) return 'identity';
  if (profile.orientation.length === 0) return 'identity';
  if (profile.intentions.length === 0) return 'intentions';
  if (!profile.pledgeAcceptedAt) return 'pledge';
  if (!user.respectPledgeCompletedAt) return 'pledge';
  return 'complete';
}

export const getMineStatus = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    // Webhook race: Clerk has authed us but the user row isn't inserted yet.
    // Caller treats null as "still loading" and shows a splash.
    if (!user) return null;

    const profile = await ctx.db
      .query('profiles')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .unique();

    return {
      step: nextStep(user, profile),
      isCis: user.isCis ?? null,
    };
  },
});

export const upsertIdentity = mutation({
  args: {
    pronouns: v.array(v.string()),
    genderIdentity: v.string(),
    genderModality: GENDER_MODALITY,
    orientation: v.array(v.string()),
    t4tPreference: T4T_PREFERENCE,
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();
    if (!user) throw new Error('User not found — account sync in progress');

    const trimmedIdentity = args.genderIdentity.trim();
    if (trimmedIdentity.length === 0) throw new Error('Gender identity is required');
    if (args.pronouns.length === 0) throw new Error('At least one pronoun is required');
    if (args.orientation.length === 0) throw new Error('At least one orientation is required');

    // Architectural safety (vision doc § 1): cis users cannot persist t4t-only
    // even if the client sends it. We coerce here rather than reject so a buggy
    // client or back-button edge case silently produces the correct state.
    const t4tPreference = args.genderModality === 'cis' ? 'open' : args.t4tPreference;

    const now = Date.now();
    // Mirror isCis onto users so pledge-branch logic can read it without a profile join.
    await ctx.db.patch(user._id, { isCis: args.genderModality === 'cis', lastActiveAt: now });

    const existing = await ctx.db
      .query('profiles')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        pronouns: args.pronouns,
        genderIdentity: trimmedIdentity,
        genderModality: args.genderModality,
        orientation: args.orientation,
        t4tPreference,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert('profiles', {
      userId: user._id,
      pronouns: args.pronouns,
      genderIdentity: trimmedIdentity,
      genderModality: args.genderModality,
      orientation: args.orientation,
      t4tPreference,
      intentions: [],
      isVisible: false,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const upsertIntentions = mutation({
  args: {
    intentions: v.array(INTENTION),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    if (args.intentions.length === 0) throw new Error('Pick at least one intention');
    if (args.intentions.length > 3) throw new Error('Pick up to three intentions');

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();
    if (!user) throw new Error('User not found');

    const profile = await ctx.db
      .query('profiles')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .unique();
    if (!profile) throw new Error('Complete identity step first');

    const now = Date.now();
    await ctx.db.patch(profile._id, { intentions: args.intentions, updatedAt: now });
    await ctx.db.patch(user._id, { lastActiveAt: now });
    return profile._id;
  },
});

export const acceptPledge = mutation({
  args: {
    pledgeType: PLEDGE_TYPE,
    pledgeVersion: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();
    if (!user) throw new Error('User not found');

    // Pledge branch must match modality: cis users take extended; everyone else takes standard.
    const requiredType: 'standard' | 'extended' = user.isCis === true ? 'extended' : 'standard';
    if (args.pledgeType !== requiredType) {
      throw new Error(`Expected ${requiredType} pledge for this user`);
    }

    const profile = await ctx.db
      .query('profiles')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .unique();
    if (!profile) throw new Error('Complete identity step first');

    const now = Date.now();
    await ctx.db.patch(profile._id, {
      pledgeAcceptedAt: now,
      pledgeVersion: args.pledgeVersion,
      pledgeType: args.pledgeType,
      updatedAt: now,
    });

    await ctx.db.patch(user._id, {
      respectPledgeCompletedAt: now,
      extendedPledgeCompletedAt: args.pledgeType === 'extended' ? now : user.extendedPledgeCompletedAt,
      onboardingComplete: true,
      lastActiveAt: now,
    });

    return profile._id;
  },
});
