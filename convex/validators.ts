import { v } from 'convex/values';

// Shared Convex value validators used by both the schema definition and
// individual mutation/query arg specs. Centralizing these keeps schema and
// API contracts in sync — drift between the two was flagged in CodeRabbit
// round 1 as a real risk (e.g. a new modality value added in one place but
// not the other would produce silent validation mismatches).

export const GENDER_MODALITY = v.union(
  v.literal('trans'),
  v.literal('cis'),
  v.literal('prefer-not-to-say'),
);

export const T4T_PREFERENCE = v.union(
  v.literal('t4t-only'),
  v.literal('t4t-preferred'),
  v.literal('open'),
);

export const INTENTION = v.union(
  v.literal('hookup'),
  v.literal('dating'),
  v.literal('serious'),
  v.literal('friendship'),
  v.literal('community'),
  v.literal('figuring-it-out'),
);

export const PLEDGE_TYPE = v.union(
  v.literal('standard'),
  v.literal('extended'),
);
