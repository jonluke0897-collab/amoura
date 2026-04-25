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

type PersonaInquiryResponse = {
  data?: {
    id?: string;
    attributes?: {
      // Persona returns a hosted URL for embedded/web flows. Field
      // historically named `inquiryUrl` or `referenceId` depending on
      // SDK version; we read both as defensive measures.
      'inquiry-url'?: string;
      url?: string;
    };
  };
};

/**
 * Create a Persona inquiry for the calling user. Returns the hosted-flow
 * URL the client should open via expo-web-browser. The inquiryId is
 * stashed (returned to the client and reflected in the webhook so we can
 * correlate when the result comes back).
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

    const response = await fetch(`${PERSONA_API_BASE_PROD}/inquiries`, {
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
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '<no body>');
      console.warn(`[verificationActions.startId] Persona POST failed: ${response.status} ${text}`);
      throw new Error('Could not start ID verification. Try again in a moment.');
    }
    const json = (await response.json()) as PersonaInquiryResponse;
    const inquiryId = json.data?.id;
    const url = json.data?.attributes?.['inquiry-url'] ?? json.data?.attributes?.url;
    if (!inquiryId || !url) {
      console.warn('[verificationActions.startId] Persona response missing id or url', json);
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
      const response = await fetch(lambdaUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${lambdaToken}`,
        },
        body: JSON.stringify({
          selfieUrl,
          profilePhotoUrl: ref.profilePhotoUrl,
        }),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '<no body>');
        console.warn(
          `[verificationActions.startPhoto] Lambda POST failed: ${response.status} ${text}`,
        );
        await ctx.storage.delete(args.selfieStorageId).catch(() => {});
        return { status: 'rejected', reason: 'config' };
      }
      result = (await response.json()) as RekognitionResult;
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
      console.warn(
        `[verificationActions.recordPersonaResult] no user for referenceId=${args.referenceId}`,
      );
      return;
    }
    await ctx.runMutation(internal.verifications.applyPersonaResult, {
      userId,
      inquiryId: args.inquiryId,
      status: args.status,
      rejectedReason: args.rejectedReason,
    });
  },
});
