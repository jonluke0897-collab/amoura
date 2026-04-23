import { useAuth } from '@clerk/clerk-expo';
import { useQuery } from 'convex/react';
import { api } from '~/convex/_generated/api';

export type OnboardingRoute =
  | { state: 'loading' }
  | { state: 'signed-out' }
  | {
      state: 'needs-step';
      step:
        | 'identity'
        | 'intentions'
        | 'pledge'
        | 'photos'
        | 'prompts'
        | 'complete';
    };

/**
 * Decides where a user should land based on Clerk auth + Convex onboarding status.
 *
 * - loading: show a splash (Clerk still initializing, or Convex query still resolving).
 * - signed-out: route to /(auth)/sign-in.
 * - needs-step: route to /(onboarding)/<step>, except "complete" which means go to /(tabs).
 */
export function useOnboardingRoute(): OnboardingRoute {
  const { isLoaded, isSignedIn } = useAuth();
  // Skip the query until Clerk confirms a signed-in session, to avoid a needless round-trip.
  const status = useQuery(
    api.profiles.getMineStatus,
    isLoaded && isSignedIn ? {} : 'skip',
  );

  if (!isLoaded) return { state: 'loading' };
  if (!isSignedIn) return { state: 'signed-out' };
  // status === undefined: query still loading
  // status === null: auth OK but users row not yet synced (Clerk webhook race) — treat as loading
  if (status === undefined || status === null) return { state: 'loading' };
  return { state: 'needs-step', step: status.step };
}
