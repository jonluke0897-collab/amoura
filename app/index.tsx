import { Redirect } from 'expo-router';

export default function Index() {
  // Placeholder routing. TASK-009 replaces this with Clerk isSignedIn check.
  return <Redirect href="/(auth)/sign-in" />;
}
