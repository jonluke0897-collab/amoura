/**
 * Moderation keyword list — PLACEHOLDER.
 *
 * The real list lives at `convex/moderationKeywords.ts`, which is gitignored
 * (see .gitignore) so the slur/fetish-language inventory isn't searchable in
 * the public repo. Copy this file to `moderationKeywords.ts` and replace the
 * placeholders with the advisor-curated list before deploying Phase 5.
 *
 * Curation rules per the trans advisors retained for Phase 1's pledge review:
 * - Include obvious slurs and degrading fetish vocabulary.
 * - Do NOT include words that trans women routinely reclaim in self-
 *   description ("trans", "tranny" used between trans women in-community,
 *   etc). The detection layer's job is to surface to a moderator, not to
 *   block. False positives still get delivered (TASK-066) — but each one
 *   wastes moderator attention and erodes trust if reviewers see the same
 *   benign in-community phrases over and over.
 * - Match on word-boundary lowercase substrings; the runtime scan is case-
 *   insensitive and trims punctuation. Multi-word phrases are matched as
 *   contiguous word sequences.
 *
 * Do NOT auto-delete flagged messages. The product principle (vision § 1)
 * is that surface-and-review beats silent suppression, especially in a
 * trans-first context where reclaimed language is common.
 */

export const MODERATION_KEYWORDS: readonly string[] = [
  // Replace with the real list before deploy. Two placeholders here so the
  // shape is testable — they will never match real-world input.
  'XXXMODSLUREXAMPLE1XXX',
  'XXXMODSLUREXAMPLE2XXX',
];
