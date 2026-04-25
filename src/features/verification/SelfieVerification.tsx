import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { useAction, useMutation } from 'convex/react';
import { ChevronLeft } from 'lucide-react-native';
import { api } from '~/convex/_generated/api';
import { Button } from '~/src/components/ui/Button';
import { Text } from '~/src/components/ui/Text';
import { AnalyticsEvents, useTrack } from '~/src/lib/analytics';

// Match the photo upload pipeline (src/features/photos/usePhotoPicker.ts):
// 2048px long edge + 0.85 JPEG quality keeps the selfie comparable to the
// reference photo in dimensions/quality so Rekognition isn't comparing
// apples to oranges.
const MAX_LONG_EDGE = 2048;
const JPEG_QUALITY = 0.85;

// Random pose prompts per § 12 edge case "Photo Verification". The user is
// given one prompt per attempt — stays simple and the variety is enough
// to deter trivial spoofing with a static photo.
const POSE_PROMPTS: readonly string[] = [
  'Look straight at the camera and smile.',
  'Turn your head slightly to the left.',
  'Turn your head slightly to the right.',
  'Tilt your chin down a little.',
];

const REJECT_COPY: Record<
  'no-face' | 'multiple-faces' | 'no-liveness' | 'no-match' | 'config',
  { heading: string; body: string }
> = {
  'no-face': {
    heading: 'We can’t see a face clearly.',
    body: 'Try better lighting and make sure your face fills the frame.',
  },
  'multiple-faces': {
    heading: 'Let’s get just you in frame.',
    body: 'Find a spot where no one else is in the shot, then try again.',
  },
  'no-liveness': {
    heading: 'Try a fresh selfie, not a photo of a photo.',
    body: 'Verification only works with a live camera capture.',
  },
  'no-match': {
    heading: 'Hmm, those don’t look like the same person.',
    body: 'Make sure you’re using the same look as your profile photo, then try again.',
  },
  config: {
    heading: 'Verification is taking a beat.',
    body: 'Our verification service is offline right now. Please try again in a few minutes.',
  },
};

