/**
 * useVideoPicker — expo-image-picker integration for video recording & selection
 * Lazy-loads the native module so it doesn't crash if unavailable in the current build.
 * Returns { uri, name, type } compatible with React Native FormData.
 */

import { useCallback } from 'react';
import { Alert } from 'react-native';

export interface VideoResult {
  uri: string;
  name: string;
  type: string;
}

const MAX_VIDEO_SIZE_MB = 50;
const MAX_DURATION_SECONDS = 120;

function getImagePicker(): typeof import('expo-image-picker') | null {
  try {
    return require('expo-image-picker');
  } catch {
    Alert.alert(
      'Not Available',
      'Video picker requires a native build. Please rebuild the app with expo-image-picker included.',
    );
    return null;
  }
}

function assetToVideoResult(asset: { uri: string; fileSize?: number | null }): VideoResult | null {
  // Validate file size
  if (asset.fileSize && asset.fileSize > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
    Alert.alert('File Too Large', `Videos must be under ${MAX_VIDEO_SIZE_MB}MB.`);
    return null;
  }

  const uriParts = asset.uri.split('/');
  const fileName = uriParts[uriParts.length - 1] || 'video.mp4';
  const ext = fileName.split('.').pop()?.toLowerCase() || 'mp4';
  const mimeType = ext === 'mov' ? 'video/quicktime' : 'video/mp4';

  return { uri: asset.uri, name: fileName, type: mimeType };
}

export function useVideoPicker() {
  const pickVideo = useCallback(async (): Promise<VideoResult | null> => {
    const ImagePicker = getImagePicker();
    if (!ImagePicker) return null;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Needed',
        'Please allow photo library access in Settings to select videos.',
      );
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      videoMaxDuration: MAX_DURATION_SECONDS,
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) return null;
    return assetToVideoResult(result.assets[0]);
  }, []);

  const recordVideo = useCallback(async (): Promise<VideoResult | null> => {
    const ImagePicker = getImagePicker();
    if (!ImagePicker) return null;

    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    if (cameraPermission.status !== 'granted') {
      Alert.alert(
        'Permission Needed',
        'Please allow camera access in Settings to record videos.',
      );
      return null;
    }

    const mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (mediaPermission.status !== 'granted') {
      Alert.alert(
        'Permission Needed',
        'Please allow photo library access in Settings to save recorded videos.',
      );
      return null;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['videos'],
      videoMaxDuration: MAX_DURATION_SECONDS,
      cameraType: ImagePicker.CameraType.Front,
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) return null;
    return assetToVideoResult(result.assets[0]);
  }, []);

  return { pickVideo, recordVideo };
}
