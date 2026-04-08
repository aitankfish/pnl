import React, { useCallback, useRef, useState } from 'react';
import { View, FlatList, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ImageGalleryProps {
  images: string[];
  height: number;
}

export function ImageGallery({ images, height }: ImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
    [],
  );

  // Single image — no FlatList overhead
  if (images.length <= 1) {
    return (
      <Image
        source={{ uri: images[0] }}
        style={[StyleSheet.absoluteFill, { height }]}
        contentFit="cover"
        transition={300}
      />
    );
  }

  return (
    <View style={{ height }}>
      <FlatList
        data={images}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item }) => (
          <Image
            source={{ uri: item }}
            style={{ width: SCREEN_WIDTH, height }}
            contentFit="cover"
            transition={300}
          />
        )}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />
      {/* Dot indicators */}
      <View style={styles.dots}>
        {images.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === activeIndex && styles.dotActive]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dots: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  dotActive: {
    backgroundColor: '#fff',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
