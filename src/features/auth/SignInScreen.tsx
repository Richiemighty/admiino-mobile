import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

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
  const submitting = useRef(false);

  const submit = async () => {
    if (submitting.current) return;
    const normalizedEmail = email.trim();
    const nextEmailError = validateEmail(normalizedEmail);
    const nextPasswordError = password ? null : 'Password is required.';
    setEmail(normalizedEmail);
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    setStatus(null);
    if (nextEmailError || nextPasswordError) return;

    submitting.current = true;
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 350));
    setLoading(false);
    setStatus('Live sign-in is awaiting backend integration. No account was accessed.');
    submitting.current = false;
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
