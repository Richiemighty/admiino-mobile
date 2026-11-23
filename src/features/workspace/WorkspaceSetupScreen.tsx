import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { ApiError } from '../../api';
import type { WorkspaceJoinRequest } from '../../api/types';
import { useAuth } from '../../auth/AuthProvider';
import { sessionService } from '../../auth/session';
import {
  AppButton,
  AppCard,
  AppInput,
  AppScreen,
  AppText,
  InlineError,
  LoadingState,
} from '../../components/ui';
import { themeTokens } from '../../theme/tokens';
import { workspaceService } from '../../workspace/service';

function errorMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 429) {
    return 'Too many requests. Please wait a moment and try again.';
  }
  if (error instanceof ApiError && error.status === 401) {
    return 'Your session has expired. Sign in again to continue.';
  }
  if (error instanceof Error && error.message) return error.message;
  return 'The request could not be completed. Please try again.';
}

function statusLabel(status: WorkspaceJoinRequest['status']) {
  return status.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function WorkspaceSetupScreen() {
  const { status, workspaces, workspacePermissionStatus, refreshWorkspaces, logout } = useAuth();
  const [workspaceName, setWorkspaceName] = useState('');
  const [companyCode, setCompanyCode] = useState('');
  const [resolvedWorkspace, setResolvedWorkspace] = useState<{
    name: string;
    companyCode: string;
  } | null>(null);
  const [joinRequests, setJoinRequests] = useState<WorkspaceJoinRequest[]>([]);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [joinMessage, setJoinMessage] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [checkingMembership, setCheckingMembership] = useState(false);
  const [membershipMessage, setMembershipMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<'join' | 'create' | null>(null);
  const requestsLoadStarted = useRef(false);

  const loadJoinRequests = useCallback(async () => {
    setLoadingRequests(true);
    setRequestsError(null);
    try {
      const token = await sessionService.restoreSession();
      if (!token) {
        router.replace('/sign-in');
        return;
      }
      const response = await workspaceService.getMyJoinRequests(token);
      setJoinRequests(response.data.requests);
    } catch (loadError) {
      setRequestsError(errorMessage(loadError));
    } finally {
      setLoadingRequests(false);
    }
  }, []);

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
    if (workspaces.length > 0 || workspacePermissionStatus === 'error') {
      router.replace('/authenticated');
      return;
    }
    if (requestsLoadStarted.current) return;
    requestsLoadStarted.current = true;
    void Promise.resolve().then(loadJoinRequests);
  }, [status, workspaces.length, workspacePermissionStatus, loadJoinRequests]);

  const handleJoinRequest = async () => {
    const code = resolvedWorkspace?.companyCode;
    if (!code || busy) return;
    setBusy('join');
    setJoinMessage(null);
    setRequestError(null);
    try {
      const token = await sessionService.restoreSession();
      if (!token) throw new ApiError('Your session has expired. Sign in again to continue.', 401);
      const response = await workspaceService.requestToJoin(token, code);
      setJoinMessage(response.message);
      setResolvedWorkspace(null);
      await loadJoinRequests();
    } catch (joinError) {
      setRequestError(errorMessage(joinError));
    } finally {
      setBusy(null);
    }
  };

  const handleResolve = async () => {
    const code = companyCode.trim().toUpperCase();
    if (!code || busy) return;
    setBusy('join');
    setJoinMessage(null);
    setRequestError(null);
    setResolvedWorkspace(null);
    try {
      const token = await sessionService.restoreSession();
      if (!token) throw new ApiError('Your session has expired. Sign in again to continue.', 401);
      const response = await workspaceService.resolveCompanyCode(token, code);
      setResolvedWorkspace(response.data.workspace);
    } catch (resolveError) {
      setRequestError(errorMessage(resolveError));
    } finally {
      setBusy(null);
    }
  };

  const handleCreateWorkspace = async () => {
    const name = workspaceName.trim();
    if (!name || busy) return;
    setBusy('create');
    setCreateError(null);
    setCreateMessage(null);
    try {
      const token = await sessionService.restoreSession();
      if (!token) throw new ApiError('Your session has expired. Sign in again to continue.', 401);
      const response = await workspaceService.createWorkspace(token, name);
      setWorkspaceName('');
      const activated = await refreshWorkspaces(response.data.company.id);
      if (activated) {
        router.replace('/(tabs)');
      } else {
        setCreateMessage(
          'The workspace was created, but membership could not be confirmed yet. Refresh your workspaces to try again.',
        );
      }
    } catch (creationError) {
      setCreateError(errorMessage(creationError));
    } finally {
      setBusy(null);
    }
  };

  const handleSignOut = async () => {
    try {
      await logout();
      router.replace('/sign-in');
    } catch {
      setAccountError('Sign out could not be completed. Please try again.');
    }
  };

  const handleRefreshMembership = async () => {
    setCheckingMembership(true);
    setMembershipMessage(null);
    const activated = await refreshWorkspaces();
    if (activated) {
      router.replace('/(tabs)');
    } else {
      setMembershipMessage(
        'No active workspace membership was found. A join request must be approved before access is granted.',
      );
    }
    setCheckingMembership(false);
  };

  if (status === 'restoring') {
    return (
      <AppScreen>
        <LoadingState label="Restoring your account" variant="fullScreen" />
      </AppScreen>
    );
  }

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
        Set up your workspace
      </AppText>
      <AppText tone="secondary">
        Join an existing workspace with its code, or create a new workspace for your team.
      </AppText>

      <AppCard padding="md" style={{ gap: themeTokens.spacing.md }}>
        <AppText variant="heading">Join a workspace</AppText>
        <AppInput
          autoCapitalize="characters"
          label="Workspace code"
          onChangeText={(value) => {
            setCompanyCode(value);
            setResolvedWorkspace(null);
            setJoinMessage(null);
          }}
          placeholder="For example, ACME-1234"
          value={companyCode}
        />
        <AppButton
          accessibilityLabel="Find workspace"
          disabled={!companyCode.trim() || checkingMembership}
          loading={busy === 'join'}
          onPress={() => void handleResolve()}
          variant="outline"
        >
          Find workspace
        </AppButton>
        {resolvedWorkspace && (
          <View style={{ gap: themeTokens.spacing.sm }}>
            <AppText>
              Request to join <AppText variant="label">{resolvedWorkspace.name}</AppText>?
            </AppText>
            <AppButton
              accessibilityLabel={`Request to join ${resolvedWorkspace.name}`}
              disabled={checkingMembership}
              loading={busy === 'join'}
              onPress={() => void handleJoinRequest()}
            >
              Request to join
            </AppButton>
          </View>
        )}
        {joinMessage && <AppText tone="success">{joinMessage}</AppText>}
        {requestError && (
          <InlineError
            message={requestError}
            onRetry={() => {
              if (resolvedWorkspace) void handleJoinRequest();
              else void handleResolve();
            }}
            retryLabel="Try again"
          />
        )}
      </AppCard>

      <AppCard padding="md" style={{ gap: themeTokens.spacing.md }}>
        <AppText variant="heading">Create a workspace</AppText>
        <AppInput
          autoCapitalize="words"
          label="Workspace name"
          onChangeText={(value) => {
            setWorkspaceName(value);
            setCreateMessage(null);
          }}
          placeholder="Your team or organization"
          value={workspaceName}
        />
        <AppButton
          accessibilityLabel="Create workspace"
          disabled={!workspaceName.trim() || checkingMembership}
          loading={busy === 'create'}
          onPress={() => void handleCreateWorkspace()}
        >
          Create workspace
        </AppButton>
        {createError && <InlineError message={createError} />}
        {createMessage && <AppText tone="warning">{createMessage}</AppText>}
      </AppCard>

      <View style={{ gap: themeTokens.spacing.sm }}>
        <AppText variant="heading">Your join requests</AppText>
        {loadingRequests ? (
          <LoadingState label="Loading join requests" />
        ) : requestsError ? (
          <InlineError
            message={requestsError}
            onRetry={() => void loadJoinRequests()}
            retryLabel="Retry loading requests"
          />
        ) : joinRequests.length > 0 ? (
          joinRequests.map((request) => (
            <AppCard key={request.id} padding="md">
              <AppText variant="label">{request.workspace?.name ?? 'Workspace'}</AppText>
              <AppText tone="secondary">{statusLabel(request.status)}</AppText>
            </AppCard>
          ))
        ) : (
          <AppText tone="secondary">You have no workspace join requests.</AppText>
        )}
      </View>

      {membershipMessage && <AppText tone="secondary">{membershipMessage}</AppText>}
      <AppButton
        accessibilityLabel="Refresh workspaces"
        disabled={busy !== null}
        loading={checkingMembership}
        onPress={() => void handleRefreshMembership()}
        variant="outline"
      >
        Refresh workspaces
      </AppButton>

      {accountError && <InlineError message={accountError} />}
      <AppButton accessibilityLabel="Sign out" onPress={() => void handleSignOut()} variant="ghost">
        Sign out
      </AppButton>
    </AppScreen>
  );
}
