/**
 * usePhotoUpload — placeholder until native rebuild with expo-image-picker
 * Will open image picker + upload to Pinata once the app is rebuilt in Xcode.
 */

import { useState, useCallback } from 'react';
import { Alert } from 'react-native';

interface UsePhotoUploadReturn {
  pickAndUploadPhoto: () => Promise<string | null>;
  isUploading: boolean;
}

export function usePhotoUpload(): UsePhotoUploadReturn {
  const [isUploading] = useState(false);

  const pickAndUploadPhoto = useCallback(async (): Promise<string | null> => {
    Alert.alert(
      'Coming Soon',
      'Photo upload will be available after the next native build.',
    );
    return null;
  }, []);

  return { pickAndUploadPhoto, isUploading };
}
