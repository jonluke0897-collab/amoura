/**
 * Content moderation — Phase 4 stub.
 *
 * TODO(phase-5): real keyword + ML check lands in roadmap Phase 5 alongside
 * the report flow (TASK-063) and bad-actor pattern detection. For now every
 * body is approved so the messaging UX works end-to-end. The stub lives in
 * its own module so the call sites in likes.send / messages.send don't have
 * to move when the real check arrives.
 *
 * Intentionally NOT async: the current check is trivially synchronous, and
 * callers mint a Date.now() before the insert — adding an unnecessary await
 * would widen the window for clock drift in the atomic match creation path.
 * When the real check goes through a Convex action, flip the signature then.
 */
export type ModerationResult = {
  flagged: boolean;
  reason?: string;
};

export function checkMessage(_body: string): ModerationResult {
  return { flagged: false };
}

export function checkLikeComment(_comment: string): ModerationResult {
  return { flagged: false };
}
