import { v } from 'convex/values';
import { paginationOptsValidator } from 'convex/server';
import { mutation, query } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { GENDER_MODALITY, INTENTION, PLEDGE_TYPE, T4T_PREFERENCE } from './validators';
import { requireUserAndProfile } from './lib/currentUser';
import { canonicalizeCity } from './lib/canonicalizeCity';

type OnboardingStep =
  | 'identity'
  | 'intentions'
  | 'pledge'
  | 'photos'
  | 'prompts'
  | 'complete';

const MIN_PHOTOS_FOR_COMPLETE = 2;

// Preference bounds, aligned with the TASK-041 FilterSheet slider ranges
// (18–70 age, 5–100 km distance). Keeping server and client bounds identical
// avoids a rehydrate-clamp-overwrite data-loss path: if the server allowed
// wider values than the client sliders, opening the sheet would clamp the
// saved value down and Apply would silently narrow it.
const MIN_AGE = 18;
const MAX_AGE = 70;
const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

const MIN_DISTANCE_KM = 5;
const MAX_DISTANCE_KM = 100;

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
    if (args.intentions.length === 0) throw new Error('Pick at least one intention');
    if (args.intentions.length > 3) throw new Error('Pick up to three intentions');

    const { user, profile } = await requireUserAndProfile(ctx);

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
    const { user, profile } = await requireUserAndProfile(ctx);

    // Pledge branch must match modality: cis users take extended; everyone else takes standard.
    const requiredType: 'standard' | 'extended' = user.isCis === true ? 'extended' : 'standard';
    if (args.pledgeType !== requiredType) {
      throw new Error(`Expected ${requiredType} pledge for this user`);
    }

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
 * Idempotently flip users.onboardingComplete AND profiles.isVisible to true.
 * Called from complete.tsx and as a migration fallback from the profile tab.
 * The gate on photoCount >= 2 keeps a misrouted caller from prematurely
 * completing a user who doesn't actually have a shippable profile yet.
 * Prompts are optional; they are not part of this gate.
 *
 * Phase 3 additionally flips isVisible so newly-minted profiles show up in
 * the browse feed. Legacy accounts that completed onboarding before Phase 3
 * (isVisible still false) get patched on next call because the early-return
 * now requires both flags to already be set.
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

    const profile = await ctx.db
      .query('profiles')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .unique();
    if (!profile) return;

    // Fast path: fully provisioned. Avoids the prerequisite scan + photo count
    // on every subsequent launch.
    if (user.onboardingComplete && profile.isVisible) return;

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

    const now = Date.now();
    if (!user.onboardingComplete) {
      await ctx.db.patch(user._id, {
        onboardingComplete: true,
        lastActiveAt: now,
      });
    }
    if (!profile.isVisible) {
      await ctx.db.patch(profile._id, {
        isVisible: true,
        updatedAt: now,
      });
    }
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
      // Skip answers whose prompt has been deactivated/deleted upstream —
      // showing an empty question+category pill on someone else's profile
      // leaks the fact that their prompt got retired and looks broken. The
      // onboarding editor has its own fallback (cached question on the row)
      // so users can still edit/remove their side.
      if (!prompt) continue;
      prompts.push({
        _id: a._id,
        question: prompt.question,
        category: prompt.category,
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
      age: computeAge(target.dateOfBirth),
      pronouns: profile.pronouns,
      identityLabel: profile.genderIdentity || 'person',
      intentions: profile.intentions,
      city: profile.city ?? null,
      photos,
      prompts,
    };
  },
});

/**
 * Viewer's own browse preferences. Used by the Browse tab to gate on city
 * presence (TASK-042 routes to the city picker when city is null) and by the
 * FilterSheet (TASK-041) to hydrate initial slider values. Separate from
 * getMineStatus because that endpoint is for onboarding gating and returns
 * the full user+profile state; this one is intentionally narrow.
 */
export const getMinePreferences = query({
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
    if (!profile) return null;

    return {
      city: profile.city ?? null,
      ageMin: profile.ageMin ?? null,
      ageMax: profile.ageMax ?? null,
      maxDistanceKm: profile.maxDistanceKm ?? null,
      intentions: profile.intentions,
      t4tPreference: profile.t4tPreference,
      genderModality: profile.genderModality,
    };
  },
});

/**
 * Phase 3 browse feed. Paginated list of visible profiles in the viewer's
 * city, with preference-aware filtering. Design notes in the phase plan:
 *
 * - City match is the geographic scope. Distance is not filtered server-side
 *   until lat/lng collection lands (Phase 5/7 follow-up).
 * - T4T ranking is deferred: t4t-only hard-filters cis; t4t-preferred and
 *   open behave the same. Revisit with real usage signal.
 * - Post-filtering happens in-memory over each ≤N-doc page, so the delivered
 *   page may be shorter than the requested `numItems`. Callers must continue
 *   paginating until `isDone`.
 * - `verifiedOnly` is accepted but ignored in Phase 3; Phase 5 TASK-062
 *   wires it to the verifications table.
 */
