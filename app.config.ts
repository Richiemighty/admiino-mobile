import type { ExpoConfig } from 'expo/config';

import { type AppEnvironmentName, getAppEnvironment } from './src/config/env.ts';

const APP_IDENTITIES: Record<AppEnvironmentName, { displayName: string; scheme: string }> = {
  development: {
    displayName: 'Admiino (Development)',
    scheme: 'admiinomobile-dev',
  },
  staging: {
    displayName: 'Admiino (Staging)',
    scheme: 'admiinomobile-staging',
  },
  production: {
    displayName: 'Admiino',
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
  const androidPackage =
    optionalIdentifier(
      'EXPO_ANDROID_PACKAGE_IDENTIFIER',
      /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/,
    ) ?? 'com.admiino.mobile';

  return {
    owner: 'admiino-pte',
    name: identity.displayName,
    slug: 'admiino-mobile',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/admiino/icons/app-icon-ios-1024.png',
    scheme: identity.scheme,
    userInterfaceStyle: 'automatic',
    ...(iosBundleIdentifier ? { ios: { bundleIdentifier: iosBundleIdentifier } } : {}),
    android: {
      package: androidPackage,
      adaptiveIcon: {
        backgroundColor: '#1E149F',
        foregroundImage: './assets/admiino/icons/android-adaptive-foreground.png',
        backgroundImage: './assets/admiino/icons/android-adaptive-background.png',
        monochromeImage: './assets/admiino/icons/android-adaptive-monochrome.png',
      },
    },
    web: {
      output: 'server',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      'expo-image',
      'expo-sharing',
      'expo-secure-store',
      [
        'expo-image-picker',
        {
          photosPermission: 'Allow Admiino to choose a profile photo.',
          cameraPermission: false,
          microphonePermission: false,
        },
      ],
      [
        'expo-splash-screen',
        {
          backgroundColor: '#FFFFFF',
          image: './assets/admiino/splash/native-splash-wordmark-light.png',
          imageWidth: 240,
          resizeMode: 'contain',
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      appEnvironment: environment.appEnv,
      eas: {
        projectId: '5010e767-3661-4976-8df9-56b94281ac4d',
      },
    },
  };
}
