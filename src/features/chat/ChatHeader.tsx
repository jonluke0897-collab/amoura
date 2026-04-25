import { useState } from 'react';
import { Alert, Modal, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation } from 'convex/react';
import { ChevronLeft, MoreVertical } from 'lucide-react-native';
import { api } from '~/convex/_generated/api';
import type { Id } from '~/convex/_generated/dataModel';
import { Avatar } from '~/src/components/ui/Avatar';
import { Text } from '~/src/components/ui/Text';
import { AnalyticsEvents, useTrack } from '~/src/lib/analytics';

export type ChatHeaderProps = {
  matchId: Id<'matches'>;
  counterpartyUserId: Id<'users'>;
  counterpartyDisplayName: string;
  counterpartyPhotoUrl: string | null;
  counterpartyPronouns: string[];
  counterpartyIdentityLabel: string;
};

export function ChatHeader({
  matchId,
  counterpartyUserId,
  counterpartyDisplayName,
  counterpartyPhotoUrl,
  counterpartyPronouns,
  counterpartyIdentityLabel,
}: ChatHeaderProps) {
  const router = useRouter();
  const track = useTrack();
  const unmatch = useMutation(api.matches.unmatch);
  const [menuOpen, setMenuOpen] = useState(false);

  function confirmUnmatch() {
    setMenuOpen(false);
    Alert.alert(
      'Unmatch?',
      'This will remove the conversation for both of you. There\u2019s no undo.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unmatch',
          style: 'destructive',
          onPress: async () => {
            try {
              await unmatch({ matchId });
              track(AnalyticsEvents.UNMATCH);
              router.back();
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              Alert.alert("Couldn't unmatch", msg);
            }
          },
        },
      ],
    );
  }

  return (
    <View className="relative">
      <View className="flex-row items-center px-3 py-2 bg-cream-50 border-b border-plum-50">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={12}
          className="h-10 w-10 items-center justify-center"
        >
          <ChevronLeft color="#6D28D9" size={22} />
        </Pressable>
        <Pressable
          onPress={() =>
            router.push(`/profile/${counterpartyUserId}` as never)
          }
          accessibilityRole="button"
          accessibilityLabel={`View ${counterpartyDisplayName}'s profile`}
          className="flex-row items-center flex-1 mr-2"
        >
          <Avatar
            displayName={counterpartyDisplayName}
            photoUrl={counterpartyPhotoUrl}
            size={40}
          />
          <View className="ml-3 flex-1">
            <Text
              variant="heading"
              numberOfLines={1}
              className="text-base text-plum-900"
            >
              {counterpartyDisplayName}
            </Text>
            <Text
              variant="caption"
              numberOfLines={1}
              className="text-xs text-plum-600"
            >
              {[counterpartyIdentityLabel, counterpartyPronouns.join(' / ')]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => setMenuOpen((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel="More options"
          hitSlop={12}
          className="h-10 w-10 items-center justify-center"
        >
          <MoreVertical color="#6D28D9" size={20} />
        </Pressable>
      </View>
      {/* Menu rendered via Modal so taps work outside the header's bounds.
          Inline-absolute positioning was hit-clipped by Android's parent
          bounds when the menu sat below the header. The Modal opens a new
          window so hit-testing is independent of the header's flex box. */}
      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <Pressable
          className="flex-1"
          onPress={() => setMenuOpen(false)}
          accessibilityRole="button"
          accessibilityLabel="Close menu"
        >
          {/* The dropdown sits roughly under the ⋮ icon (top-right of the
              header). Top offset = status bar + header (~96 on most
              Androids); cheap visual approximation. */}
          <View
            className="absolute right-3 bg-cream-50 rounded-md shadow-modal border border-plum-50 overflow-hidden"
            style={{ top: 96, minWidth: 160 }}
          >
            <Pressable
              onPress={() => {
                setMenuOpen(false);
                router.push(`/profile/${counterpartyUserId}` as never);
              }}
              className="px-4 py-3"
              accessibilityRole="button"
              accessibilityLabel="View profile"
            >
              <Text variant="body" className="text-plum-900">
                View profile
              </Text>
            </Pressable>
            <View className="h-px bg-plum-50" />
            <Pressable
              onPress={confirmUnmatch}
              className="px-4 py-3"
              accessibilityRole="button"
              accessibilityLabel="Unmatch"
            >
              <Text variant="body" className="text-rose-700">
                Unmatch
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
