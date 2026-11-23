import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { useAuth } from '../../auth/AuthProvider';
import {
  AppButton,
  AppCard,
  AppScreen,
  AppText,
  InlineError,
  LoadingState,
} from '../../components/ui';
import { themeTokens } from '../../theme/tokens';

function roleLabel(role: string) {
  return role.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function WorkspaceSelectionScreen() {
  const {
    status,
    workspaces,
    activeWorkspace,
    selectedWorkspaceId,
    workspacePermissionStatus,
    workspaceError,
    selectWorkspace,
    refreshWorkspaces,
    clearWorkspaceError,
  } = useAuth();
  const [selectionStarted, setSelectionStarted] = useState(false);
  const [openedWithActiveWorkspace] = useState(
    activeWorkspace !== null && workspacePermissionStatus === 'ready',
  );

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
    if (
      activeWorkspace &&
      workspacePermissionStatus === 'ready' &&
      (selectionStarted || !openedWithActiveWorkspace)
    ) {
      router.replace('/(tabs)');
      return;
    }
    if (
      activeWorkspace &&
      workspacePermissionStatus === 'suspended' &&
      (selectionStarted || !openedWithActiveWorkspace)
    ) {
      router.replace('/workspace-suspended');
      return;
    }
    if (
      workspaces.length === 0 &&
      workspacePermissionStatus !== 'loading' &&
      workspacePermissionStatus !== 'error'
    ) {
      router.replace('/workspace-setup');
    }
  }, [
    status,
    workspaces.length,
    activeWorkspace,
    workspacePermissionStatus,
    selectionStarted,
    openedWithActiveWorkspace,
  ]);

  if (status === 'restoring' || workspacePermissionStatus === 'loading') {
    return (
      <AppScreen>
        <LoadingState label="Checking workspace access" variant="fullScreen" />
      </AppScreen>
    );
  }

  const handleSelect = async (workspaceId: string) => {
    setSelectionStarted(true);
    clearWorkspaceError();
    await selectWorkspace(workspaceId);
  };

  const handleRetry = async () => {
    clearWorkspaceError();
    if (activeWorkspace) {
      setSelectionStarted(true);
      await selectWorkspace(activeWorkspace.companyId);
    } else {
      await refreshWorkspaces(selectedWorkspaceId ?? undefined);
    }
  };

  return (
    <AppScreen
      scrollable
      padding="xl"
      contentContainerStyle={{
        width: '100%',
        maxWidth: 680,
        alignSelf: 'center',
        gap: themeTokens.spacing.md,
      }}
    >
      <AppText accessibilityRole="header" variant="title">
        Choose a workspace
      </AppText>
      <AppText tone="secondary">
        Your tasks and workspace information are kept separate. Select the workspace you want to
        open.
      </AppText>

      {workspaceError && (
        <InlineError
          message={workspaceError}
          onRetry={() => void handleRetry()}
          retryLabel={activeWorkspace ? 'Retry access check' : 'Refresh workspaces'}
        />
      )}

      {workspaces.map((workspace) => {
        return (
          <AppCard
            key={workspace.companyId}
            accessibilityLabel={`Select ${workspace.company.name}, ${roleLabel(workspace.role)}`}
            onPress={() => void handleSelect(workspace.companyId)}
            padding="md"
            style={{ gap: themeTokens.spacing.sm }}
          >
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: themeTokens.spacing.sm }}
            >
              <View style={{ flex: 1, gap: themeTokens.spacing.xxs }}>
                <AppText variant="heading">{workspace.company.name}</AppText>
                <AppText tone="secondary">{roleLabel(workspace.role)}</AppText>
              </View>
              <AppText tone="link" variant="label">
                {activeWorkspace?.companyId === workspace.companyId ? 'Current' : 'Open'}
              </AppText>
            </View>
          </AppCard>
        );
      })}

      {workspaces.length === 0 && workspacePermissionStatus === 'error' && (
        <AppButton accessibilityLabel="Refresh workspaces" onPress={() => void handleRetry()}>
          Refresh workspaces
        </AppButton>
      )}
    </AppScreen>
  );
}