export const listFeed = query({
  args: {
    paginationOpts: paginationOptsValidator,
    filters: v.optional(
      v.object({
        t4tOnly: v.optional(v.boolean()),
        intentions: v.optional(v.array(INTENTION)),
        ageMin: v.optional(v.number()),
        ageMax: v.optional(v.number()),
        verifiedOnly: v.optional(v.boolean()),
      }),
    ),
    // Cache-bust nonce used by pull-to-refresh (TASK-039). Server ignores it;
    // bumping it from the client changes the args object identity so Convex's
    // usePaginatedQuery resets to page 1 with a fresh subscription.
    refreshKey: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { user: viewer, profile: viewerProfile } = await requireUserAndProfile(ctx);
    const viewerCity = viewerProfile.city;

    // No city = no feed. Client routes to the city-picker flow (TASK-042).
    // Returning an empty page with isDone lets the UI treat this as a
    // "needs setup" state without trying to reload.
    if (!viewerCity) {
      return {
        page: [] as FeedItem[],
        isDone: true,
        continueCursor: '',
      };
    }

    const filters = args.filters ?? {};

    const t4tOnly =
      filters.t4tOnly ?? (viewerProfile.t4tPreference === 't4t-only');

    // Empty arrays collapse to "no filter" — otherwise deselecting all
    // intentions in the FilterSheet would silently zero out the feed.
    const intentionsFilterRaw = filters.intentions ?? viewerProfile.intentions;
    const intentionsFilter = intentionsFilterRaw.length > 0 ? intentionsFilterRaw : null;

    const ageMin = clampAge(filters.ageMin ?? viewerProfile.ageMin ?? MIN_AGE);
    const ageMax = clampAge(filters.ageMax ?? viewerProfile.ageMax ?? MAX_AGE);

    // Blocks both directions. Set keys are userId strings; Id<'users'> is a
    // branded string so conversion is implicit.
    const blockedIds = new Set<string>();
    const blockedByMe = await ctx.db
      .query('blocks')
      .withIndex('by_blocker', (q) => q.eq('blockerId', viewer._id))
      .collect();
    for (const b of blockedByMe) blockedIds.add(b.blockedUserId);
    const blockingMe = await ctx.db
      .query('blocks')
      .withIndex('by_blocked', (q) => q.eq('blockedUserId', viewer._id))
      .collect();
    for (const b of blockingMe) blockedIds.add(b.blockerId);

    // `by_visible_city` is `[isVisible, city]` plus the implicit _creationTime
    // suffix, so .order('desc') gives newest-first pagination without an
    // additional index. Self is excluded via filter — the index doesn't key
    // on userId so we can't eq() it out.
    const paged = await ctx.db
      .query('profiles')
      .withIndex('by_visible_city', (q) =>
        q.eq('isVisible', true).eq('city', viewerCity),
      )
      .order('desc')
      .filter((q) => q.neq(q.field('userId'), viewer._id))
      .paginate(args.paginationOpts);

    const now = Date.now();
    const page: FeedItem[] = [];
    for (const target of paged.page) {
      if (blockedIds.has(target.userId)) continue;
      if (t4tOnly && target.genderModality === 'cis') continue;
      if (
        intentionsFilter &&
        !target.intentions.some((i) => intentionsFilter.includes(i))
      ) {
        continue;
      }

      const targetUser = await ctx.db.get(target.userId);
      if (!targetUser) continue;
      if (targetUser.accountStatus !== 'active') continue;

      // Age filter is permissive: missing DOB passes through. Phase 2 didn't
      // collect DOB, so a strict filter would zero the feed for legacy users.
      const age = computeAge(targetUser.dateOfBirth, now);
      if (age !== null && (age < ageMin || age > ageMax)) continue;

      const firstPhoto = await ctx.db
        .query('photos')
        .withIndex('by_profile_position', (q) => q.eq('profileId', target._id))
        .order('asc')
        .first();
      const firstPhotoUrl = firstPhoto
        ? await ctx.storage.getUrl(firstPhoto.storageId)
        : null;

      const topAnswer = await ctx.db
        .query('profilePrompts')
        .withIndex('by_profile_position', (q) => q.eq('profileId', target._id))
        .order('asc')
        .first();
      let topPrompt: FeedItem['topPrompt'] = null;
      if (topAnswer) {
        const promptDoc = await ctx.db.get(topAnswer.promptId);
        if (promptDoc) {
          topPrompt = {
            question: promptDoc.question,
            answerText: topAnswer.answerText ?? '',
          };
        }
      }

      page.push({
        userId: target.userId,
        profileId: target._id,
        displayName: targetUser.displayName,
        age,
        pronouns: target.pronouns,
        city: target.city ?? null,
        identityLabel: target.genderIdentity || 'person',
        firstPhotoUrl,
        topPrompt,
      });
    }

    return {
      page,
      isDone: paged.isDone,
      continueCursor: paged.continueCursor,
    };
  },
});

