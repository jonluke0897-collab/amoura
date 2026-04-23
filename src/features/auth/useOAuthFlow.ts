import { useCallback, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useOAuth, useSignIn } from '@clerk/clerk-expo';

// Ensures any in-flight OAuth WebBrowser sessions complete when we return to the app.
// Safe to call at module load; Clerk's Expo guide recommends this.
WebBrowser.maybeCompleteAuthSession();

// Shared deep-link target used by the OAuth providers (Apple / Google).
// Email-code flow doesn't need a redirect URL — verification happens in-app
// via the attempted code, with no browser bounce.
const OAUTH_REDIRECT_URL = Linking.createURL('/', { scheme: 'amoura' });

export type OAuthMethod = 'apple' | 'google';

export function useOAuthFlow() {
  const appleFlow = useOAuth({ strategy: 'oauth_apple' });
  const googleFlow = useOAuth({ strategy: 'oauth_google' });
  const { signIn, setActive, isLoaded: signInLoaded } = useSignIn();

  const [busy, setBusy] = useState<OAuthMethod | 'email' | null>(null);

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

  // Step 1: create a sign-in attempt and ask Clerk to email a one-time code.
  // The return is void — the caller transitions to the code-entry UI on
  // resolve. Errors propagate so the UI can surface them (e.g. unknown
  // email, rate-limited).
  const sendEmailCode = useCallback(
    async (email: string): Promise<void> => {
      const identifier = email.trim();
      if (!identifier) throw new Error('Enter a valid email address');
      if (!signInLoaded || !signIn) {
        throw new Error('Sign-in not ready yet, try again in a moment');
      }

      setBusy('email');
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
      } finally {
        setBusy(null);
      }
    },
    [signIn, signInLoaded],
  );

  // Step 2: submit the 6-digit code and, on success, activate the session.
  // Throws on an invalid code so the UI can keep the user on the code-entry
  // screen with an error message.
  const verifyEmailCode = useCallback(
    async (code: string): Promise<{ status: 'complete' | 'incomplete' }> => {
      const trimmed = code.trim();
      if (!trimmed) throw new Error('Enter the code from your email');
      if (!signIn || !setActive) {
        throw new Error('Sign-in not ready yet, try again in a moment');
      }

      setBusy('email');
      try {
        const attempt = await signIn.attemptFirstFactor({
          strategy: 'email_code',
          code: trimmed,
        });
        if (attempt.status === 'complete' && attempt.createdSessionId) {
          await setActive({ session: attempt.createdSessionId });
          return { status: 'complete' };
        }
        // Any non-complete status (needs_second_factor, abandoned) is
        // surfaced as incomplete — the caller can decide how to escalate.
        return { status: 'incomplete' };
      } finally {
        setBusy(null);
      }
    },
    [signIn, setActive],
  );

  return { signInWith, sendEmailCode, verifyEmailCode, busy };
}
