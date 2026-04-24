import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
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
      {menuOpen && (
        // Inline dropdown rather than a modal. A full sheet would add
        // friction for a two-item menu; this closes on outside tap via
        // the backdrop pressable below.
        <>
          <Pressable
            className="absolute inset-0"
            style={{ top: 56, height: 1000 }}
            onPress={() => setMenuOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Close menu"
          />
          <View
            className="absolute right-3 top-14 bg-cream-50 rounded-md shadow-modal border border-plum-50 overflow-hidden"
            style={{ minWidth: 160 }}
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
        </>
      )}
    </View>
  );
}
