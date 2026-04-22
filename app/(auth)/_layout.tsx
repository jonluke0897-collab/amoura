import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';

export default function AuthLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  // If Clerk already has a session (including the async magic-link completion),
  // bounce to / so the root router routes us to onboarding or tabs.
  if (isLoaded && isSignedIn) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
