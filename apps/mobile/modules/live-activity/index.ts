import { requireNativeModule, Platform } from 'expo-modules-core';

const LiveActivityModule =
  Platform.OS === 'ios' ? requireNativeModule('LiveActivityModule') : null;

export async function startVoiceRoomActivity(
  marketId: string,
  marketName: string,
  tokenSymbol: string
): Promise<string> {
  if (!LiveActivityModule) return '';
  return LiveActivityModule.startVoiceRoomActivity(marketId, marketName, tokenSymbol);
}

export async function updateVoiceRoomActivity(
  participantCount: number,
  isMuted: boolean,
  speakerName?: string
): Promise<void> {
  if (!LiveActivityModule) return;
  return LiveActivityModule.updateVoiceRoomActivity(participantCount, isMuted, speakerName ?? null);
}

export async function endVoiceRoomActivity(): Promise<void> {
  if (!LiveActivityModule) return;
  return LiveActivityModule.endVoiceRoomActivity();
}
