import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  withSequence,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { useVoiceRoomContextSafe } from '../../providers/VoiceRoomProvider';
import { PressableScale } from '../PressableScale';

interface MiniVoiceBarProps {
  currentMarketId?: string | null;
  onExpand?: () => void;
}

/** Animated sound wave bars */
function SoundWave({ active }: { active: boolean }) {
  const bar1 = useSharedValue(0.3);
  const bar2 = useSharedValue(0.3);
  const bar3 = useSharedValue(0.3);

  useEffect(() => {
    if (active) {
      bar1.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 300, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.25, { duration: 400, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
      bar2.value = withRepeat(
        withDelay(
          100,
          withSequence(
            withTiming(0.85, { duration: 350, easing: Easing.inOut(Easing.ease) }),
            withTiming(0.2, { duration: 300, easing: Easing.inOut(Easing.ease) }),
          ),
        ),
        -1,
        true,
      );
      bar3.value = withRepeat(
        withDelay(
          200,
          withSequence(
            withTiming(0.95, { duration: 280, easing: Easing.inOut(Easing.ease) }),
            withTiming(0.3, { duration: 360, easing: Easing.inOut(Easing.ease) }),
          ),
        ),
        -1,
        true,
      );
    } else {
      cancelAnimation(bar1);
      cancelAnimation(bar2);
      cancelAnimation(bar3);
      bar1.value = withTiming(0.3, { duration: 200 });
      bar2.value = withTiming(0.3, { duration: 200 });
      bar3.value = withTiming(0.3, { duration: 200 });
    }
  }, [active, bar1, bar2, bar3]);

  const style1 = useAnimatedStyle(() => ({ transform: [{ scaleY: bar1.value }] }));
  const style2 = useAnimatedStyle(() => ({ transform: [{ scaleY: bar2.value }] }));
  const style3 = useAnimatedStyle(() => ({ transform: [{ scaleY: bar3.value }] }));

  return (
    <View style={waveStyles.container}>
      <Animated.View style={[waveStyles.bar, style1]} />
      <Animated.View style={[waveStyles.bar, waveStyles.barTall, style2]} />
      <Animated.View style={[waveStyles.bar, style3]} />
    </View>
  );
}

const waveStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1.5,
    height: 12,
  },
  bar: {
    width: 2,
    height: 10,
    borderRadius: 1,
    backgroundColor: '#4ade80',
  },
  barTall: {
    height: 12,
  },
});

/**
 * Small floating pill centered at the top of the screen.
 * Shows animated sound wave when someone speaks + room name + count.
 */
export function MiniVoiceBar({ currentMarketId, onExpand }: MiniVoiceBarProps) {
  const voice = useVoiceRoomContextSafe();
  const insets = useSafeAreaInsets();

  if (!voice?.isConnected) return null;
  if (currentMarketId && voice.marketId === currentMarketId && !voice.isMinimized) return null;

  const participantCount = voice.participants.length + 1;
  const roomLabel = voice.roomTitle || voice.marketName || 'Voice Room';
  const anyoneSpeaking =
    voice.isSpeaking || voice.participants.some((p) => p.isSpeaking);

  const handleTap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentMarketId && voice.marketId === currentMarketId) {
      voice.setMinimized(false);
      onExpand?.();
    } else if (voice.marketAddress) {
      voice.setMinimized(false);
      router.push({ pathname: '/voice-rooms', params: { marketAddress: voice.marketAddress } } as any);
    }
  };

  return (
    <View style={[styles.wrapper, { top: insets.top + 4 }]} pointerEvents="box-none">
      <PressableScale onPress={handleTap} style={styles.pill}>
        <SoundWave active={anyoneSpeaking} />
        <Text style={styles.label} numberOfLines={1}>
          {roomLabel}
        </Text>
        <View style={styles.countBadge}>
          <Ionicons name="people" size={9} color="#4ade80" />
          <Text style={styles.count}>{participantCount}</Text>
        </View>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
    maxWidth: 220,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: '#e2e8f0',
    flexShrink: 1,
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(74, 222, 128, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  count: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4ade80',
  },
});
