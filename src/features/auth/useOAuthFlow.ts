import { useCallback, useRef, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useOAuth, useSignIn } from '@clerk/clerk-expo';

// Ensures any in-flight OAuth WebBrowser sessions complete when we return to the app.
// Safe to call at module load; Clerk's Expo guide recommends this.
WebBrowser.maybeCompleteAuthSession();

// Shared deep-link target used by both Clerk OAuth providers and the email-link
// flow. Computed at module load (Linking.createURL is side-effect-free).
// Centralizing avoids drift if the scheme or path ever changes.
const OAUTH_REDIRECT_URL = Linking.createURL('/', { scheme: 'amoura' });

export type OAuthMethod = 'apple' | 'google';

type EmailLinkFlowHandle = { cancelEmailLinkFlow: () => void };

export function useOAuthFlow() {
  const appleFlow = useOAuth({ strategy: 'oauth_apple' });
  const googleFlow = useOAuth({ strategy: 'oauth_google' });
  const { signIn, setActive, isLoaded: signInLoaded } = useSignIn();

  const [busy, setBusy] = useState<OAuthMethod | 'email' | null>(null);
  const linkFlowRef = useRef<EmailLinkFlowHandle | null>(null);

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

  const sendMagicLink = useCallback(
    async (email: string): Promise<void> => {
      if (!signInLoaded || !signIn || !setActive) {
        throw new Error('Sign-in not ready yet, try again in a moment');
      }

      // If a prior send is still long-polling (user tapped Send again before
      // tapping the first email's link), cancel it so only one flow races
      // setActive. Best-effort — swallow errors.
      if (linkFlowRef.current) {
        try {
          linkFlowRef.current.cancelEmailLinkFlow();
          if (__DEV__) {
            // eslint-disable-next-line no-console
            console.debug('[useOAuthFlow] cancelled prior email link flow');
          }
        } catch {
          // Ignore — we're about to start a new flow anyway.
        }
      }

      setBusy('email');
      try {
        // Start the email-link sign-in. Clerk emails a magic link; when the user taps it,
        // the flow promise below resolves and we set the active session.
        const { supportedFirstFactors } = await signIn.create({
          strategy: 'email_link',
          identifier: email,
          redirectUrl: OAUTH_REDIRECT_URL,
        });

        const emailFactor = supportedFirstFactors?.find(
          (f): f is { strategy: 'email_link'; emailAddressId: string; safeIdentifier: string } =>
            f.strategy === 'email_link',
        );
        if (!emailFactor) throw new Error('Email sign-in is not enabled for this account');

        const linkFlow = signIn.createEmailLinkFlow();
        linkFlowRef.current = linkFlow;
        // Intentionally fire-and-forget. The caller's async work completes once
        // Clerk has sent the magic-link email (from signIn.create above); the
        // UI shows "Check your inbox" immediately. startEmailLinkFlow below only
        // resolves when the user taps the link in their email, which could be
        // minutes later or never. Awaiting it would block the sheet UI forever.
        // When the link is tapped, setActive triggers ConvexProviderWithClerk
        // to re-authenticate, which re-fires getMineStatus → (auth) layout
        // redirects the user away.
        linkFlow
          .startEmailLinkFlow({ emailAddressId: emailFactor.emailAddressId, redirectUrl: OAUTH_REDIRECT_URL })
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
          })
          .finally(() => {
            // Only clear if a later call hasn't already replaced the ref.
            if (linkFlowRef.current === linkFlow) {
              linkFlowRef.current = null;
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
