// PLACEHOLDER — awaiting trans advisor review. Do NOT ship to beta with this copy.
// Tracked in roadmap TASK-025. Bumping PLEDGE_VERSION to "1.0.0" requires
// written sign-off from at least one paid trans advisor (per CLAUDE.md advisor gate).

export const PLEDGE_VERSION = '0.1.0-placeholder';

export const STANDARD_PLEDGE_HEADING = "A few things we ask of everyone here.";
export const STANDARD_PLEDGE_SUBHEAD = "Take a beat, then continue.";
export const STANDARD_PLEDGE_CTA = "I'm in";

export const STANDARD_COMMITMENTS: readonly string[] = [
  "I'll use the pronouns people share with me, and correct myself when I slip.",
  "I won't ask invasive questions about anyone's body, transition, or medical history.",
  "I'll treat the people I match with as whole humans — not lessons, trophies, or experiments.",
];

export const EXTENDED_PLEDGE_HEADING = "Welcome in. Here's how we show up for each other.";
export const EXTENDED_PLEDGE_SUBHEAD =
  "Read each one, then tap Agree. This takes a minute — it matters.";
export const EXTENDED_PLEDGE_CTA = "Submit pledge";
export const EXTENDED_PLEDGE_AGREE_LABEL = "Agree";
export const EXTENDED_PLEDGE_DISAGREE_LABEL = "Disagree";
// Minimum read time before the Continue button enables, in milliseconds.
export const EXTENDED_PLEDGE_MIN_READ_MS = 15_000;

// Shown when someone taps "Disagree" on any commitment. Warm exit — these
// commitments are the baseline for respect and consent on Amia, and if someone
// can't agree to them, this isn't the right space for them right now.
export const PLEDGE_EXIT_HEADING = "Amia might not be the right fit for you right now.";
export const PLEDGE_EXIT_BODY =
  "These aren't negotiable — they're how we keep this a respectful, safe place for everyone here. If anything on the pledge didn't sit right, that's okay. No hard feelings. You're welcome back anytime your answer changes.";
export const PLEDGE_EXIT_BACK_CTA = "Take me back";
export const PLEDGE_EXIT_SIGN_OUT_CTA = "Sign out";

export const EXTENDED_COMMITMENTS: readonly string[] = [
  "I'll use the pronouns people share with me every single time — no exceptions, no quiet substitutions.",
  "I'll never ask about anyone's body, surgeries, or medical history. If I want to know someone, that's not how.",
  "I'll show up with genuine curiosity and respect — here to get to know a whole person, never to make anyone a spectacle.",
  "I won't treat transness as a kink, a thrill, or a bucket-list item. Fetishization is a boundary, not a preference.",
  "Consent lives in every message, photo, and meet-up. I'll ask, I'll listen, and I'll take 'no' as a complete sentence.",
  "If someone tells me I've crossed a line, I'll thank them, listen, and do better — not get defensive.",
];
