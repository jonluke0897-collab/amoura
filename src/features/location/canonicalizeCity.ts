/**
 * Normalize a city string so equivalent inputs map to the same feed bucket.
 *
 * listFeed is city-string gated with an exact-match index, so "brooklyn",
 * "Brooklyn", and " Brooklyn " from a geocoder or manual picker would each
 * sit in their own bucket without this. We trim whitespace and title-case
 * each word. Hyphenated names ("Winston-Salem") and multi-word names
 * ("Los Angeles") round-trip cleanly.
 *
 * Borough / metro consolidation (e.g. "Queens" → "New York", or
 * "Berkeley" → "Oakland") is deliberately NOT done here — those are
 * product calls that need a proper metro table and explicit sign-off.
 * This helper only fixes the casing/whitespace split that creates
 * accidental empty buckets.
 */
export function canonicalizeCity(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return '';
  // Preserve separators (single space, multiple spaces collapsed, hyphens)
  // while title-casing the alphabetic parts.
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
