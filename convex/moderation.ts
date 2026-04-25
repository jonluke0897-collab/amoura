/**
 * Content moderation — Phase 5 keyword check.
 *
 * Scans bodies (messages, like comments) against an advisor-curated list of
 * slurs and obvious fetish-language phrases. The list lives in
 * `convex/moderationKeywords.ts`, which is gitignored — see
 * `moderationKeywords.example.ts` for the shape and curation rules.
 *
 * Key product principle (vision § 1, "Safety is a feature, not a policy"):
 * flagged content is **NOT auto-deleted**. Reclaimed in-community language
 * generates inevitable false positives, and silent suppression is a worse
 * harm than letting a moderator review. Callers persist `flagged: true` on
 * the row and emit a moderationFlags audit row; the message still delivers.
 *
 * Intentionally synchronous: the keyword set is in-memory, no I/O. Keeps the
 * call-site flow in messages.send / likes.send single-pass without await.
 */
import { MODERATION_KEYWORDS } from './moderationKeywords';

export type ModerationResult = {
  flagged: boolean;
  reason?: string;
  matchedKeyword?: string;
};

// Pre-lowercase the keyword list once at module load so the per-message scan
// stays O(keywords * body) without allocating per call.
const NORMALIZED_KEYWORDS = MODERATION_KEYWORDS.map((k) => k.toLowerCase());

/**
 * Lowercase a body and collapse non-letter/non-digit/non-space runs to a
 * single space. This lets a contiguous word match survive punctuation,
 * combining marks, and most stylization tricks ("s.l.u.r" → "s l u r"). It
 * is NOT a defense against motivated obfuscation — that's the moderator's
 * job — just a baseline that catches the obvious.
 */
function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scanForKeyword(body: string): string | null {
  const normalized = normalize(body);
  if (normalized.length === 0) return null;
  // Pad with spaces so word-boundary matches work for keywords at the very
  // start or end of the message without a separate edge case.
  const padded = ` ${normalized} `;
  for (const keyword of NORMALIZED_KEYWORDS) {
    const padKeyword = ` ${keyword} `;
    if (padded.includes(padKeyword)) return keyword;
  }
  return null;
}

export function checkMessage(body: string): ModerationResult {
  const matched = scanForKeyword(body);
  if (matched) {
    return {
      flagged: true,
      reason: 'message-keyword',
      matchedKeyword: matched,
    };
  }
  return { flagged: false };
}

export function checkLikeComment(comment: string): ModerationResult {
  const matched = scanForKeyword(comment);
  if (matched) {
    return {
      flagged: true,
      reason: 'like-comment-keyword',
      matchedKeyword: matched,
    };
  }
  return { flagged: false };
}
