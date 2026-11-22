import type { PropsWithChildren } from 'react';
import {
  Pressable,
  type PressableStateCallbackType,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native';

import { useAppTheme } from '../../theme';
import { type SpacingToken, themeTokens } from '../../theme/tokens';

interface AppCardBaseProps extends PropsWithChildren {
  variant?: 'outlined' | 'elevated';
  padding?: SpacingToken;
  style?: StyleProp<ViewStyle>;
}

export type AppCardProps =
  | (AppCardBaseProps & {
      onPress: () => void;
      accessibilityLabel: string;
      disabled?: boolean;
    })
  | (AppCardBaseProps & {
      onPress?: never;
      accessibilityLabel?: never;
      disabled?: never;
    });

export function AppCard(props: AppCardProps) {
  const { colors } = useAppTheme();
  const variant = props.variant ?? 'outlined';
  const baseStyle: ViewStyle = {
    padding: themeTokens.spacing[props.padding ?? 'md'],
    borderRadius: themeTokens.radius.md,
    backgroundColor: colors.surface,
    borderWidth: variant === 'outlined' ? 1 : 0,
    borderColor: colors.border,
    ...(variant === 'elevated' ? themeTokens.elevation.card : {}),
  };

  if (props.onPress) {
    const pressStyle = ({ pressed }: PressableStateCallbackType) => [
      baseStyle,
      { opacity: props.disabled ? 0.55 : pressed ? 0.82 : 1 },
      props.style,
    ];

    return (
      <Pressable
        accessibilityLabel={props.accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{ disabled: props.disabled ?? false }}
        disabled={props.disabled}
        onPress={props.onPress}
        style={pressStyle}
      >
        {props.children}
      </Pressable>
    );
  }

  return <View style={[baseStyle, props.style]}>{props.children}</View>;
}
