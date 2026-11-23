import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '../../components/ui';
import { getAppEnvironment } from '../../config/env';
import { themeTokens } from '../../theme/tokens';

export function EnvironmentIndicator() {
  const { appEnv } = getAppEnvironment();
  if (appEnv === 'production') return null;

  return (
    <View style={styles.row}>
      <AppText accessibilityLabel={`${appEnv} environment`} tone="secondary" variant="caption">
        {appEnv === 'development' ? 'Development' : 'Staging'}
      </AppText>
      {__DEV__ && (
        <Link asChild href="/dev/ui-kit">
          <Pressable
            accessibilityLabel="Open design system gallery"
            accessibilityRole="link"
            hitSlop={8}
          >
            <AppText tone="link" variant="caption">
              UI kit
            </AppText>
          </Pressable>
        </Link>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: themeTokens.touchTarget.ios,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: themeTokens.spacing.md,
  },
});
