/**
 * Shared client-side validation primitives. Kept deliberately lightweight —
 * anything rejected here is also rejected by the server, so this is UX
 * pre-flight, not a source of truth.
 */

// local@domain.tld structural check — Clerk enforces the real rules. This
// just stops obviously-malformed input from making a round-trip.
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
