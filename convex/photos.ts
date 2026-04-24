import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { requireUserAndProfile } from './lib/currentUser';

const MAX_PHOTOS = 6;

async function countPhotos(
  ctx: MutationCtx | QueryCtx,
  profileId: Id<'profiles'>,
): Promise<number> {
  const rows = await ctx.db
    .query('photos')
    .withIndex('by_profile', (q) => q.eq('profileId', profileId))
    .collect();
  return rows.length;
}

export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    const { profile } = await requireUserAndProfile(ctx);
    // Gate URL issuance on current count so a maxed-out account can't waste
    // signed URLs. finalizeUpload re-checks to cover a concurrent race where
    // two devices grab URLs simultaneously.
    if ((await countPhotos(ctx, profile._id)) >= MAX_PHOTOS) {
      throw new Error(`Maximum ${MAX_PHOTOS} photos per profile`);
    }
    return await ctx.storage.generateUploadUrl();
  },
});

export const finalizeUpload = mutation({
  args: {
    storageId: v.id('_storage'),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // By the time finalizeUpload is called, the client has already POSTed the
    // bytes, so ctx.storage holds a blob for args.storageId. Any throw from
    // here onwards leaks that blob unless we compensate. Wrap the body in a
    // try/catch that deletes the blob on any failure before rethrowing, so
    // the only surviving orphan case is "client never called finalizeUpload"
    // (app killed mid-upload) — that's the documented Phase 7 cleanup-cron
    // territory. Doing this server-side keeps the orphan-delete capability
    // out of client hands; exposing a callable cleanup mutation would be a
    // DoS surface because storageIds leak in photo URLs.
    try {
      // Dimensions come from client-side manipulator output; bad values (<=0
      // or non-integer) would poison layout calculations in the carousel.
      if (args.width !== undefined && (args.width <= 0 || !Number.isFinite(args.width))) {
        throw new Error('width must be a positive number');
      }
      if (args.height !== undefined && (args.height <= 0 || !Number.isFinite(args.height))) {
        throw new Error('height must be a positive number');
      }

      const { user, profile } = await requireUserAndProfile(ctx);
      const existing = await ctx.db
        .query('photos')
        .withIndex('by_profile_position', (q) => q.eq('profileId', profile._id))
        .collect();
      if (existing.length >= MAX_PHOTOS) {
        throw new Error(`Maximum ${MAX_PHOTOS} photos per profile`);
      }
      // existing.length is always the right next position because remove()
      // repacks gaps and reorder() is a bijection on [0..N-1]. Using Math.max
      // + 1 would strand holes if we ever hit a non-contiguous state.
      const nextPosition = existing.length;
      const now = Date.now();
      const photoId = await ctx.db.insert('photos', {
        profileId: profile._id,
        userId: user._id,
        storageId: args.storageId,
        position: nextPosition,
        isVerified: false,
        width: args.width,
        height: args.height,
        createdAt: now,
      });
      await ctx.db.patch(user._id, { lastActiveAt: now });
      return photoId;
    } catch (err) {
      // Best-effort blob cleanup. Swallow cleanup errors so the original
      // error surfaces to the client; the Phase 7 cron will catch any
      // stragglers.
      try {
        await ctx.storage.delete(args.storageId);
      } catch {
        // intentionally silent
      }
      throw err;
    }
  },
});

export const remove = mutation({
  args: { photoId: v.id('photos') },
  handler: async (ctx, args) => {
    const { user, profile } = await requireUserAndProfile(ctx);
    const photo = await ctx.db.get(args.photoId);
    if (!photo) throw new Error('Photo not found');
    if (photo.userId !== user._id) throw new Error('Not your photo');

    await ctx.storage.delete(photo.storageId);
    await ctx.db.delete(photo._id);

    // Close the gap so positions remain contiguous 0..N-1. Preserves the
    // invariant that other code (carousel, interleave) relies on.
    const remaining = await ctx.db
      .query('photos')
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

export const reorder = mutation({
  args: { photoIds: v.array(v.id('photos')) },
  handler: async (ctx, args) => {
    const { user, profile } = await requireUserAndProfile(ctx);
    const current = await ctx.db
      .query('photos')
      .withIndex('by_profile', (q) => q.eq('profileId', profile._id))
      .collect();
    if (current.length !== args.photoIds.length) {
      throw new Error('Reorder list length does not match current photo count');
    }
    const ownedIds = new Set(current.map((p) => p._id));
    const seen = new Set<Id<'photos'>>();
    for (const id of args.photoIds) {
      if (!ownedIds.has(id)) throw new Error('Not your photo');
      // Reject duplicate ids so the new positions remain a bijection onto
      // [0..N-1]. Without this a payload like [a, a, b] would silently patch
      // one photo twice and leave another unassigned, breaking the
      // contiguous-position invariant the rest of the app depends on.
      if (seen.has(id)) throw new Error('Duplicate photo id in reorder list');
      seen.add(id);
    }
    for (let i = 0; i < args.photoIds.length; i++) {
      await ctx.db.patch(args.photoIds[i], { position: i });
    }
    await ctx.db.patch(user._id, { lastActiveAt: Date.now() });
  },
});

type PhotoView = {
  _id: Id<'photos'>;
  url: string | null;
  position: number;
  width?: number;
  height?: number;
  isVerified: boolean;
};

async function toView(ctx: QueryCtx, photo: Doc<'photos'>): Promise<PhotoView> {
  return {
    _id: photo._id,
    url: await ctx.storage.getUrl(photo.storageId),
    position: photo.position,
    width: photo.width,
    height: photo.height,
    isVerified: photo.isVerified,
  };
}

export const listMine = query({
  handler: async (ctx): Promise<PhotoView[]> => {
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

    const rows = await ctx.db
      .query('photos')
      .withIndex('by_profile_position', (q) => q.eq('profileId', profile._id))
      .collect();
    rows.sort((a, b) => a.position - b.position);
    return Promise.all(rows.map((p) => toView(ctx, p)));
  },
});

// listForProfile was drafted for external use but has no callers —
// profiles.getPublic inlines its own photo fetch and applies isVisible +
// accountStatus gating there. Shipping an ungated public query would leak
// photos for hidden or suspended profiles, so the query is intentionally
// omitted. Phase 4 (browse feed) can reintroduce a gated variant if needed.
