import { router } from 'expo-router';
import {
  ArrowLeft,
  Bell,
  ChevronRight,
  ExternalLink,
  KeyRound,
  LogOut,
  Palette,
  ShieldCheck,
  Trash2,
} from 'lucide-react-native';
import { type ReactNode, useRef, useState } from 'react';
import { Alert, Linking, View } from 'react-native';

import { ApiError, ApiNetworkError, ApiTimeoutError } from '../../api';
import { useAuth } from '../../auth/AuthProvider';
import {
  AppButton,
  AppCard,
  AppScreen,
  AppText,
  IconButton,
  InlineError,
} from '../../components/ui';
import { useAppTheme } from '../../theme';
import { themeTokens } from '../../theme/tokens';
import { profileService } from './service';

const LEGAL_LINKS = [
  { label: 'Terms of Service', url: 'https://www.admiino.com/terms' },
  { label: 'Privacy Policy', url: 'https://www.admiino.com/privacy' },
];
const SUPPORT_EMAIL = 'contact@admiino.com';

function resetError(error: unknown): string {
  if (error instanceof ApiNetworkError) return 'You appear to be offline. Reconnect and try again.';
  if (error instanceof ApiTimeoutError) return 'The request timed out. Please try again.';
  if (error instanceof ApiError && error.status === 401)
    return 'Your session has expired. Sign in again to continue.';
  if (error instanceof ApiError && error.status === 429)
    return 'Too many requests. Wait a moment, then try again.';
  return 'The password reset email could not be requested. Please try again.';
}

interface SettingsLinkProps {
  label: string;
  detail?: string;
  icon: ReactNode;
  onPress: () => void;
  accessibilityLabel?: string;
  destructive?: boolean;
  disabled?: boolean;
}

function SettingsLink({
  label,
  detail,
  icon,
  onPress,
  accessibilityLabel = label,
  destructive = false,
  disabled = false,
}: SettingsLinkProps) {
  const { colors } = useAppTheme();
  return (
    <AppCard
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      padding="sm"
      style={{ minHeight: 60, justifyContent: 'center' }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: themeTokens.spacing.sm }}>
        {icon}
        <View style={{ flex: 1, gap: 2 }}>
          <AppText tone={destructive ? 'danger' : 'primary'} variant="label">
            {label}
          </AppText>
          {detail ? (
            <AppText numberOfLines={2} tone="secondary" variant="caption">
              {detail}
            </AppText>
          ) : null}
        </View>
        <ChevronRight
          color={destructive ? colors.semantic.danger.foreground : colors.textMuted}
          size={18}
        />
      </View>
    </AppCard>
  );
}

