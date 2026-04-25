import { httpRouter } from 'convex/server';
import { Webhook } from 'svix';
import { httpAction } from './_generated/server';
import { internal } from './_generated/api';

const http = httpRouter();

/**
 * Constant-time string comparison for HMAC signatures. WebCrypto's
 * subtle.timingSafeEqual would be ideal but isn't available in Convex's
 * V8 isolate; this is the next-best at length-checked OR-accumulation.
 * Strings of different lengths return false immediately, which is fine —
 * an attacker can't gain timing-leak info by forcing a length mismatch
 * since the lengths themselves aren't secret.
 */
function timingSafeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

type ClerkEvent = {
  type: 'user.created' | 'user.updated' | 'user.deleted';
  data: {
    id: string;
    email_addresses?: Array<{ email_address: string }>;
    phone_numbers?: Array<{ phone_number: string }>;
    first_name?: string | null;
  };
};

http.route({
  path: '/clerk-webhook',
  method: 'POST',
  handler: httpAction(async (ctx, req) => {
    const secret = process.env.CLERK_WEBHOOK_SECRET;
    if (!secret) {
      return new Response('Missing CLERK_WEBHOOK_SECRET', { status: 500 });
    }

    const svixId = req.headers.get('svix-id');
    const svixTimestamp = req.headers.get('svix-timestamp');
    const svixSignature = req.headers.get('svix-signature');
    if (!svixId || !svixTimestamp || !svixSignature) {
      return new Response('Missing Svix headers', { status: 400 });
    }

    const body = await req.text();
    let event: ClerkEvent;
    try {
      event = new Webhook(secret).verify(body, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      }) as ClerkEvent;
    } catch {
      return new Response('Invalid signature', { status: 401 });
    }

    switch (event.type) {
      case 'user.created':
      case 'user.updated': {
        // Email is optional at sync time — phone-only signups and Clerk test
        // payloads both arrive with empty email_addresses. Onboarding requires
        // users to supply an email before a profile can be created.
        const email = event.data.email_addresses?.[0]?.email_address ?? '';
        await ctx.runMutation(internal.users.syncFromClerk, {
          clerkId: event.data.id,
          email,
          phoneNumber: event.data.phone_numbers?.[0]?.phone_number,
          displayName: event.data.first_name ?? 'Friend',
        });
        break;
      }
      case 'user.deleted':
        await ctx.runMutation(internal.users.deleteByClerkId, {
          clerkId: event.data.id,
        });
        break;
    }

    return new Response(null, { status: 200 });
  }),
});

/**
 * Persona webhook — Phase 5 TASK-060.
 *
 * Persona signs the payload with HMAC-SHA256 over the request body using
 * the webhook secret from the Persona dashboard. The signature comes in
 * as `Persona-Signature: t=<unix>,v1=<hex>` (per Persona's docs); we
 * extract v1 and timing-safe-compare against our own HMAC. Mismatch →
 * 401, missing secret → 500, well-formed but in a non-terminal state →
 * 200 no-op.
 *
 * Persona event shape: `{ data: { attributes: { payload: { data: { id,
 * attributes: { 'reference-id', status } } } } } }` — yes, that nesting
 * is real, Persona's API is JSONAPI under their own envelope. We extract
 * cautiously and bail without writing if the shape is unexpected.
 */
type PersonaInquiryEvent = {
  data?: {
    attributes?: {
      name?: string; // 'inquiry.completed' | 'inquiry.expired' | 'inquiry.failed' | etc.
      payload?: {
        data?: {
          id?: string;
          attributes?: {
            'reference-id'?: string;
            status?: string;
          };
        };
      };
    };
  };
};

http.route({
  path: '/persona-webhook',
  method: 'POST',
  handler: httpAction(async (ctx, req) => {
    const secret = process.env.PERSONA_WEBHOOK_SECRET;
    if (!secret) {
      return new Response('Missing PERSONA_WEBHOOK_SECRET', { status: 500 });
    }

    const signatureHeader = req.headers.get('Persona-Signature');
    if (!signatureHeader) {
      return new Response('Missing Persona-Signature header', { status: 400 });
    }

    // Persona-Signature: t=1684868400,v1=abcdef... (comma-separated kv)
    // We accept either order and ignore unrecognised keys.
    const parts = signatureHeader.split(',').map((p) => p.trim());
    let v1: string | undefined;
    for (const part of parts) {
      const [k, value] = part.split('=', 2);
      if (k === 'v1') v1 = value;
    }
    if (!v1) {
      return new Response('Persona-Signature missing v1 component', { status: 400 });
    }

    const body = await req.text();
    const expected = await hmacSha256Hex(secret, body);
    if (!timingSafeStringEqual(v1, expected)) {
      return new Response('Invalid signature', { status: 401 });
    }

    let event: PersonaInquiryEvent;
    try {
      event = JSON.parse(body) as PersonaInquiryEvent;
    } catch {
      return new Response('Invalid JSON body', { status: 400 });
    }

    const eventName = event.data?.attributes?.name ?? '';
    const payload = event.data?.attributes?.payload?.data;
    const inquiryId = payload?.id;
    const referenceId = payload?.attributes?.['reference-id'];
    const personaStatus = payload?.attributes?.status;

    if (!inquiryId || !referenceId || !personaStatus) {
      // Webhook fired for an event we don't care about (e.g., session
      // started). Acknowledge so Persona doesn't retry, but don't write.
      return new Response(null, { status: 200 });
    }

    // Persona statuses: 'completed' / 'approved' / 'declined' / 'failed' /
    // 'expired' / 'needs_review'. We collapse to approved | rejected for
    // the verifications row; needs_review counts as rejected for now —
    // a future phase can introduce a 'pending-review' status if the
    // moderator surface needs it.
    const isApproved =
      eventName === 'inquiry.approved' || personaStatus === 'approved';
    const isTerminalRejection =
      eventName === 'inquiry.declined' ||
      eventName === 'inquiry.failed' ||
      eventName === 'inquiry.expired' ||
      personaStatus === 'declined' ||
      personaStatus === 'failed' ||
      personaStatus === 'expired';

    if (!isApproved && !isTerminalRejection) {
      // Non-terminal state — Persona will fire another webhook later.
      return new Response(null, { status: 200 });
    }

    await ctx.runAction(internal.verificationActions.recordPersonaResult, {
      referenceId,
      inquiryId,
      status: isApproved ? 'approved' : 'rejected',
      rejectedReason: isApproved ? undefined : personaStatus,
    });

    return new Response(null, { status: 200 });
  }),
});

export default http;
