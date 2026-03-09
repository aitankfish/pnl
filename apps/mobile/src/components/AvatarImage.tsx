/**
 * AvatarImage — Renders profile avatars, handling both SVG and raster image URLs.
 * React Native's Image component cannot render SVGs from URLs,
 * so we detect .svg extensions and use SvgUri from react-native-svg instead.
 */

import React, { useState } from 'react';
import { Image, View, StyleSheet } from 'react-native';
import { SvgUri } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

interface AvatarImageProps {
  uri: string | null | undefined;
  size: number;
  style?: any;
  /** Icon size for the fallback placeholder (defaults to size * 0.5) */
  fallbackIconSize?: number;
}

export function AvatarImage({ uri, size, style, fallbackIconSize }: AvatarImageProps) {
  const [hasError, setHasError] = useState(false);

  const containerStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    overflow: 'hidden' as const,
  };

  if (!uri || hasError) {
    return (
      <View style={[containerStyle, styles.placeholder, style]}>
        <Ionicons name="person" size={fallbackIconSize ?? size * 0.5} color={colors.textMuted} />
      </View>
    );
  }

  if (uri.endsWith('.svg')) {
    return (
      <View style={[containerStyle, style]}>
        <SvgUri
          uri={uri}
          width={size}
          height={size}
          onError={() => setHasError(true)}
        />
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={[containerStyle, style]}
      onError={() => setHasError(true)}
    />
  );
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
});
