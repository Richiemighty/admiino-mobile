import { router } from 'expo-router';
import { useEffect } from 'react';

import { useAuth } from '../src/auth/AuthProvider';
import { AppButton, AppScreen, AppText } from '../src/components/ui';

export default function AuthenticatedScreen() {
  const { status, user, workspaces, activeWorkspace, logout } = useAuth();

  useEffect(() => {
    if (status === 'signed-out') router.replace('/sign-in');
  }, [status]);

  const signOut = async () => {
    await logout();
    router.replace('/sign-in');
  };

  return (
    <AppScreen padding="xl" scrollable>
      {status === 'access-denied' ? (
        <>
          <AppText accessibilityRole="header" variant="title">
            Access denied
          </AppText>
          <AppText tone="secondary">
            Your account is signed in, but this session does not have access to the requested
            resource.
          </AppText>
          <AppButton accessibilityLabel="Sign out" onPress={() => void signOut()}>
            Sign out
          </AppButton>
        </>
      ) : status === 'suspended' ? (
        <>
          <AppText accessibilityRole="header" variant="title">
            Workspace suspended
          </AppText>
          <AppText tone="secondary">
            This workspace is temporarily suspended. Your workspace data has been retained.
          </AppText>
          <AppButton accessibilityLabel="Sign out" onPress={() => void signOut()}>
            Sign out
          </AppButton>
        </>
      ) : (
        <>
          <AppText accessibilityRole="header" variant="title">
            {user ? `Welcome, ${user.firstName || 'back'}` : 'Signed in'}
          </AppText>
          <AppText tone="secondary">
            {activeWorkspace
              ? `Active workspace: ${activeWorkspace.company.name}`
              : 'No active workspace is available.'}
          </AppText>
          <AppText tone="secondary">{workspaces.length} eligible workspace(s)</AppText>
          <AppButton accessibilityLabel="Sign out" onPress={() => void signOut()}>
            Sign out
          </AppButton>
        </>
      )}
    </AppScreen>
  );
}
