import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError, ApiNetworkError, ApiTimeoutError } from '../../api';
import { useAuth } from '../../auth/AuthProvider';
import { AppButton, AppInput, AppText, InlineError } from '../../components/ui';
import { themeTokens } from '../../theme/tokens';
import { onboardingRoutes } from '../onboarding/routes';
import { AuthScreen } from './AuthScreen';
import { validateEmail } from './validation';

export function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [verificationRequired, setVerificationRequired] = useState(false);
  const submitting = useRef(false);
  const { login } = useAuth();

  const submit = async () => {
    if (submitting.current) return;
    const normalizedEmail = email.trim();
    const nextEmailError = validateEmail(normalizedEmail);
    const nextPasswordError = password ? null : 'Password is required.';
    setEmail(normalizedEmail);
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    setStatus(null);
    setVerificationRequired(false);
    if (nextEmailError || nextPasswordError) return;

    submitting.current = true;
    setLoading(true);
    try {
      await login({ email: normalizedEmail, password, accountType: 'workspace' });
      setLoading(false);
      submitting.current = false;
      setVerificationRequired(false);
      router.replace('/authenticated');
    } catch (error) {
      setLoading(false);
      submitting.current = false;
      if (error instanceof ApiNetworkError || error instanceof ApiTimeoutError) {
        setStatus(error.message);
      } else if (error instanceof ApiError) {
        setStatus(error.message);
      } else if (error instanceof Error) {
        setStatus(error.message);
        setVerificationRequired(error.message === 'Please verify your email before logging in.');
      } else {
        setStatus('Sign-in could not be completed. Please try again.');
      }
    }
  };

  return (
    <AuthScreen
      backLabel="Back"
      description="Sign in to continue where you left off."
      onBack={() => router.replace(onboardingRoutes.accountChoice)}
      title="Welcome back"
      footer={
        <View style={styles.footer}>
          <AppText tone="secondary">{"Don't have an account?"}</AppText>
          <AppButton
            accessibilityLabel="Create an account"
            onPress={() => router.push('/create-account')}
            variant="ghost"
          >
            Create one
          </AppButton>
        </View>
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
          setVerificationRequired(false);
        }}
        placeholder="you@company.com"
        returnKeyType="next"
        textContentType="emailAddress"
        value={email}
      />
      <AppInput
        error={passwordError ?? undefined}
        label="Password"
        onChangeText={(value) => {
          setPassword(value);
          if (passwordError) setPasswordError(value ? null : 'Password is required.');
          setVerificationRequired(false);
        }}
        placeholder="Enter your password"
        returnKeyType="done"
        secureTextEntry
        textContentType="password"
        value={password}
      />
      <AppButton
        accessibilityLabel="Forgot password"
        onPress={() => router.push('/forgot-password')}
        style={styles.forgotButton}
        variant="ghost"
      >
        Forgot password?
      </AppButton>
      {status && <InlineError message={status} />}
      {verificationRequired && (
        <AppButton
          accessibilityLabel="Resend verification email"
          onPress={() => router.push('/verify-email')}
          variant="outline"
        >
          Resend verification email
        </AppButton>
      )}
      <AppButton
        accessibilityLabel="Sign in"
        disabled={loading}
        loading={loading}
        onPress={() => void submit()}
      >
        Sign in
      </AppButton>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  forgotButton: {
    alignSelf: 'flex-end',
    minWidth: 128,
  },
  footer: {
    alignItems: 'center',
    gap: themeTokens.spacing.xxs,
  },
});
