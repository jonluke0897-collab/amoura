import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import type { Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';

const MAX_ANSWER_LENGTH = 250;
const VALID_POSITIONS = new Set([0, 1, 2]);

async function requireUserAndProfile(ctx: MutationCtx | QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('Not authenticated');
  const user = await ctx.db
    .query('users')
    .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
    .unique();
  if (!user) throw new Error('User not found — account sync in progress');
  const profile = await ctx.db
    .query('profiles')
    .withIndex('by_user', (q) => q.eq('userId', user._id))
    .unique();
  if (!profile) throw new Error('Complete identity step first');
  return { user, profile };
}

export const listActive = query({
  handler: async (ctx) => {
    const rows = await ctx.db
      .query('prompts')
      .withIndex('by_active', (q) => q.eq('isActive', true))
      .collect();
    rows.sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return a.question.localeCompare(b.question);
    });
    return rows.map((p) => ({
      _id: p._id,
      question: p.question,
      category: p.category,
    }));
  },
});

export const listMine = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();
    if (!user) return [];
    const profile = await ctx.db
      .query('profiles')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .unique();
    if (!profile) return [];

    const answers = await ctx.db
      .query('profilePrompts')
      .withIndex('by_profile_position', (q) => q.eq('profileId', profile._id))
      .collect();
    answers.sort((a, b) => a.position - b.position);

    const results = [];
    for (const a of answers) {
      const prompt = await ctx.db.get(a.promptId);
      results.push({
        _id: a._id,
        promptId: a.promptId,
        question: prompt?.question ?? '',
        category: prompt?.category ?? '',
        answerType: a.answerType,
        answerText: a.answerText ?? '',
        position: a.position,
      });
    }
    return results;
  },
});

export const answerPrompt = mutation({
  args: {
    promptId: v.id('prompts'),
    answerText: v.string(),
    position: v.number(),
  },
  handler: async (ctx, args) => {
    const { user, profile } = await requireUserAndProfile(ctx);

    if (!VALID_POSITIONS.has(args.position)) {
      throw new Error('Position must be 0, 1, or 2');
    }
    const trimmed = args.answerText.trim();
    if (trimmed.length === 0) throw new Error('Answer cannot be empty');
    if (trimmed.length > MAX_ANSWER_LENGTH) {
      throw new Error(`Answer must be ${MAX_ANSWER_LENGTH} characters or fewer`);
    }

    const prompt = await ctx.db.get(args.promptId);
    if (!prompt) throw new Error('Prompt not found');
    if (!prompt.isActive) throw new Error('Prompt is no longer active');

    const existing = await ctx.db
      .query('profilePrompts')
      .withIndex('by_profile_position', (q) => q.eq('profileId', profile._id))
      .collect();

    // Reject answering the same prompt twice unless we're editing the row
    // already occupying the target position.
    const slotRow = existing.find((r) => r.position === args.position);
    const dupe = existing.find((r) => r.promptId === args.promptId && r._id !== slotRow?._id);
    if (dupe) throw new Error("You've already answered this prompt");

    const now = Date.now();
    let savedId: Id<'profilePrompts'>;
    if (slotRow) {
      await ctx.db.patch(slotRow._id, {
        promptId: args.promptId,
        answerType: 'text',
        answerText: trimmed,
      });
      savedId = slotRow._id;
    } else {
      savedId = await ctx.db.insert('profilePrompts', {
        profileId: profile._id,
        userId: user._id,
        promptId: args.promptId,
        answerType: 'text',
        answerText: trimmed,
        position: args.position,
        createdAt: now,
      });
    }

    // Prompts are optional in onboarding — answering the third prompt no
    // longer flips onboardingComplete. That bit is now owned by
    // profiles.markOnboardingComplete (fired from complete.tsx and as a
    // migration fallback from the profile tab).
    await ctx.db.patch(user._id, { lastActiveAt: now });

    return savedId;
  },
});

export const removePrompt = mutation({
  args: { profilePromptId: v.id('profilePrompts') },
  handler: async (ctx, args) => {
    const { user, profile } = await requireUserAndProfile(ctx);
    const row = await ctx.db.get(args.profilePromptId);
    if (!row) throw new Error('Answer not found');
    if (row.userId !== user._id) throw new Error('Not your answer');
    // Defense in depth: a user could conceivably have multiple profiles in a
    // future design; pin ownership to the current profile too.
    if (row.profileId !== profile._id) throw new Error('Not your answer');

    await ctx.db.delete(row._id);

    // Close gaps so positions remain 0..N-1 contiguous.
    const remaining = await ctx.db
      .query('profilePrompts')
      .withIndex('by_profile_position', (q) => q.eq('profileId', profile._id))
      .collect();
    remaining.sort((a, b) => a.position - b.position);
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].position !== i) {
        await ctx.db.patch(remaining[i]._id, { position: i });
      }
    }

    await ctx.db.patch(user._id, { lastActiveAt: Date.now() });
  },
});
