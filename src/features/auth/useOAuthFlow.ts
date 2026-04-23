import { useCallback, useRef, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useOAuth, useSignIn, useSignUp } from '@clerk/clerk-expo';

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
    ): Promise<{ status: 'complete' | 'incomplete' | 'invalid_code' }> => {
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
            return { status: 'incomplete' };
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
          return { status: 'incomplete' };
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
  // no email code. Returns `incomplete` if Clerk needs more factors (e.g.
  // a MFA flow we don't support yet) so the caller can fall back to the
  // code flow without the user bouncing.
  const signInWithPassword = useCallback(
    async (
      email: string,
      password: string,
    ): Promise<{ status: 'complete' | 'incomplete' }> => {
      const identifier = email.trim();
      if (!identifier) throw new Error('Enter a valid email address');
      if (!password) throw new Error('Enter your password');
      if (!signInLoaded || !signIn || !setActive) {
        throw new Error('Sign-in not ready yet, try again in a moment');
      }

      setBusy('email');
      try {
        const attempt = await signIn.create({
          identifier,
          password,
          strategy: 'password',
        });
        if (attempt.status === 'complete' && attempt.createdSessionId) {
          await setActive({ session: attempt.createdSessionId });
          return { status: 'complete' };
        }
        return { status: 'incomplete' };
      } finally {
        setBusy(null);
      }
    },
    [signIn, setActive, signInLoaded],
  );

  return { signInWith, sendEmailCode, verifyEmailCode, signInWithPassword, busy };
}
