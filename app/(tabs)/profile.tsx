import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
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
import { SafetyTipsSheet } from '~/src/features/settings/SafetyTipsSheet';

export default function ProfileTab() {
  const me = useQuery(api.users.me);
  const photos = useQuery(api.photos.listMine) ?? [];
  const prompts = useQuery(api.profilePrompts.listMine) ?? [];
  const [sheetOpen, setSheetOpen] = useState(false);
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const [nameEditOpen, setNameEditOpen] = useState(false);
  const [safetyTipsOpen, setSafetyTipsOpen] = useState(false);
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

  const goToBlockedUsers = () => {
    setSheetOpen(false);
    router.push('/settings/blocked-users');
  };

  const goToMyReports = () => {
    setSheetOpen(false);
    router.push('/settings/my-reports');
  };

  const handleSafetyTips = () => {
    setSheetOpen(false);
    setSafetyTipsOpen(true);
  };

  const goToVerifyPhoto = () => {
    setSheetOpen(false);
    router.push('/verify-photo');
  };

  const goToVerifyId = () => {
    setSheetOpen(false);
    router.push('/verify-id');
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
            style={{
              paddingBottom: Math.max(insets.bottom, 24),
              maxHeight: '85%',
            }}
            // Catch presses so the backdrop press-through doesn't close when
            // users tap inside the sheet itself. Bottom padding uses the
            // larger of the safe-area inset (Android gesture bar / iOS home
            // indicator) or 24px so the sheet never hugs the nav bar.
            // The 85% height cap + ScrollView accommodates Phase 5's
            // expanded row count (Safety & Privacy section).
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
            <ScrollView showsVerticalScrollIndicator={false}>
              <SheetRow label="Edit photos" onPress={() => goToEdit('photos')} />
              <SheetRow label="Edit prompts" onPress={() => goToEdit('prompts')} />
              <SheetRow label="Edit identity" onPress={() => goToEdit('identity')} />
              <SheetRow label="Change name" onPress={handleChangeName} />
              <SheetRow label="Change city" onPress={handleChangeCity} />

              <SectionHeader label="Safety & Privacy" />
              <SheetRow label="Verify your photo" onPress={goToVerifyPhoto} />
              <SheetRow label="Verify your ID" onPress={goToVerifyId} />
              <SheetRow label="Blocked users" onPress={goToBlockedUsers} />
              <SheetRow label="My reports" onPress={goToMyReports} />
              <SheetRow label="Safety tips" onPress={handleSafetyTips} />

              <View className="h-px bg-plum-50 my-3" />
              <Button
                label="Sign out"
                variant="ghost"
                onPress={handleSignOut}
              />
            </ScrollView>
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

      <SafetyTipsSheet
        visible={safetyTipsOpen}
        onClose={() => setSafetyTipsOpen(false)}
      />
    </View>
  );
}

function SheetRow({
  label,
  onPress,
  hint,
}: {
  label: string;
  onPress: () => void;
  hint?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="flex-row items-center justify-between py-3"
    >
      <Text variant="body" className="text-base text-plum-900">
        {label}
      </Text>
      {hint && (
        <Text variant="caption" className="text-xs text-plum-400">
          {hint}
        </Text>
      )}
    </Pressable>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <View className="mt-4 mb-1 pt-3 border-t border-plum-50">
      <Text
        variant="caption"
        className="text-xs uppercase tracking-wider text-plum-400"
      >
        {label}
      </Text>
    </View>
  );
}
