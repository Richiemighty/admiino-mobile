import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { ApiError } from '../api';
import type {
  EffectiveWorkspacePermissionsResponse,
  MeResponse,
  MobileWorkspace,
  WorkspacesResponse,
} from '../api/types';
import { AppButton, AppText } from '../components/ui';
import {
  clearConversationDrafts,
  conversationDraftKey,
  getConversationDraft,
  saveConversationDraft,
} from '../features/tasks/conversationDraft';
import { deleteTemporaryConversationFiles } from '../features/tasks/conversationDraftFiles';
import { renderWithProviders } from '../test/render';
import { workspaceService } from '../workspace/service';
import { AuthProvider, useAuth } from './AuthProvider';
import { sessionService } from './session';

jest.mock('./session', () => ({
  sessionService: {
    restoreSession: jest.fn(),
    getMe: jest.fn(),
    getAccessToken: jest.fn(),
    getWorkspaces: jest.fn(),
    getSelectedWorkspaceId: jest.fn(),
    setSelectedWorkspaceId: jest.fn(),
    clearSelectedWorkspaceId: jest.fn(),
    prepareLogin: jest.fn(),
    logout: jest.fn(),
  },
}));
jest.mock('../features/tasks/conversationDraftFiles', () => ({
  deleteTemporaryConversationFiles: jest.fn(),
}));

jest.mock('../workspace/service', () => ({
  workspaceService: { getEffectivePermissions: jest.fn() },
}));

const alpha: MobileWorkspace = {
  companyId: 'workspace-1',
  role: 'owner',
  status: 'active',
  isVerified: true,
  company: { id: 'workspace-1', name: 'Alpha', companyCode: 'ALPHA-1234' },
};
const beta: MobileWorkspace = {
  companyId: 'workspace-2',
  role: 'member',
  status: 'active',
  isVerified: true,
  company: { id: 'workspace-2', name: 'Beta', companyCode: 'BETA-1234' },
};

function workspacesResponse(workspaces: MobileWorkspace[]): WorkspacesResponse {
  return { status: 'success', data: { workspaces } };
}

function permissionsResponse(
  companyId: string,
  role = 'member',
): EffectiveWorkspacePermissionsResponse {
  return {
    status: 'success',
    data: {
      companyId,
      userId: 'user-1',
      role,
      rolePermissions: { create_tasks: role === 'owner' },
      individualOverrides: {},
      permissions: { create_tasks: role === 'owner' },
    },
  };
}

function Snapshot() {
  const {
    status,
    activeWorkspace,
    workspaces,
    permissions,
    workspacePermissionStatus,
    selectWorkspace,
    logout,
    login,
    refreshUser,
    applyUserProfileUpdate,
    user,
  } = useAuth();

  return (
    <>
      <AppText testID="auth-status">{status}</AppText>
      <AppText testID="auth-user-name">{user?.firstName ?? 'none'}</AppText>
      <AppText testID="active-workspace">{activeWorkspace?.company.name ?? 'none'}</AppText>
      <AppText testID="workspace-count">{workspaces.length}</AppText>
      <AppText testID="permission-status">{workspacePermissionStatus}</AppText>
      <AppText testID="effective-role">{permissions?.role ?? 'none'}</AppText>
      <AppText testID="create-tasks">
        {String(permissions?.permissions.create_tasks ?? 'none')}
      </AppText>
      <AppButton
        accessibilityLabel="Switch to Beta"
        onPress={() => void selectWorkspace(beta.companyId)}
      >
        Switch to Beta
      </AppButton>
      <AppButton accessibilityLabel="Sign out" onPress={() => void logout()}>
        Sign out
      </AppButton>
      <AppButton
        accessibilityLabel="Sign in in test"
        onPress={() => void login({ email: 'ada@example.test', password: 'test-password' })}
      >
        Sign in in test
      </AppButton>
      <AppButton accessibilityLabel="Refresh profile in test" onPress={() => void refreshUser()}>
        Refresh profile
      </AppButton>
      <AppButton
        accessibilityLabel="Apply profile update in test"
        onPress={() => applyUserProfileUpdate('user-1', { firstName: 'Augusta' })}
      >
        Apply profile update
      </AppButton>
    </>
  );
}

async function renderAuthProvider() {
  return renderWithProviders(
    <AuthProvider>
      <Snapshot />
    </AuthProvider>,
  );
}