export function SettingsScreen() {
  const { logout, user } = useAuth();
  const { colors, mode } = useAppTheme();
  const [resettingPassword, setResettingPassword] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const resetInProgress = useRef(false);
  const signOutInProgress = useRef(false);
  const modeLabel = mode === 'system' ? 'System Default' : mode === 'dark' ? 'Dark' : 'Light';

  const sendPasswordReset = async () => {
    if (!user?.email || resetInProgress.current) return;
    resetInProgress.current = true;
    setResettingPassword(true);
    setError(null);
    setMessage(null);
    try {
      await profileService.requestPasswordReset(user.email);
      setMessage('If this email is registered, password reset instructions will be sent shortly.');
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        try {
          await logout();
          router.replace('/sign-in');
        } catch {
          setError('Your session could not be cleared safely. Please try again.');
        }
      } else {
        setError(resetError(requestError));
      }
    } finally {
      resetInProgress.current = false;
      setResettingPassword(false);
    }
  };

  const signOut = async () => {
    if (signOutInProgress.current) return;
    signOutInProgress.current = true;
    setSigningOut(true);
    setError(null);
    try {
      await logout();
      router.replace('/sign-in');
    } catch {
      setError('Sign out could not be completed. Please try again.');
    } finally {
      signOutInProgress.current = false;
      setSigningOut(false);
    }
  };

  const confirmSignOut = () => {
    Alert.alert('Sign out of Admiino?', 'Your session will be cleared from this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  const openExternal = async (url: string) => {
    setError(null);
    try {
      await Linking.openURL(url);
    } catch {
      setError('This link could not be opened on your device.');
    }
  };

  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/more');
  };

  return (
    <AppScreen scrollable padding="md">
      <View
        style={{
          width: '100%',
          maxWidth: 680,
          alignSelf: 'center',
          gap: themeTokens.spacing.lg,
          paddingBottom: themeTokens.spacing.lg,
        }}
      >
        <View style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <IconButton
            accessibilityLabel="Back"
            icon={<ArrowLeft color={colors.text} size={22} />}
            onPress={back}
          />
          <AppText accessibilityRole="header" style={{ flex: 1 }} variant="heading">
            Settings
          </AppText>
        </View>

        {error ? <InlineError message={error} /> : null}
        {message ? (
          <AppText accessibilityRole="alert" tone="info">
            {message}
          </AppText>
        ) : null}

        <View style={{ gap: themeTokens.spacing.sm }}>
          <AppText variant="label">Appearance</AppText>
          <SettingsLink
            accessibilityLabel="App appearance"
            detail={modeLabel}
            icon={<Palette color={colors.primaryAction} size={20} />}
            label="Theme"
            onPress={() => router.push('/settings/appearance')}
          />
        </View>

        <View style={{ gap: themeTokens.spacing.sm }}>
          <AppText variant="label">Notifications</AppText>
          <SettingsLink
            detail="Choose in-app, email, and WhatsApp preferences"
            icon={<Bell color={colors.primaryAction} size={20} />}
            label="Notification preferences"
            onPress={() => router.push('/notification-settings')}
          />
        </View>

        <View style={{ gap: themeTokens.spacing.sm }}>
          <AppText variant="label">Account and Security</AppText>
          <SettingsLink
            detail={user?.email ?? ''}
            icon={<KeyRound color={colors.primaryAction} size={20} />}
            label="Send password reset link"
            onPress={() => void sendPasswordReset()}
            accessibilityLabel="Send password reset link"
            disabled={resettingPassword}
          />
          {resettingPassword ? (
            <AppText accessibilityRole="alert" tone="secondary">
              Requesting password reset…
            </AppText>
          ) : null}
          <SettingsLink
            accessibilityLabel="Delete account information"
            destructive
            detail="Deletion is not currently supported in the app"
            icon={<Trash2 color={colors.semantic.danger.foreground} size={20} />}
            label="Delete Account"
            onPress={() => router.push('/account/delete')}
          />
        </View>

        <View style={{ gap: themeTokens.spacing.sm }}>
          <AppText variant="label">Help and Legal</AppText>
          {LEGAL_LINKS.map(({ label, url }) => (
            <SettingsLink
              key={label}
              detail={url.replace('https://', '')}
              icon={<ExternalLink color={colors.primaryAction} size={18} />}
              label={label}
              onPress={() => void openExternal(url)}
            />
          ))}
          <SettingsLink
            detail={SUPPORT_EMAIL}
            icon={<ShieldCheck color={colors.primaryAction} size={20} />}
            label="Contact Support"
            onPress={() =>
              void openExternal(`mailto:${SUPPORT_EMAIL}?subject=Admiino%20Mobile%20Support`)
            }
          />
        </View>

        <View style={{ gap: themeTokens.spacing.sm }}>
          <AppText variant="label">Session</AppText>
          <AppButton
            accessibilityLabel="Sign out"
            disabled={signingOut}
            icon={<LogOut color={colors.semantic.danger.foreground} size={18} />}
            loading={signingOut}
            onPress={confirmSignOut}
            variant="destructive"
          >
            Sign Out
          </AppButton>
          <AppText tone="secondary" variant="caption">
            Sign out clears this device&apos;s saved session. It does not revoke the server token.
          </AppText>
        </View>
      </View>
    </AppScreen>
  );
}
