import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useQuery } from 'convex/react';
import { api } from '~/convex/_generated/api';

/**
 * Surfaces the ID-verification prompt when appropriate, exactly once
 * per app lifecycle.
 *
 * **Not wired into the root layout by default.** The plan calls for
 * sign-in-time auto-routing after onboarding completes (TASK-060), but
 * routing to /verify-id when Persona env vars aren't configured will
 * dump users into a "verification is not configured" error screen and
 * — after 2 dismisses — lock them out. Operators should wire this hook
 * in `app/_layout.tsx` after setting PERSONA_API_KEY + PERSONA_TEMPLATE_ID
 * via `npx convex env set`. Until then, the Settings → Verify your ID
 * row is the only entry point and users opt in deliberately.
 *
 * Wire-up (one line in app/_layout.tsx after Persona is configured):
 *
 *     useVerificationGate();
 *
 * Trigger conditions:
 *   - status query returned (i.e., signed in + onboarded)
 *   - id verification status is null OR rejected
 *   - the prompt has not already been shown in this app session
 *
 * The verify-id screen itself reads dismissCount + idVerifyRequiredAt
 * from the status query and decides whether to show the "Not now"
 * button. This hook is just the "auto-open the screen" part.
 *
 * The "once per app lifecycle" rule lives in a useRef so a tab-bar
 * re-render or focus event doesn't re-route the user mid-action. The
 * counter is reset by an app reload, which is fine — the dismiss count
 * tracked server-side is what actually enforces the gate's stickiness.
 */
export function useVerificationGate() {
  const router = useRouter();
  const status = useQuery(api.verifications.status);
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    if (!status) return;
    // Only redirect when the user genuinely needs to start (or restart)
    // verification. A pending status means an inquiry is mid-flight —
    // they're either still in the Persona browser session or waiting on
    // the webhook; routing them back to verify-id would either fight
    // the in-flight session or look broken. Approved obviously needs
    // no prompt.
    const needsPrompt = status.id === null || status.id === 'rejected';
    if (!needsPrompt) return;
    fired.current = true;
    router.push('/verify-id');
  }, [status, router]);
}
