import { useLocalSearchParams } from 'expo-router';
import type { Id } from '~/convex/_generated/dataModel';
import { ChatScreen } from '~/src/features/chat/ChatScreen';

/**
 * Route wrapper for /chat/[matchId]. The ChatScreen handles everything
 * else — header, message list, input, unmatch menu.
 */
export default function ChatRoute() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  if (!matchId) return null;
  return <ChatScreen matchId={matchId as Id<'matches'>} />;
}
