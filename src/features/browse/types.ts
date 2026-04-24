import type { Id } from '~/convex/_generated/dataModel';

/**
 * Shape of a single profile card in the Phase 3 browse feed. Mirrors the
 * return type of convex/profiles.ts#listFeed — duplicated here so the card
 * component doesn't need to import from generated types (and so the props
 * read naturally in component files).
 */
export type FeedItem = {
  userId: Id<'users'>;
  profileId: Id<'profiles'>;
  displayName: string;
  age: number | null;
  pronouns: string[];
  city: string | null;
  identityLabel: string;
  firstPhotoUrl: string | null;
  topPrompt: { question: string; answerText: string } | null;
};
