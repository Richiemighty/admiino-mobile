import { Image, type ImageSourcePropType, StyleSheet, View } from 'react-native';

import { themeTokens } from '../../theme/tokens';

interface OnboardingArtworkProps {
  source: ImageSourcePropType;
  accessibilityLabel: string;
  scale: number;
}

export function OnboardingArtwork({ source, accessibilityLabel, scale }: OnboardingArtworkProps) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.canvas]}>
      <Image
        accessible
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="image"
        resizeMode="contain"
        source={source}
        style={{ width: `${scale * 100}%`, height: `${scale * 100}%` }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    backgroundColor: themeTokens.colors.light.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
