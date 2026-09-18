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

/**
 * Recursively strip object keys that start with `$`. Convex's value
 * serializer rejects any field named with a leading `$` ("reserved")
 * even when the receiving mutation declares `args: { event: v.any() }`
 * — the validation runs at the transport layer before the mutation
 * sees the value.
 *
 * RevenueCat's webhook payload nests subscriber attributes under
 * `event.subscriber_attributes` with keys like `$displayName`,
 * `$email`, `$apnsTokens` (their convention for reserved attrs). We
 * don't read any of those, so dropping them is safe — and keeps the
 * payload's other useful fields intact for `handleWebhook` to
 * consume.
 *
 * Also strips arrays of objects (rare in RC payloads but possible).
 * Primitives pass through unchanged.
 */
function stripDollarKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripDollarKeys);
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (k.startsWith('$')) continue;
      out[k] = stripDollarKeys(v);
    }
    return out;
  }
  return value;
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

    // Persona supports multiple signature sets in one header,
    // whitespace-separated, so secret rotation can sign with both the
    // old and new secrets during the window:
    //
    //   Persona-Signature: t=1684868400,v1=abcdef... t=1684868400,v1=fedcba...
    //
    // Each set is comma-separated kv pairs; we accept the request if
    // any one set verifies. Within a set, both t and v1 are required.
    const sets = signatureHeader
      .split(/\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (sets.length === 0) {
      return new Response('Persona-Signature is empty', { status: 400 });
    }

    const body = await req.text();
    const nowSec = Math.floor(Date.now() / 1000);
    let verified = false;
    let lastError = 'Invalid signature';
    for (const set of sets) {
      let v1: string | undefined;
      let t: string | undefined;
      for (const part of set.split(',').map((p) => p.trim())) {
        const [k, value] = part.split('=', 2);
        if (k === 'v1') v1 = value;
        else if (k === 't') t = value;
      }
      if (!v1 || !t) {
        lastError = 'Persona-Signature missing required components';
        continue;
      }
      const tNumber = Number(t);
      if (!Number.isFinite(tNumber)) {
        lastError = 'Persona-Signature t is not numeric';
        continue;
      }
      // ±300s replay window. Persona stamps `t` on send; a request
      // older than five minutes is either a delayed retry (already
      // processed — applyPersonaResult is idempotent on inquiryId) or
      // a captured-and-replayed signature. Either way we don't want
      // to act on it.
      if (Math.abs(nowSec - tNumber) > 300) {
        lastError = 'Persona-Signature outside replay window';
        continue;
      }
      // Sign over `${t}.${body}` — Stripe/GitHub/Slack convention
      // Persona follows. Including the timestamp in the signed payload
      // is what makes the replay window meaningful: an attacker with a
      // captured (header, body) pair can't shift `t` to bypass the
      // window without invalidating the signature.
      const expected = await hmacSha256Hex(secret, `${t}.${body}`);
      if (timingSafeStringEqual(v1, expected)) {
        verified = true;
        break;
      }
      lastError = 'Invalid signature';
    }
    if (!verified) {
      return new Response(lastError, {
        status: lastError === 'Invalid signature' ? 401 : 400,
      });
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
    // the verifications row.
    //
    // `needs_review` is intentionally NOT terminal — Persona resolves it
    // to a final status when their team or rules engine acts. Closing it
    // here would write a 'rejected' row that flips back to 'approved' on
    // the follow-up webhook, leaving stale data in the verifications
    // table. We acknowledge with 200 (so Persona doesn't retry) and wait
    // for the resolution event.
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

/**
 * RevenueCat webhook — Phase 6 TASK-073.
 *
 * RevenueCat's webhook auth model is a static `Authorization: Bearer
 * <secret>` header (not HMAC-signed payloads like Persona/Stripe). We
 * compare the secret with `timingSafeStringEqual` defined above to
 * avoid the timing-attack surface a string `===` would expose.
 *
 * Payload shape: `{ api_version, event: { type, app_user_id, product_id,
 * entitlement_ids, ..., store } }`. Full reference at
 * https://www.revenuecat.com/docs/webhooks. We hand the inner `event`
 * object to `internal.subscriptions.handleWebhook`, which validates
 * the type whitelist and upserts the row.
 *
 * Always responding 200 once the secret is verified means RC won't
 * retry on app-level failures (user not found, unsupported store).
 * Those soft-failures are returned in the response body for log
 * visibility but don't gate webhook delivery — see the structured
 * `{ ok, reason }` object handleWebhook returns.
 */
http.route({
  path: '/revenuecat-webhook',
  method: 'POST',
  handler: httpAction(async (ctx, req) => {
    const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
    if (!secret) {
      return new Response('Missing REVENUECAT_WEBHOOK_SECRET', { status: 500 });
    }

    const auth = req.headers.get('Authorization');
    if (!auth) {
      return new Response('Missing Authorization header', { status: 401 });
    }
    const expected = `Bearer ${secret}`;
    if (!timingSafeStringEqual(auth, expected)) {
      return new Response('Invalid signature', { status: 401 });
    }

    let body: { event?: unknown };
    try {
      body = (await req.json()) as { event?: unknown };
    } catch {
      return new Response('Invalid JSON body', { status: 400 });
    }
    if (!body || typeof body !== 'object' || !body.event) {
      return new Response('Missing event in payload', { status: 400 });
    }

    // Sanitize the payload before forwarding to the mutation.
    // RC's `subscriber_attributes` block has `$`-prefixed keys
    // ($displayName, $email, $apnsTokens, ...) that Convex's value
    // serializer rejects with "Field name $X starts with a '$', which
    // is reserved." Strip them recursively — handleWebhook never reads
    // those fields anyway.
    const sanitizedEvent = stripDollarKeys(body.event);
    const result = await ctx.runMutation(
      internal.subscriptions.handleWebhook,
      { event: sanitizedEvent },
    );
    // 200 even on soft-fail — see the doc-comment above. Status code
    // is what RC keys retries off of; the body is for our logs.
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }),
});

export default http;
