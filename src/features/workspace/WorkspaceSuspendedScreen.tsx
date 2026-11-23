import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { useAuth } from '../../auth/AuthProvider';
import { AppButton, AppScreen, AppText, InlineError, LoadingState } from '../../components/ui';
import { themeTokens } from '../../theme/tokens';

export function WorkspaceSuspendedScreen() {
  const { status, activeWorkspace, workspaces, logout } = useAuth();
  const [signOutError, setSignOutError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'restoring') return;
    if (status === 'signed-out') {
      router.replace('/sign-in');
      return;
    }
    if (status !== 'authenticated' || !activeWorkspace) {
      router.replace('/authenticated');
    }
  }, [status, activeWorkspace]);

  if (status === 'restoring') {
    return (
      <AppScreen>
        <LoadingState label="Restoring your account" variant="fullScreen" />
      </AppScreen>
    );
  }

  const signOut = async () => {
    try {
      await logout();
      router.replace('/sign-in');
    } catch {
      setSignOutError('Sign out could not be completed. Please try again.');
    }
  };

  return (
    <AppScreen
      padding="xl"
      contentContainerStyle={{
        flex: 1,
        justifyContent: 'center',
        gap: themeTokens.spacing.md,
        width: '100%',
        maxWidth: 560,
        alignSelf: 'center',
      }}
    >
      <AppText accessibilityRole="header" variant="title">
        Workspace temporarily suspended
      </AppText>
      <AppText tone="secondary">
        {activeWorkspace
          ? `${activeWorkspace.company.name} is temporarily unavailable. Its data is hidden while access is restricted.`
          : 'This workspace is temporarily unavailable. Its data is hidden while access is restricted.'}
      </AppText>
      {signOutError && (
        <InlineError
          message={signOutError}
          onRetry={() => void signOut()}
          retryLabel="Try sign out again"
        />
      )}
      {workspaces.length > 1 && (
        <AppButton
          accessibilityLabel="Switch workspace"
          onPress={() => router.replace('/workspace-select')}
          variant="outline"
        >
          Switch workspace
        </AppButton>
      )}
      <AppButton accessibilityLabel="Sign out" onPress={() => void signOut()} variant="ghost">
        Sign out
      </AppButton>
    </AppScreen>
  );
}
