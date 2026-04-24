import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { GENDER_MODALITY, INTENTION, PLEDGE_TYPE, T4T_PREFERENCE } from './validators';

export default defineSchema({
  // Synced from Clerk via webhook
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    phoneNumber: v.optional(v.string()),
    displayName: v.string(),
    dateOfBirth: v.optional(v.number()),
    isCis: v.optional(v.boolean()),
    onboardingComplete: v.boolean(),
    // Pledge completion timestamps: these drive onboarding/auth gating and
    // live on users so the root router can read them without a profile join.
    // The versioned snapshot (pledgeVersion/Type on profiles) is the audit source.
    respectPledgeCompletedAt: v.optional(v.number()),
    extendedPledgeCompletedAt: v.optional(v.number()),
    accountStatus: v.union(
      v.literal('active'),
      v.literal('paused'),
      v.literal('suspended'),
      v.literal('banned'),
      v.literal('deleted'),
    ),
    lastActiveAt: v.number(),
    createdAt: v.number(),
  })
    .index('by_clerk_id', ['clerkId'])
    .index('by_email', ['email'])
    .index('by_status', ['accountStatus'])
    .index('by_last_active', ['lastActiveAt']),

  profiles: defineTable({
    userId: v.id('users'),
    pronouns: v.array(v.string()),
    genderIdentity: v.string(),
    genderModality: GENDER_MODALITY,
    orientation: v.array(v.string()),
    t4tPreference: T4T_PREFERENCE,
    intentions: v.array(INTENTION),
    // Location + age prefs are populated in Phase 3 (browse); Phase 1 creates the row without them.
    city: v.optional(v.string()),
    locationLat: v.optional(v.number()),
    locationLng: v.optional(v.number()),
    maxDistanceKm: v.optional(v.number()),
    ageMin: v.optional(v.number()),
    ageMax: v.optional(v.number()),
    bio: v.optional(v.string()),
    isVisible: v.boolean(),
    // Pledge snapshot for audit: which version of the pledge copy this user
    // accepted. The completion timestamps on users are what gating logic reads;
    // these fields are the historical record for moderation/audit.
    pledgeAcceptedAt: v.optional(v.number()),
    pledgeVersion: v.optional(v.string()),
    pledgeType: v.optional(PLEDGE_TYPE),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_city', ['city'])
    .index('by_visible_city', ['isVisible', 'city']),

  photos: defineTable({
    profileId: v.id('profiles'),
    userId: v.id('users'),
    storageId: v.id('_storage'),
    position: v.number(),
    isVerified: v.boolean(),
    caption: v.optional(v.string()),
    // Dimensions captured by expo-image-manipulator after resize so the client
    // can reserve layout space before the image decodes — avoids shift in the
    // carousel on slow networks.
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index('by_profile', ['profileId'])
    .index('by_profile_position', ['profileId', 'position']),

  prompts: defineTable({
    question: v.string(),
    category: v.string(),
    isActive: v.boolean(),
    createdBy: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_active', ['isActive'])
    .index('by_category_active', ['category', 'isActive']),

  profilePrompts: defineTable({
    profileId: v.id('profiles'),
    userId: v.id('users'),
    promptId: v.id('prompts'),
    answerType: v.union(v.literal('text'), v.literal('audio')),
    answerText: v.optional(v.string()),
    answerAudioStorageId: v.optional(v.id('_storage')),
    answerAudioTranscript: v.optional(v.string()),
    answerAudioDurationMs: v.optional(v.number()),
    position: v.number(),
    createdAt: v.number(),
  })
    .index('by_profile', ['profileId'])
    .index('by_profile_position', ['profileId', 'position']),

  likes: defineTable({
    fromUserId: v.id('users'),
    toUserId: v.id('users'),
    targetType: v.union(v.literal('prompt'), v.literal('photo')),
    targetId: v.union(v.id('profilePrompts'), v.id('photos')),
    comment: v.string(),
    status: v.union(
      v.literal('pending'),
      v.literal('matched'),
      v.literal('passed'),
      v.literal('expired'),
    ),
    matchId: v.optional(v.id('matches')),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index('by_from_user', ['fromUserId'])
    .index('by_to_user', ['toUserId'])
    .index('by_to_user_status', ['toUserId', 'status'])
    .index('by_expires', ['expiresAt']),

  matches: defineTable({
    userAId: v.id('users'),
    userBId: v.id('users'),
    initiatedByLikeId: v.id('likes'),
    // Lifecycle: 'active' from creation. Flips to 'unmatched' when either
    // party unmatches (rows are preserved for audit but hidden from both
    // users' listMine). Phase 5 may add 'blocked' when the safety surface
    // lands; for now, a block just creates a blocks row and relies on
    // feed-level filtering.
    status: v.union(v.literal('active'), v.literal('unmatched')),
    lastMessageAt: v.optional(v.number()),
    lastMessagePreview: v.optional(v.string()),
    lastMessageSenderId: v.optional(v.id('users')),
    unreadCountA: v.number(),
    unreadCountB: v.number(),
    isArchivedByA: v.boolean(),
    isArchivedByB: v.boolean(),
    createdAt: v.number(),
  })
    .index('by_user_a', ['userAId'])
    .index('by_user_b', ['userBId'])
    .index('by_users', ['userAId', 'userBId'])
    .index('by_user_a_activity', ['userAId', 'lastMessageAt'])
    .index('by_user_b_activity', ['userBId', 'lastMessageAt']),

  messages: defineTable({
    matchId: v.id('matches'),
    senderId: v.id('users'),
    body: v.string(),
    messageType: v.union(
      v.literal('text'),
      v.literal('photo'),
      v.literal('system'),
    ),
    photoStorageId: v.optional(v.id('_storage')),
    readAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index('by_match_created', ['matchId', 'createdAt'])
    .index('by_sender', ['senderId']),

  reports: defineTable({
    reporterId: v.id('users'),
    reportedUserId: v.id('users'),
    reason: v.union(
      v.literal('fetishization'),
      v.literal('transphobia'),
      v.literal('unwanted-sexual-content'),
      v.literal('harassment'),
      v.literal('safety-concern'),
      v.literal('fake-profile'),
      v.literal('underage'),
      v.literal('spam'),
      v.literal('other'),
    ),
    context: v.optional(v.string()),
    relatedMessageId: v.optional(v.id('messages')),
    relatedMatchId: v.optional(v.id('matches')),
    status: v.union(
      v.literal('open'),
      v.literal('under-review'),
      v.literal('actioned'),
      v.literal('dismissed'),
    ),
    moderatorId: v.optional(v.string()),
    moderatorNotes: v.optional(v.string()),
    resolvedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index('by_status', ['status'])
    .index('by_reported_user', ['reportedUserId'])
    .index('by_reporter', ['reporterId'])
    .index('by_created', ['createdAt']),

  verifications: defineTable({
    userId: v.id('users'),
    type: v.union(v.literal('photo'), v.literal('id')),
    status: v.union(
      v.literal('pending'),
      v.literal('approved'),
      v.literal('rejected'),
    ),
    provider: v.string(),
    providerInquiryId: v.optional(v.string()),
    rejectedReason: v.optional(v.string()),
    verifiedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_user_type', ['userId', 'type']),

  subscriptions: defineTable({
    userId: v.id('users'),
    revenueCatUserId: v.string(),
    entitlementId: v.string(),
    productId: v.string(),
    isActive: v.boolean(),
    willRenew: v.boolean(),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
    platform: v.union(v.literal('ios'), v.literal('android')),
    updatedAt: v.number(),
    createdAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_active', ['isActive']),

  blocks: defineTable({
    blockerId: v.id('users'),
    blockedUserId: v.id('users'),
    reason: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_blocker', ['blockerId'])
    .index('by_blocked', ['blockedUserId'])
    .index('by_pair', ['blockerId', 'blockedUserId']),

  moderationFlags: defineTable({
    userId: v.id('users'),
    flagType: v.union(
      v.literal('multiple-reports'),
      v.literal('rapid-messaging'),
      v.literal('flagged-keywords'),
      v.literal('rejected-verification'),
    ),
    severity: v.union(
      v.literal('low'),
      v.literal('medium'),
      v.literal('high'),
    ),
    details: v.string(),
    status: v.union(
      v.literal('open'),
      v.literal('reviewed'),
      v.literal('resolved'),
    ),
    createdAt: v.number(),
    reviewedAt: v.optional(v.number()),
  })
    .index('by_user', ['userId'])
    .index('by_status', ['status'])
    .index('by_user_status', ['userId', 'status']),

  rateLimitBuckets: defineTable({
    userId: v.id('users'),
    bucket: v.string(),
    count: v.number(),
    periodStart: v.number(),
  })
    .index('by_user_bucket', ['userId', 'bucket']),
});
