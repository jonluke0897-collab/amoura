'use node';

import { v } from 'convex/values';
import { internalAction, action } from './_generated/server';
import { internal } from './_generated/api';

/**
 * External-service actions for Phase 5 Wave 3 verification (TASK-060,
 * TASK-061). Node runtime so we can use fetch + JSON.parse without the
 * V8-runtime caveats that bite Convex's default isolate.
 *
 * Two flows:
 *   - startId: creates a Persona inquiry and returns the hosted-flow URL
 *     for the client to open via expo-web-browser. Persona handles the
 *     ID + selfie capture in their hosted environment; the result lands
 *     via `/persona-webhook` (see convex/http.ts) which writes the
 *     verifications row.
 *   - startPhoto: ships the user's selfie + most recent profile photo to
 *     an AWS Lambda wrapping Rekognition CompareFaces, parses the result,
 *     and writes the verifications row + photos.isVerified cache.
 *
 * Both gracefully no-op (with a clear error) when their env vars aren't
 * set, mirroring the Phase 0 provider pattern in CLAUDE.md. The selfie
 * blob is deleted from Convex storage at the end of startPhoto regardless
 * of outcome — keeping the user's face on the server beyond the
 * verification window has no purpose and is a privacy leak.
 *
 * Persona setup contract (operator):
 *   PERSONA_API_KEY            — server-side API key (Persona dashboard → API Keys)
 *   PERSONA_TEMPLATE_ID        — template id for "Government ID + Selfie"
 *   PERSONA_ENV                — "sandbox" | "production"
 *   PERSONA_REDIRECT_URL       — deep-link the inquiry redirects to on
 *                                completion. We use amoura://verify-id-return
 *                                so expo-web-browser dismissAuthSession()
 *                                fires.
 *
 * Rekognition Lambda contract (operator) — see docs/aws-rekognition-lambda.md:
 *   REKOGNITION_LAMBDA_URL     — Function URL with bearer-token auth
 *   REKOGNITION_LAMBDA_TOKEN   — shared secret the Lambda compares against
 *                                Authorization: Bearer <token>
 */

const PERSONA_API_BASE_PROD = 'https://api.withpersona.com/api/v1';
// Persona uses the same base for sandbox; the API key prefix (sandbox_*
// vs production_*) determines which environment is hit. We surface the
// PERSONA_ENV var anyway so the runbook is unambiguous and analytics can
// distinguish.

// External-fetch deadlines. Both Persona inquiry creation and the
// Rekognition Lambda call are bounded so a stalled upstream can't hang
// the action indefinitely. The Lambda timeout is intentionally shorter
// than the client's VERIFY_TIMEOUT_MS (45s) so a server-side late
// completion can't race with a client-initiated retry: by the time the
// client gives up, this side has already aborted and won't try to
// double-write the verifications row.
const PERSONA_FETCH_TIMEOUT_MS = 20_000;
const REKOGNITION_FETCH_TIMEOUT_MS = 30_000;

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

type PersonaInquiryResponse = {
  data?: {
    id?: string;
  };
};

type PersonaOneTimeLinkResponse = {
  meta?: {
    'one-time-link'?: string;
    'one-time-link-short'?: string;
  };
};

/**
 * Create a Persona inquiry for the calling user, then mint a one-time
 * hosted link to it. Persona's POST /inquiries doesn't return a hosted
 * URL by default (meta.one-time-link comes back null), so the second
 * POST is the documented way to get a URL the client can open. The
 * inquiryId is returned alongside so it can be reflected in the webhook
 * for correlation.
 *
 * The user's clerkId is passed as the inquiry's referenceId. The webhook
 * uses that to look up the user when persisting the result, since
 * Persona itself doesn't know about Convex user IDs.
 */
