import { View, Text, StyleSheet, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { REACTION_EMOJIS, type ReactionEmoji } from '../../providers/VoiceRoomProvider';
import { colors, spacing, borderRadius } from '../../theme';

interface VoiceReactionBarProps {
  onReaction: (emoji: ReactionEmoji) => void;
}

export function VoiceReactionBar({ onReaction }: VoiceReactionBarProps) {
  const handlePress = (emoji: ReactionEmoji) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onReaction(emoji);
  };

  return (
    <View style={styles.container}>
      {REACTION_EMOJIS.map((emoji) => (
        <Pressable
          key={emoji}
          onPress={() => handlePress(emoji)}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.emoji}>{emoji}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  buttonPressed: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    transform: [{ scale: 1.15 }],
  },
  emoji: {
    fontSize: 20,
  },
});
