/**
 * usePhotoUpload — pick a photo and upload via backend proxy to IPFS.
 * The Pinata JWT never leaves the server — mobile sends to /api/upload/ipfs.
 */

import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { authenticatedFetch } from '@pnl/shared/utils';
import { getEnvConfig } from '@pnl/shared/config';

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
    try {
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
    } catch (err) {
      Alert.alert('Error', 'Failed to open photo picker. Please try again.');
      return null;
    }
  }, []);

  const pickAndUploadPhoto = useCallback(async (): Promise<string | null> => {
    setIsUploading(true);
    try {
      const photo = await pickPhoto();
      if (!photo) {
        setIsUploading(false);
        return null;
      }

      // Upload via backend proxy — Pinata JWT stays on server
      const formData = new FormData();
      formData.append('file', {
        uri: photo.uri,
        name: photo.name,
        type: photo.type,
      } as any);
      formData.append('metadata', JSON.stringify({ name: photo.name }));

      const res = await authenticatedFetch('/api/upload/ipfs', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!data.success) {
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
