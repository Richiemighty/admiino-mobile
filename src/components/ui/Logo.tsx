import { Image, type ImageStyle, type StyleProp, View, type ViewStyle } from 'react-native';

import { useAppTheme } from '../../theme';
import { themeTokens } from '../../theme/tokens';

export type LogoVariant = 'wordmark' | 'monogram';

export interface LogoProps {
  variant?: LogoVariant;
  size?: number;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
}

const ORIGINAL_WORDMARK = require('../../../assets/admiino/brand/logo-wordmark-original-transparent.png');
const GENERATED_MONOGRAM = require('../../../assets/admiino/brand/logo-monogram-generated-transparent.png');

export function Logo({ variant = 'wordmark', size = 128, style, imageStyle }: LogoProps) {
  const { resolvedMode } = useAppTheme();
  const safeSize = Math.max(24, Math.min(size, 160));

  return (
    <View
      accessible
      accessibilityLabel={variant === 'wordmark' ? 'Admiino logo' : 'Admiino monogram concept'}
      accessibilityRole="image"
      style={[
        {
          width: safeSize,
          height: safeSize,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: themeTokens.radius.sm,
          backgroundColor:
            variant === 'wordmark' && resolvedMode === 'dark'
              ? themeTokens.brand.logoCanvas
              : 'transparent',
        },
        style,
      ]}
    >
      <Image
        accessible={false}
        resizeMode="contain"
        source={variant === 'wordmark' ? ORIGINAL_WORDMARK : GENERATED_MONOGRAM}
        style={[{ width: safeSize, height: safeSize }, imageStyle]}
      />
    </View>
  );
}
