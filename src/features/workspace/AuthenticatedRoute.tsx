import { router } from 'expo-router';
import { type PropsWithChildren, useEffect, useState } from 'react';

import { useAuth } from '../../auth/AuthProvider';
import { AppButton, AppScreen, AppText, InlineError, LoadingState } from '../../components/ui';
import { themeTokens } from '../../theme/tokens';

export function getAuthenticatedRouteRedirect({
  status,
  workspaceCount,
  activeWorkspace,
  workspacePermissionStatus,
  redirectToHome,
}: {
  status: string;
  workspaceCount: number;
  activeWorkspace: boolean;
  workspacePermissionStatus: string;
  redirectToHome: boolean;
}): string | null {
  if (status === 'restoring') return null;
  if (status === 'signed-out') return '/sign-in';
  if (status !== 'authenticated') return null;
  if (workspacePermissionStatus === 'suspended' && activeWorkspace) return '/workspace-suspended';
  if (workspacePermissionStatus === 'error') return '/workspace-access';
  if (workspaceCount === 0 && workspacePermissionStatus !== 'loading') return '/workspace-setup';
  if (activeWorkspace && workspacePermissionStatus === 'ready') {
    return redirectToHome ? '/(tabs)' : null;
  }
  if (workspaceCount > 0 || workspacePermissionStatus === 'loading') return '/workspace-select';
  return null;
}

export function AuthenticatedRoute({
  children,
  redirectToHome = true,
}: PropsWithChildren & { redirectToHome?: boolean }) {
  const { status, workspaces, activeWorkspace, workspacePermissionStatus, logout } = useAuth();
  const [signOutError, setSignOutError] = useState<string | null>(null);

  useEffect(() => {
    const destination = getAuthenticatedRouteRedirect({
      status,
      workspaceCount: workspaces.length,
      activeWorkspace: Boolean(activeWorkspace),
      workspacePermissionStatus,
      redirectToHome,
    });
    if (destination) router.replace(destination as never);
  }, [status, workspaces.length, activeWorkspace, workspacePermissionStatus, redirectToHome]);

  if (status === 'restoring') {
    return (
      <AppScreen>
        <LoadingState label="Restoring your account" variant="fullScreen" />
      </AppScreen>
    );
  }

  if (status === 'authenticated') {
    if (!activeWorkspace || workspacePermissionStatus !== 'ready')
      return (
        <AppScreen>
          <LoadingState label="Opening your workspace" variant="fullScreen" />
        </AppScreen>
      );
    return children;
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
