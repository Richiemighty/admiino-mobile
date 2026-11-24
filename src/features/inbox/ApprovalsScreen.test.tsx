import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, cleanup, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import type { EffectiveWorkspacePermissions } from '../../api/types';
import { useAuth } from '../../auth/AuthProvider';
import { renderWithProviders } from '../../test/render';
import { ApprovalsScreen } from './ApprovalsScreen';
import { workspaceApprovalsService } from './approvalsService';

const workspaceId = 'workspace-1';
const mockUseAuth = jest.mocked(useAuth);
const mockListJoinRequests = jest.mocked(workspaceApprovalsService.listJoinRequests);
const mockListVerifications = jest.mocked(workspaceApprovalsService.listPendingVerifications);
const mockListAccessRequests = jest.mocked(workspaceApprovalsService.listAccessRequests);
const mockDecideJoinRequest = jest.mocked(workspaceApprovalsService.decideJoinRequest);
const mockDecideVerification = jest.mocked(workspaceApprovalsService.decideMemberVerification);
const mockDecideAccessRequest = jest.mocked(workspaceApprovalsService.decideAccessRequest);
const mockRefreshWorkspaces = jest.fn<() => Promise<boolean>>().mockResolvedValue(true);
function setAuthenticated(role = 'owner', selectedWorkspaceId = workspaceId) {
  const activeWorkspace = {
    companyId: selectedWorkspaceId,
    role,
    status: 'active',
    isVerified: true,
    company: { id: selectedWorkspaceId, name: 'Admiino', companyCode: 'ADM-1000' },
  };
  const permissions: EffectiveWorkspacePermissions = {
    companyId: selectedWorkspaceId,
    userId: 'user-1',
    role,
    rolePermissions: {},
    individualOverrides: {},
    permissions: {},
  };
  mockUseAuth.mockReturnValue({
    status: 'authenticated',
    user: { id: 'user-1', email: 'user@example.test' },
    workspaces: [activeWorkspace],
    activeWorkspace,
    selectedWorkspaceId,
    permissions,
    workspacePermissionStatus: 'ready',
    workspaceError: null,
    error: null,
    restore: async () => undefined,
    login: async () => undefined,
    logout: async () => undefined,
    selectWorkspace: async () => true,
    refreshWorkspaces: mockRefreshWorkspaces,
    clearError: () => undefined,
    clearWorkspaceError: () => undefined,
  });
}

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react') as typeof import('react');
  return {
    router: {
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
      canGoBack: jest.fn(() => true),
    },
    useLocalSearchParams: jest.fn(() => ({})),
    useFocusEffect: (callback: () => void | (() => void)) => useEffect(callback, [callback]),
  };
});

jest.mock('../../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('./approvalsService', () => ({
  workspaceApprovalsService: {
    listJoinRequests: jest.fn(),
    getJoinRequest: jest.fn(),
    decideJoinRequest: jest.fn(),
    listPendingVerifications: jest.fn(),
    decideMemberVerification: jest.fn(),
    listAccessRequests: jest.fn(),
    decideAccessRequest: jest.fn(),
  },
}));

describe('Workspace approvals screen', () => {
  let alertSpy: jest.SpiedFunction<typeof Alert.alert>;

  afterEach(() => {
    cleanup();
    alertSpy.mockRestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthenticated();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockListJoinRequests.mockResolvedValue({
      requests: [
        {
          id: 'join-1',
          companyId: workspaceId,
          status: 'pending',
          createdAt: '2026-03-16T12:00:00.000Z',
          message: 'Please add me',
          requester: {
            id: 'user-2',
            firstName: 'Ada',
            lastName: 'Lovelace',
            email: 'ada@example.test',
          },
          workspace: { id: workspaceId, name: 'Admiino' },
          decidedAt: null,
        },
      ],
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });
    mockListVerifications.mockResolvedValue([
      {
        id: 'membership-1',
        companyId: workspaceId,
        userId: 'user-2',
        status: 'invited',
        isVerified: false,
        createdAt: '2026-03-16T12:00:00.000Z',
        user: {
          id: 'user-2',
          firstName: 'Ada',
          lastName: 'Lovelace',
          email: 'ada@example.test',
        },
      },
    ]);
    mockListAccessRequests.mockResolvedValue([
      {
        id: 'access-1',
        companyId: workspaceId,
        requesterUserId: 'user-2',
        permissionKey: 'view_all_tasks',
        reason: 'Need workspace visibility',
        status: 'pending',
        createdAt: '2026-03-16T12:00:00.000Z',
        requester: {
          id: 'user-2',
          firstName: 'Ada',
          lastName: 'Lovelace',
          email: 'ada@example.test',
        },
      },
    ]);
    mockDecideJoinRequest.mockResolvedValue({
      id: 'join-1',
      companyId: workspaceId,
      status: 'declined',
      createdAt: '2026-03-16T12:00:00.000Z',
      message: 'Please add me',
      requester: null,
      workspace: { id: workspaceId, name: 'Admiino' },
      decidedAt: '2026-03-16T13:00:00.000Z',
    });
    mockDecideVerification.mockResolvedValue(undefined);
    mockDecideAccessRequest.mockResolvedValue(undefined);
  });

  it('does not expose approval queues to unauthorised workspace members', async () => {
    setAuthenticated('employee');
    const screen = await renderWithProviders(<ApprovalsScreen />);

    expect(
      await screen.findByText('You are not authorised to review workspace requests.'),
    ).toBeTruthy();
    expect(mockListJoinRequests).not.toHaveBeenCalled();
    expect(mockListVerifications).not.toHaveBeenCalled();
    expect(mockListAccessRequests).not.toHaveBeenCalled();
  });

  it('limits managers to permission requests and prevents duplicate confirmed decisions', async () => {
    setAuthenticated('manager');
    const screen = await renderWithProviders(<ApprovalsScreen />);

    expect(await screen.findByLabelText('Review view all tasks. Permission requests')).toBeTruthy();
    expect(mockListAccessRequests).toHaveBeenCalledWith(workspaceId, expect.any(AbortSignal));
    expect(mockListJoinRequests).not.toHaveBeenCalled();
    expect(mockListVerifications).not.toHaveBeenCalled();

    fireEvent.press(screen.getByLabelText('Review view all tasks. Permission requests'));
    fireEvent.press(await screen.findByLabelText('Approve request'));
    expect(alertSpy).toHaveBeenCalledWith(
      'Approve request?',
      expect.stringContaining('grants the requester'),
      expect.any(Array),
    );
    const buttons = alertSpy.mock.calls[0]?.[2] ?? [];
    const approve = buttons.find((button) => button.text === 'Approve');

    await act(async () => {
      approve?.onPress?.();
      approve?.onPress?.();
    });
    await waitFor(() => expect(mockDecideAccessRequest).toHaveBeenCalledTimes(1));
    expect(mockDecideAccessRequest).toHaveBeenCalledWith(workspaceId, 'access-1', 'approve');
    expect(mockRefreshWorkspaces).toHaveBeenCalled();
    await waitFor(() => expect(mockListAccessRequests).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByLabelText('Approve request')).toBeNull());
  });
});
