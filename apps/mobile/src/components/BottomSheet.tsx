import React, { forwardRef, ReactNode, useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import GorhomBottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
  BottomSheetProps as GorhomProps,
} from '@gorhom/bottom-sheet';
import { colors, borderRadius } from '../theme';

interface BottomSheetProps {
  children: ReactNode;
  snapPoints?: (string | number)[];
  onClose?: () => void;
}

export const BottomSheet = forwardRef<GorhomBottomSheet, BottomSheetProps>(
  ({ children, snapPoints: snapPointsProp, onClose }, ref) => {
    const snapPoints = useMemo(() => snapPointsProp ?? ['50%'], [snapPointsProp]);

    const renderBackdrop = useCallback(
      (props: any) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.6} />
      ),
      [],
    );

    return (
      <GorhomBottomSheet
        ref={ref}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        onClose={onClose}
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.background}
        handleIndicatorStyle={styles.handle}
      >
        <BottomSheetView style={styles.content}>{children}</BottomSheetView>
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
    padding: 16,
  },
});
