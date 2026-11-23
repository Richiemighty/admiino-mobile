import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';

import { AppButton, AppText, InlineError } from '../../components/ui';
import { AuthScreen } from './AuthScreen';

const APP_ORIGIN = 'https://www.app.admiino.com';

export function ResetPasswordScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openSecureReset = async () => {
    if (!token || opening) return;
    setOpening(true);
    setError(null);
    try {
      await WebBrowser.openBrowserAsync(
        `${APP_ORIGIN}/reset-password/${encodeURIComponent(token)}`,
      );
    } catch {
      setError('The secure password reset page could not be opened. Please try again.');
    } finally {
      setOpening(false);
    }
  };

  return (
    <AuthScreen
      backLabel="Back"
      description="Complete password changes on the secure Admiino website."
      onBack={() => router.replace('/sign-in')}
      title="Reset your password"
    >
      <AppText style={{ textAlign: 'center' }} tone="secondary">
        Password reset links are completed in your browser. Open the link from your email to set and
        confirm your new password.
      </AppText>
      {error && <InlineError message={error} />}
      <AppButton
        accessibilityLabel="Continue to secure password reset"
        disabled={!token || opening}
        loading={opening}
        onPress={() => void openSecureReset()}
      >
        Continue to secure reset
      </AppButton>
      {!token && (
        <AppText accessibilityRole="alert" tone="danger">
          This reset link is missing. Request a new link from Forgot Password.
        </AppText>
      )}
      <AppButton
        accessibilityLabel="Return to Sign In"
        onPress={() => router.replace('/sign-in')}
        variant="outline"
      >
        Return to Sign In
      </AppButton>
    </AuthScreen>
  );
}
