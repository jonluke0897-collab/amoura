import { ConvexReactClient } from 'convex/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { useAuth } from '@clerk/clerk-expo';
import type { ReactNode } from 'react';
import { env } from '~/src/lib/env';

// Bootstrap fallback: if Convex URL isn't set yet, skip the provider.
// Once EXPO_PUBLIC_CONVEX_URL is in .env, Convex activates automatically.
let client: ConvexReactClient | null = null;
try {
  client = new ConvexReactClient(env.convexUrl);
} catch {
  if (__DEV__) {
    console.warn('[Amoura] EXPO_PUBLIC_CONVEX_URL missing — Convex is disabled.');
  }
}

export function ConvexProvider({ children }: { children: ReactNode }) {
  if (!client) return <>{children}</>;
  return (
    <ConvexProviderWithClerk client={client} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}
