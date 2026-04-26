# AWS Rekognition Lambda — contract spec

> Operator runbook for the external Lambda that backs Amoura's photo
> verification (TASK-061). Deploy this once per environment, set the
> env vars in Convex, and the `verificationActions.startPhoto` action
> will route requests through it. The Lambda is the only place the AWS
> SDK lives — keeps the Convex bundle slim and isolates AWS credentials.

## Why a Lambda (not direct AWS SDK in Convex)

Calling AWS Rekognition directly from a Convex action would require
adding `@aws-sdk/client-rekognition` and SigV4 signing logic to every
Convex deploy. The Lambda approach lets us:

- Keep AWS credentials out of Convex (the Lambda IAM role holds them).
- Bound the AWS surface area to one function ARN that does exactly one
  thing.
- Update Rekognition logic (e.g., add liveness providers, swap to
  Bedrock for AI-image detection) without redeploying Convex.

## Request shape

```http
POST <Function URL>
Authorization: Bearer <REKOGNITION_LAMBDA_TOKEN>
Content-Type: application/json

{
  "selfieUrl": "https://<convex>.convex.cloud/api/storage/<id>?token=...",
  "profilePhotoUrl": "https://<convex>.convex.cloud/api/storage/<id>?token=..."
}
```

Both URLs are short-lived signed Convex storage URLs. The Lambda
fetches both images and passes them to `Rekognition.CompareFaces`.

## Response shape

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "similarity": 96.4,
  "livenessConfirmed": true,
  "faceCount": 1
}
```

| Field | Type | Notes |
|---|---|---|
| `similarity` | number | 0–100. Rekognition's similarity score. Required when `faceCount === 1`; can be omitted otherwise. |
| `livenessConfirmed` | boolean | Whether the selfie passes liveness. Use AWS Rekognition Face Liveness if available, or set to `true` for the MVP and tighten later. |
| `faceCount` | number | Faces detected in the selfie. 0 → no-face rejection; 1 → proceed; >1 → multiple-faces rejection. |

The Convex action collapses these into approve/reject:

| Result | Outcome |
|---|---|
| `faceCount === 0` | rejected, reason `no-face` |
| `faceCount > 1` | rejected, reason `multiple-faces` |
| `livenessConfirmed === false` | rejected, reason `no-liveness` |
| `similarity < 90` | rejected, reason `no-match` |
| else | approved |

## Lambda environment variables

Set on the Lambda function itself (not on Convex):

| Var | Value |
|---|---|
| `AMOURA_SHARED_TOKEN` | Same value as the Convex env var `REKOGNITION_LAMBDA_TOKEN`. The Lambda compares this against the `Authorization: Bearer …` header and rejects with 401 on mismatch. |
| `AWS_REGION` | The Rekognition region (`us-east-1` recommended). |

The Lambda's IAM execution role needs `rekognition:CompareFaces` and
`rekognition:DetectFaces` permissions, scoped to the region chosen.

## Function URL configuration

Deploy as a Function URL with `auth-type: NONE`. Authentication is
handled at the application layer via the bearer token — simpler than
SigV4 and the only client is one trusted Convex action.

Set CORS to `OPTIONS allowed origins: *` if you want to call from a
browser later; otherwise leave it locked to Convex's outbound IPs.

## Region gotcha

**AWS Rekognition isn't available in every region.** Notably it's NOT
available in `eu-north-1` (Stockholm) — DNS lookup for
`rekognition.eu-north-1.amazonaws.com` fails with `ENOTFOUND`. Pick
a Lambda region that supports Rekognition, or override the
Rekognition client's region in code:

```js
const rekog = new RekognitionClient({ region: 'eu-west-1' });
```

For the canonical, current list of Rekognition-supported regions, see
[AWS's regional services list](https://aws.amazon.com/about-aws/global-infrastructure/regional-product-services/)
and the [Rekognition endpoints reference](https://docs.aws.amazon.com/general/latest/gr/rekognition.html).
Feature availability (e.g., Custom Labels) varies by region within
the supported set.

If the Lambda is in a different region than Rekognition, expect an
extra ~30ms cross-region hop per call. For verification volume this
is negligible; for high-throughput workloads, co-locate them.

## Convex env vars

Set after the Lambda is deployed:

```bash
npx convex env set REKOGNITION_LAMBDA_URL https://<lambda-function-url>
npx convex env set REKOGNITION_LAMBDA_TOKEN <random-256-bit-secret>
```

Generate the token with `openssl rand -hex 32`. Persist it in your
secret-manager of choice; rotate by setting both Lambda env and
Convex env to the new value (no downtime if you support both for
a brief window).

## Lambda code (Node.js 20.x reference)

```js
import crypto from 'crypto';
import { RekognitionClient, CompareFacesCommand, DetectFacesCommand } from '@aws-sdk/client-rekognition';

