import { type StyleProp, Text, type TextProps, type TextStyle } from 'react-native';

import { useAppTheme } from '../../theme';
import { themeTokens, type TypographyVariant } from '../../theme/tokens';

export type AppTextTone =
  | 'primary'
  | 'secondary'
  | 'subtle'
  | 'inverse'
  | 'link'
  | 'success'
  | 'warning'
  | 'info'
  | 'danger';

export interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  tone?: AppTextTone;
  style?: StyleProp<TextStyle>;
}

export function AppText({
  variant = 'body',
  tone = 'primary',
  allowFontScaling = true,
  style,
  ...props
}: AppTextProps) {
  const { colors } = useAppTheme();
  const color =
    tone === 'primary'
      ? colors.text
      : tone === 'secondary'
        ? colors.textMuted
        : tone === 'subtle'
          ? colors.textSubtle
          : tone === 'inverse'
            ? colors.onPrimary
            : tone === 'link'
              ? colors.link
              : colors.semantic[tone].foreground;

  return (
    <Text
      {...props}
      allowFontScaling={allowFontScaling}
      style={[themeTokens.typography[variant], { color, flexShrink: 1 }, style]}
    />
  );
}
