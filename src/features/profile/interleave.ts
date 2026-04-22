export type InterleaveItem<P, A> =
  | { type: 'photo'; item: P }
  | { type: 'prompt'; item: A };

/**
 * Build the profile body section by alternating photos and prompt answers.
 *
 * Rule: emit photos in order, inserting a prompt card after photos at stream
 * positions 1, 4, 7 (i.e. roughly every 1–2 photos). Any answers left over
 * after photos run out are appended at the end, so nothing is ever dropped.
 *
 * Examples:
 *   photos=6, prompts=3 → [p0, q0, p1, p2, q1, p3, p4, q2, p5]
 *   photos=2, prompts=3 → [p0, q0, p1, q1, q2]
 *   photos=0, prompts=3 → [q0, q1, q2]
 *
 * If UX wants a different cadence later, change PROMPT_SLOTS and/or the
 * iteration rule in one place.
 */
const PROMPT_SLOTS = [1, 4, 7] as const;

export function interleave<P, A>(
  photos: P[],
  prompts: A[],
): InterleaveItem<P, A>[] {
  const out: InterleaveItem<P, A>[] = [];
  let photoIdx = 0;
  let promptIdx = 0;
  const total = photos.length + prompts.length;

  for (let slot = 0; slot < total; slot++) {
    const isPromptSlot =
      PROMPT_SLOTS.includes(slot as (typeof PROMPT_SLOTS)[number]) &&
      promptIdx < prompts.length;
    if (isPromptSlot) {
      out.push({ type: 'prompt', item: prompts[promptIdx++] });
    } else if (photoIdx < photos.length) {
      out.push({ type: 'photo', item: photos[photoIdx++] });
    } else if (promptIdx < prompts.length) {
      out.push({ type: 'prompt', item: prompts[promptIdx++] });
    }
  }
  return out;
}
