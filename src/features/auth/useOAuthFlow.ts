import { useCallback, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useOAuth, useSignIn } from '@clerk/clerk-expo';

// Ensures any in-flight OAuth WebBrowser sessions complete when we return to the app.
// Safe to call at module load; Clerk's Expo guide recommends this.
WebBrowser.maybeCompleteAuthSession();

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
        const redirectUrl = Linking.createURL('/', { scheme: 'amoura' });
        const result = await flow.startOAuthFlow({ redirectUrl });
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

  const sendMagicLink = useCallback(
    async (email: string): Promise<void> => {
      if (!signInLoaded || !signIn || !setActive) {
        throw new Error('Sign-in not ready yet, try again in a moment');
      }
      setBusy('email');
      try {
        const redirectUrl = Linking.createURL('/', { scheme: 'amoura' });

        // Start the email-link sign-in. Clerk emails a magic link; when the user taps it,
        // the flow promise below resolves and we set the active session.
        const { supportedFirstFactors } = await signIn.create({
          strategy: 'email_link',
          identifier: email,
          redirectUrl,
        });

        const emailFactor = supportedFirstFactors?.find(
          (f): f is { strategy: 'email_link'; emailAddressId: string; safeIdentifier: string } =>
            f.strategy === 'email_link',
        );
        if (!emailFactor) throw new Error('Email sign-in is not enabled for this account');

        const linkFlow = signIn.createEmailLinkFlow();
        // Fire and forget from the caller's perspective. When the user taps the link, this
        // resolves and we activate the session; setActive triggers ConvexProviderWithClerk
        // to re-authenticate, which in turn re-fires getMineStatus → root layout routes.
        linkFlow
          .startEmailLinkFlow({ emailAddressId: emailFactor.emailAddressId, redirectUrl })
          .then(async (result) => {
            if (result.status === 'complete' && result.createdSessionId) {
              await setActive({ session: result.createdSessionId });
            }
          })
          .catch((err) => {
            // Swallow for the user (caller UI handles "link expired / cancelled" via timeout UX),
            // but surface in dev so engineers see cancellations/timeouts during iteration.
            if (__DEV__) {
              // eslint-disable-next-line no-console
              console.debug('[useOAuthFlow] email link flow ended:', err);
            }
          });
      } finally {
        setBusy(null);
      }
    },
    [signIn, setActive, signInLoaded],
  );

  return { signInWith, sendMagicLink, busy };
}
