/**
 * Single source of truth for like-comment length bounds. Imported by
 * the server validator (`convex/likes.ts`) AND the client modal
 * (`src/features/likes/LikeWithCommentModal.tsx` via the `~/convex`
 * alias) so the UX never lets the user submit something the server will
 * reject — and a future tightening of the bounds touches one constant,
 * not two.
 *
 * Per FR-014 the schema allows 2-500 chars; the 20-char floor in the
 * roadmap was overridden in the Phase 4 plan in favor of UX nudges.
 *
 * Lives in `convex/lib/` (rather than `src/lib/`) because Convex's
 * bundler only sees files inside `convex/`. The client can still import
 * from here via the `~/convex/lib/likeBounds` path alias.
 */
export const LIKE_COMMENT_MIN_CHARS = 2;
export const LIKE_COMMENT_MAX_CHARS = 500;
