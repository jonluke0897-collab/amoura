import { View } from 'react-native';
import { Check, CheckCheck } from 'lucide-react-native';
import { Text } from '~/src/components/ui/Text';
import { formatClockTime } from '~/src/lib/dateFormat';

export type MessageBubbleProps = {
  body: string;
  messageType: 'text' | 'photo' | 'system';
  isMine: boolean;
  readAt: number | null;
  createdAt: number;
  /**
   * When true, read receipts render as the double-check indicator. When
   * false (free tier), a single delivered-check shows on the sender's
   * own outgoing messages but no read state is revealed. Matches the
   * paid-tier gate from TASK-056.
   */
  showReadReceipts: boolean;
};

/**
 * Chat message bubble. Three layouts by messageType:
 *   - "system": centered, italic, muted — used for "You matched…" seed
 *     message and any future system events (unmatch, warning, etc.).
 *   - "text" (mine): right-aligned plum bubble with cream text.
 *   - "text" (theirs): left-aligned cream bubble with plum text.
 *
 * Photo bubbles are deferred to a later phase per the Phase 4 plan — the
 * messageType is accepted so schema validation passes if a test row is
 * ever inserted manually, but the renderer falls back to the text layout.
 */
export function MessageBubble({
  body,
  messageType,
  isMine,
  readAt,
  createdAt,
  showReadReceipts,
}: MessageBubbleProps) {
  if (messageType === 'system') {
    return (
      <View className="px-8 py-3">
        <Text
          variant="body"
          className="text-center text-sm text-plum-600 italic"
        >
          {body}
        </Text>
      </View>
    );
  }

  const bubbleBase =
    'max-w-[80%] rounded-2xl px-4 py-2.5 my-1 shadow-card';
  const mine = isMine;
  const bubbleClass = mine
    ? `${bubbleBase} bg-plum-600 self-end rounded-br-md`
    : `${bubbleBase} bg-cream-50 border border-plum-50 self-start rounded-bl-md`;
  const textClass = mine
    ? 'text-base text-cream-50 leading-6'
    : 'text-base text-plum-900 leading-6';

  return (
    <View className="px-4">
      <View className={bubbleClass}>
        <Text variant="body" className={textClass}>
          {body}
        </Text>
        {mine && (
          <View className="flex-row items-center justify-end mt-1">
            <Text className="text-[10px] text-cream-50/70 mr-1">
              {formatClockTime(createdAt)}
            </Text>
            {showReadReceipts && readAt !== null ? (
              <CheckCheck color="#FAFAFF" size={12} />
            ) : (
              <Check color="#FAFAFF" size={12} />
            )}
          </View>
        )}
        {!mine && (
          <Text className="text-[10px] text-plum-400 mt-1">
            {formatClockTime(createdAt)}
          </Text>
        )}
      </View>
    </View>
  );
}

