import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { ApiError } from '../../api';
import { useAuth } from '../../auth/AuthProvider';
import { sessionService } from '../../auth/session';
import { renderWithProviders } from '../../test/render';
import { workspaceService } from '../../workspace/service';
import { WorkspaceSelectionScreen } from './WorkspaceSelectionScreen';
import { WorkspaceSetupScreen } from './WorkspaceSetupScreen';

jest.mock('../../auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('../../auth/session', () => ({
  sessionService: { restoreSession: jest.fn() },
}));
jest.mock('../../workspace/service', () => ({
  workspaceService: {
    getMyJoinRequests: jest.fn(),
    resolveCompanyCode: jest.fn(),
    requestToJoin: jest.fn(),
    createWorkspace: jest.fn(),
  },
}));

const alpha = {
  companyId: 'workspace-1',
  role: 'member',
  status: 'active',
  isVerified: true,
  company: { id: 'workspace-1', name: 'Alpha', companyCode: 'ALPHA-1234' },
};

const emptyAuth = {
  status: 'authenticated',
  user: { id: 'user-1', firstName: 'Ada', email: 'ada@example.test' },
  workspaces: [],
  activeWorkspace: null,
  selectedWorkspaceId: null,
  permissions: null,
  workspacePermissionStatus: 'idle',
  workspaceError: null,
  error: null,
  login: jest.fn(),
  logout: jest.fn(async () => undefined),
  restore: jest.fn(),
  selectWorkspace: jest.fn(async () => true),
  refreshWorkspaces: jest.fn(async () => true),
  clearError: jest.fn(),
  clearWorkspaceError: jest.fn(),
};

describe('P10 workspace screens', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useAuth).mockReturnValue(emptyAuth as never);
    jest.mocked(sessionService.restoreSession).mockResolvedValue('access-token');
    jest.mocked(workspaceService.getMyJoinRequests).mockResolvedValue({
      status: 'success',
      data: { requests: [] },
    });
    jest.mocked(workspaceService.resolveCompanyCode).mockResolvedValue({
      status: 'success',
      data: { workspace: { name: 'Acme', companyCode: 'ACME-1234' } },
    });
    jest.mocked(workspaceService.requestToJoin).mockResolvedValue({
      status: 'success',
      message: 'Your request to join Acme has been sent for approval.',
      data: { request: { id: 'request-1', status: 'pending' }, workspace: { name: 'Acme' } },
    });
    jest.mocked(workspaceService.createWorkspace).mockResolvedValue({
      status: 'success',
      message: 'Workspace created',
      data: { company: { id: 'workspace-new', name: 'New Team', companyCode: 'NEW-1234' } },
    });
    jest.mocked(router.push).mockClear();
    jest.mocked(router.replace).mockClear();
  });

  it('lists workspace memberships by their membership role and selects a workspace', async () => {
    jest.mocked(useAuth).mockReturnValue({
      ...emptyAuth,
      workspaces: [alpha],
    } as never);
    const selectWorkspace = jest.fn(async () => true);
    jest.mocked(useAuth).mockReturnValue({
      ...emptyAuth,
      workspaces: [alpha],
      selectWorkspace,
    } as never);

    await renderWithProviders(<WorkspaceSelectionScreen />);

    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText('Member')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Select Alpha, Member' }));
    expect(selectWorkspace).toHaveBeenCalledWith('workspace-1');
  });

  it('submits the verified code and reports join approval as pending', async () => {
    await renderWithProviders(<WorkspaceSetupScreen />);

    await fireEvent.changeText(screen.getByLabelText('Workspace code'), 'acme-1234');
    await fireEvent.press(screen.getByRole('button', { name: 'Find workspace' }));
    await screen.findByText(/Request to join Acme/);
    await fireEvent.press(screen.getByRole('button', { name: 'Request to join Acme' }));

    await waitFor(() =>
      expect(
        screen.getByText('Your request to join Acme has been sent for approval.'),
      ).toBeTruthy(),
    );
    expect(workspaceService.resolveCompanyCode).toHaveBeenCalledWith('access-token', 'ACME-1234');
    expect(workspaceService.requestToJoin).toHaveBeenCalledWith('access-token', 'ACME-1234');
    expect(workspaceService.getMyJoinRequests).toHaveBeenCalledTimes(2);
  });

  it('creates a workspace through the verified endpoint and confirms membership before opening it', async () => {
    await renderWithProviders(<WorkspaceSetupScreen />);

    await fireEvent.changeText(screen.getByLabelText('Workspace name'), 'New Team');
    await fireEvent.press(screen.getByRole('button', { name: 'Create workspace' }));

    await waitFor(() =>
      expect(workspaceService.createWorkspace).toHaveBeenCalledWith('access-token', 'New Team'),
    );
    expect(emptyAuth.refreshWorkspaces).toHaveBeenCalledWith('workspace-new');
    expect(router.replace).toHaveBeenCalledWith('/(tabs)');
  });

  it('shows rate-limit errors instead of reporting a join request succeeded', async () => {
    jest
      .mocked(workspaceService.resolveCompanyCode)
      .mockRejectedValue(new ApiError('Rate limited', 429));

    await renderWithProviders(<WorkspaceSetupScreen />);

    await fireEvent.changeText(screen.getByLabelText('Workspace code'), 'acme-1234');
    await fireEvent.press(screen.getByRole('button', { name: 'Find workspace' }));

    await waitFor(() =>
      expect(
        screen.getByText('Too many requests. Please wait a moment and try again.'),
      ).toBeTruthy(),
    );
    expect(screen.queryByText(/Request to join Acme has been sent/)).toBeNull();
    expect(workspaceService.requestToJoin).not.toHaveBeenCalled();
  });
});
