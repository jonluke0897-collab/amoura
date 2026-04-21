import { PostHogProvider } from 'posthog-react-native';
import type { ReactNode } from 'react';
import { env } from '~/src/lib/env';

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const apiKey = env.posthogKey;

  // Bootstrap fallback: if PostHog key isn't set yet, skip the provider.
  if (!apiKey) {
    if (__DEV__) {
      console.warn('[Amoura] EXPO_PUBLIC_POSTHOG_KEY missing — analytics are disabled.');
    }
    return <>{children}</>;
  }

  return (
    <PostHogProvider apiKey={apiKey} options={{ host: 'https://us.i.posthog.com' }} autocapture>
      {children}
    </PostHogProvider>
  );
}
