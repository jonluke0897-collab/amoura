import { useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { useAuth } from '@clerk/clerk-expo';
import { X } from 'lucide-react-native';
import { api } from '~/convex/_generated/api';
import { Text } from '~/src/components/ui/Text';
import { Button } from '~/src/components/ui/Button';
import { ProfileView } from '~/src/features/profile/ProfileView';
import { NameEditSheet } from '~/src/features/profile/NameEditSheet';
import { CityPickerSheet } from '~/src/features/location/CityPickerSheet';

export default function ProfileTab() {
  const me = useQuery(api.users.me);
  const photos = useQuery(api.photos.listMine) ?? [];
  const prompts = useQuery(api.profilePrompts.listMine) ?? [];
  const [sheetOpen, setSheetOpen] = useState(false);
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const [nameEditOpen, setNameEditOpen] = useState(false);
  const { signOut } = useAuth();
  const markOnboardingComplete = useMutation(api.profiles.markOnboardingComplete);
  const insets = useSafeAreaInsets();

  // Migration fallback for two pre-existing stale states:
  //   1. Pre-prompts era: onboardingComplete=false despite all prereqs met.
  //   2. Pre-Phase-3 era: onboardingComplete=true but profile.isVisible=false
  //      because Phase 3 introduced the visibility flip and didn't backfill
  //      historical accounts. Without this branch, those users can browse but
  //      stay invisible to everyone else's feed (Phase 4 magic-moment break).
  // markOnboardingComplete is idempotent and a no-op if the gate isn't met.
  useEffect(() => {
    if (!me?.user || !me.profile) return;
    const needsMigration = !me.user.onboardingComplete || !me.profile.isVisible;
    if (needsMigration) {
      markOnboardingComplete().catch(() => {});
    }
  }, [me, markOnboardingComplete]);

  if (me === undefined) {
    return <View className="flex-1 bg-cream-50" />;
  }

  if (me === null || !me.profile) {
    return (
      <View className="flex-1 items-center justify-center bg-cream-50 px-5">
        <Text variant="body">Your profile is still syncing…</Text>
      </View>
    );
  }

  const goToEdit = (step: 'photos' | 'prompts' | 'identity') => {
    setSheetOpen(false);
    router.push({
      pathname: `/(onboarding)/${step}` as const,
      params: { mode: 'edit' },
    });
  };

  const handleSignOut = async () => {
    setSheetOpen(false);
    await signOut();
    router.replace('/(auth)/sign-in');
  };

  const handleChangeCity = () => {
    setSheetOpen(false);
    setCityPickerOpen(true);
  };

  const handleChangeName = () => {
    setSheetOpen(false);
    setNameEditOpen(true);
  };

  return (
    <View className="flex-1 bg-cream-50">
      <ProfileView
        displayName={me.user.displayName}
        age={null}
        pronouns={me.profile.pronouns}
        identityLabel={me.profile.genderIdentity || 'person'}
        intentions={me.profile.intentions}
        city={me.profile.city ?? null}
        photos={photos.map((p) => ({
          _id: p._id,
          url: p.url,
          width: p.width,
          height: p.height,
          isVerified: p.isVerified,
        }))}
        prompts={prompts.map((p) => ({
          _id: p._id,
          question: p.question,
          category: p.category,
          answerText: p.answerText,
        }))}
        variant="self"
        onEdit={() => setSheetOpen(true)}
        onAddPrompts={() =>
          router.push({
            pathname: '/(onboarding)/prompts',
            params: { mode: 'edit' },
          })
        }
      />

      <Modal
        visible={sheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetOpen(false)}
      >
        <Pressable className="flex-1 bg-black/40" onPress={() => setSheetOpen(false)}>
          <Pressable
            className="absolute bottom-0 left-0 right-0 bg-cream-50 rounded-t-lg pt-4 px-5"
            style={{ paddingBottom: Math.max(insets.bottom, 24) }}
            // Catch presses so the backdrop press-through doesn't close when
            // users tap inside the sheet itself. Bottom padding uses the
            // larger of the safe-area inset (Android gesture bar / iOS home
            // indicator) or 24px so the sheet never hugs the nav bar.
            onPress={() => {}}
          >
            <View className="flex-row items-center justify-between mb-4">
              <Text variant="heading" className="text-xl text-plum-900">
                Edit profile
              </Text>
              <Pressable
                onPress={() => setSheetOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={12}
              >
                <X color="#6D28D9" size={22} />
              </Pressable>
            </View>
            <SheetRow label="Edit photos" onPress={() => goToEdit('photos')} />
            <SheetRow label="Edit prompts" onPress={() => goToEdit('prompts')} />
            <SheetRow label="Edit identity" onPress={() => goToEdit('identity')} />
            <SheetRow label="Change name" onPress={handleChangeName} />
            <SheetRow label="Change city" onPress={handleChangeCity} />
            <View className="h-px bg-plum-50 my-3" />
            <Button
              label="Sign out"
              variant="ghost"
              onPress={handleSignOut}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <CityPickerSheet
        visible={cityPickerOpen}
        onClose={() => setCityPickerOpen(false)}
        onCitySet={() => setCityPickerOpen(false)}
      />

      <NameEditSheet
        visible={nameEditOpen}
        currentName={me.user.displayName}
        onClose={() => setNameEditOpen(false)}
        onSaved={() => setNameEditOpen(false)}
      />
    </View>
  );
}

function SheetRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" className="py-3">
      <Text variant="body" className="text-base text-plum-900">
        {label}
      </Text>
    </Pressable>
  );
}
