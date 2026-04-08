/**
 * useVideoPicker — expo-image-picker integration for video recording & selection
 * Returns { uri, name, type } compatible with React Native FormData.
 */

import { useCallback } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export interface VideoResult {
  uri: string;
  name: string;
  type: string;
}

const MAX_VIDEO_SIZE_MB = 50;
const MAX_DURATION_SECONDS = 120;

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
    try {
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
    } catch (err) {
      console.warn('Video picker error:', err);
      Alert.alert('Error', 'Failed to open video picker. Please try again.');
      return null;
    }
  }, []);

  const recordVideo = useCallback(async (): Promise<VideoResult | null> => {
    try {
      // Check camera availability first (simulators don't have cameras)
      const available = await ImagePicker.getCameraPermissionsAsync();
      if (available.status === 'undetermined') {
        const req = await ImagePicker.requestCameraPermissionsAsync();
        if (req.status !== 'granted') {
          Alert.alert(
            'Permission Needed',
            'Please allow camera access in Settings to record videos.',
          );
          return null;
        }
      } else if (available.status !== 'granted') {
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
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('simulator') || msg.includes('not available')) {
        console.warn('Camera not available (simulator):', msg);
        Alert.alert('Camera Unavailable', 'Camera is not available on the simulator. Please test on a physical device, or use "Choose from Library" instead.');
      } else {
        console.warn('Video recorder error:', err);
        Alert.alert('Error', 'Failed to open camera. Please try again.');
      }
      return null;
    }
  }, []);

  return { pickVideo, recordVideo };
}
