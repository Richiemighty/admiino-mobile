import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { cleanup, fireEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import type { EffectiveWorkspacePermissions } from '../../api/types';
import { useAuth } from '../../auth/AuthProvider';
import { renderWithProviders } from '../../test/render';
import { projectService } from '../projects/service';
import { taskService } from '../tasks/service';
import { workspaceApprovalsService } from './approvalsService';
import { InboxScreen } from './InboxScreen';
import { inboxService, type NotificationRecord } from './service';

const workspaceId = 'workspace-1';
const mockUseAuth = jest.mocked(useAuth);
const mockListNotifications = jest.mocked(inboxService.listNotifications);
const mockMarkRead = jest.mocked(inboxService.markNotificationRead);
const mockGetTask = jest.mocked(taskService.getTask);
const mockGetProject = jest.mocked(projectService.getProject);
const mockCountState = {
  unreadCount: 2 as number | null,
  countError: null as string | null,
  refreshUnreadCount: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
};

const notification: NotificationRecord = {
  id: 'notice-1',
  userId: 'user-1',
  companyId: workspaceId,
  type: 'task_assigned',
  title: 'Prepare launch report',
  message: 'A new task was assigned to you.',
  data: { taskId: 'task-1', action: 'view_task' },
  isRead: false,
  readAt: null,
  createdAt: '2026-03-16T12:00:00.000Z',
  updatedAt: '2026-03-16T12:00:00.000Z',
};

function setAuthenticated(role = 'owner', selectedWorkspaceId = workspaceId) {
  const activeWorkspace = {
    companyId: selectedWorkspaceId,
    role,
    status: 'active',
    isVerified: true,
    company: {
      id: selectedWorkspaceId,
      name: 'Admiino',
      companyCode: 'ADM-1000',
    },
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
    refreshWorkspaces: async () => true,
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
    useFocusEffect: (callback: () => void | (() => void)) => useEffect(callback, [callback]),
  };
});

jest.mock('../../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('./InboxCountProvider', () => ({
  InboxCountProvider: ({ children }: { children: React.ReactNode }) => children,
  useInboxCount: () => mockCountState,
}));

jest.mock('./service', () => ({
  NOTIFICATION_PAGE_SIZE: 20,
  inboxService: {
    listNotifications: jest.fn(),
    markNotificationRead: jest.fn(),
  },
}));

jest.mock('../tasks/service', () => ({
  taskService: { getTask: jest.fn() },
}));

jest.mock('../projects/service', () => ({
  projectService: { getProject: jest.fn() },
}));

jest.mock('./approvalsService', () => ({
  workspaceApprovalsService: {
    getJoinRequest: jest.fn(),
    listAccessRequests: jest.fn(),
  },
}));