export const startId = action({
  handler: async (ctx): Promise<{ inquiryId: string; url: string }> => {
    const apiKey = process.env.PERSONA_API_KEY;
    const templateId = process.env.PERSONA_TEMPLATE_ID;
    const redirectUri = process.env.PERSONA_REDIRECT_URL ?? 'amoura://verify-id-return';
    if (!apiKey || !templateId) {
      throw new Error(
        'ID verification is not configured. Set PERSONA_API_KEY and PERSONA_TEMPLATE_ID via `npx convex env set`.',
      );
    }

    // Pull the calling user's clerkId for referenceId. We could call an
    // internal query for this, but the auth identity is already in scope.
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');
    const referenceId = identity.subject;

    let inquiryResponse: Response;
    try {
      inquiryResponse = await fetchWithTimeout(
        `${PERSONA_API_BASE_PROD}/inquiries`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'Persona-Version': '2023-01-05',
          },
          body: JSON.stringify({
            data: {
              attributes: {
                'inquiry-template-id': templateId,
                'reference-id': referenceId,
                'redirect-uri': redirectUri,
              },
            },
          }),
        },
        PERSONA_FETCH_TIMEOUT_MS,
      );
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        console.warn('[verificationActions.startId] Persona create-inquiry timed out');
        throw new Error(
          'ID verification timed out. Please try again in a moment.',
        );
      }
      throw e;
    }
    if (!inquiryResponse.ok) {
      // Don't log the response body — Persona's error envelopes can echo
      // request fields, and downstream calls in this action can return
      // hosted verification URLs we never want in log aggregators.
      console.warn('[verificationActions.startId] Persona create-inquiry failed', {
        status: inquiryResponse.status,
      });
      throw new Error('Could not start ID verification. Try again in a moment.');
    }
    const inquiryJson = (await inquiryResponse.json()) as PersonaInquiryResponse;
    const inquiryId = inquiryJson.data?.id;
    if (!inquiryId) {
      console.warn('[verificationActions.startId] Persona create-inquiry response missing data.id', {
        responseKeys: Object.keys(inquiryJson ?? {}),
      });
      throw new Error('Could not start ID verification. Try again in a moment.');
    }

    let linkResponse: Response;
    try {
      linkResponse = await fetchWithTimeout(
        `${PERSONA_API_BASE_PROD}/inquiries/${inquiryId}/generate-one-time-link`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'Persona-Version': '2023-01-05',
          },
        },
        PERSONA_FETCH_TIMEOUT_MS,
      );
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        console.warn('[verificationActions.startId] Persona generate-one-time-link timed out');
        throw new Error(
          'ID verification timed out. Please try again in a moment.',
        );
      }
      throw e;
    }
    if (!linkResponse.ok) {
      console.warn('[verificationActions.startId] Persona generate-one-time-link failed', {
        status: linkResponse.status,
        inquiryId,
      });
      throw new Error('Could not start ID verification. Try again in a moment.');
    }
    const linkJson = (await linkResponse.json()) as PersonaOneTimeLinkResponse;
    const url = linkJson.meta?.['one-time-link'];
    if (!url) {
      // Never log linkJson directly — meta may contain a one-time-link in a
      // shape we didn't account for, and that URL is a verification credential.
      console.warn('[verificationActions.startId] Persona generate-one-time-link response missing meta.one-time-link', {
        inquiryId,
        metaKeys: Object.keys(linkJson.meta ?? {}),
      });
      throw new Error('Could not start ID verification. Try again in a moment.');
    }
    return { inquiryId, url };
  },
});

type RekognitionResult = {
  similarity: number;
  livenessConfirmed: boolean;
  faceCount: number;
};

/**
 * Runtime guard for the Lambda's response shape. We can't trust the
 * upstream — a stale Lambda deploy, a corrupted env, or an entirely
 * different service mistakenly pointed at by REKOGNITION_LAMBDA_URL
 * would otherwise feed undefined fields to the outcome branching and
 * silently land "no-face" rejections on every legitimate selfie.
 * faceCount is the only required-and-meaningful field on the
 * non-success path; similarity matters only when faceCount === 1.
 */
function isRekognitionResult(value: unknown): value is RekognitionResult {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (typeof v.faceCount !== 'number' || !Number.isFinite(v.faceCount)) return false;
  if (typeof v.livenessConfirmed !== 'boolean') return false;
  // similarity is allowed to be omitted when faceCount !== 1, but if
  // present it must be a finite number.
  if (
    v.similarity !== undefined &&
    (typeof v.similarity !== 'number' || !Number.isFinite(v.similarity))
  ) {
    return false;
  }
  return true;
}

/**
 * Compare the just-captured selfie against the user's most recent profile
 * photo. Two storage URLs are passed to the Rekognition Lambda; the
 * Lambda invokes AWS Rekognition CompareFaces and returns similarity +
 * liveness + face count. The Lambda owns the AWS credentials so this
 * action stays free of `@aws-sdk` deps. See docs/aws-rekognition-lambda.md
 * for the request/response contract.
 *
 * Outcomes:
 *   faceCount === 0 → rejected, "no-face"
 *   faceCount  > 1 → rejected, "multiple-faces"
 *   liveness false → rejected, "no-liveness"
 *   similarity < 90 → rejected, "no-match"
 *   else            → approved, photos.isVerified flipped on the
 *                     reference photo via internal.verifications.applyPhotoVerification
 *
 * The selfie blob is deleted from Convex storage at the end regardless
 * of outcome — there's no reason to keep it past the action's lifetime,
 * and storing user faces is a privacy issue.
 */
