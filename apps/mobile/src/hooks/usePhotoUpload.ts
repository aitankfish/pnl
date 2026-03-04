/**
 * usePhotoUpload — pick a photo and upload it directly to Pinata/IPFS.
 * Returns the IPFS gateway URL (not a local file:// URI).
 */

import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
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
      console.error('Photo picker error:', err);
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

      const env = getEnvConfig();
      if (!env.PINATA_JWT) {
        Alert.alert('Upload Failed', 'IPFS upload is not configured.');
        return null;
      }

      // Upload directly to Pinata (same approach as web)
      const formData = new FormData();
      formData.append('file', {
        uri: photo.uri,
        name: photo.name,
        type: photo.type,
      } as any);
      formData.append('pinataMetadata', JSON.stringify({ name: photo.name }));
      formData.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));

      // Do NOT set Content-Type manually — React Native's fetch must
      // auto-generate it with the correct multipart boundary string.
      const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.PINATA_JWT}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error('Pinata upload error:', res.status, errorText);
        Alert.alert('Upload Failed', 'Could not upload photo. Try again.');
        return null;
      }

      const data = await res.json();
      const ipfsHash = data.IpfsHash;

      if (!ipfsHash) {
        Alert.alert('Upload Failed', 'No IPFS hash returned.');
        return null;
      }

      // Return the gateway URL (same format web uses)
      return `${env.PINATA_GATEWAY_URL}/ipfs/${ipfsHash}`;
    } catch (err) {
      console.error('Photo upload error:', err);
      Alert.alert('Upload Failed', 'Network error. Please try again.');
      return null;
    } finally {
      setIsUploading(false);
    }
  }, [pickPhoto]);

  return { pickPhoto, pickAndUploadPhoto, isUploading };
}
