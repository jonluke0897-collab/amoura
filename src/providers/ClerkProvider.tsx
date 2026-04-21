import { ClerkProvider as BaseClerkProvider } from '@clerk/clerk-expo';
import { tokenCache } from '@clerk/clerk-expo/token-cache';
import type { ReactNode } from 'react';
import { env } from '~/src/lib/env';

export function ClerkProvider({ children }: { children: ReactNode }) {
  const key = env.clerkPublishableKey;

  // Bootstrap fallback: if the Clerk key isn't set yet, skip the provider entirely
  // so the app still boots for UI/design QA. Once the .env is populated, Clerk activates.
  if (!key) {
    if (__DEV__) {
      console.warn('[Amoura] EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY missing — auth is disabled.');
    }
    return <>{children}</>;
  }

  return (
    <BaseClerkProvider publishableKey={key} tokenCache={tokenCache}>
      {children}
    </BaseClerkProvider>
  );
}
