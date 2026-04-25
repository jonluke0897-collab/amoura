/**
 * Verifications — TASK-060 / TASK-061 backend (V8 runtime).
 *
 * Mutations + queries the client and the verification actions invoke. The
 * actions themselves (Persona inquiry creation, Rekognition Lambda call)
 * live in `convex/verificationActions.ts` because they need the Node
 * runtime for HTTP calls; this file holds the DB-only operations and the
 * internal mutations the actions delegate to.
 *
 * The verifications table (`convex/schema.ts`) stores one row per
 * (userId, type, attempt). On approval for type='photo' we also flip the
 * denormalized `photos.isVerified` cache so the existing
 * VerificationBadge keeps reading from photos without joining
 * verifications on every render.
 */
import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server';
import { requireUserAndProfile } from './lib/currentUser';

const ID_VERIFY_REQUIRED_AFTER_DISMISSALS = 2;

/**
 * Issue a Convex storage upload URL for the selfie capture. Selfies are
 * NOT counted against the 6-photo profile cap and don't go through the
 * photos table — they're scoped storage blobs the Rekognition action
 * passes to AWS, then deletes afterwards. We deliberately don't reuse
 * `photos.generateUploadUrl` because the lifecycle is different.
 */
export const generateSelfieUploadUrl = mutation({
  handler: async (ctx) => {
    await requireUserAndProfile(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

type VerificationStatus =
  | 'pending'
  | 'approved'
  | 'rejected';

type StatusResult = {
  photo: VerificationStatus | null;
  photoRejectedReason: string | null;
  photoLatestAt: number | null;
  id: VerificationStatus | null;
  idRejectedReason: string | null;
  // createdAt of the latest verifications row of each type. The client uses
  // these as a per-attempt marker — `id` alone can't distinguish a fresh
  // rejection from the previous-attempt's stale rejection (both render as
  // 'rejected'), so the IDVerification awaitingWebhook watcher tracks a
  // change in idLatestAt to know when a new resolution row has landed.
  idLatestAt: number | null;
  // UX state for the dismiss-twice-then-required gate (TASK-060).
  idVerifyDismissCount: number;
  idVerifyRequiredAt: number | null;
};

/**
 * Latest verification status per type for the calling user, plus the
 * UX state that drives the ID-verify gate. The UI reads this once on
 * mount of any verification surface and on the SafetyCenter rows.
 *
 * "Latest" is by createdAt desc — multiple verification attempts may
 * exist (a rejected attempt followed by an approved retry), and the
 * client always shows the most recent state. The by_user_type index
 * already orders by _creationTime within the partition.
 */
export const status = query({
  handler: async (ctx): Promise<StatusResult> => {
    const { user } = await requireUserAndProfile(ctx);
    const all = await ctx.db
      .query('verifications')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .order('desc')
      .collect();
    // Group by type, pick the first (newest by desc order). A user with
    // a rejected then approved photo attempt sees `approved` here.
    type Slot = {
      status: VerificationStatus;
      rejectedReason: string | null;
      createdAt: number;
    };
    let photo: Slot | null = null;
    let id: Slot | null = null;
    for (const row of all) {
      if (row.type === 'photo' && !photo) {
        photo = {
          status: row.status,
          rejectedReason: row.rejectedReason ?? null,
          createdAt: row.createdAt,
        };
      } else if (row.type === 'id' && !id) {
        id = {
          status: row.status,
          rejectedReason: row.rejectedReason ?? null,
          createdAt: row.createdAt,
        };
      }
      if (photo && id) break;
    }
    return {
      photo: photo?.status ?? null,
      photoRejectedReason: photo?.rejectedReason ?? null,
      photoLatestAt: photo?.createdAt ?? null,
      id: id?.status ?? null,
      idRejectedReason: id?.rejectedReason ?? null,
      idLatestAt: id?.createdAt ?? null,
      idVerifyDismissCount: user.idVerifyDismissCount ?? 0,
      idVerifyRequiredAt: user.idVerifyRequiredAt ?? null,
    };
  },
});

/**
 * Record a dismissal of the ID-verify prompt. The first two dismissals
 * are free; the third sets `idVerifyRequiredAt` so the next sign-in
 * can't dismiss the modal until verification completes (per TASK-060
 * "dismissible twice then required on 3rd open"). The threshold lives
 * on the user row so it survives re-installs and clearing local app
 * state — the gate has to be sticky for cis users hoping to skip
 * verification by reinstalling.
 */
export const recordIdDismiss = mutation({
  handler: async (ctx) => {
    const { user } = await requireUserAndProfile(ctx);
    const next = (user.idVerifyDismissCount ?? 0) + 1;
    const patch: { idVerifyDismissCount: number; idVerifyRequiredAt?: number } = {
      idVerifyDismissCount: next,
    };
    // Plan: "dismissible twice then required on 3rd open". After the 2nd
    // dismissal (next === 2), set idVerifyRequiredAt so the 3rd time the
    // user lands on the verify-id screen the Cancel button is hidden.
    // `>=` not `>`: the previous `>` would have given the user 3 free
    // dismissals before lockout (4th open required), which is one more
    // than the spec.
    if (next >= ID_VERIFY_REQUIRED_AFTER_DISMISSALS) {
      patch.idVerifyRequiredAt = Date.now();
    }
    await ctx.db.patch(user._id, patch);
    return {
      dismissCount: next,
      isRequired: next >= ID_VERIFY_REQUIRED_AFTER_DISMISSALS,
    };
  },
});

/**
 * Internal mutation called by the Persona webhook (HTTP route in
 * convex/http.ts) when an inquiry transitions to a terminal state.
 * Inserts a new verifications row keyed on (userId, type='id',
 * providerInquiryId). Each Persona inquiry is a separate attempt for
 * audit purposes; the `status` query always returns the most recent.
 *
 * **Idempotent on (userId, type='id', providerInquiryId)** — Persona
 * retries webhooks on transient failures (5xx responses, network
 * timeouts), and we acknowledge resolved inquiries with 200 even when
 * the action runs in a follow-up retry. Without the guard, a single
 * inquiry that retried twice would land three duplicate rows in the
 * verifications table and pollute the status query's "latest"
 * resolution.
 */
export const applyPersonaResult = internalMutation({
  args: {
    userId: v.id('users'),
    inquiryId: v.string(),
    status: v.union(v.literal('approved'), v.literal('rejected')),
    rejectedReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error('User not found');

    const existing = await ctx.db
      .query('verifications')
      .withIndex('by_user_type', (q) =>
        q.eq('userId', args.userId).eq('type', 'id'),
      )
      .filter((q) => q.eq(q.field('providerInquiryId'), args.inquiryId))
      .first();
    if (existing) {
      // Webhook retry on the same inquiry — already recorded, nothing to do.
      return;
    }

    const now = Date.now();
    await ctx.db.insert('verifications', {
      userId: args.userId,
      type: 'id',
      status: args.status,
      provider: 'persona',
      providerInquiryId: args.inquiryId,
      rejectedReason: args.rejectedReason,
      verifiedAt: args.status === 'approved' ? now : undefined,
      createdAt: now,
    });
    // Persona's identity check passing isn't itself enough to clear the
    // dismiss-required gate, but it does mean the user is no longer the
    // target of the gate — clearing idVerifyRequiredAt unblocks any UI
    // surface that's waiting on it.
    if (args.status === 'approved' && target.idVerifyRequiredAt !== undefined) {
      await ctx.db.patch(args.userId, { idVerifyRequiredAt: undefined });
    }
  },
});

/**
 * Internal mutation called by `verificationActions.startPhoto` after
 * Rekognition returns. Writes the verifications row AND patches the
 * denormalized `photos.isVerified` cache so VerificationBadge picks
 * up the change without a separate query. Only patches the photo when
 * status='approved' — a rejected attempt doesn't taint the existing
 * cache value (which was already false until this point).
 */
export const applyPhotoVerification = internalMutation({
  args: {
    userId: v.id('users'),
    profilePhotoId: v.id('photos'),
    status: v.union(v.literal('approved'), v.literal('rejected')),
    similarity: v.optional(v.number()),
    rejectedReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.insert('verifications', {
      userId: args.userId,
      type: 'photo',
      status: args.status,
      provider: 'internal-selfie',
      rejectedReason: args.rejectedReason,
      verifiedAt: args.status === 'approved' ? now : undefined,
      createdAt: now,
    });
    if (args.status === 'approved') {
      // Patch the specific photo that was used as the reference. If the
      // user later adds new photos, those default to isVerified=false
      // and stay that way until they re-verify — that's intentional, not
      // a bug. A future "auto-roll-forward verification on re-upload" is
      // a Phase 7 nicety.
      await ctx.db.patch(args.profilePhotoId, { isVerified: true });
    }
  },
});

/**
 * Internal query for the Rekognition action: resolves the calling user's
 * id, their first profile photo's id, and a signed URL for that photo
 * so the Lambda can fetch it. Lives here (not in the actions file)
 * because Convex actions can't run queries directly — they must call
 * out via ctx.runQuery to a V8-runtime function.
 */
export const getReferencePhoto = internalQuery({
  handler: async (
    ctx,
  ): Promise<{
    userId: Id<'users'>;
    profilePhotoId: Id<'photos'>;
    profilePhotoUrl: string;
  } | null> => {
    const { user, profile } = await requireUserAndProfile(ctx);
    const photo = await ctx.db
      .query('photos')
      .withIndex('by_profile_position', (q) => q.eq('profileId', profile._id))
      .order('asc')
      .first();
    if (!photo) return null;
    const url = await ctx.storage.getUrl(photo.storageId);
    if (!url) return null;
    return {
      userId: user._id,
      profilePhotoId: photo._id,
      profilePhotoUrl: url,
    };
  },
});

/**
 * Internal query for the Persona webhook action: resolves a Clerk
 * subject id back to the Convex users._id. Persona doesn't know about
 * Convex, so we pass the clerkId in as the inquiry's referenceId; this
 * is the reverse lookup.
 */
export const getUserIdByClerkId = internalQuery({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();
    return user?._id ?? null;
  },
});
