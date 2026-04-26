import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

/**
 * Persona deep-link landing route. Persona's hosted flow redirects to
 * `amoura://verify-id-return?inquiry-id=...&status=completed` when the
 * inquiry finishes. On iOS the redirect closes SFAuthenticationSession
 * inline and we never reach this route. On Android, the OS intent
 * dispatch races the Custom Tab callback and usually wins — when it
 * does, we land here. Either way the work is the same: bounce back to
 * the verify-id screen, whose status query subscription will surface
 * the webhook-written verifications row and render the success panel.
 */
export default function VerifyIdReturn() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/verify-id');
  }, [router]);
  return null;
}
