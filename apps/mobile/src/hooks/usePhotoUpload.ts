/**
 * usePhotoUpload — pick a photo and upload it to IPFS via the server API.
 * Returns the IPFS gateway URL (not a local file:// URI).
 */

import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { apiUrl } from '@pnl/shared/utils';

export interface PhotoResult {
  uri: string;
  name: string;
  type: string;
}

interface UsePhotoUploadReturn {
  pickPhoto: () => Promise<PhotoResult | null>;
  pickAndUploadPhoto: () => Promise<string | null>;
  isUploading: boolean;
}

export function usePhotoUpload(): UsePhotoUploadReturn {
  const [isUploading, setIsUploading] = useState(false);

  const pickPhoto = useCallback(async (): Promise<PhotoResult | null> => {
    let ImagePicker: typeof import('expo-image-picker');
    try {
      ImagePicker = require('expo-image-picker');
    } catch {
      Alert.alert(
        'Not Available',
        'Photo picker requires a native build. Please rebuild the app with expo-image-picker included.',
      );
      return null;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Needed',
        'Please allow photo library access in Settings to upload images.',
      );
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) {
      return null;
    }

    const asset = result.assets[0];
    const uriParts = asset.uri.split('/');
    const fileName = uriParts[uriParts.length - 1] || 'photo.jpg';
    const ext = fileName.split('.').pop()?.toLowerCase() || 'jpg';
    const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';

    return { uri: asset.uri, name: fileName, type: mimeType };
  }, []);

  const pickAndUploadPhoto = useCallback(async (): Promise<string | null> => {
    setIsUploading(true);
    try {
      const photo = await pickPhoto();
      if (!photo) return null;

      // Upload to server which pins to Pinata/IPFS
      const formData = new FormData();
      formData.append('file', {
        uri: photo.uri,
        name: photo.name,
        type: photo.type,
      } as any);

      const res = await fetch(apiUrl('/api/upload/avatar'), {
        method: 'POST',
        body: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const data = await res.json();

      if (!data.success || !data.data?.url) {
        Alert.alert('Upload Failed', data.error || 'Could not upload photo. Try again.');
        return null;
      }

      return data.data.url;
    } catch (err) {
      Alert.alert('Upload Failed', 'Network error. Please try again.');
      return null;
    } finally {
      setIsUploading(false);
    }
  }, [pickPhoto]);

  return { pickPhoto, pickAndUploadPhoto, isUploading };
}
