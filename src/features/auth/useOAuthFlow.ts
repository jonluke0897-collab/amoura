import { useCallback, useRef, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { isClerkAPIResponseError, useOAuth, useSignIn, useSignUp } from '@clerk/clerk-expo';

// Ensures any in-flight OAuth WebBrowser sessions complete when we return to the app.
// Safe to call at module load; Clerk's Expo guide recommends this.
WebBrowser.maybeCompleteAuthSession();

// Shared deep-link target used by the OAuth providers (Apple / Google).
// Email-code flow doesn't need a redirect URL — verification happens in-app
// via the attempted code, with no browser bounce.
const OAUTH_REDIRECT_URL = Linking.createURL('/', { scheme: 'amoura' });

export type OAuthMethod = 'apple' | 'google';

/**
 * Clerk returns a structured error object with `errors[]`. We branch on
 * specific codes rather than message text — message copy is prone to
 * wording changes between Clerk releases.
 */
function hasErrorCode(e: unknown, code: string): boolean {
  if (!e || typeof e !== 'object') return false;
  const errors = (e as { errors?: Array<{ code?: string }> }).errors;
  return Array.isArray(errors) && errors.some((err) => err?.code === code);
}

const isUserNotFoundError = (e: unknown) =>
  hasErrorCode(e, 'form_identifier_not_found');

const isIncorrectCodeError = (e: unknown) =>
  hasErrorCode(e, 'form_code_incorrect');

// Clerk returns `form_password_or_identifier_incorrect` for wrong-password
// *and* wrong-identifier from a password sign-in — the combined code is
// deliberate (don't leak "user exists but password is wrong"). We treat any
// of these three as an "invalid credentials" signal so the UI can render a
// single generic error.
const isInvalidCredentialsError = (e: unknown) =>
  hasErrorCode(e, 'form_identifier_not_found') ||
  hasErrorCode(e, 'form_password_incorrect') ||
  hasErrorCode(e, 'form_password_or_identifier_incorrect');

/**
 * Pulls the structured fields off a Clerk API error so callers can forward
 * them into telemetry and dev logs. Clerk wraps every API failure in an
 * `errors[]` array — the top entry is what's user-facing, the rest are
 * supplementary. We surface the first code as the primary signal and a
 * comma-joined list as the secondary signal so PostHog can group failures
 * by `clerk_code` without losing detail.
 */
export type ClerkErrorSummary = {
  code: string;
  codes: string;
  message: string;
  longMessage: string | null;
  paramName: string | null;
};

export function summarizeClerkError(e: unknown): ClerkErrorSummary | null {
  if (!isClerkAPIResponseError(e)) return null;
  const errors = e.errors ?? [];
  const first = errors[0];
  if (!first) return null;
  return {
    code: first.code ?? 'unknown',
    codes: errors.map((err) => err.code ?? 'unknown').join(','),
    message: first.message ?? '',
    longMessage: first.longMessage ?? null,
    paramName: first.meta?.paramName ?? null,
  };
}

// Dev-only structured warning — gives the developer the Clerk error code at
// a glance instead of having to dig through an opaque "Something went wrong"
// message in the UI. No-op in production.
function devWarnAuthError(scope: string, e: unknown) {
  if (!__DEV__) return;
  const summary = summarizeClerkError(e);
  if (summary) {
    console.warn(`[Amoura] ${scope} — Clerk API error`, summary);
  } else {
    console.warn(`[Amoura] ${scope} — non-Clerk error`, e);
  }
}

// Dev-only warning for non-complete `attempt.status` returns. We don't
// support continuation states like `needs_new_password` / MFA yet, so the
// caller surfaces a generic "additional verification required" message —
// this prints which state we actually hit so it's visible without parsing
// the PostHog funnel.
function devWarnIncomplete(scope: string, clerkStatus: string) {
  if (!__DEV__) return;
  console.warn(`[Amoura] ${scope} — non-complete Clerk status`, { clerkStatus });
}

export function useOAuthFlow() {
  const appleFlow = useOAuth({ strategy: 'oauth_apple' });
  const googleFlow = useOAuth({ strategy: 'oauth_google' });
  const { signIn, setActive, isLoaded: signInLoaded } = useSignIn();
  const { signUp, isLoaded: signUpLoaded } = useSignUp();

  const [busy, setBusy] = useState<OAuthMethod | 'email' | null>(null);
  // Which Clerk flow (signIn vs signUp) was started when the code was sent.
  // The verify step routes back to the matching attemptXxx call — Clerk
  // keeps these on separate handles.
  const modeRef = useRef<'signIn' | 'signUp' | null>(null);

  const signInWith = useCallback(
    async (method: OAuthMethod): Promise<{ status: 'complete' | 'cancelled' }> => {
      setBusy(method);
      try {
        const flow = method === 'apple' ? appleFlow : googleFlow;
        const result = await flow.startOAuthFlow({ redirectUrl: OAUTH_REDIRECT_URL });
        if (result.createdSessionId && result.setActive) {
          await result.setActive({ session: result.createdSessionId });
          return { status: 'complete' };
        }
        return { status: 'cancelled' };
      } finally {
        setBusy(null);
      }
    },
    [appleFlow, googleFlow],
  );

  // Unified send — tries sign-in first, falls through to sign-up if Clerk
  // reports the identifier isn't registered yet. A single code is sent in
  // either case; the caller doesn't need to know which branch ran.
  const sendEmailCode = useCallback(
    async (email: string): Promise<void> => {
      const identifier = email.trim();
      if (!identifier) throw new Error('Enter a valid email address');
      if (!signInLoaded || !signIn || !signUpLoaded || !signUp) {
        throw new Error('Sign-in not ready yet, try again in a moment');
      }

      setBusy('email');
      try {
        // Try sign-in first.
        try {
          const { supportedFirstFactors } = await signIn.create({ identifier });
          const emailFactor = supportedFirstFactors?.find(
            (f): f is {
              strategy: 'email_code';
              emailAddressId: string;
              safeIdentifier: string;
            } => f.strategy === 'email_code',
          );
          if (!emailFactor) {
            throw new Error(
              'Email code sign-in is not enabled for this account',
            );
          }
          await signIn.prepareFirstFactor({
            strategy: 'email_code',
            emailAddressId: emailFactor.emailAddressId,
          });
          modeRef.current = 'signIn';
        } catch (e) {
          if (!isUserNotFoundError(e)) throw e;
          // Fall through: this email isn't registered; create a new account
          // and send the verification code via signUp.
          await signUp.create({ emailAddress: identifier });
          await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
          modeRef.current = 'signUp';
        }
      } finally {
        setBusy(null);
      }
    },
    [signIn, signInLoaded, signUp, signUpLoaded],
  );

  // Verify the 6-digit code against whichever flow (signIn / signUp) sent
  // it. Both paths end with setActive on success so the rest of the app
  // sees a normal authenticated session. `invalid_code` is surfaced as a
  // first-class status (rather than a generic thrown error) so the caller
  // can show the specific "wrong code" message without message-string
  // sniffing.
  const verifyEmailCode = useCallback(
    async (
      code: string,
    ): Promise<
      | { status: 'complete' }
      | { status: 'invalid_code' }
      | { status: 'incomplete'; clerkStatus: string }
    > => {
      const trimmed = code.trim();
      if (!trimmed) throw new Error('Enter the code from your email');
      if (!signIn || !signUp || !setActive) {
        throw new Error('Sign-in not ready yet, try again in a moment');
      }
      if (!modeRef.current) {
        throw new Error('Send a code first');
      }

      setBusy('email');
      try {
        try {
          if (modeRef.current === 'signIn') {
            const attempt = await signIn.attemptFirstFactor({
              strategy: 'email_code',
              code: trimmed,
            });
            if (attempt.status === 'complete' && attempt.createdSessionId) {
              await setActive({ session: attempt.createdSessionId });
              modeRef.current = null;
              return { status: 'complete' };
            }
            // Forward the actual Clerk status (`needs_first_factor`,
            // `needs_new_password`, …) so the caller can record which
            // continuation state we hit. Without this, every non-complete
            // outcome looks the same in PostHog. Clerk types `status` as
            // `SignInStatus | null` (null = pre-create); coerce so the
            // analytics payload always has a string.
            const status = attempt.status ?? 'unknown';
            devWarnIncomplete('verifyEmailCode/signIn', status);
            return { status: 'incomplete', clerkStatus: status };
          }

          // signUp branch
          const attempt = await signUp.attemptEmailAddressVerification({
            code: trimmed,
          });
          if (attempt.status === 'complete' && attempt.createdSessionId) {
            await setActive({ session: attempt.createdSessionId });
            modeRef.current = null;
            return { status: 'complete' };
          }
          const status = attempt.status ?? 'unknown';
          devWarnIncomplete('verifyEmailCode/signUp', status);
          return { status: 'incomplete', clerkStatus: status };
        } catch (e) {
          if (isIncorrectCodeError(e)) {
            return { status: 'invalid_code' };
          }
          throw e;
        }
      } finally {
        setBusy(null);
      }
    },
    [signIn, signUp, setActive],
  );

  // Fast path for returning users: email + password in a single round-trip,
  // no email code. `invalid_credentials` is surfaced as a first-class status
  // (rather than a thrown Clerk error) so the caller can render a single
  // generic error string without sniffing message text. `incomplete` covers
  // future MFA flows we don't support yet.
  const signInWithPassword = useCallback(
    async (
      email: string,
      password: string,
    ): Promise<
      | { status: 'complete' }
      | { status: 'invalid_credentials' }
      | { status: 'incomplete'; clerkStatus: string }
    > => {
      const identifier = email.trim();
      if (!identifier) throw new Error('Enter a valid email address');
      if (!password) throw new Error('Enter your password');
      if (!signInLoaded || !signIn || !setActive) {
        throw new Error('Sign-in not ready yet, try again in a moment');
      }

      setBusy('email');
      try {
        try {
          // `SignInCreateParams` is a discriminated union — for a password
          // attempt the discriminator is `strategy: 'password'`. Without it,
          // TypeScript narrows to the bare `{ identifier }` overload and
          // Clerk's API silently treats the request as a factor-discovery
          // call (returning `needs_first_factor`), or rejects it outright
          // when password isn't a configured strategy on the instance.
          const attempt = await signIn.create({
            strategy: 'password',
            identifier,
            password,
          });
          if (attempt.status === 'complete' && attempt.createdSessionId) {
            await setActive({ session: attempt.createdSessionId });
            return { status: 'complete' };
          }
          // Clerk has multiple non-complete statuses (`needs_first_factor`
          // when password is disabled on the instance, `needs_new_password`
          // for forced resets, `needs_second_factor` for MFA, …). Forward
          // the actual status so PostHog/telemetry shows which one fired
          // instead of a generic 'incomplete'. Clerk types `status` as
          // `SignInStatus | null`; coerce so the payload always has a string.
          const status = attempt.status ?? 'unknown';
          devWarnIncomplete('signInWithPassword', status);
          return { status: 'incomplete', clerkStatus: status };
        } catch (e) {
          if (isInvalidCredentialsError(e)) {
            return { status: 'invalid_credentials' };
          }
          // Anything past this point is "unexpected" from the UI's POV
          // (instance config issue, MFA, network, unverified email). Log
          // the structured error in dev so the developer sees the code
          // immediately; rethrow so the caller can record it in telemetry.
          devWarnAuthError('signInWithPassword', e);
          throw e;
        }
      } finally {
        setBusy(null);
      }
    },
    [signIn, setActive, signInLoaded],
  );

  return { signInWith, sendEmailCode, verifyEmailCode, signInWithPassword, busy };
}
