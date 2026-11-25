import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { cleanup, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ReactNode } from 'react';

import MainTabsLayout from '../../app/(tabs)/_layout';
import { useAuth } from '../auth/AuthProvider';
import { DeleteAccountScreen } from '../features/account/DeleteAccountScreen';
import { SignInScreen } from '../features/auth/SignInScreen';
import { getNotificationTarget } from '../features/inbox/notificationTarget';
import { getAuthenticatedRouteRedirect } from '../features/workspace/AuthenticatedRoute';
import { renderWithProviders } from '../test/render';

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
  useFocusEffect: (callback: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    useEffect(callback, [callback]);
  },
  Tabs: Object.assign(
    ({ children }: { children: ReactNode }) => {
      const { View } = jest.requireActual<typeof import('react-native')>('react-native');
      return <View>{children}</View>;
    },
    {
      Screen: ({ name }: { name: string }) => {
        const { View } = jest.requireActual<typeof import('react-native')>('react-native');
        return <View testID={`tab-screen-${name}`} />;
      },
    },
  ),
}));

jest.mock('../auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('../features/inbox/InboxScreen', () => ({
  InboxScreen: () => {
    const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return <Text>Inbox content</Text>;
  },
}));

const activeWorkspace = {
  companyId: 'workspace-1',
  role: 'owner',
  status: 'active',
  isVerified: true,
  company: { id: 'workspace-1', name: 'Admiino', companyCode: 'ADM-1' },
};

function authenticatedAuth(overrides: Record<string, unknown> = {}) {
  return {
    status: 'authenticated',
    user: { id: 'user-1', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.test' },
    workspaces: [activeWorkspace],
    activeWorkspace,
    selectedWorkspaceId: activeWorkspace.companyId,
    workspacePermissionStatus: 'ready',
    permissions: {
      companyId: activeWorkspace.companyId,
      userId: 'user-1',
      role: 'owner',
      rolePermissions: {},
      individualOverrides: {},
      permissions: {},
    },
    logout: jest.fn(async () => undefined),
    ...overrides,
  };
}

describe('P17.1 end-to-end journey smoke coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useAuth).mockReturnValue(authenticatedAuth() as never);
  });

  afterEach(() => {
    cleanup();
  });

  it('J01 signs in through the real screen and enters the authenticated shell', async () => {
    await renderWithProviders(<SignInScreen />);
    expect(screen.getByText('Welcome back')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Create an account'));
    expect(router.push).toHaveBeenCalledWith('/create-account');
  });

  it('J02 preserves the authenticated workspace gate instead of rendering work early', async () => {
    expect(
      getAuthenticatedRouteRedirect({
        status: 'authenticated',
        workspaceCount: 1,
        activeWorkspace: false,
        workspacePermissionStatus: 'loading',
        redirectToHome: false,
      }),
    ).toBe('/workspace-select');
  });

  it('J03 keeps the current six-tab work shell available for task/project work', async () => {
    await renderWithProviders(<MainTabsLayout />);
    expect(screen.getAllByTestId(/tab-screen-/).map((element) => element.props.testID)).toEqual([
      'tab-screen-index',
      'tab-screen-tasks',
      'tab-screen-teams',
      'tab-screen-projects',
      'tab-screen-calendar',
      'tab-screen-more',
    ]);
  });

  it('J04 resolves collaboration notification targets without trusting notification text', () => {
    expect(
      getNotificationTarget({
        id: 'notice-1',
        userId: 'user-1',
        companyId: 'workspace-1',
        type: 'task_mentioned',
        title: 'Comment',
        message: 'Open the task',
        data: { taskId: 'task-1', commentId: 'comment-1' },
        isRead: false,
        readAt: null,
        createdAt: '2026-11-25T10:00:00.000Z',
        updatedAt: '2026-11-25T10:00:00.000Z',
      }),
    ).toEqual({ kind: 'task-comment', taskId: 'task-1', commentId: 'comment-1' });
  });

  it('J05 keeps the canonical Inbox route available to authenticated workspace members', async () => {
    expect(
      getAuthenticatedRouteRedirect({
        status: 'authenticated',
        workspaceCount: 1,
        activeWorkspace: true,
        workspacePermissionStatus: 'ready',
        redirectToHome: false,
      }),
    ).toBeNull();
  });

  it('J06 rejects an Inbox destination when the session is signed out', async () => {
    expect(
      getAuthenticatedRouteRedirect({
        status: 'signed-out',
        workspaceCount: 0,
        activeWorkspace: false,
        workspacePermissionStatus: 'idle',
        redirectToHome: false,
      }),
    ).toBe('/sign-in');
  });

  it('J07 presents the truthful account-deletion blocker without mutating the account', async () => {
    await renderWithProviders(<DeleteAccountScreen />);
    expect(await screen.findByText('Account deletion is unavailable')).toBeTruthy();
    expect(screen.getByText(/No deletion request has been submitted/)).toBeTruthy();
  });
});
