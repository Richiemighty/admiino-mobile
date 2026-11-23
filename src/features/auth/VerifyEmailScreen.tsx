import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';

import { apiClient, ApiError, ApiNetworkError, ApiTimeoutError } from '../../api';
import { AppButton, AppInput, AppText, InlineError } from '../../components/ui';
import { AuthScreen } from './AuthScreen';

interface InspectResponse {
  status: 'success';
  data?: { email?: string; verified?: boolean };
}

export function VerifyEmailScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'resent' | 'error'>(
    token ? 'loading' : 'ready',
  );
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const resendLock = useRef(false);

  useEffect(() => {
    if (!token) return;
    let active = true;
    void apiClient
      .post<InspectResponse>('/auth/verify-email/inspect', { token })
      .then((response) => {
        if (!active) return;
        setEmail(response.data?.email ?? '');
        setStatus(response.data?.verified ? 'resent' : 'ready');
      })
      .catch((caught) => {
        if (!active) return;
        setStatus('error');
        if (caught instanceof ApiError) {
          setError(caught.message || 'This verification link is missing, invalid or expired.');
        } else if (caught instanceof ApiNetworkError || caught instanceof ApiTimeoutError) {
          setError(caught.message);
        } else {
          setError('The verification link could not be checked.');
        }
      });
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const resend = async () => {
    if (resendLock.current || cooldown > 0) return;
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError('Enter the email address used for your account.');
      return;
    }
    resendLock.current = true;
    setResending(true);
    setError(null);
    try {
      await apiClient.post('/auth/resend-verification', { email: normalizedEmail });
      setStatus('resent');
      setCooldown(120);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 429) {
        setError('Please wait before requesting another verification email.');
        setCooldown(120);
      } else if (caught instanceof ApiNetworkError || caught instanceof ApiTimeoutError) {
        setError(caught.message);
      } else if (caught instanceof ApiError) {
        setError(caught.message);
      } else {
        setError('The verification email could not be sent.');
      }
    } finally {
      resendLock.current = false;
      setResending(false);
    }
  };

  const openEmail = async () => {
    setError(null);
    try {
      await Linking.openURL('mailto:');
    } catch {
      setError('No email app could be opened. Check your email manually, or try another app.');
    }
  };

  return (
    <AuthScreen
      backLabel="Back"
      description="Check your inbox and use the latest verification link."
      onBack={() => router.replace('/sign-in')}
      title="Verify your email"
    >
      {status === 'loading' && (
        <AppInput disabled label="Email address" onChangeText={() => undefined} value="" />
      )}
      {error && <InlineError message={error} />}
      {status !== 'loading' && (
        <AppInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          label="Email address"
          onChangeText={setEmail}
          placeholder="you@company.com"
          value={email}
        />
      )}
      {status === 'resent' && (
        <AppText accessibilityRole="alert" tone="info">
          If that account needs verification, a verification email has been requested.
        </AppText>
      )}
      {status === 'error' && (
        <AppText tone="secondary">
          The link may be expired or invalid. Request a new verification email to continue.
        </AppText>
      )}
      <AppButton
        accessibilityLabel="Open email app"
        onPress={() => void openEmail()}
        variant="outline"
      >
        Open email app
      </AppButton>
      <AppButton
        accessibilityLabel="Resend verification email"
        disabled={cooldown > 0 || status === 'loading' || resending}
        loading={resending}
        onPress={() => void resend()}
        variant="outline"
      >
        {cooldown > 0 ? `Resend available in ${cooldown}s` : 'Resend verification email'}
      </AppButton>
      <AppButton accessibilityLabel="Return to Sign In" onPress={() => router.replace('/sign-in')}>
        Return to Sign In
      </AppButton>
    </AuthScreen>
  );
}
