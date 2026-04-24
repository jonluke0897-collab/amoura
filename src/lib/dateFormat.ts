/**
 * Date formatting helpers for Phase 4 chat UX.
 *
 * - `formatClockTime(ts)` — "2:47 PM" / "14:47". Used in chat bubbles.
 * - `formatMatchListActivity(ts)` — "now", "5m", "2h", "Yesterday",
 *   "Mon", "Mar 14". Used in the match list and any row that needs a
 *   "when did this happen?" glance value. Deliberately coarse — exact
 *   time lives in the chat screen, so the list just needs "recent?".
 */

export function formatClockTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatMatchListActivity(ts: number, now: number = Date.now()): string {
  // Clamp to non-negative so client-clock-ahead-of-server skew renders as
  // "now" rather than a negative-minutes intermediate.
  const diffMs = Math.max(0, now - ts);
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) {
    return new Date(ts).toLocaleDateString(undefined, { weekday: 'short' });
  }
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}
