import { router } from 'expo-router';
import { useRef, useState } from 'react';

import { AppButton, AppInput, AppText, InlineError } from '../../components/ui';
import { AuthScreen } from './AuthScreen';
import { validateEmail } from './validation';

type RecoveryStatus = 'idle' | 'submitting' | 'ui-only';

export function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [status, setStatus] = useState<RecoveryStatus>('idle');
  const [networkError, setNetworkError] = useState(false);
  const submitting = useRef(false);

  const submit = async () => {
    if (submitting.current) return;
    const normalizedEmail = email.trim();
    const error = validateEmail(normalizedEmail);
    setEmail(normalizedEmail);
    setEmailError(error);
    setNetworkError(false);
    if (error) return;

    submitting.current = true;
    setStatus('submitting');
    await new Promise((resolve) => setTimeout(resolve, 350));
    setStatus('ui-only');
    submitting.current = false;
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
          setNetworkError(false);
          if (status === 'ui-only') setStatus('idle');
        }}
        placeholder="you@company.com"
        returnKeyType="done"
        textContentType="emailAddress"
        value={email}
      />
      {networkError && (
        <InlineError
          message="We could not complete the preview request. Please try again."
          onRetry={() => void submit()}
        />
      )}
      {status === 'ui-only' && (
        <AppText accessibilityRole="alert" tone="info">
          Password reset delivery is awaiting backend integration. No reset email was sent.
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
