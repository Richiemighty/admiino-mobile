import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { View } from 'react-native';

import { AppButton, AppText, InlineError } from '../../components/ui';
import { onboardingRoutes } from '../onboarding/routes';
import { AuthScreen } from './AuthScreen';

const SECURE_SIGNUP_URL = 'https://www.app.admiino.com/signup';

export function CreateAccountScreen() {
  const [error, setError] = useState<string | null>(null);

  const openSignup = async () => {
    setError(null);
    try {
      await WebBrowser.openBrowserAsync(SECURE_SIGNUP_URL);
    } catch {
      setError('The secure account page could not be opened. Please try again.');
    }
  };

  return (
    <AuthScreen
      backLabel="Back"
      description="Create your account and bring your work together in one place."
      onBack={() => router.replace(onboardingRoutes.accountChoice)}
      title="Get started with Admiino"
      footer={
        <View style={{ alignItems: 'center', gap: 4 }}>
          <AppText tone="secondary">Already have an account?</AppText>
          <AppButton
            accessibilityLabel="Already have an account? Sign in"
            onPress={() => router.replace('/sign-in')}
            variant="ghost"
          >
            Sign in
          </AppButton>
        </View>
      }
    >
      <AppText style={{ textAlign: 'center' }} tone="secondary">
        Account creation continues securely on the Admiino website, which preserves browser-based
        verification and signup protections.
      </AppText>
      {error && <InlineError message={error} />}
      <AppButton accessibilityLabel="Continue to create account" onPress={() => void openSignup()}>
        Continue to create account
      </AppButton>
    </AuthScreen>
  );
}
