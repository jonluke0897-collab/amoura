import { useRef, useState } from 'react';
import { ActionSheetIOS, Alert, Platform, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from '~/convex/_generated/api';
import type { Id } from '~/convex/_generated/dataModel';
import { Text } from '~/src/components/ui/Text';
import { Button } from '~/src/components/ui/Button';
import { PhotoGrid } from '~/src/features/photos/PhotoGrid';
import { usePhotoPicker, type PickedPhoto } from '~/src/features/photos/usePhotoPicker';
import { PHOTOS_SCREEN } from '~/src/features/onboarding/onboardingCopy';
import { AnalyticsEvents, useTrack } from '~/src/lib/analytics';

const MIN_PHOTOS = 2;
const MAX_PHOTOS = 6;

export default function PhotosScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const isEditMode = params.mode === 'edit';

  const photos = useQuery(api.photos.listMine) ?? [];
  const generateUploadUrl = useMutation(api.photos.generateUploadUrl);
  const finalizeUpload = useMutation(api.photos.finalizeUpload);
  const removePhoto = useMutation(api.photos.remove);
  const reorderPhotos = useMutation(api.photos.reorder);
  const { pickFromLibrary, pickFromCamera, isProcessing } = usePhotoPicker();
  const track = useTrack();

  const [uploadingCount, setUploadingCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const continueInFlight = useRef(false);

  const openPicker = () => {
    if (photos.length + uploadingCount >= MAX_PHOTOS) return;
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [PHOTOS_SCREEN.pickerCamera, PHOTOS_SCREEN.pickerLibrary, PHOTOS_SCREEN.pickerCancel],
          cancelButtonIndex: 2,
        },
        (idx) => {
          if (idx === 0) handlePick(pickFromCamera);
          if (idx === 1) handlePick(pickFromLibrary);
        },
      );
    } else {
      Alert.alert(PHOTOS_SCREEN.addCta, undefined, [
        { text: PHOTOS_SCREEN.pickerCamera, onPress: () => handlePick(pickFromCamera) },
        { text: PHOTOS_SCREEN.pickerLibrary, onPress: () => handlePick(pickFromLibrary) },
        { text: PHOTOS_SCREEN.pickerCancel, style: 'cancel' },
      ]);
    }
  };

  const handlePick = async (picker: () => Promise<PickedPhoto | null>) => {
    setError(null);
    try {
      const picked = await picker();
      if (!picked) return;
      await uploadAndFinalize(picked);
    } catch (e) {
      if (__DEV__) console.error('[photos] pick/upload failed:', e);
      setError(
        e instanceof Error && e.message.toLowerCase().includes('permission')
          ? PHOTOS_SCREEN.permissionDeniedBody
          : PHOTOS_SCREEN.uploadFailedBody,
      );
    }
  };

  const uploadAndFinalize = async (picked: PickedPhoto) => {
    setUploadingCount((n) => n + 1);
    try {
      const uploadUrl = await generateUploadUrl();
      // Read the local file into a blob. fetch() on a file:// URI returns the
      // bytes on iOS + Android. expo-image-manipulator has already normalized
      // the URI (HEIC → JPEG), so Content-Type is safely image/jpeg.
      const blob = await (await fetch(picked.uri)).blob();
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'image/jpeg' },
        body: blob,
      });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      const { storageId } = (await res.json()) as { storageId: Id<'_storage'> };
      await finalizeUpload({ storageId, width: picked.width, height: picked.height });
    } finally {
      setUploadingCount((n) => Math.max(0, n - 1));
    }
  };

  const handleRemove = (id: Id<'photos'>) => {
    Alert.alert(PHOTOS_SCREEN.removeTitle, undefined, [
      { text: PHOTOS_SCREEN.removeCancel, style: 'cancel' },
      {
        text: PHOTOS_SCREEN.removeConfirm,
        style: 'destructive',
        onPress: async () => {
          try {
            await removePhoto({ photoId: id });
          } catch (e) {
            if (__DEV__) console.error('[photos] remove failed:', e);
          }
        },
      },
    ]);
  };

  const handleReorder = async (ids: Id<'photos'>[]) => {
    try {
      await reorderPhotos({ photoIds: ids });
    } catch (e) {
      if (__DEV__) console.error('[photos] reorder failed:', e);
    }
  };

  const canContinue = photos.length >= MIN_PHOTOS && !isProcessing && uploadingCount === 0;

  const handleContinue = () => {
    if (continueInFlight.current) return;
    continueInFlight.current = true;
    track(AnalyticsEvents.ONBOARDING_STEP_COMPLETED, { step: 'photos' });
    if (isEditMode) router.back();
    else router.replace('/(onboarding)/prompts');
  };

  return (
    <View className="flex-1 px-5 pt-4">
      <Text variant="heading" className="text-3xl text-plum-600 mb-2">
        {PHOTOS_SCREEN.heading}
      </Text>
      <Text variant="body" className="text-base text-plum-900 mb-4 leading-6">
        {PHOTOS_SCREEN.subhead}
      </Text>

      <View className="flex-1">
        <PhotoGrid
          photos={photos.map((p) => ({ _id: p._id, url: p.url }))}
          uploadingCount={uploadingCount}
          onAdd={openPicker}
          onRemove={handleRemove}
          onReorder={handleReorder}
        />
      </View>

      {error && (
        <Text variant="body" className="text-rose-700 mb-2 text-sm">
          {error}
        </Text>
      )}

      {photos.length < MIN_PHOTOS && (
        <Text variant="caption" className="mb-3 text-sm">
          {PHOTOS_SCREEN.minHint}
        </Text>
      )}

      <Button
        label={isEditMode ? PHOTOS_SCREEN.saveCta : PHOTOS_SCREEN.continueCta}
        size="lg"
        onPress={handleContinue}
        disabled={!canContinue}
        className="mb-4"
      />
    </View>
  );
}
