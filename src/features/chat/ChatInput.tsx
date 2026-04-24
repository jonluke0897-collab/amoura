import { useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import { Send } from 'lucide-react-native';
import { useMutation } from 'convex/react';
import { api } from '~/convex/_generated/api';
import type { Id } from '~/convex/_generated/dataModel';
import { AnalyticsEvents, useTrack } from '~/src/lib/analytics';
import { promptForPushPermissionIfNeeded } from '~/src/providers/NotificationProvider';

export type ChatInputProps = {
  matchId: Id<'matches'>;
  /**
   * Number of messages currently in the match, pre-send. Used to fire
   * the `first_message_sent` analytics event — 1 means only the system
   * seed exists, so our send is the first real message.
   */
  messageCountBeforeSend: number;
};

const MAX_CHARS = 2000;

export function ChatInput({ matchId, messageCountBeforeSend }: ChatInputProps) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const send = useMutation(api.messages.send);
  const track = useTrack();

  const trimmed = text.trim();
  const canSend = trimmed.length > 0 && !sending;

  async function handleSend() {
    if (!canSend) return;
    const body = trimmed;
    // Clear input optimistically — Convex reactivity will render the new
    // message as soon as it commits. Restore on failure so the user
    // doesn't lose their draft.
    setText('');
    setSending(true);
    try {
      await send({ matchId, body });
      track(AnalyticsEvents.MESSAGE_SENT);
      if (messageCountBeforeSend <= 1) {
        // ≤1 means only the system seed was present; our send is the
        // first real back-and-forth message.
        track(AnalyticsEvents.FIRST_MESSAGE_SENT);
      }
      if (messageCountBeforeSend === 5) {
        track(AnalyticsEvents.CONVERSATION_DEPTH_5);
      }
      // Nudge for push at the first real send.
      if (messageCountBeforeSend <= 1) {
        promptForPushPermissionIfNeeded();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setText(body);
      if (msg.startsWith('RATE_LIMITED:messages-daily')) {
        Alert.alert(
          "You've sent a lot today",
          "Take a breather — the limit resets tomorrow.",
        );
      } else if (msg.includes('no longer available')) {
        Alert.alert('Match unavailable', 'This match is no longer active.');
      } else {
        Alert.alert("Couldn't send", "Try again in a moment.");
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <View className="flex-row items-end px-3 py-2 bg-cream-50 border-t border-plum-50">
      <View className="flex-1 mr-2">
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Message…"
          placeholderTextColor="#8A7F78"
          multiline
          maxLength={MAX_CHARS}
          editable={!sending}
          style={{
            minHeight: 40,
            maxHeight: 120,
            paddingHorizontal: 14,
            paddingVertical: 10,
            backgroundColor: '#F7EDF3',
            borderRadius: 20,
            fontFamily: 'Inter',
            fontSize: 16,
            color: '#2C1520',
          }}
        />
      </View>
      <Pressable
        onPress={handleSend}
        disabled={!canSend}
        accessibilityRole="button"
        accessibilityLabel="Send message"
        className="h-10 w-10 rounded-full items-center justify-center bg-plum-600"
        style={{ opacity: canSend ? 1 : 0.4 }}
      >
        <Send color="#FAFAFF" size={18} />
      </Pressable>
    </View>
  );
}
