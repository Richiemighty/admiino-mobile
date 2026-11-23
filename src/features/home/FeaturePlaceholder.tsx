import { type LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { AppScreen, AppText } from '../../components/ui';
import { useAppTheme } from '../../theme';
import { themeTokens } from '../../theme/tokens';

interface FeaturePlaceholderProps {
  title: string;
  description: string;
  Icon: LucideIcon;
}

export function FeaturePlaceholder({ title, description, Icon }: FeaturePlaceholderProps) {
  const { colors } = useAppTheme();

  return (
    <AppScreen padding="xl">
      <View
        style={{
          flex: 1,
          width: '100%',
          maxWidth: 680,
          alignSelf: 'center',
          justifyContent: 'center',
          alignItems: 'flex-start',
          gap: themeTokens.spacing.md,
        }}
      >
        <Icon color={colors.primaryAction} size={28} />
        <AppText accessibilityRole="header" variant="title">
          {title}
        </AppText>
        <AppText tone="secondary">{description}</AppText>
      </View>
    </AppScreen>
  );
}
