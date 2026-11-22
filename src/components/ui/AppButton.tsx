import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  type PressableStateCallbackType,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native';

import { useAppTheme } from '../../theme';
import { themeTokens } from '../../theme/tokens';
import { AppText } from './AppText';

export type AppButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';

export interface AppButtonProps extends Omit<PressableProps, 'children' | 'style' | 'onPress'> {
  accessibilityLabel: string;
  children: ReactNode;
  onPress: () => void;
  variant?: AppButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function AppButton({
  accessibilityLabel,
  children,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  style,
  ...pressableProps
}: AppButtonProps) {
  const { colors } = useAppTheme();
  const isDisabled = disabled || loading;
  const variants = {
    primary: { backgroundColor: colors.primaryAction, foreground: colors.onPrimary },
    secondary: { backgroundColor: colors.primarySurface, foreground: colors.primaryAction },
    outline: { backgroundColor: colors.surface, foreground: colors.text },
    ghost: { backgroundColor: 'transparent', foreground: colors.primaryAction },
    destructive: {
      backgroundColor: colors.semantic.danger.background,
      foreground: colors.semantic.danger.foreground,
    },
  };
  const selected = variants[variant];
  const textTone =
    variant === 'primary'
      ? 'inverse'
      : variant === 'destructive'
        ? 'danger'
        : variant === 'outline'
          ? 'primary'
          : 'link';

  const buttonStyle = ({ pressed }: PressableStateCallbackType) => [
    {
      minHeight: themeTokens.touchTarget.minimum,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      flexDirection: 'row' as const,
      gap: themeTokens.spacing.xs,
      paddingHorizontal: themeTokens.spacing.md,
      paddingVertical: themeTokens.spacing.xs,
      borderRadius: themeTokens.radius.md,
      backgroundColor: selected.backgroundColor,
      borderWidth: variant === 'outline' ? 1 : 0,
      borderColor: colors.border,
      opacity: isDisabled ? 0.55 : pressed ? 0.82 : 1,
    },
    style,
  ];

  return (
    <Pressable
      {...pressableProps}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={() => {
        if (!isDisabled) onPress();
      }}
      style={buttonStyle}
    >
      {loading ? (
        <ActivityIndicator color={selected.foreground} />
      ) : (
        icon && (
          <View accessibilityElementsHidden importantForAccessibility="no">
            {icon}
          </View>
        )
      )}
      <AppText variant="label" tone={textTone}>
        {children}
      </AppText>
    </Pressable>
  );
}
