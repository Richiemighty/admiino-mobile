import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, cleanup, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import type { EffectiveWorkspacePermissions } from '../../api/types';
import { useAuth } from '../../auth/AuthProvider';
import { renderWithProviders } from '../../test/render';
import { InboxCountProvider, useInboxCount } from './InboxCountProvider';
import { inboxService } from './service';

const mockUseAuth = jest.mocked(useAuth);
const mockCountWorkspaceUnread = jest.mocked(inboxService.countWorkspaceUnread);

function setAuthenticated(workspaceId: string) {
  const activeWorkspace = {
    companyId: workspaceId,
    role: 'owner',
    status: 'active',
    isVerified: true,
    company: { id: workspaceId, name: workspaceId, companyCode: 'ADM-1000' },
  };
  const permissions: EffectiveWorkspacePermissions = {
    companyId: workspaceId,
    userId: 'user-1',
    role: 'owner',
    rolePermissions: {},
    individualOverrides: {},
    permissions: {},
  };
  mockUseAuth.mockReturnValue({
    status: 'authenticated',
    user: { id: 'user-1', email: 'user@example.test' },
    workspaces: [activeWorkspace],
    activeWorkspace,
    selectedWorkspaceId: workspaceId,
    permissions,
    workspacePermissionStatus: 'ready',
    workspaceError: null,
    error: null,
    restore: async () => undefined,
    login: async () => undefined,
    logout: async () => undefined,
    selectWorkspace: async () => true,
    refreshWorkspaces: async () => true,
    clearError: () => undefined,
    clearWorkspaceError: () => undefined,
  });
}

function CountLabel() {
  const { unreadCount } = useInboxCount();
  return <Text>{unreadCount === null ? 'Unavailable' : String(unreadCount)}</Text>;
}

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('../../auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('./service', () => ({
  inboxService: { countWorkspaceUnread: jest.fn() },
}));

describe('Inbox count provider', () => {
  afterEach(cleanup);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('clears the previous workspace badge until the new workspace count is confirmed', async () => {
    let resolveSecondCount: ((count: number | null) => void) | undefined;
    mockCountWorkspaceUnread.mockImplementation(async (workspaceId) => {
      if (workspaceId === 'workspace-2') {
        return await new Promise<number | null>((resolve) => {
          resolveSecondCount = resolve;
        });
      }
      return 4;
    });
    setAuthenticated('workspace-1');
    const screen = await renderWithProviders(
      <InboxCountProvider>
        <CountLabel />
      </InboxCountProvider>,
    );

    expect(await screen.findByText('4')).toBeTruthy();

    setAuthenticated('workspace-2');
    screen.rerender(
      <InboxCountProvider>
        <CountLabel />
      </InboxCountProvider>,
    );
    expect(await screen.findByText('Unavailable')).toBeTruthy();
    await waitFor(() => expect(resolveSecondCount).toBeDefined());

    await act(async () => resolveSecondCount?.(7));

    expect(await screen.findByText('7')).toBeTruthy();
    expect(screen.queryByText('4')).toBeNull();
  });
});
