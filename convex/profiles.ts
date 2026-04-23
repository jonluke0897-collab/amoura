import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import type { Doc } from './_generated/dataModel';
import { GENDER_MODALITY, INTENTION, PLEDGE_TYPE, T4T_PREFERENCE } from './validators';

type OnboardingStep =
  | 'identity'
  | 'intentions'
  | 'pledge'
  | 'photos'
  | 'prompts'
  | 'complete';

const MIN_PHOTOS_FOR_COMPLETE = 2;

function nextStep(
  user: Doc<'users'>,
  profile: Doc<'profiles'> | null,
  counts: { photoCount: number; promptAnswerCount: number },
): OnboardingStep {
  if (!profile) return 'identity';
  if (!profile.genderIdentity || profile.genderIdentity.trim() === '') return 'identity';
  if (profile.pronouns.length === 0) return 'identity';
  if (profile.orientation.length === 0) return 'identity';
  if (profile.intentions.length === 0) return 'intentions';
  if (!profile.pledgeAcceptedAt) return 'pledge';
  if (!user.respectPledgeCompletedAt) return 'pledge';
  // Cis users additionally require the extended-pledge timestamp. Mirrors the
  // two-field write in acceptPledge; defends against stale rows where only the
  // base timestamp was set (e.g. migrations from an older schema).
  if (user.isCis === true && !user.extendedPledgeCompletedAt) return 'pledge';
  if (counts.photoCount < MIN_PHOTOS_FOR_COMPLETE) return 'photos';
  // Prompts are optional in onboarding: the user sees the prompts step once
  // (photos.tsx → prompts.tsx) but can skip it and still complete. We don't
  // re-route them there on subsequent launches even if promptAnswerCount < 3;
  // the profile-tab nudge handles encouragement post-onboarding.
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

    // Small result sets (max 6 photos, max 3 prompts) so .collect() stays cheap.
    const photoCount = profile
      ? (
          await ctx.db
            .query('photos')
            .withIndex('by_profile', (q) => q.eq('profileId', profile._id))
            .collect()
        ).length
      : 0;
    const promptAnswerCount = profile
      ? (
          await ctx.db
            .query('profilePrompts')
            .withIndex('by_profile', (q) => q.eq('profileId', profile._id))
            .collect()
        ).length
      : 0;

    return {
      step: nextStep(user, profile, { photoCount, promptAnswerCount }),
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
    // Optional at the API boundary so clients that omit it (e.g. cis users whose
    // UI hides the picker) don't hit validation errors. Handler defaults to "open"
    // and then re-coerces for cis users below.
    t4tPreference: v.optional(T4T_PREFERENCE),
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
    // Clients that omit the field entirely also default to "open".
    const t4tPreference = args.genderModality === 'cis' ? 'open' : (args.t4tPreference ?? 'open');

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
    // Server-enforced step order: the UI routes identity → intentions → pledge,
    // but a direct API call could skip intentions and jump here. Block that so
    // onboardingComplete can't be set with no intentions stored.
    if (profile.intentions.length === 0) throw new Error('Complete intentions step first');

    const now = Date.now();
    await ctx.db.patch(profile._id, {
      pledgeAcceptedAt: now,
      pledgeVersion: args.pledgeVersion,
      pledgeType: args.pledgeType,
      updatedAt: now,
    });

    // onboardingComplete is intentionally NOT set here. Prompts are optional,
    // so the boolean flips in profiles.markOnboardingComplete (called from
    // complete.tsx on mount and as a migration fallback from the profile
    // tab) once the user has the minimum photos in place. Pledge acceptance
    // is a necessary step toward completion, not sufficient.
    await ctx.db.patch(user._id, {
      respectPledgeCompletedAt: now,
      extendedPledgeCompletedAt: args.pledgeType === 'extended' ? now : user.extendedPledgeCompletedAt,
      lastActiveAt: now,
    });

    return profile._id;
  },
});

