import { useCallback } from 'react';
import { Platform } from 'react-native';

let LiveActivity: typeof import('../../modules/live-activity') | null = null;

// Only import on iOS to avoid Android errors
if (Platform.OS === 'ios') {
  try {
    LiveActivity = require('../../modules/live-activity');
  } catch {
    // Native module not available (e.g., Expo Go, simulator without rebuild)
  }
}

export function useLiveActivity() {
  const startActivity = useCallback(
    async (marketId: string, marketName: string, tokenSymbol: string): Promise<string | null> => {
      if (!LiveActivity) return null;
      try {
        return await LiveActivity.startVoiceRoomActivity(marketId, marketName, tokenSymbol);
      } catch {
        return null;
      }
    },
    []
  );

  const updateActivity = useCallback(
    async (participantCount: number, isMuted: boolean, speakerName?: string): Promise<void> => {
      if (!LiveActivity) return;
      try {
        await LiveActivity.updateVoiceRoomActivity(participantCount, isMuted, speakerName);
      } catch {
        // Silently fail — older iOS, simulator, or activity already ended
      }
    },
    []
  );

  const endActivity = useCallback(async (): Promise<void> => {
    if (!LiveActivity) return;
    try {
      await LiveActivity.endVoiceRoomActivity();
    } catch {
      // Silently fail
    }
  }, []);

  return { startActivity, updateActivity, endActivity };
}
