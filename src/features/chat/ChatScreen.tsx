import { useEffect } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react';
import { useCallback } from 'react';
import { api } from '~/convex/_generated/api';
import type { Id } from '~/convex/_generated/dataModel';
import { Text } from '~/src/components/ui/Text';
import { AnalyticsEvents, useTrack } from '~/src/lib/analytics';
import { ChatHeader } from './ChatHeader';
import { ChatInput } from './ChatInput';
import { MessageBubble } from './MessageBubble';

const PAGE_SIZE = 30;

export type ChatScreenProps = {
  matchId: Id<'matches'>;
};

export function ChatScreen({ matchId }: ChatScreenProps) {
  const me = useQuery(api.users.me);
  const match = useQuery(api.matches.get, { matchId });
  const messages = usePaginatedQuery(
    api.messages.listByMatch,
    { matchId },
    { initialNumItems: PAGE_SIZE },
  );
  const markRead = useMutation(api.messages.markRead);
  const track = useTrack();

  // Mark read on focus. Convex reactivity will push the unread-count
  // reset to the Matches tab list automatically.
  useFocusEffect(
    useCallback(() => {
      markRead({ matchId }).catch(() => {
        // Best-effort; silent failure is fine — the unread badge will
        // clear on next focus.
      });
    }, [markRead, matchId]),
  );

  // Fire chat_opened once per mount.
  useEffect(() => {
    track(AnalyticsEvents.CHAT_OPENED);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  const showReadReceipts = me?.hasActiveSubscription ?? false;
  const messageCount = messages.results.length;

  if (match === undefined || me === undefined) {
    return <View className="flex-1 bg-cream-50" />;
  }

  if (match === null) {
    // Match no longer exists (unmatched by the counterparty, deleted
    // user, etc.). Show a terminal state rather than an empty chat.
    return (
      <SafeAreaView className="flex-1 bg-cream-50 items-center justify-center px-6">
        <Text variant="heading" className="text-2xl text-plum-900 text-center">
          This match is no longer available.
        </Text>
        <Text variant="body" className="text-base text-plum-600 mt-2 text-center">
          You can find new people in Browse.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      className="flex-1 bg-cream-50"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
        className="flex-1"
      >
        <ChatHeader
          matchId={matchId}
          counterpartyUserId={match.counterpartyUserId}
          counterpartyDisplayName={match.counterpartyDisplayName}
          counterpartyPhotoUrl={match.counterpartyPhotoUrl}
          counterpartyPronouns={match.counterpartyPronouns}
          counterpartyIdentityLabel={match.counterpartyIdentityLabel}
        />
        <FlatList
          data={messages.results}
          keyExtractor={(item) => item.messageId}
          // `inverted` flips the list so new messages render at the
          // bottom and scrolling up pages older messages. Query returns
          // newest-first, which matches inverted rendering naturally.
          inverted
          contentContainerStyle={{ paddingVertical: 12, flexGrow: 1 }}
          onEndReached={() => {
            if (messages.status === 'CanLoadMore') messages.loadMore(PAGE_SIZE);
          }}
          onEndReachedThreshold={0.4}
          renderItem={({ item }) => (
            <MessageBubble
              body={item.body}
              messageType={item.messageType}
              isMine={item.isMine}
              readAt={item.readAt}
              createdAt={item.createdAt}
              showReadReceipts={showReadReceipts}
            />
          )}
        />
        <ChatInput matchId={matchId} messageCountBeforeSend={messageCount} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
