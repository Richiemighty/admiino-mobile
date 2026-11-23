import { router } from 'expo-router';
import { ArrowRightLeft, LogOut } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { useAuth } from '../../auth/AuthProvider';
import { AppButton, AppCard, AppScreen, AppText, InlineError } from '../../components/ui';
import { useAppTheme } from '../../theme';
import { themeTokens } from '../../theme/tokens';

export function MoreScreen() {
  const { user, activeWorkspace, permissions, logout } = useAuth();
  const { colors } = useAppTheme();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || 'Admiino user';

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

  return (
    <AppScreen scrollable padding="xl">
      <View
        style={{ width: '100%', maxWidth: 680, alignSelf: 'center', gap: themeTokens.spacing.lg }}
      >
        <AppText accessibilityRole="header" variant="title">
          More
        </AppText>

        <AppCard padding="md" style={{ gap: themeTokens.spacing.xs }}>
          <AppText variant="heading">{name}</AppText>
          {user?.email && <AppText tone="secondary">{user.email}</AppText>}
        </AppCard>

        <AppCard padding="md" style={{ gap: themeTokens.spacing.xs }}>
          <AppText variant="caption" tone="secondary">
            CURRENT WORKSPACE
          </AppText>
          <AppText variant="heading">{activeWorkspace?.company.name}</AppText>
          <AppText tone="secondary">
            {permissions?.role
              ? permissions.role
                  .replaceAll('_', ' ')
                  .replace(/\b\w/g, (letter) => letter.toUpperCase())
              : 'Membership verified'}
          </AppText>
        </AppCard>

        {error && <InlineError message={error} />}

        <AppButton
          accessibilityLabel="Switch workspace"
          icon={<ArrowRightLeft color={colors.primaryAction} size={18} />}
          onPress={() => router.push('/workspace-select')}
          variant="outline"
        >
          Switch workspace
        </AppButton>

        <AppButton
          accessibilityLabel="Sign out"
          icon={<LogOut color={colors.onPrimary} size={18} />}
          loading={signingOut}
          onPress={() => void signOut()}
        >
          Sign out
        </AppButton>
      </View>
    </AppScreen>
  );
}
