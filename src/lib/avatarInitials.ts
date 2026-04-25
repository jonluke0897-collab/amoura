/**
 * Extract 1-2 uppercase initials from a display name. Handles empty
 * strings and single-word names without throwing — callers always get
 * a non-empty string they can render in a placeholder avatar.
 */
export function getInitials(displayName: string): string {
  const trimmed = displayName.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  const letters = parts.map((p) => p[0] ?? '').join('');
  return letters.slice(0, 2).toUpperCase() || '?';
}
