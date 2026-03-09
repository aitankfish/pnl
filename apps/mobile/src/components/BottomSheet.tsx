import React, { forwardRef, ReactNode, useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import GorhomBottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
  BottomSheetProps as GorhomProps,
} from '@gorhom/bottom-sheet';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, borderRadius } from '../theme';

interface BottomSheetProps {
  children: ReactNode;
  snapPoints?: (string | number)[];
  onClose?: () => void;
}

const CosmicBackground = ({ style }: { style?: any }) => (
  <View style={[style, styles.backgroundOuter]}>
    <LinearGradient
      colors={['#141a2e', '#0f1525', '#0a0e1a']}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
    {/* Subtle top glow accent */}
    <LinearGradient
      colors={['rgba(99, 102, 241, 0.12)', 'rgba(139, 92, 246, 0.04)', 'transparent']}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 0.4 }}
      style={StyleSheet.absoluteFill}
    />
  </View>
);

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
        backgroundComponent={CosmicBackground}
        handleIndicatorStyle={styles.handle}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
      >
        <BottomSheetView style={styles.content}>{children}</BottomSheetView>
      </GorhomBottomSheet>
    );
  },
);

const styles = StyleSheet.create({
  backgroundOuter: {
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    borderTopWidth: 1,
    borderLeftWidth: 0.5,
    borderRightWidth: 0.5,
    borderColor: colors.glassBorder,
    overflow: 'hidden',
  },
  handle: {
    backgroundColor: 'rgba(129, 140, 248, 0.4)',
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
});
