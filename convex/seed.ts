import { internalMutation } from './_generated/server';

// PHASE 0 PLACEHOLDER PROMPTS.
// These MUST be reviewed and revised by trans advisors before Phase 1 ships.
// See product-roadmap.md TASK-025 (Copy review gate with trans advisor).
const PLACEHOLDER_PROMPTS: Array<{ question: string; category: string }> = [
  // identity
  { question: 'Something about me that surprises people', category: 'identity' },
  { question: 'A small joy that feels like home', category: 'identity' },
  { question: "The chosen family I'd introduce you to first", category: 'identity' },
  { question: 'What growing into myself has taught me', category: 'identity' },
  { question: "A compliment I've learned to receive", category: 'identity' },
  { question: 'Where I feel most myself', category: 'identity' },
  { question: 'A thing I used to hide that I now wear on my sleeve', category: 'identity' },
  { question: 'My relationship with rest', category: 'identity' },
  // humor
  { question: "A shower thought I can't shake", category: 'humor' },
  { question: 'The dumbest hill I will die on', category: 'humor' },
  { question: 'My most chaotic group chat contribution', category: 'humor' },
  { question: "Something I'm irrationally competitive about", category: 'humor' },
  { question: 'An opinion I have about a small, stupid thing', category: 'humor' },
  { question: 'Worst song I secretly love', category: 'humor' },
  { question: 'My Roman Empire', category: 'humor' },
  // values
  { question: "Something I'll always make time for", category: 'values' },
  { question: 'What a good day looks like for me', category: 'values' },
  { question: "How I want to be cared for when I'm tired", category: 'values' },
  { question: "What I'm slowly unlearning", category: 'values' },
  { question: 'A belief I hold that I had to fight for', category: 'values' },
  { question: 'What community means to me right now', category: 'values' },
  { question: 'The kind of partner I am becoming', category: 'values' },
  // desire
  { question: "What I'm looking for, honestly", category: 'desire' },
  { question: 'A first date I would plan for you', category: 'desire' },
  { question: 'Something that makes me feel wanted (that is not about my body)', category: 'desire' },
  { question: "What flirting looks like when I'm actually into you", category: 'desire' },
  { question: "A love language I'm learning to speak", category: 'desire' },
  // connection
  { question: 'The last thing I texted a friend about', category: 'connection' },
  { question: 'Who I call when something good happens', category: 'connection' },
  { question: "An artist, show, or book I'd send you first", category: 'connection' },
  { question: 'A ritual I want someone to share with me', category: 'connection' },
  { question: "Somewhere I'd take you that means something to me", category: 'connection' },
];

export const seedPrompts = internalMutation({
  handler: async (ctx) => {
    const existing = await ctx.db.query('prompts').collect();
    if (existing.length > 0) {
      return { skipped: true, count: existing.length };
    }

    const now = Date.now();
    let inserted = 0;
    for (const p of PLACEHOLDER_PROMPTS) {
      await ctx.db.insert('prompts', {
        question: p.question,
        category: p.category,
        isActive: true,
        createdBy: 'amoura-placeholder',
        createdAt: now,
      });
      inserted += 1;
    }
    return { inserted };
  },
});
