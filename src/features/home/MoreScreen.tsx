import { router } from 'expo-router';
import { ArrowRightLeft, LogOut, Settings } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { useAuth } from '../../auth/AuthProvider';
import {
  AppButton,
  AppCard,
  AppScreen,
  AppText,
  InlineError,
  UserAvatar,
} from '../../components/ui';
import { useAppTheme } from '../../theme';
import { themeTokens } from '../../theme/tokens';

export function MoreScreen() {
  const { user, activeWorkspace, permissions, logout } = useAuth();
  const { colors } = useAppTheme();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || 'Admiino user';
  const role = permissions?.role
    ? permissions.role.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
    : 'Membership verified';

  const signOut = async () => {
    setSigningOut(true);
    setError(null);
    try {
      await logout();
      router.replace('/sign-in');
    } catch {
      setError('Sign out could not be completed. Please try again.');
      setSigningOut(false);
    }
  };

  const confirmSignOut = () => {
    Alert.alert('Sign out of Admiino?', 'You can sign in again at any time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  return (
    <AppScreen scrollable padding="xl">
      <View
        style={{ width: '100%', maxWidth: 680, alignSelf: 'center', gap: themeTokens.spacing.lg }}
      >
        <AppText accessibilityRole="header" variant="title">
          More
        </AppText>

        <View style={{ gap: themeTokens.spacing.sm }}>
          <AppText variant="label">Account</AppText>
          <AppCard
            accessibilityLabel="Open My Profile"
            onPress={() => router.push('/profile')}
            padding="md"
          >
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: themeTokens.spacing.md }}
            >
              <UserAvatar imageUrl={user?.profilePictureUrl} name={name} size={56} />
              <View style={{ flex: 1, gap: themeTokens.spacing.xxs }}>
                <AppText variant="heading">{name}</AppText>
                {user?.email && <AppText tone="secondary">{user.email}</AppText>}
              </View>
            </View>
          </AppCard>
        </View>

        <View style={{ gap: themeTokens.spacing.sm }}>
          <AppText variant="label">Workspace</AppText>
          <AppCard padding="md" style={{ gap: themeTokens.spacing.sm }}>
            <AppText variant="heading">
              {activeWorkspace?.company.name ?? 'No active workspace'}
            </AppText>
            <AppText tone="secondary">{role}</AppText>
            <AppButton
              accessibilityLabel="Switch workspace"
              icon={<ArrowRightLeft color={colors.primaryAction} size={18} />}
              onPress={() => router.push('/workspace-select')}
              variant="outline"
            >
              Switch workspace
            </AppButton>
          </AppCard>
        </View>

        <View style={{ gap: themeTokens.spacing.sm }}>
          <AppText variant="label">Settings</AppText>
          <AppButton
            accessibilityLabel="Open Settings"
            icon={<Settings color={colors.primaryAction} size={18} />}
            onPress={() => router.push('/settings')}
            variant="outline"
          >
            Settings
          </AppButton>
        </View>

        {error && <InlineError message={error} />}

        <AppButton
          accessibilityLabel="Sign out"
          icon={<LogOut color={colors.onPrimary} size={18} />}
          loading={signingOut}
          onPress={confirmSignOut}
        >
          Sign out
        </AppButton>
      </View>
    </AppScreen>
  );
}