const rekog = new RekognitionClient({});
const SHARED_TOKEN = process.env.AMOURA_SHARED_TOKEN;

export const handler = async (event) => {
  const auth = event.headers?.authorization ?? event.headers?.Authorization ?? '';
  const expected = `Bearer ${SHARED_TOKEN}`;
  // Timing-safe comparison so a malicious caller can't infer the token
  // length (or bytes) from response timing. timingSafeEqual requires
  // equal-length buffers; bail early when the lengths differ.
  const authBuf = Buffer.from(auth);
  const expectedBuf = Buffer.from(expected);
  if (
    authBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(authBuf, expectedBuf)
  ) {
    return { statusCode: 401, body: 'unauthorized' };
  }

  let body;
  try { body = JSON.parse(event.body ?? '{}'); }
  catch { return { statusCode: 400, body: 'invalid json' }; }

  const { selfieUrl, profilePhotoUrl } = body;
  if (!selfieUrl || !profilePhotoUrl) {
    return { statusCode: 400, body: 'missing selfieUrl or profilePhotoUrl' };
  }

  // Fetch each image with explicit response.ok checks so a token-expired
  // or 404 response surfaces as a 502 instead of silently feeding empty
  // bytes to Rekognition (which would return faceCount=0 and look like
  // a "no face detected" rejection).
  const fetchImage = async (url, label) => {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch ${label}: HTTP ${res.status}`);
    }
    return new Uint8Array(await res.arrayBuffer());
  };
  let selfieBytes, refBytes;
  try {
    [selfieBytes, refBytes] = await Promise.all([
      fetchImage(selfieUrl, 'selfie'),
      fetchImage(profilePhotoUrl, 'profilePhoto'),
    ]);
  } catch (err) {
    console.error('[lambda] image fetch failed', err);
    return { statusCode: 502, body: err.message };
  }

  // Detect faces in the selfie first to get faceCount cheaply. If 0 or
  // >1 we short-circuit and skip CompareFaces.
  const detect = await rekog.send(new DetectFacesCommand({
    Image: { Bytes: selfieBytes },
  }));
  const faceCount = detect.FaceDetails?.length ?? 0;
  if (faceCount === 0) {
    return ok({ similarity: 0, livenessConfirmed: false, faceCount: 0 });
  }
  if (faceCount > 1) {
    return ok({ similarity: 0, livenessConfirmed: false, faceCount });
  }

  const compare = await rekog.send(new CompareFacesCommand({
    SourceImage: { Bytes: selfieBytes },
    TargetImage: { Bytes: refBytes },
    SimilarityThreshold: 80,
  }));
  const match = compare.FaceMatches?.[0];
  const similarity = match?.Similarity ?? 0;

  // Liveness: AWS Rekognition Face Liveness is a separate flow that
  // requires the client to capture a session video. For Phase 5 MVP
  // we approximate via DetectFaces quality signals. Replace this
  // with the real liveness session when the iOS/Android client is
  // wired to capture one.
  const quality = detect.FaceDetails?.[0]?.Quality;
  const livenessConfirmed =
    (quality?.Brightness ?? 0) > 30 && (quality?.Sharpness ?? 0) > 30;

  return ok({ similarity, livenessConfirmed, faceCount });
};

function ok(body) {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}
```

## Cost shape

Rekognition `DetectFaces` + `CompareFaces` is ~$0.001 per call at
launch volume. With selfie verification at most once per user (2-3x
counting retries), this is negligible — single-digit dollars per
1000 verifications.

Lambda cold starts add ~1–3s on first call after idle. The Convex
action's spinner should be enough for users; if cold starts get
noticeably worse with growth, switch to provisioned concurrency for
the production region.

## Privacy

The Lambda receives selfies via signed Convex URLs. Both images are
held in Lambda memory only — no persistence to S3 or anywhere else.
Convex deletes the selfie blob after the action completes (see
`verificationActions.startPhoto` finally block). The reference
profile photo continues to live in Convex storage as the user's normal
profile photo; no copy is made.

## Sentry / monitoring

The Lambda doesn't push errors to Sentry today. Add `@sentry/aws-lambda`
in Phase 7 alongside the Sentry rollout in the main app — for now,
errors land in CloudWatch logs and the action surfaces a generic
"Verification is taking a beat" message to users on Lambda failure
(see `verificationActions.startPhoto` reject `'config'` branch).