export const startPhoto = action({
  args: {
    selfieStorageId: v.id('_storage'),
  },
  handler: async (
    ctx,
    args,
  ): Promise<
    | { status: 'approved'; similarity: number }
    | { status: 'rejected'; reason: 'no-face' | 'multiple-faces' | 'no-liveness' | 'no-match' | 'config' }
  > => {
    const lambdaUrl = process.env.REKOGNITION_LAMBDA_URL;
    const lambdaToken = process.env.REKOGNITION_LAMBDA_TOKEN;
    if (!lambdaUrl || !lambdaToken) {
      console.warn(
        '[verificationActions.startPhoto] REKOGNITION_LAMBDA_URL or _TOKEN not set; rejecting with config reason',
      );
      // Always cleanup the selfie blob, even on config errors.
      await ctx.storage.delete(args.selfieStorageId).catch(() => {});
      return { status: 'rejected', reason: 'config' };
    }

    const selfieUrl = await ctx.storage.getUrl(args.selfieStorageId);
    if (!selfieUrl) {
      console.warn('[verificationActions.startPhoto] selfie blob is missing');
      await ctx.storage.delete(args.selfieStorageId).catch(() => {});
      return { status: 'rejected', reason: 'no-face' };
    }

    // Fetch the calling user + their reference photo via internal queries
    // so we don't have to reimplement the auth lookup here. The reference
    // photo is the one with position=0 (display photo).
    const ref = await ctx.runQuery(
      internal.verifications.getReferencePhoto,
      {},
    );
    if (!ref) {
      await ctx.storage.delete(args.selfieStorageId).catch(() => {});
      throw new Error('Add at least one profile photo before verifying.');
    }

    let result: RekognitionResult;
    try {
      let response: Response;
      try {
        response = await fetchWithTimeout(
          lambdaUrl,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${lambdaToken}`,
            },
            body: JSON.stringify({
              selfieUrl,
              profilePhotoUrl: ref.profilePhotoUrl,
            }),
          },
          REKOGNITION_FETCH_TIMEOUT_MS,
        );
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') {
          console.warn(
            '[verificationActions.startPhoto] Lambda POST timed out',
          );
          return { status: 'rejected', reason: 'config' };
        }
        throw e;
      }
      if (!response.ok) {
        const text = await response.text().catch(() => '<no body>');
        console.warn(
          `[verificationActions.startPhoto] Lambda POST failed: ${response.status} ${text}`,
        );
        return { status: 'rejected', reason: 'config' };
      }
      const parsed: unknown = await response.json().catch(() => null);
      if (!isRekognitionResult(parsed)) {
        // Malformed response — treat as a config error so the user
        // sees the friendly "verification is taking a beat" copy
        // instead of a confusing "no face detected" rejection.
        console.warn(
          '[verificationActions.startPhoto] Lambda returned malformed response',
          parsed,
        );
        return { status: 'rejected', reason: 'config' };
      }
      result = parsed;
    } finally {
      // Delete the selfie blob whether or not the Lambda call succeeded.
      // This catch guards against a missing-blob race (action retried).
      await ctx.storage.delete(args.selfieStorageId).catch(() => {});
    }

    let outcome:
      | { status: 'approved'; similarity: number }
      | {
          status: 'rejected';
          reason: 'no-face' | 'multiple-faces' | 'no-liveness' | 'no-match';
        };

    if (result.faceCount === 0) {
      outcome = { status: 'rejected', reason: 'no-face' };
    } else if (result.faceCount > 1) {
      outcome = { status: 'rejected', reason: 'multiple-faces' };
    } else if (!result.livenessConfirmed) {
      outcome = { status: 'rejected', reason: 'no-liveness' };
    } else if (typeof result.similarity !== 'number' || result.similarity < 90) {
      outcome = { status: 'rejected', reason: 'no-match' };
    } else {
      outcome = { status: 'approved', similarity: result.similarity };
    }

    await ctx.runMutation(internal.verifications.applyPhotoVerification, {
      userId: ref.userId,
      profilePhotoId: ref.profilePhotoId,
      status: outcome.status,
      similarity: outcome.status === 'approved' ? outcome.similarity : undefined,
      rejectedReason: outcome.status === 'rejected' ? outcome.reason : undefined,
    });

    return outcome;
  },
});

/**
 * Internal action wrapper used by the Persona webhook to report inquiry
 * results. Splitting this out of the http.ts route keeps the http file
 * focused on signature verification and lets the webhook delegate the
 * DB write to a typed action. See convex/http.ts for the call site.
 */
export const recordPersonaResult = internalAction({
  args: {
    referenceId: v.string(),
    inquiryId: v.string(),
    status: v.union(v.literal('approved'), v.literal('rejected')),
    rejectedReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Resolve the user from the Clerk subject (Persona's referenceId).
    const userId = await ctx.runQuery(
      internal.verifications.getUserIdByClerkId,
      { clerkId: args.referenceId },
    );
    if (!userId) {
      // Throw rather than return — a silent return 200-acks the webhook,
      // Persona never retries, and the verification result is lost. Throwing
      // surfaces a non-2xx from /persona-webhook so Persona's retry queue
      // re-delivers (e.g., long enough for a slow Clerk → Convex user-sync to
      // catch up).
      throw new Error(
        `Persona webhook referenceId could not be resolved: ${args.referenceId}`,
      );
    }
    await ctx.runMutation(internal.verifications.applyPersonaResult, {
      userId,
      inquiryId: args.inquiryId,
      status: args.status,
      rejectedReason: args.rejectedReason,
    });
  },
});