/**
 * Idempotently flip users.onboardingComplete to true. Called from
 * complete.tsx and as a migration fallback from the profile tab. The gate on
 * photoCount >= 2 keeps a misrouted caller from prematurely completing a user
 * who doesn't actually have a shippable profile yet. Prompts are optional;
 * they are not part of this gate.
 */
export const markOnboardingComplete = mutation({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();
    if (!user) throw new Error('User not found');
    if (user.onboardingComplete) return;

    const profile = await ctx.db
      .query('profiles')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .unique();
    if (!profile) return;

    // Mirror the full nextStep() prerequisite chain so a direct / misrouted
    // caller can't skip pledge+identity+intentions just because photos are in
    // place. Any one of these gates missing means the user isn't actually
    // ready to flip; silently no-op (client will retry when state catches up).
    if (!profile.genderIdentity || profile.genderIdentity.trim() === '') return;
    if (profile.pronouns.length === 0) return;
    if (profile.orientation.length === 0) return;
    if (profile.intentions.length === 0) return;
    if (!profile.pledgeAcceptedAt) return;
    if (!user.respectPledgeCompletedAt) return;
    if (user.isCis === true && !user.extendedPledgeCompletedAt) return;

    const photoCount = (
      await ctx.db
        .query('photos')
        .withIndex('by_profile', (q) => q.eq('profileId', profile._id))
        .collect()
    ).length;
    if (photoCount < MIN_PHOTOS_FOR_COMPLETE) return;

    await ctx.db.patch(user._id, {
      onboardingComplete: true,
      lastActiveAt: Date.now(),
    });
  },
});

/**
 * Public profile view returned when viewing another user (Phase 4 browse /
 * profile detail). Field-level privacy is enforced here — the return shape is
 * the allow-list, and the test in the Phase 2 PR asserts no private fields
 * leak. Self-view bypasses the isVisible gate so a user can preview how their
 * own profile looks before Phase 3 flips visibility on.
 */
export const getPublic = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    const viewer = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();
    if (!viewer) return null;

    const target = await ctx.db.get(args.userId);
    if (!target) return null;
    if (target.accountStatus !== 'active') return null;

    const profile = await ctx.db
      .query('profiles')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .unique();
    if (!profile) return null;

    const isSelf = viewer._id === target._id;
    if (!profile.isVisible && !isSelf) return null;

    const photoDocs = await ctx.db
      .query('photos')
      .withIndex('by_profile_position', (q) => q.eq('profileId', profile._id))
      .collect();
    photoDocs.sort((a, b) => a.position - b.position);
    const photos = await Promise.all(
      photoDocs.map(async (p) => ({
        _id: p._id,
        url: await ctx.storage.getUrl(p.storageId),
        position: p.position,
        width: p.width,
        height: p.height,
        isVerified: p.isVerified,
      })),
    );

    const answerDocs = await ctx.db
      .query('profilePrompts')
      .withIndex('by_profile_position', (q) => q.eq('profileId', profile._id))
      .collect();
    answerDocs.sort((a, b) => a.position - b.position);
    const prompts = [];
    for (const a of answerDocs) {
      const prompt = await ctx.db.get(a.promptId);
      prompts.push({
        _id: a._id,
        question: prompt?.question ?? '',
        category: prompt?.category ?? '',
        answerText: a.answerText ?? '',
        position: a.position,
      });
    }

    // Explicit allow-list return. Every field here is a deliberate choice; do
    // not spread profile/target. Private fields that MUST NOT appear:
    //   email, phoneNumber, dateOfBirth, orientation, t4tPreference, bio,
    //   pledgeAcceptedAt / pledgeVersion / pledgeType, isCis,
    //   respectPledgeCompletedAt, extendedPledgeCompletedAt.
    return {
      userId: target._id,
      displayName: target.displayName,
      // Phase 2 stub: dateOfBirth isn't collected during onboarding yet
      // (Phase 3 gap). UI hides the age pip when null.
      age: null as number | null,
      pronouns: profile.pronouns,
      identityLabel: profile.genderIdentity || 'person',
      intentions: profile.intentions,
      city: profile.city ?? null,
      photos,
      prompts,
    };
  },
});
