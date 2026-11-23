import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';

import { apiClient, ApiError, ApiNetworkError, ApiTimeoutError } from '../../api';
import { AppButton, AppText, InlineError } from '../../components/ui';
import { AuthScreen } from './AuthScreen';

export function ActivationScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [error, setError] = useState<string | null>(
    token ? null : 'This activation link is missing or invalid.',
  );
  const [ready, setReady] = useState(false);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    if (!token) return;
    let active = true;
    void apiClient
      .post('/auth/org-activation/inspect', { token })
      .then(() => {
        if (active) setReady(true);
      })
      .catch((caught) => {
        if (!active) return;
        if (caught instanceof ApiError) setError(caught.message);
        else if (caught instanceof ApiNetworkError || caught instanceof ApiTimeoutError)
          setError(caught.message);
        else setError('This activation link could not be verified.');
      });
    return () => {
      active = false;
    };
  }, [token]);

  const openWebActivation = async () => {
    if (!token) return;
    setOpening(true);
    setError(null);
    try {
      await WebBrowser.openBrowserAsync(
        `https://www.app.admiino.com/activate-account#token=${encodeURIComponent(token)}`,
      );
    } catch {
      setError('The secure activation page could not be opened.');
    } finally {
      setOpening(false);
    }
  };

  return (
    <AuthScreen
      backLabel="Back"
      description="Complete your organisation account activation securely."
      onBack={() => router.replace('/sign-in')}
      title="Activate your account"
    >
      {error && <InlineError message={error} />}
      {ready && (
        <AppText tone="secondary" style={{ textAlign: 'center' }}>
          Continue through the secure Admiino website to complete activation.
        </AppText>
      )}
      <AppButton
        accessibilityLabel="Continue secure activation"
        disabled={!ready || opening}
        loading={opening}
        onPress={() => void openWebActivation()}
      >
        Continue secure activation
      </AppButton>
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
