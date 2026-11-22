import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getAppEnvironment } from '../src/config/env';

export default function Index() {
  const { appEnv } = getAppEnvironment();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          Admiino Mobile
        </Text>
        <Text style={styles.message}>Application setup completed successfully.</Text>
        {appEnv !== 'production' && (
          <Text style={styles.environment}>
            {appEnv === 'development' ? 'Development' : 'Staging'}
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    color: '#132238',
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    color: '#46566b',
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
  },
  environment: {
    color: '#596b82',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 20,
  },
});
