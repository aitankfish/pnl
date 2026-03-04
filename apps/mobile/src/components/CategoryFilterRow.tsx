import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { CategoryPill } from './CategoryPill';
import { spacing } from '../theme';

const CATEGORIES = [
  'All', 'DeFi', 'Gaming', 'Meme', 'AI/ML', 'Social', 'Infrastructure',
  'DAO', 'Creator', 'NFT', 'Healthcare', 'Science', 'Education', 'Finance',
  'Commerce', 'Real Estate', 'Energy', 'Media', 'Manufacturing', 'Mobility', 'Other',
];

interface CategoryFilterRowProps {
  selected: string;
  onSelect: (category: string) => void;
}

export function CategoryFilterRow({ selected, onSelect }: CategoryFilterRowProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {CATEGORIES.map((cat) => (
        <CategoryPill
          key={cat}
          label={cat}
          variant="filter"
          active={selected === cat}
          onPress={() => onSelect(cat)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
});