type FeedItem = {
  userId: Id<'users'>;
  profileId: Id<'profiles'>;
  displayName: string;
  age: number | null;
  pronouns: string[];
  city: string | null;
  identityLabel: string;
  firstPhotoUrl: string | null;
  topPrompt: { question: string; answerText: string } | null;
};

/**
 * Write-through for Phase 3 browse preferences. Used by the FilterSheet
 * (TASK-041) and the city-picker / location hook (TASK-042). All args are
 * optional; unspecified fields are left untouched so callers can update a
 * single slider without clobbering the rest.
 */
export const updatePreferences = mutation({
  args: {
    city: v.optional(v.string()),
    ageMin: v.optional(v.number()),
    ageMax: v.optional(v.number()),
    maxDistanceKm: v.optional(v.number()),
    intentions: v.optional(v.array(INTENTION)),
    t4tPreference: v.optional(T4T_PREFERENCE),
  },
  handler: async (ctx, args) => {
    const { user, profile } = await requireUserAndProfile(ctx);

    const patch: Partial<Doc<'profiles'>> = {};

    if (args.city !== undefined) {
      // Canonicalize, not just trim. listFeed gates on exact-match city via
      // `by_visible_city`, so "Brooklyn", "brooklyn", and " Brooklyn " would
      // otherwise sit in separate buckets. The client hook
      // (useLocationCity) already normalizes before calling, but we repeat
      // it here so any other write path — Clerk admin, a future migration,
      // a direct Convex dashboard edit — can't bypass the invariant.
      const normalized = canonicalizeCity(args.city);
      if (normalized.length === 0) throw new Error('City cannot be empty');
      patch.city = normalized;
    }

    if (args.ageMin !== undefined || args.ageMax !== undefined) {
      const nextMin = clampAge(args.ageMin ?? profile.ageMin ?? MIN_AGE);
      const nextMax = clampAge(args.ageMax ?? profile.ageMax ?? MAX_AGE);
      if (nextMin > nextMax) throw new Error('Minimum age must not exceed maximum age');
      if (args.ageMin !== undefined) patch.ageMin = nextMin;
      if (args.ageMax !== undefined) patch.ageMax = nextMax;
    }

    if (args.maxDistanceKm !== undefined) {
      if (
        !Number.isFinite(args.maxDistanceKm) ||
        args.maxDistanceKm < MIN_DISTANCE_KM ||
        args.maxDistanceKm > MAX_DISTANCE_KM
      ) {
        throw new Error(
          `Distance must be between ${MIN_DISTANCE_KM} and ${MAX_DISTANCE_KM} km`,
        );
      }
      patch.maxDistanceKm = args.maxDistanceKm;
    }

    if (args.intentions !== undefined) {
      if (args.intentions.length > 3) throw new Error('Pick up to three intentions');
      patch.intentions = args.intentions;
    }

    if (args.t4tPreference !== undefined) {
      // Same architectural rule as upsertIdentity: cis users cannot persist
      // t4t-only even if the FilterSheet sends it. Server-side coercion keeps
      // a buggy client from ever writing the invalid state.
      patch.t4tPreference =
        profile.genderModality === 'cis' ? 'open' : args.t4tPreference;
    }

    const now = Date.now();
    if (Object.keys(patch).length > 0) {
      patch.updatedAt = now;
      await ctx.db.patch(profile._id, patch);
    }
    await ctx.db.patch(user._id, { lastActiveAt: now });
    return profile._id;
  },
});

// Math.round (not floor) so the server matches the FilterSheet's rounding
// on slider drags. Drift between the two would let a stored fractional
// value rehydrate to one integer in the UI and filter against a different
// integer on the server.
function clampAge(value: number): number {
  if (!Number.isFinite(value)) return MIN_AGE;
  return Math.min(MAX_AGE, Math.max(MIN_AGE, Math.round(value)));
}

// Calendar-based age rather than (now - dob)/YEAR_MS. Dividing by a constant
// year length is off by one around birthdays (leap years, early vs late in
// the day) — a user could briefly show as 25 on their 26th birthday and get
// filtered out by a feed gate set to 26+.
function computeAge(dob: number | undefined, now: number = Date.now()): number | null {
  if (dob === undefined || !Number.isFinite(dob)) return null;
  const birth = new Date(dob);
  const current = new Date(now);
  let years = current.getUTCFullYear() - birth.getUTCFullYear();
  const birthdayPassedThisYear =
    current.getUTCMonth() > birth.getUTCMonth() ||
    (current.getUTCMonth() === birth.getUTCMonth() &&
      current.getUTCDate() >= birth.getUTCDate());
  if (!birthdayPassedThisYear) years -= 1;
  if (years < 0 || years > 150) return null;
  return years;
}
