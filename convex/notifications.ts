'use node';

import { v } from 'convex/values';
import { internalAction } from './_generated/server';

/**
 * OneSignal push dispatcher. Runs as a Node action so we can use fetch +
 * OneSignal's REST API without worrying about the Convex runtime's fetch
 * quirks. Invoked via ctx.scheduler.runAfter(0, ...) from messages.send and
 * whenever createMatch fires — fire-and-forget; failures here don't
 * rollback the committed message or match.
 *
 * ONESIGNAL_APP_ID + ONESIGNAL_API_KEY live in Convex env (set via
 * `npx convex env set`). If either is unset (dev before Phase 4 setup),
 * the action no-ops gracefully — the mutation still commits, the chat UI
 * still updates via reactivity, and we just don't get a push. That keeps
 * the messaging flow working for UI QA before OneSignal is wired.
 */

const ONESIGNAL_API_BASE = 'https://onesignal.com/api/v1';

async function sendToOneSignal(payload: {
  externalUserId: string;
  title: string;
  body: string;
  data: Record<string, string>;
}): Promise<void> {
  const appId = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_API_KEY;
  if (!appId || !apiKey) {
    // Graceful no-op in dev. Logs to Convex so a missing env surfaces in
    // `npx convex logs` rather than silently dropping every push.
    console.log(
      '[notifications] ONESIGNAL_APP_ID or ONESIGNAL_API_KEY not set; skipping push',
    );
    return;
  }

  const response = await fetch(`${ONESIGNAL_API_BASE}/notifications`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${apiKey}`,
    },
    body: JSON.stringify({
      app_id: appId,
      // External user IDs are registered client-side on Clerk sign-in
      // (NotificationProvider). Using include_aliases with external_id keeps
      // the server-side contract stable even if OneSignal's player_id
      // rotates (e.g. app reinstall).
      include_aliases: { external_id: [payload.externalUserId] },
      target_channel: 'push',
      headings: { en: payload.title },
      contents: { en: payload.body },
      data: payload.data,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '<no body>');
    console.error(
      `[notifications] OneSignal POST failed: ${response.status} ${text}`,
    );
  }
}

/**
 * Push for a new text message. Respects the free-tier privacy rule:
 * callers pass `bodyPreview: null` for free-tier recipients and the push
 * degrades to "You have a new message" without leaking content.
 */
export const sendPushForMessage = internalAction({
  args: {
    recipientUserId: v.id('users'),
    senderDisplayName: v.string(),
    bodyPreview: v.union(v.string(), v.null()),
    matchId: v.id('matches'),
  },
  handler: async (_ctx, args) => {
    const body = args.bodyPreview ?? 'You have a new message.';
    await sendToOneSignal({
      externalUserId: args.recipientUserId,
      title: `New message from ${args.senderDisplayName}`,
      body,
      data: {
        type: 'message',
        matchId: args.matchId,
      },
    });
  },
});

/**
 * Push for a new match. Fires from createMatch's caller (likes.send /
 * likes.respond) whenever a new match row is created.
 */
export const sendPushForMatch = internalAction({
  args: {
    recipientUserId: v.id('users'),
    matcherDisplayName: v.string(),
    matchId: v.id('matches'),
  },
  handler: async (_ctx, args) => {
    await sendToOneSignal({
      externalUserId: args.recipientUserId,
      title: 'New match',
      body: `You matched with ${args.matcherDisplayName}.`,
      data: {
        type: 'match',
        matchId: args.matchId,
      },
    });
  },
});
