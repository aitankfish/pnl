/**
 * Chat Tab
 * Real-time chat rooms for active markets
 */

import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '../../src/theme';

export default function ChatScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.screenTitle}>Chat Rooms</Text>

      <View style={styles.emptyState}>
        <Ionicons name="chatbubbles-outline" size={64} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>No active chats</Text>
        <Text style={styles.emptySubtext}>
          Join a market to start chatting with other predictors
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 60 },
  screenTitle: { ...typography.display, color: colors.textPrimary, paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },
  emptyState: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 100,
  },
  emptyTitle: { ...typography.heading, color: colors.textSecondary, marginTop: spacing.lg },
  emptySubtext: { ...typography.body, color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center', paddingHorizontal: spacing['2xl'] },
});
