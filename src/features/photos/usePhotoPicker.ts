import { useCallback, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

const MAX_LONG_EDGE = 2048;
const JPEG_QUALITY = 0.85;

export type PickedPhoto = {
  uri: string;
  width: number;
  height: number;
  mimeType: 'image/jpeg';
};

type PermissionRequestResult = {
  granted: boolean;
  canAskAgain: boolean;
};

/**
 * Thrown when the user denies photo-library or camera access. The caller
 * uses the instance check (not the message) to decide whether to show the
 * "turn on access in settings" guidance vs. a generic error.
 */
export class PhotoPermissionDeniedError extends Error {
  constructor(public readonly source: 'library' | 'camera') {
    super(`Permission denied: ${source}`);
    this.name = 'PhotoPermissionDeniedError';
  }
}

async function resizeAndEncode(
  asset: ImagePicker.ImagePickerAsset,
): Promise<PickedPhoto> {
  // Scale longest edge down to 2048 (never up) and re-encode to JPEG @ 0.85
  // so HEIC from iOS is normalized, EXIF is stripped, and Convex storage sees
  // predictable bytes. Manipulator returns post-resize width/height.
  const longEdge = Math.max(asset.width, asset.height);
  const actions: ImageManipulator.Action[] =
    longEdge > MAX_LONG_EDGE
      ? [
          {
            resize:
              asset.width >= asset.height
                ? { width: MAX_LONG_EDGE }
                : { height: MAX_LONG_EDGE },
          },
        ]
      : [];

  const result = await ImageManipulator.manipulateAsync(asset.uri, actions, {
    compress: JPEG_QUALITY,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
    mimeType: 'image/jpeg',
  };
}

export function usePhotoPicker() {
  const [isProcessing, setIsProcessing] = useState(false);

  const pickFromLibrary = useCallback(async (): Promise<PickedPhoto | null> => {
    const perm: PermissionRequestResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    // Differentiate denial from user-cancel: null means "user backed out of
    // the picker," throw means "we need explicit permission guidance."
    if (!perm.granted) throw new PhotoPermissionDeniedError('library');

    setIsProcessing(true);
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 1,
        exif: false,
      });
      if (res.canceled || res.assets.length === 0) return null;
      return await resizeAndEncode(res.assets[0]);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const pickFromCamera = useCallback(async (): Promise<PickedPhoto | null> => {
    const perm: PermissionRequestResult =
      await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new PhotoPermissionDeniedError('camera');

    setIsProcessing(true);
    try {
      const res = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 1,
        exif: false,
      });
      if (res.canceled || res.assets.length === 0) return null;
      return await resizeAndEncode(res.assets[0]);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  return { pickFromLibrary, pickFromCamera, isProcessing };
}