describe('P10 authenticated workspace state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearConversationDrafts();
    jest.mocked(deleteTemporaryConversationFiles).mockClear();
    jest.mocked(sessionService.restoreSession).mockResolvedValue('access-token');
    jest.mocked(sessionService.getAccessToken).mockResolvedValue('access-token');
    jest.mocked(sessionService.getMe).mockResolvedValue({
      status: 'success',
      data: {
        user: { id: 'user-1', firstName: 'Ada', email: 'ada@example.test', role: 'executive' },
      },
    } satisfies MeResponse);
    jest.mocked(sessionService.getWorkspaces).mockResolvedValue(workspacesResponse([alpha, beta]));
    jest.mocked(sessionService.getSelectedWorkspaceId).mockResolvedValue(alpha.companyId);
    jest.mocked(sessionService.prepareLogin).mockResolvedValue({
      status: 'success',
      message: 'Welcome',
      token: 'access-token',
      data: { user: { id: 'user-1', firstName: 'Ada', email: 'ada@example.test' } },
    });
    jest.mocked(sessionService.setSelectedWorkspaceId).mockResolvedValue();
    jest.mocked(sessionService.clearSelectedWorkspaceId).mockResolvedValue();
    jest.mocked(sessionService.logout).mockResolvedValue();
    jest
      .mocked(workspaceService.getEffectivePermissions)
      .mockImplementation(async (_token, workspaceId) =>
        permissionsResponse(workspaceId, workspaceId === alpha.companyId ? 'owner' : 'member'),
      );
  });

  it('restores the eligible selected workspace and uses its effective membership permissions', async () => {
    await renderAuthProvider();

    await waitFor(() =>
      expect(screen.getByTestId('active-workspace').props.children).toBe('Alpha'),
    );
    expect(screen.getByTestId('permission-status').props.children).toBe('ready');
    expect(screen.getByTestId('effective-role').props.children).toBe('owner');
    expect(screen.getByTestId('create-tasks').props.children).toBe('true');
    expect(workspaceService.getEffectivePermissions).toHaveBeenCalledWith(
      'access-token',
      alpha.companyId,
    );
  });

  it('clears a stale workspace selection and asks the user to choose again', async () => {
    jest.mocked(sessionService.getWorkspaces).mockResolvedValue(workspacesResponse([alpha]));
    jest.mocked(sessionService.getSelectedWorkspaceId).mockResolvedValue('removed-workspace');

    await renderAuthProvider();

    await waitFor(() =>
      expect(screen.getByTestId('auth-status').props.children).toBe('authenticated'),
    );
    expect(sessionService.clearSelectedWorkspaceId).toHaveBeenCalled();
    expect(screen.getByTestId('active-workspace').props.children).toBe('none');
    expect(screen.getByTestId('permission-status').props.children).toBe('idle');
    expect(workspaceService.getEffectivePermissions).not.toHaveBeenCalled();
  });

  it('clears previous workspace permissions before loading a new selection', async () => {
    let finishSwitch: ((value: EffectiveWorkspacePermissionsResponse) => void) | undefined;
    jest
      .mocked(workspaceService.getEffectivePermissions)
      .mockImplementation(async (_token, workspaceId) => {
        if (workspaceId === beta.companyId) {
          return await new Promise((resolve) => {
            finishSwitch = resolve;
          });
        }
        return permissionsResponse(workspaceId, 'owner');
      });

    await renderAuthProvider();
    await waitFor(() =>
      expect(screen.getByTestId('active-workspace').props.children).toBe('Alpha'),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Switch to Beta' }));

    await waitFor(() => expect(screen.getByTestId('active-workspace').props.children).toBe('none'));
    expect(screen.getByTestId('create-tasks').props.children).toBe('none');
    expect(sessionService.setSelectedWorkspaceId).toHaveBeenLastCalledWith(beta.companyId);
    expect(workspaceService.getEffectivePermissions).toHaveBeenLastCalledWith(
      'access-token',
      beta.companyId,
    );

    await act(async () => {
      finishSwitch?.(permissionsResponse(beta.companyId, 'member'));
    });
    await waitFor(() => expect(screen.getByTestId('active-workspace').props.children).toBe('Beta'));
    expect(screen.getByTestId('effective-role').props.children).toBe('member');
    expect(screen.getByTestId('create-tasks').props.children).toBe('false');
  });

  it('keeps suspended workspaces restricted without exposing permissions', async () => {
    jest
      .mocked(workspaceService.getEffectivePermissions)
      .mockRejectedValue(new ApiError('Suspended', 423));

    await renderAuthProvider();

    await waitFor(() =>
      expect(screen.getByTestId('permission-status').props.children).toBe('suspended'),
    );
    expect(screen.getByTestId('active-workspace').props.children).toBe('Alpha');
    expect(screen.getByTestId('create-tasks').props.children).toBe('none');
  });

  it('drops a workspace after access is denied and refreshes the eligible membership list', async () => {
    jest
      .mocked(sessionService.getWorkspaces)
      .mockResolvedValueOnce(workspacesResponse([alpha, beta]))
      .mockResolvedValueOnce(workspacesResponse([beta]));
    jest
      .mocked(workspaceService.getEffectivePermissions)
      .mockRejectedValue(new ApiError('Forbidden', 403));

    await renderAuthProvider();

    await waitFor(() =>
      expect(screen.getByTestId('permission-status').props.children).toBe('access-denied'),
    );
    expect(screen.getByTestId('active-workspace').props.children).toBe('none');
    expect(screen.getByTestId('workspace-count').props.children).toBe(1);
    expect(sessionService.clearSelectedWorkspaceId).toHaveBeenCalled();
  });

  it('clears the session and selected workspace on sign out', async () => {
    await renderAuthProvider();
    await waitFor(() =>
      expect(screen.getByTestId('active-workspace').props.children).toBe('Alpha'),
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() =>
      expect(screen.getByTestId('auth-status').props.children).toBe('signed-out'),
    );
    expect(screen.getByTestId('active-workspace').props.children).toBe('none');
    expect(screen.getByTestId('workspace-count').props.children).toBe(0);
    expect(screen.getByTestId('permission-status').props.children).toBe('idle');
    expect(sessionService.logout).toHaveBeenCalled();
  });

  it('refreshes the current user without changing the workspace or session', async () => {
    await renderAuthProvider();
    await waitFor(() =>
      expect(screen.getByTestId('active-workspace').props.children).toBe('Alpha'),
    );
    jest.mocked(sessionService.getMe).mockResolvedValueOnce({
      status: 'success',
      data: {
        user: { id: 'user-1', firstName: 'Augusta', email: 'ada@example.test' },
      },
    } satisfies MeResponse);

    await fireEvent.press(screen.getByRole('button', { name: 'Refresh profile in test' }));

    await waitFor(() =>
      expect(screen.getByTestId('auth-user-name').props.children).toBe('Augusta'),
    );
    expect(screen.getByTestId('active-workspace').props.children).toBe('Alpha');
    expect(sessionService.getMe).toHaveBeenLastCalledWith('access-token', undefined);
  });

  it('applies confirmed profile fields and clears private conversation drafts on sign out', async () => {
    const key = conversationDraftKey('user-1', alpha.companyId, 'task-1');
    const draft = {
      content: 'Private draft',
      parentCommentId: null,
      mentionedUserIds: [],
      mentionLabels: {},
      files: [
        {
          uri: 'file:///private-draft.jpg',
          name: 'private-draft.jpg',
          mimeType: 'image/jpeg',
          size: 12,
        },
      ],
      clientMessageId: null,
      attemptedContent: null,
      attemptedParentCommentId: null,
    };
    saveConversationDraft(key, draft);
    await renderAuthProvider();
    await waitFor(() =>
      expect(screen.getByTestId('active-workspace').props.children).toBe('Alpha'),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Apply profile update in test' }));
    expect(screen.getByTestId('auth-user-name').props.children).toBe('Augusta');

    await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() =>
      expect(screen.getByTestId('auth-status').props.children).toBe('signed-out'),
    );
    expect(getConversationDraft(key)).toBeNull();
    expect(deleteTemporaryConversationFiles).toHaveBeenCalledWith(draft.files);
  });

  it('preserves login and resolves the selected workspace before exposing the app', async () => {
    jest.mocked(sessionService.restoreSession).mockResolvedValueOnce(null);
    await renderAuthProvider();
    await waitFor(() =>
      expect(screen.getByTestId('auth-status').props.children).toBe('signed-out'),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in in test' }));

    await waitFor(() =>
      expect(screen.getByTestId('permission-status').props.children).toBe('ready'),
    );
    expect(screen.getByTestId('auth-status').props.children).toBe('authenticated');
    expect(sessionService.prepareLogin).toHaveBeenCalledWith({
      email: 'ada@example.test',
      password: 'test-password',
    });
    expect(screen.getByTestId('active-workspace').props.children).toBe('Alpha');
  });
});
