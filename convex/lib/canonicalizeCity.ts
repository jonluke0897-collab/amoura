/**
 * Server-side copy of the city normalizer that the client hook applies
 * before calling updatePreferences. Duplicated here so `convex/` never
 * imports from `src/` — the Convex deploy bundle stays isolated from
 * React Native code paths.
 *
 * IMPORTANT: keep byte-for-byte in sync with
 * src/features/location/canonicalizeCity.ts. Drift between the two would
 * re-split feed buckets (the bug this helper exists to prevent).
 */
export function canonicalizeCity(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return '';
  return trimmed
    .split(/(\s+|-)/)
    .map((part) => {
      if (part.length === 0) return part;
      if (/^\s+$/.test(part)) return ' ';
      if (part === '-') return '-';
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join('');
}
