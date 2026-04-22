/**
 * Phase 5 scaffold. Real implementation lands with TASK-059+ (AWS Rekognition
 * selfie verification). For now this module exists so Phase 2 UI components
 * (VerificationBadge) can evolve against a stable import path without
 * accidentally shipping a functional query/mutation that would be mistaken for
 * working verification.
 *
 * Expected Phase 5 exports:
 *   - startVerification(mutation): creates a verifications row with status
 *     'pending', calls Rekognition, writes back status approved/rejected.
 *   - getMineStatus(query): returns { status, rejectedReason? } for the
 *     current user so the UI can show guidance after a rejected attempt.
 *   - listRejected(internalQuery): for moderation dashboards.
 */

export {};
