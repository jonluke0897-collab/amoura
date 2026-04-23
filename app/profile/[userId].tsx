import { Redirect, useLocalSearchParams } from 'expo-router';
import type { Id } from '~/convex/_generated/dataModel';
import { ProfileDetailScreen } from '~/src/features/profile/ProfileDetailScreen';

export default function ProfileDetailRoute() {
  // useLocalSearchParams isn't runtime-validated: the param can be undefined
  // (dropped deep link) or an array of strings (same key repeated). Normalize
  // before passing to Convex, whose v.id validator would throw on bad input.
  const params = useLocalSearchParams<{ userId?: string | string[] }>();
  const userId = Array.isArray(params.userId) ? params.userId[0] : params.userId;
  if (!userId) return <Redirect href="/(tabs)/profile" />;
  return <ProfileDetailScreen userId={userId as Id<'users'>} />;
}
