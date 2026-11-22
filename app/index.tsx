import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppScreen, AppText } from '../src/components/ui';
import { getAppEnvironment } from '../src/config/env';

export default function Index() {
  const { appEnv } = getAppEnvironment();

  return (
    <AppScreen padding="xl" scrollable>
      <View style={styles.content}>
        <AppText accessibilityRole="header" style={styles.title} variant="title">
          Admiino Mobile
        </AppText>
        <AppText style={styles.message} tone="secondary">
          Application setup completed successfully.
        </AppText>
        {appEnv !== 'production' && (
          <AppText style={styles.environment} tone="secondary" variant="caption">
            {appEnv === 'development' ? 'Development' : 'Staging'}
          </AppText>
        )}
        {__DEV__ && (
          <Link asChild href="./dev/ui-kit">
            <Pressable
              accessibilityLabel="Open design system gallery"
              accessibilityRole="link"
              style={styles.galleryLink}
            >
              <AppText tone="link" variant="label">
                Design system gallery
              </AppText>
            </Pressable>
          </Link>
        )}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: 'stretch',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    textAlign: 'center',
  },
  message: {
    marginTop: 12,
    textAlign: 'center',
  },
  environment: {
    marginTop: 20,
  },
  galleryLink: {
    minHeight: 48,
    justifyContent: 'center',
    marginTop: 24,
  },
});
