import { router } from 'expo-router';
import { useRef, useState } from 'react';

import { apiClient, ApiError, ApiNetworkError, ApiTimeoutError } from '../../api';
import { AppButton, AppInput, AppText, InlineError } from '../../components/ui';
import { AuthScreen } from './AuthScreen';
import { validateEmail } from './validation';

type RecoveryStatus = 'idle' | 'submitting' | 'sent';
type RecoveryError = 'rate-limit' | 'network' | 'server';

export function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [status, setStatus] = useState<RecoveryStatus>('idle');
  const [requestError, setRequestError] = useState<RecoveryError | null>(null);
  const submitting = useRef(false);

  const submit = async () => {
    if (submitting.current) return;
    const normalizedEmail = email.trim();
    const error = validateEmail(normalizedEmail);
    setEmail(normalizedEmail);
    setEmailError(error);
    setRequestError(null);
    if (error) return;

    submitting.current = true;
    setStatus('submitting');
    try {
      await apiClient.post('/auth/forgot-password', { email: normalizedEmail });
      setStatus('sent');
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) setRequestError('rate-limit');
      else if (error instanceof ApiNetworkError || error instanceof ApiTimeoutError)
        setRequestError('network');
      else setRequestError('server');
      setStatus('idle');
    } finally {
      submitting.current = false;
    }
  };

  return (
    <AuthScreen
      backLabel="Back"
      description="Enter your email address and we'll help you reset your password."
      onBack={() => router.replace('/sign-in')}
      title="Forgot your password?"
      footer={
        <AppButton
          accessibilityLabel="Back to Sign In"
          onPress={() => router.replace('/sign-in')}
          variant="ghost"
        >
          Back to Sign In
        </AppButton>
      }
    >
      <AppInput
        autoCapitalize="none"
        autoCorrect={false}
        error={emailError ?? undefined}
        keyboardType="email-address"
        label="Email address"
        onChangeText={(value) => {
          setEmail(value);
          if (emailError) setEmailError(validateEmail(value));
          setRequestError(null);
          if (status === 'sent') setStatus('idle');
        }}
        placeholder="you@company.com"
        returnKeyType="done"
        textContentType="emailAddress"
        value={email}
      />
      {requestError && (
        <InlineError
          message={
            requestError === 'rate-limit'
              ? 'Too many attempts. Please wait a moment before trying again.'
              : requestError === 'network'
                ? 'We could not reach Admiino. Check your connection and try again.'
                : 'We could not send the recovery request. Please try again.'
          }
          onRetry={() => void submit()}
        />
      )}
      {status === 'sent' && (
        <AppText accessibilityRole="alert" tone="info">
          If that email is registered, you will receive password reset instructions shortly.
        </AppText>
      )}
      <AppButton
        accessibilityLabel="Send reset link"
        disabled={status === 'submitting'}
        loading={status === 'submitting'}
        onPress={() => void submit()}
      >
        Send reset link
      </AppButton>
    </AuthScreen>
  );
}
