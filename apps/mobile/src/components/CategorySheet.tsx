import React, { forwardRef, useCallback, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import GorhomBottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { PressableScale } from './PressableScale';
import { colors, spacing, borderRadius } from '../theme';

interface CategorySheetProps {
  categories: string[];
  selected: string;
  onSelect: (category: string) => void;
}

export const CategorySheet = forwardRef<GorhomBottomSheet, CategorySheetProps>(
  ({ categories, selected, onSelect }, ref) => {
    const snapPoints = useMemo(() => ['45%'], []);

    const renderBackdrop = useCallback(
      (props: any) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.6} />
      ),
      [],
    );

    const handleSelect = useCallback(
      (cat: string) => {
        onSelect(cat);
        if (ref && 'current' in ref && ref.current) {
          ref.current.close();
        }
      },
      [onSelect, ref],
    );

    const renderItem = useCallback(
      ({ item }: { item: string }) => {
        const isActive = selected === item;
        return (
          <PressableScale
            onPress={() => handleSelect(item)}
            style={[styles.cell, isActive && styles.cellActive]}
          >
            <Text style={[styles.cellText, isActive && styles.cellTextActive]}>
              {item}
            </Text>
          </PressableScale>
        );
      },
      [selected, handleSelect],
    );

    return (
      <GorhomBottomSheet
        ref={ref}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.background}
        handleIndicatorStyle={styles.handle}
      >
        <BottomSheetView style={styles.content}>
          <Text style={styles.title}>Filter by Category</Text>
          <FlatList
            data={categories}
            keyExtractor={(item) => item}
            numColumns={3}
            columnWrapperStyle={styles.row}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.grid}
          />
        </BottomSheetView>
      </GorhomBottomSheet>
    );
  },
);

const styles = StyleSheet.create({
  background: {
    backgroundColor: colors.sheetBackground,
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
  },
  handle: {
    backgroundColor: colors.sheetHandle,
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  grid: {
    paddingBottom: spacing.xl,
  },
  row: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  cell: {
    flex: 1,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  cellActive: {
    borderColor: 'rgba(139, 92, 246, 0.6)',
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    shadowColor: '#8b5cf6',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  cellText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  cellTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
});