export function SelfieVerification() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const track = useTrack();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [pose] = useState(
    () => POSE_PROMPTS[Math.floor(Math.random() * POSE_PROMPTS.length)],
  );
  const [step, setStep] = useState<
    | { kind: 'capture' }
    | { kind: 'submitting' }
    | { kind: 'approved' }
    | {
        kind: 'rejected';
        reason: keyof typeof REJECT_COPY;
      }
  >({ kind: 'capture' });

  const generateUploadUrl = useMutation(api.verifications.generateSelfieUploadUrl);
  const startPhoto = useAction(api.verificationActions.startPhoto);

  useEffect(() => {
    track(AnalyticsEvents.VERIFICATION_PROMPT_SHOWN, { type: 'photo' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-request permission on mount. expo-camera renders a black
  // placeholder until granted; without the prompt the user sits looking
  // at black until they figure out the OS settings.
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  // The Rekognition action takes >1s on the first run (cold Lambda).
  // The plan's verification scenario notes >30s should show "Almost
  // there..." per § 12. For now the spinner alone is enough; switch to a
  // staged "Almost there..." message if we see slow Lambda starts on
  // the dev build.
  async function captureAndVerify(): Promise<void> {
    if (!cameraRef.current) return;
    setStep({ kind: 'submitting' });
    track(AnalyticsEvents.VERIFICATION_STARTED, { type: 'photo' });
    try {
      const photo = await cameraRef.current.takePictureAsync({
        skipProcessing: false,
        quality: JPEG_QUALITY,
      });
      if (!photo) throw new Error('Camera returned no photo');

      // Resize to match the photo upload's long-edge cap. Rekognition
      // accepts up to 5MB; 2048px @ 0.85 JPEG is well under.
      const longEdge = Math.max(photo.width, photo.height);
      const resized =
        longEdge > MAX_LONG_EDGE
          ? await ImageManipulator.manipulateAsync(
              photo.uri,
              [
                {
                  resize:
                    photo.width >= photo.height
                      ? { width: MAX_LONG_EDGE }
                      : { height: MAX_LONG_EDGE },
                },
              ],
              { compress: JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG },
            )
          : { uri: photo.uri };

      const uploadUrl = await generateUploadUrl();
      const blob = await fetch(resized.uri).then((r) => r.blob());
      const upload = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'image/jpeg' },
        body: blob,
      });
      if (!upload.ok) throw new Error('Upload failed');
      const { storageId } = (await upload.json()) as { storageId: string };

      const result = await startPhoto({
        selfieStorageId: storageId as never,
      });
      if (result.status === 'approved') {
        track(AnalyticsEvents.VERIFICATION_APPROVED, { type: 'photo' });
        setStep({ kind: 'approved' });
      } else {
        track(AnalyticsEvents.VERIFICATION_REJECTED, {
          type: 'photo',
          reason: result.reason,
        });
        setStep({ kind: 'rejected', reason: result.reason });
      }
    } catch (e) {
      console.warn('[SelfieVerification] capture failed', e);
      track(AnalyticsEvents.VERIFICATION_REJECTED, {
        type: 'photo',
        reason: 'config',
      });
      setStep({ kind: 'rejected', reason: 'config' });
    }
  }

  if (!permission) {
    return <View className="flex-1 bg-plum-900" />;
  }

  if (!permission.granted) {
    return (
      <View
        className="flex-1 bg-cream-50 px-6 items-center justify-center"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        <Text variant="heading" className="text-2xl text-plum-900 mb-3 text-center">
          Camera permission needed
        </Text>
        <Text variant="body" className="text-base text-plum-700 mb-6 text-center">
          Verification only works with a live camera capture. We don’t store the
          selfie after we check it.
        </Text>
        <View className="w-full max-w-sm">
          <Button
            label="Allow camera access"
            onPress={() => requestPermission()}
            disabled={!permission.canAskAgain}
          />
        </View>
        {!permission.canAskAgain && (
          <Text variant="caption" className="text-xs text-plum-400 mt-3 text-center">
            You’ll need to enable the camera in your device settings.
          </Text>
        )}
        <Pressable
          onPress={() => router.back()}
          className="mt-6"
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Cancel verification"
        >
          <Text variant="body" className="text-plum-600">
            Cancel
          </Text>
        </Pressable>
      </View>
    );
  }

  if (step.kind === 'approved') {
    return (
      <ResultScreen
        heading="You’re verified."
        body="A plum check now appears next to your photo. Welcome."
        ctaLabel="Done"
        onCta={() => router.back()}
      />
    );
  }

  if (step.kind === 'rejected') {
    const copy = REJECT_COPY[step.reason];
    return (
      <ResultScreen
        heading={copy.heading}
        body={copy.body}
        ctaLabel="Try again"
        onCta={() => setStep({ kind: 'capture' })}
        secondary={{ label: 'Cancel', onPress: () => router.back() }}
      />
    );
  }

  return (
    <View className="flex-1 bg-plum-900" style={{ paddingTop: insets.top }}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFillObject}
        facing="front"
      />
      {/* Top bar with cancel and pose prompt overlaid on the camera. The
          camera fills the screen; the controls float above it with a
          translucent backdrop so they read against any skin tone or
          lighting condition. */}
      <View
        className="px-5 pt-2"
        style={{
          backgroundColor: 'rgba(31, 16, 51, 0.55)',
        }}
      >
        <View className="flex-row items-center justify-between mb-3">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            hitSlop={12}
            className="h-10 w-10 items-center justify-center"
          >
            <ChevronLeft color="#FAFAFF" size={22} />
          </Pressable>
        </View>
        <Text variant="heading" className="text-xl text-cream-50 text-center mb-1">
          {pose}
        </Text>
        <Text variant="caption" className="text-xs text-cream-50/80 text-center mb-3">
          We compare this with your profile photo. The selfie is deleted right
          after.
        </Text>
      </View>

      <View className="flex-1" />

      <View
        className="px-5 pt-3"
        style={{
          paddingBottom: Math.max(insets.bottom, 24),
          backgroundColor: 'rgba(31, 16, 51, 0.6)',
        }}
      >
        {step.kind === 'submitting' ? (
          <View className="items-center py-3">
            <ActivityIndicator color="#FAFAFF" />
            <Text variant="caption" className="text-xs text-cream-50/80 mt-2">
              Checking your selfie…
            </Text>
          </View>
        ) : (
          <Button label="Take selfie" onPress={captureAndVerify} />
        )}
      </View>
    </View>
  );
}

function ResultScreen({
  heading,
  body,
  ctaLabel,
  onCta,
  secondary,
}: {
  heading: string;
  body: string;
  ctaLabel: string;
  onCta: () => void;
  secondary?: { label: string; onPress: () => void };
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="flex-1 bg-cream-50 px-6 items-center justify-center"
      style={{ paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 24) }}
    >
      <Text variant="heading" className="text-2xl text-plum-900 mb-3 text-center">
        {heading}
      </Text>
      <Text variant="body" className="text-base text-plum-700 mb-6 text-center">
        {body}
      </Text>
      <View className="w-full max-w-sm">
        <Button label={ctaLabel} onPress={onCta} />
        {secondary && (
          <View className="mt-3">
            <Button label={secondary.label} variant="ghost" onPress={secondary.onPress} />
          </View>
        )}
      </View>
    </View>
  );
}
