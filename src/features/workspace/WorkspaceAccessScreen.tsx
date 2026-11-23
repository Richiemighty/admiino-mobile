import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { useAuth } from '../../auth/AuthProvider';
import { AppButton, AppScreen, AppText, InlineError, LoadingState } from '../../components/ui';
import { themeTokens } from '../../theme/tokens';

export function WorkspaceAccessScreen() {
  const {
    status,
    activeWorkspace,
    workspaces,
    selectedWorkspaceId,
    workspacePermissionStatus,
    workspaceError,
    selectWorkspace,
    refreshWorkspaces,
    clearWorkspaceError,
    logout,
  } = useAuth();
  const [signOutError, setSignOutError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'restoring') return;
    if (status === 'signed-out') {
      router.replace('/sign-in');
      return;
    }
    if (status !== 'authenticated') {
      router.replace('/authenticated');
      return;
    }
    if (workspacePermissionStatus === 'ready') {
      router.replace('/(tabs)');
      return;
    }
    if (workspacePermissionStatus === 'suspended' && activeWorkspace) {
      router.replace('/workspace-suspended');
    }
  }, [status, workspacePermissionStatus, activeWorkspace]);

  if (status === 'restoring' || workspacePermissionStatus === 'loading') {
    return (
      <AppScreen>
        <LoadingState label="Checking workspace access" variant="fullScreen" />
      </AppScreen>
    );
  }

  const retry = async () => {
    clearWorkspaceError();
    if (activeWorkspace) {
      await selectWorkspace(activeWorkspace.companyId);
    } else {
      await refreshWorkspaces(selectedWorkspaceId ?? undefined);
    }
  };

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
        Workspace access unavailable
      </AppText>
      <AppText tone="secondary">
        We could not confirm your permissions for this workspace. Workspace data remains hidden
        until access is verified.
      </AppText>
      {workspaceError && <InlineError message={workspaceError} />}
      {signOutError && (
        <InlineError
          message={signOutError}
          onRetry={() => void signOut()}
          retryLabel="Try sign out again"
        />
      )}
      <AppButton accessibilityLabel="Retry workspace access" onPress={() => void retry()}>
        Retry access check
      </AppButton>
      {workspaces.length > 0 && (
        <AppButton
          accessibilityLabel="Choose another workspace"
          onPress={() => router.replace('/workspace-select')}
          variant="outline"
        >
          Choose another workspace
        </AppButton>
      )}
      <AppButton accessibilityLabel="Sign out" onPress={() => void signOut()} variant="ghost">
        Sign out
      </AppButton>
    </AppScreen>
  );
}
