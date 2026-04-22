import { useLocalSearchParams } from 'expo-router';
import type { Id } from '~/convex/_generated/dataModel';
import { ProfileDetailScreen } from '~/src/features/profile/ProfileDetailScreen';

export default function ProfileDetailRoute() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  return <ProfileDetailScreen userId={userId as Id<'users'>} />;
}
