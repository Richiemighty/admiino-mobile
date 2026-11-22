import type { ExpoConfig } from 'expo/config';

import { type AppEnvironmentName, getAppEnvironment } from './src/config/env.ts';

const APP_IDENTITIES: Record<AppEnvironmentName, { displayName: string; scheme: string }> = {
  development: {
    displayName: 'Admiino Mobile (Development)',
    scheme: 'admiinomobile-dev',
  },
  staging: {
    displayName: 'Admiino Mobile (Staging)',
    scheme: 'admiinomobile-staging',
  },
  production: {
    displayName: 'Admiino Mobile',
    scheme: 'admiinomobile',
  },
};

function optionalIdentifier(
  key: 'EXPO_IOS_BUNDLE_IDENTIFIER' | 'EXPO_ANDROID_PACKAGE_IDENTIFIER',
  pattern: RegExp,
): string | undefined {
  const identifier = process.env[key]?.trim();
  if (!identifier) return undefined;
  if (!pattern.test(identifier)) {
    throw new Error(`${key} has invalid syntax; its value was not logged.`);
  }
  return identifier;
}

export default function appConfig(): ExpoConfig {
  const environment = getAppEnvironment();
  const identity = APP_IDENTITIES[environment.appEnv];
  const iosBundleIdentifier = optionalIdentifier(
    'EXPO_IOS_BUNDLE_IDENTIFIER',
    /^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/,
  );
  const androidPackage = optionalIdentifier(
    'EXPO_ANDROID_PACKAGE_IDENTIFIER',
    /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/,
  );

  return {
    name: identity.displayName,
    slug: 'admiino-mobile',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: identity.scheme,
    userInterfaceStyle: 'automatic',
    ...(iosBundleIdentifier ? { ios: { bundleIdentifier: iosBundleIdentifier } } : {}),
    android: {
      ...(androidPackage ? { package: androidPackage } : {}),
      adaptiveIcon: {
        backgroundColor: '#132238',
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
    },
    web: {
      output: 'server',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          backgroundColor: '#132238',
          image: './assets/images/splash-icon.png',
          imageWidth: 76,
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      appEnvironment: environment.appEnv,
    },
  };
}
