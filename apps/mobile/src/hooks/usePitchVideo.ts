/**
 * usePitchVideo — Upload, replace, or delete a project's pitch video.
 * Uses the existing useVideoPicker for camera/library selection.
 */

import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { apiUrl, parseError } from '@pnl/shared/utils';
import { useVideoPicker, type VideoResult } from './useVideoPicker';

type PitchVideoStatus = 'idle' | 'picking' | 'uploading' | 'deleting';

interface UsePitchVideoOptions {
  projectId: string;
  walletAddress: string;
  onSuccess?: () => void;
}

export function usePitchVideo({ projectId, walletAddress, onSuccess }: UsePitchVideoOptions) {
  const { pickVideo, recordVideo } = useVideoPicker();
  const [status, setStatus] = useState<PitchVideoStatus>('idle');

  const uploadVideo = useCallback(
    async (video: VideoResult) => {
      setStatus('uploading');
      try {
        const formData = new FormData();
        formData.append('walletAddress', walletAddress);
        formData.append('pitchVideo', {
          uri: video.uri,
          name: video.name,
          type: video.type,
        } as any);

        const res = await fetch(apiUrl(`/api/projects/${projectId}/pitch-video`), {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();

        if (!data.success) throw new Error(data.error || 'Upload failed');

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onSuccess?.();
        return true;
      } catch (err: any) {
        console.error('Pitch video upload error:', err);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        const parsed = parseError(err);
        Alert.alert(parsed.title, parsed.message);
        return false;
      } finally {
        setStatus('idle');
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
    handleRecord,
    handlePick,
    handleDelete,
  };
}
