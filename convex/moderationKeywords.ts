/**
 * Moderation keyword list — placeholder values shipped to the public repo.
 *
 * The entries below are intentionally not real slurs. The keyword scanner
 * in `convex/moderation.ts` matches on word-boundary lowercased substrings;
 * with placeholders, no real-world message ever flags. Replace these with
 * the advisor-curated list before deploying production — see
 * `docs/moderation-runbook.md` for the procedure.
 *
 * Curation rules per the trans advisors retained for Phase 1's pledge review:
 * - Include obvious slurs and degrading fetish vocabulary.
 * - Do NOT include words that trans women routinely reclaim in self-
 *   description ("trans", "tranny" used between trans women in-community,
 *   etc). The detection layer's job is to surface to a moderator, not to
 *   block. False positives still get delivered (TASK-066) — but each one
 *   wastes moderator attention and erodes trust if reviewers see the same
 *   benign in-community phrases over and over.
 *
 * Why placeholders ship instead of gitignoring the file: the import in
 * `moderation.ts` would fail in clean clones / CI if this file weren't
 * tracked. We ship a no-match list so the repo builds; the real list is
 * applied at deploy time via the runbook's keyword update procedure.
 */
export const MODERATION_KEYWORDS: readonly string[] = [
  'XXXMODSLUREXAMPLE1XXX',
  'XXXMODSLUREXAMPLE2XXX',
];
