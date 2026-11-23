import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { useAuth } from '../../auth/AuthProvider';
import { AppButton, AppScreen, AppText, InlineError, LoadingState } from '../../components/ui';
import { themeTokens } from '../../theme/tokens';

export function AuthenticatedRoute() {
  const { status, workspaces, activeWorkspace, workspacePermissionStatus, logout } = useAuth();
  const [signOutError, setSignOutError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'restoring') return;
    if (status === 'signed-out') {
      router.replace('/sign-in');
      return;
    }
    if (status !== 'authenticated') return;
    if (workspacePermissionStatus === 'suspended' && activeWorkspace) {
      router.replace('/workspace-suspended');
      return;
    }
    if (workspacePermissionStatus === 'error') {
      router.replace('/workspace-access');
      return;
    }
    if (workspaces.length === 0 && workspacePermissionStatus !== 'loading') {
      router.replace('/workspace-setup');
      return;
    }
    if (activeWorkspace && workspacePermissionStatus === 'ready') {
      router.replace('/(tabs)');
      return;
    }
    if (workspaces.length > 0 || workspacePermissionStatus === 'loading') {
      router.replace('/workspace-select');
    }
  }, [status, workspaces.length, activeWorkspace, workspacePermissionStatus]);

  if (status === 'restoring') {
    return (
      <AppScreen>
        <LoadingState label="Restoring your account" variant="fullScreen" />
      </AppScreen>
    );
  }

  if (status === 'authenticated') {
    return (
      <AppScreen>
        <LoadingState label="Opening your workspace" variant="fullScreen" />
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
        {status === 'suspended' ? 'Workspace access restricted' : 'Access denied'}
      </AppText>
      <AppText tone="secondary">
        {status === 'suspended'
          ? 'This account or workspace is temporarily restricted. Please try again later or contact your workspace administrator.'
          : 'Your signed-in account does not currently have access to a workspace.'}
      </AppText>
      {signOutError && (
        <InlineError
          message={signOutError}
          onRetry={() => void signOut()}
          retryLabel="Try sign out again"
        />
      )}
      <AppButton accessibilityLabel="Sign out" onPress={() => void signOut()}>
        Sign out
      </AppButton>
    </AppScreen>
  );
}
