// PLACEHOLDER vocabularies — awaiting trans advisor review (TASK-025).
// These control what identity options are offered to users, so the copy here is
// as sensitive as the pledge itself. Any additions/removals should be discussed
// with advisors before shipping to beta.

export const PRONOUN_PRESETS: readonly string[] = [
  'she/her',
  'he/him',
  'they/them',
  'she/they',
  'he/they',
];

export const GENDER_SUGGESTIONS: readonly string[] = [
  'woman',
  'man',
  'non-binary',
  'genderqueer',
  'genderfluid',
  'agender',
  'trans woman',
  'trans man',
  'two-spirit',
];

export const ORIENTATION_PRESETS: readonly string[] = [
  'lesbian',
  'gay',
  'bisexual',
  'pansexual',
  'queer',
  'straight',
  'asexual',
  'demisexual',
];

export type ModalityValue = 'trans' | 'cis' | 'prefer-not-to-say';
export const MODALITY_OPTIONS: readonly { value: ModalityValue; label: string }[] = [
  { value: 'trans', label: 'Trans or non-binary' },
  { value: 'cis', label: 'Cis' },
  { value: 'prefer-not-to-say', label: 'Prefer not to say' },
];

export type T4TValue = 't4t-only' | 't4t-preferred' | 'open';
export const T4T_OPTIONS: readonly { value: T4TValue; label: string }[] = [
  { value: 't4t-only', label: 'Only trans & non-binary people' },
  { value: 't4t-preferred', label: 'Prefer trans & non-binary, but open' },
  { value: 'open', label: 'Open to everyone' },
];

// Intention chip labels map to schema literals.
// NOTE: the `hookup` schema literal is intentionally omitted from the Phase 1 UI.
// The schema keeps it for forward compatibility, but Phase 1 onboarding does not
// expose sex-first framing (per vision doc § 4 anti-patterns). Re-expose in a
// later phase only if advisors approve.
export type IntentionValue =
  | 'serious'
  | 'dating'
  | 'friendship'
  | 'community'
  | 'figuring-it-out';

export const INTENTION_OPTIONS: readonly { value: IntentionValue; label: string }[] = [
  { value: 'serious', label: 'Long-term partnership' },
  { value: 'dating', label: 'Short-term dating' },
  { value: 'friendship', label: 'Friendship' },
  { value: 'community', label: 'Community' },
  { value: 'figuring-it-out', label: 'Figuring it out' },
];

export const INTENTIONS_MAX_SELECTION = 3;
