import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  type PressableStateCallbackType,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native';

import { useAppTheme } from '../../theme';
import { themeTokens } from '../../theme/tokens';

export interface IconButtonProps {
  icon: ReactNode;
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  disabled = false,
  loading = false,
  size = themeTokens.touchTarget.minimum,
  style,
}: IconButtonProps) {
  const { colors } = useAppTheme();
  const minimumSize =
    Platform.OS === 'ios' ? themeTokens.touchTarget.ios : themeTokens.touchTarget.android;
  const targetSize = Math.max(size, minimumSize);
  const isDisabled = disabled || loading;

  const buttonStyle = ({ pressed }: PressableStateCallbackType) => [
    {
      width: targetSize,
      height: targetSize,
      minWidth: minimumSize,
      minHeight: minimumSize,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      borderRadius: themeTokens.radius.pill,
      backgroundColor: pressed && !isDisabled ? colors.primarySurface : 'transparent',
      opacity: isDisabled ? 0.55 : 1,
    },
    style,
  ];

  return (
    <Pressable
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
        <ActivityIndicator accessible={false} color={colors.primaryAction} />
      ) : (
        <View
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {icon}
        </View>
      )}
    </Pressable>
  );
}
