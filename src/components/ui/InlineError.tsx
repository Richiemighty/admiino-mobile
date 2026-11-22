import { type StyleProp, View, type ViewStyle } from 'react-native';

import { useAppTheme } from '../../theme';
import { themeTokens } from '../../theme/tokens';
import { AppButton } from './AppButton';
import { AppText } from './AppText';

export interface InlineErrorProps {
  message: string;
  retryLabel?: string;
  onRetry?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function InlineError({
  message,
  retryLabel = 'Try again',
  onRetry,
  style,
}: InlineErrorProps) {
  const { colors } = useAppTheme();

  return (
    <View
      accessibilityLabel={message}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[
        {
          gap: themeTokens.spacing.sm,
          padding: themeTokens.spacing.md,
          borderRadius: themeTokens.radius.md,
          backgroundColor: colors.semantic.danger.background,
        },
        style,
      ]}
    >
      <AppText tone="danger">{message}</AppText>
      {onRetry && (
        <AppButton
          accessibilityLabel={retryLabel}
          onPress={onRetry}
          style={{ alignSelf: 'flex-start' }}
          variant="ghost"
        >
          {retryLabel}
        </AppButton>
      )}
    </View>
  );
}