describe('Inbox screen', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthenticated();
    mockCountState.unreadCount = 2;
    mockCountState.countError = null;
    mockListNotifications.mockResolvedValue({
      notifications: [notification],
      results: 1,
      hasMore: false,
    });
    mockMarkRead.mockResolvedValue({
      ...notification,
      isRead: true,
      readAt: '2026-03-16T12:05:00.000Z',
    });
    mockGetTask.mockResolvedValue({
      task: {
        id: 'task-1',
        companyId: workspaceId,
        title: 'Launch task',
        status: 'pending',
        priority: 'medium',
      },
      access: { canView: true, canEdit: false, readOnly: true },
    });
    mockGetProject.mockResolvedValue({
      id: 'project-1',
      companyId: workspaceId,
      name: 'Launch project',
      status: 'active',
      visibility: 'workspace',
    });
  });

  it('loads workspace notifications, shows unread count, and uses the server unread filter', async () => {
    const screen = await renderWithProviders(<InboxScreen />);

    expect(await screen.findByText('Prepare launch report')).toBeTruthy();
    expect(screen.getByText('Inbox · 2')).toBeTruthy();
    expect(mockListNotifications).toHaveBeenCalledWith(
      workspaceId,
      expect.objectContaining({ offset: 0, unreadOnly: false }),
    );

    fireEvent.press(screen.getByLabelText('Unread'));
    await waitFor(() =>
      expect(mockListNotifications).toHaveBeenLastCalledWith(
        workspaceId,
        expect.objectContaining({ offset: 0, unreadOnly: true }),
      ),
    );
  });

  it('marks a notification read only after backend confirmation', async () => {
    const screen = await renderWithProviders(<InboxScreen />);

    fireEvent.press(await screen.findByLabelText('Mark Prepare launch report as read'));
    await waitFor(() => expect(mockMarkRead).toHaveBeenCalledWith(workspaceId, notification));
    await waitFor(() =>
      expect(screen.queryByLabelText('Mark Prepare launch report as read')).toBeNull(),
    );
    expect(mockCountState.refreshUnreadCount).toHaveBeenCalled();
  });

  it('keeps an unread notification when marking it read fails', async () => {
    mockMarkRead.mockRejectedValueOnce(new Error('request failed'));
    const screen = await renderWithProviders(<InboxScreen />);

    fireEvent.press(await screen.findByLabelText('Mark Prepare launch report as read'));

    expect(
      await screen.findByText('This update could not be marked as read. Please try again.'),
    ).toBeTruthy();
    expect(screen.getByLabelText('Unread. Prepare launch report. Open update')).toBeTruthy();
    expect(screen.getByLabelText('Mark Prepare launch report as read')).toBeTruthy();
  });

  it('shows a real empty Inbox state', async () => {
    mockListNotifications.mockResolvedValue({
      notifications: [],
      results: 0,
      hasMore: false,
    });
    const screen = await renderWithProviders(<InboxScreen />);

    expect(await screen.findByText('Your Inbox is clear')).toBeTruthy();
  });

  it('loads subsequent pages with the backend offset', async () => {
    const firstPage = Array.from({ length: 2 }, (_, index) => ({
      ...notification,
      id: `notice-${index}`,
      title: `Task update ${index}`,
    }));
    mockListNotifications
      .mockResolvedValueOnce({ notifications: firstPage, results: firstPage.length, hasMore: true })
      .mockResolvedValueOnce({
        notifications: [{ ...notification, id: 'notice-20', title: 'Task update 20' }],
        results: 1,
        hasMore: false,
      });
    const screen = await renderWithProviders(<InboxScreen />);
    expect(await screen.findByText('Task update 0')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Load more notifications'));

    await waitFor(() =>
      expect(mockListNotifications).toHaveBeenLastCalledWith(
        workspaceId,
        expect.objectContaining({ offset: 20 }),
      ),
    );
    expect(await screen.findByText('Task update 20')).toBeTruthy();
  });

  it('preflights task destinations and returns through the existing task route', async () => {
    const screen = await renderWithProviders(<InboxScreen />);
    fireEvent.press(await screen.findByLabelText('Unread. Prepare launch report. Open update'));

    await waitFor(() =>
      expect(mockGetTask).toHaveBeenCalledWith('task-1', workspaceId, expect.any(AbortSignal)),
    );
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/tasks/[id]',
        params: { id: 'task-1', returnTo: 'inbox' },
      }),
    );
  });

  it('preflights project notifications and opens the existing project route', async () => {
    const projectNotification: NotificationRecord = {
      ...notification,
      id: 'notice-project',
      type: 'project_member_added',
      title: 'Launch project update',
      data: { projectId: 'project-1' },
    };
    mockListNotifications.mockResolvedValue({
      notifications: [projectNotification],
      results: 1,
      hasMore: false,
    });
    const screen = await renderWithProviders(<InboxScreen />);

    fireEvent.press(await screen.findByLabelText('Unread. Launch project update. Open update'));

    await waitFor(() =>
      expect(mockGetProject).toHaveBeenCalledWith(
        'project-1',
        workspaceId,
        expect.any(AbortSignal),
      ),
    );
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/projects/[id]',
        params: { id: 'project-1', returnTo: 'inbox' },
      }),
    );
  });

  it('keeps the user in Inbox when a notification target is deleted or inaccessible', async () => {
    mockGetTask.mockRejectedValueOnce(new Error('Task not found'));
    const screen = await renderWithProviders(<InboxScreen />);
    fireEvent.press(await screen.findByLabelText('Unread. Prepare launch report. Open update'));

    expect(
      await screen.findByText(
        'This update could not be opened. It may have been removed or access may have changed.',
      ),
    ).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
    expect(workspaceApprovalsService.getJoinRequest).not.toHaveBeenCalled();
  });

  it('clears prior-workspace notifications when the active workspace changes', async () => {
    mockListNotifications.mockImplementation(async (id) => ({
      notifications: [{ ...notification, companyId: id, title: `${id} update` }],
      results: 1,
      hasMore: false,
    }));
    const screen = await renderWithProviders(<InboxScreen />);
    expect(await screen.findByText('workspace-1 update')).toBeTruthy();

    setAuthenticated('owner', 'workspace-2');
    screen.rerender(<InboxScreen />);

    expect(await screen.findByText('workspace-2 update')).toBeTruthy();
    expect(screen.queryByText('workspace-1 update')).toBeNull();
  });

  it('does not expose the Requests category to ordinary members', async () => {
    setAuthenticated('member');
    const screen = await renderWithProviders(<InboxScreen />);
    expect(await screen.findByText('Prepare launch report')).toBeTruthy();
    expect(screen.queryByLabelText('Requests')).toBeNull();
  });
});
