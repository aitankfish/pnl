/**
 * usePitchVideo — Upload, replace, or delete a project's pitch video.
 * Uses the existing useVideoPicker for camera/library selection.
 */

import { useState, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { apiUrl } from '@pnl/shared/utils';
import { useVideoPicker, type VideoResult } from './useVideoPicker';

type PitchVideoStatus = 'idle' | 'picking' | 'uploading' | 'deleting';

interface UsePitchVideoOptions {
  projectId: string;
  walletAddress: string;
  onSuccess?: () => void;
}

/** Upload with XMLHttpRequest for progress tracking. */
function uploadWithProgress(
  url: string,
  formData: FormData,
  onProgress: (pct: number) => void,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data);
        } else {
          reject(new Error(data.error || `Upload failed (${xhr.status})`));
        }
      } catch {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error — check your connection and try again'));
    xhr.ontimeout = () => reject(new Error('Upload timed out — try a smaller video or better connection'));

    xhr.open('POST', url);
    xhr.timeout = 120000; // 2 min timeout
    xhr.send(formData);
  });
}

export function usePitchVideo({ projectId, walletAddress, onSuccess }: UsePitchVideoOptions) {
  const { pickVideo, recordVideo } = useVideoPicker();
  const [status, setStatus] = useState<PitchVideoStatus>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadVideo = useCallback(
    async (video: VideoResult) => {
      setStatus('uploading');
      setUploadProgress(0);
      try {
        const formData = new FormData();
        formData.append('walletAddress', walletAddress);
        formData.append('pitchVideo', {
          uri: video.uri,
          name: video.name,
          type: video.type,
        } as any);

        const data = await uploadWithProgress(
          apiUrl(`/api/projects/${projectId}/pitch-video`),
          formData,
          setUploadProgress,
        );

        if (!data.success) throw new Error(data.error || 'Upload failed');

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Pitch Video Uploaded', 'Your pitch video is now live on the feed!');
        onSuccess?.();
        return true;
      } catch (err: any) {
        console.error('Pitch video upload error:', err);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        const msg = err?.message || '';
        if (msg.includes('Network error')) {
          Alert.alert('No Connection', 'Check your internet connection and try again.');
        } else if (msg.includes('timed out')) {
          Alert.alert('Upload Timed Out', 'Try a shorter video or a stronger connection.');
        } else if (msg.includes('413') || msg.toLowerCase().includes('too large')) {
          Alert.alert('File Too Large', 'Your video exceeds the size limit. Try a shorter clip.');
        } else {
          Alert.alert('Upload Failed', msg || 'Something went wrong. Please try again.');
        }
        return false;
      } finally {
        setStatus('idle');
        setUploadProgress(0);
      }
    },
    [projectId, walletAddress, onSuccess],
  );

  const handleRecord = useCallback(async () => {
    setStatus('picking');
    const result = await recordVideo();
    if (result) {
      await uploadVideo(result);
    } else {
      setStatus('idle');
    }
  }, [recordVideo, uploadVideo]);

  const handlePick = useCallback(async () => {
    setStatus('picking');
    const result = await pickVideo();
    if (result) {
      await uploadVideo(result);
    } else {
      setStatus('idle');
    }
  }, [pickVideo, uploadVideo]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Delete Pitch Video',
      'This will remove your pitch video from the feed. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setStatus('deleting');
            try {
              const res = await fetch(apiUrl(`/api/projects/${projectId}/pitch-video`), {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ walletAddress }),
              });
              const data = await res.json();
              if (!data.success) throw new Error(data.error || 'Delete failed');

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Video Removed', 'Your pitch video has been deleted.');
              onSuccess?.();
            } catch (err: any) {
              console.error('Pitch video delete error:', err);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              const parsed = parseError(err);
              Alert.alert(parsed.title, parsed.message);
            } finally {
              setStatus('idle');
            }
          },
        },
      ],
    );
  }, [projectId, walletAddress, onSuccess]);

  return {
    status,
    isLoading: status === 'uploading' || status === 'deleting',
    uploadProgress,
    handleRecord,
    handlePick,
    handleDelete,
  };
}
