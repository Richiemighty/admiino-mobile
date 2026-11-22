import { ActivityIndicator, type StyleProp, View, type ViewStyle } from 'react-native';

import { useAppTheme } from '../../theme';
import { themeTokens } from '../../theme/tokens';
import { AppText } from './AppText';

export interface LoadingStateProps {
  label: string;
  variant?: 'compact' | 'fullScreen';
  style?: StyleProp<ViewStyle>;
}

export function LoadingState({ label, variant = 'compact', style }: LoadingStateProps) {
  const { colors } = useAppTheme();
  const fullScreen = variant === 'fullScreen';

  return (
    <View
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
      accessibilityRole="progressbar"
      accessibilityState={{ busy: true }}
      style={[
        {
          minHeight: fullScreen ? undefined : themeTokens.touchTarget.minimum,
          flex: fullScreen ? 1 : undefined,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: fullScreen ? 'column' : 'row',
          gap: themeTokens.spacing.sm,
          padding: fullScreen ? themeTokens.spacing.xl : themeTokens.spacing.xs,
        },
        style,
      ]}
    >
      <ActivityIndicator accessible={false} color={colors.primaryAction} />
      <AppText tone="secondary">{label}</AppText>
    </View>
  );
}
