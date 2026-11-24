import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Alert } from 'react-native';

import { ApiError, ApiNetworkError } from '../../api';
import { useAuth } from '../../auth/AuthProvider';
import { triggerFocusEffectsForTest } from '../../test/mocks/expo-router';
import { renderWithProviders } from '../../test/render';
import { GlobalSearchScreen } from './GlobalSearchScreen';
import { HomeScreen } from './HomeScreen';
import { MoreScreen } from './MoreScreen';
import { globalSearchService, homeService } from './service';

jest.mock('../../auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('./service', () => ({
  homeService: { getDashboardData: jest.fn() },
  globalSearchService: { search: jest.fn() },
}));

const alpha = {
  companyId: 'workspace-1',
  role: 'member',
  status: 'active',
  isVerified: true,
  company: { id: 'workspace-1', name: 'Alpha Workspace', companyCode: 'ALPHA-1' },
};

const beta = {
  companyId: 'workspace-2',
  role: 'manager',
  status: 'active',
  isVerified: true,
  company: { id: 'workspace-2', name: 'Beta Workspace', companyCode: 'BETA-2' },
};

const authState = (
  activeWorkspace = alpha,
  logout = jest.fn(async () => undefined),
  permissionOverrides: Record<string, boolean> = {},
) =>
  ({
    status: 'authenticated',
    user: {
      id: 'user-1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.test',
      role: 'executive',
    },
    workspaces: [alpha, beta],
    activeWorkspace,
    selectedWorkspaceId: activeWorkspace.companyId,
    permissions: {
      companyId: activeWorkspace.companyId,
      userId: 'user-1',
      role: activeWorkspace.role,
      rolePermissions: {},
      individualOverrides: {},
      permissions: permissionOverrides,
    },
    workspacePermissionStatus: 'ready',
    logout,
  }) as never;

const dashboardFor = (workspaceId: string, title: string) => ({
  workspaceId,
  summary: {
    relation: 'assigned' as const,
    totalTasks: 4,
    pendingTasks: 2,
    inProgressTasks: 1,
    inReviewTasks: 0,
    delayedTasks: 0,
    completedTasks: 1,
    cancelledTasks: 0,
    openTasks: 3,
    overdueTasks: 1,
    urgentTasks: 1,
    completionRate: 25,
  },
  tasks: [
    {
      id: `${workspaceId}-task-1`,
      title,
      status: 'in_progress',
      priority: 'high',
      deadline: new Date().toISOString().slice(0, 10),
    },
  ],
});

describe('P11 Home, Global Search, and More screens', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    jest.mocked(useAuth).mockReturnValue(authState());
    jest.mocked(router.push).mockClear();
    jest.mocked(router.replace).mockClear();
    jest
      .mocked(homeService.getDashboardData)
      .mockResolvedValue(dashboardFor('workspace-1', 'Prepare quarterly plan'));
    jest.mocked(globalSearchService.search).mockResolvedValue({
      tasks: [{ id: 'task-1', title: 'Quarterly plan', subtitle: 'in_progress' }],
      projects: [{ id: 'project-1', title: 'Quarterly project', subtitle: 'Project' }],
      people: [{ id: 'person-1', title: 'Ada Member', subtitle: 'Workspace member' }],
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads personal metrics and authorized tasks for the active workspace', async () => {
    await renderWithProviders(<HomeScreen />);

    expect(await screen.findByText('Hello, Ada')).toBeTruthy();
    expect(screen.getAllByText('Alpha Workspace').length).toBeGreaterThan(0);
    expect(screen.getByText('Needs attention')).toBeTruthy();
    expect(screen.getByText('Due soon')).toBeTruthy();
    expect(await screen.findAllByText('Prepare quarterly plan')).not.toHaveLength(0);
    expect(await screen.findAllByText('Today')).not.toHaveLength(0);
    expect(homeService.getDashboardData).toHaveBeenCalledWith(
      'workspace-1',
      expect.any(AbortSignal),
    );
  });

  it('opens Home task rows at task details and reloads the summary on refocus', async () => {
    jest
      .mocked(homeService.getDashboardData)
      .mockResolvedValueOnce(dashboardFor('workspace-1', 'Prepare quarterly plan'))
      .mockResolvedValueOnce(dashboardFor('workspace-1', 'Recently updated task'));
    await renderWithProviders(<HomeScreen />);
    expect(await screen.findAllByText('Prepare quarterly plan')).not.toHaveLength(0);

    await fireEvent.press(
      screen.getAllByRole('button', { name: 'Open task Prepare quarterly plan' })[0],
    );
    expect(router.push).toHaveBeenCalledWith('/tasks/workspace-1-task-1');

    await act(async () => {
      triggerFocusEffectsForTest();
    });
    expect(await screen.findAllByText('Recently updated task')).not.toHaveLength(0);
    expect(homeService.getDashboardData).toHaveBeenCalledTimes(2);
  });

  it('opens the profile drawer and navigates to Tasks', async () => {
    await renderWithProviders(<HomeScreen />);
    expect(await screen.findByText('Hello, Ada')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Open profile and navigation menu' }));
    expect(screen.getByText('ada@example.test')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Navigate to Tasks' }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/(tabs)/tasks'));
  });

  it('opens My Profile and Settings from the navigation drawer', async () => {
    await renderWithProviders(<HomeScreen />);
    expect(await screen.findByText('Hello, Ada')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Open profile and navigation menu' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Open My Profile' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/profile'));

    await fireEvent.press(screen.getByRole('button', { name: 'Open profile and navigation menu' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Open Settings' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/settings'));
  });

  it('opens the quick workspace switcher from the profile drawer', async () => {
    jest.mocked(useAuth).mockReturnValue(authState(alpha));
    const view = await renderWithProviders(<HomeScreen />);
    expect(await screen.findByText('Hello, Ada')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Open profile and navigation menu' }));
    await fireEvent.press(
      screen.getByRole('button', { name: /Switch workspace, current workspace Alpha Workspace/ }),
    );
    await waitFor(() => expect(screen.getByText('Switch workspace')).toBeTruthy());
    view.unmount();
  });

  it('opens My Profile and Settings from More', async () => {
    await renderWithProviders(<MoreScreen />);

    await fireEvent.press(screen.getAllByRole('button', { name: 'Open My Profile' }).at(-1)!);
    expect(router.push).toHaveBeenCalledWith('/profile');
    await fireEvent.press(screen.getByRole('button', { name: 'Open Settings' }));
    expect(router.push).toHaveBeenCalledWith('/settings');
  });

  it('shows only permitted Home quick-access actions and routes them correctly', async () => {
    jest.mocked(useAuth).mockReturnValue(
      authState(
        alpha,
        jest.fn(async () => undefined),
        { create_tasks: true },
      ),
    );
    await renderWithProviders(<HomeScreen />);
    expect(await screen.findByText('Quick access')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Open Create Task' }));
    expect(router.push).toHaveBeenCalledWith('/task-create');
    await fireEvent.press(screen.getByRole('button', { name: 'Open Projects' }));
    expect(router.push).toHaveBeenCalledWith('/(tabs)/projects');
  });

  it('removes previous-workspace dashboard data before rendering the new selection', async () => {
    let resolveBeta: ((value: ReturnType<typeof dashboardFor>) => void) | undefined;
    jest.mocked(homeService.getDashboardData).mockImplementation((workspaceId) => {
      if (workspaceId === 'workspace-1') {
        return Promise.resolve(dashboardFor(workspaceId, 'Alpha private task'));
      }
      return new Promise((resolve) => {
        resolveBeta = resolve;
      });
    });
    const view = await renderWithProviders(<HomeScreen />);
    expect(await screen.findAllByText('Alpha private task')).not.toHaveLength(0);

    jest.mocked(useAuth).mockReturnValue(authState(beta));
    view.rerender(<HomeScreen />);

    await waitFor(() =>
      expect(homeService.getDashboardData).toHaveBeenCalledWith(
        'workspace-2',
        expect.any(AbortSignal),
      ),
    );
    expect(screen.queryByText('Alpha private task')).toBeNull();
    resolveBeta?.(dashboardFor('workspace-2', 'Beta private task'));
    expect(await screen.findAllByText('Beta private task')).not.toHaveLength(0);
  });

  it('shows offline errors and allows a retry', async () => {
    jest
      .mocked(homeService.getDashboardData)
      .mockRejectedValueOnce(new ApiNetworkError())
      .mockResolvedValueOnce(dashboardFor('workspace-1', 'Recovered task'));
    await renderWithProviders(<HomeScreen />);

    expect(await screen.findByText(/You appear to be offline/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Retry loading your work' }));
    expect(await screen.findAllByText('Recovered task')).not.toHaveLength(0);
    expect(homeService.getDashboardData).toHaveBeenCalledTimes(2);
  });

  it('refreshes Home data with pull-to-refresh', async () => {
    await renderWithProviders(<HomeScreen />);
    expect(await screen.findAllByText('Prepare quarterly plan')).not.toHaveLength(0);
    const refreshControl = screen.getByTestId('home-scroll-view').props.refreshControl;

    await act(async () => {
      refreshControl.props.onRefresh();
    });

    await waitFor(() => expect(homeService.getDashboardData).toHaveBeenCalledTimes(2));
  });

  it('debounces global search, groups results, filters locally, and stores only recent terms', async () => {
    await renderWithProviders(<GlobalSearchScreen />);
    expect(globalSearchService.search).not.toHaveBeenCalled();

    const searchInput = screen.getByLabelText('Search tasks, projects, and people');
    await fireEvent.changeText(searchInput, 'quarter');
    await fireEvent.changeText(searchInput, 'quarterly plan');

    expect(await screen.findByText('Quarterly plan')).toBeTruthy();
    expect(screen.getByText('Quarterly project')).toBeTruthy();
    expect(screen.getByText('Ada Member')).toBeTruthy();
    expect(globalSearchService.search).toHaveBeenCalledWith(
      'quarterly plan',
      'workspace-1',
      expect.any(AbortSignal),
    );
    expect(globalSearchService.search).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByRole('button', { name: 'Filter search by Tasks' }));
    expect(screen.getByText('Quarterly plan')).toBeTruthy();
    expect(screen.queryByText('Quarterly project')).toBeNull();
    expect(screen.queryByText('Ada Member')).toBeNull();

    await waitFor(async () => {
      const stored = await AsyncStorage.getItem('admiino.mobile.search-recent.workspace-1');
      expect(JSON.parse(stored ?? 'null')).toEqual(['quarterly plan']);
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Clear search' }));
    expect(await screen.findByText('Recent searches')).toBeTruthy();
    expect(screen.getByText('quarterly plan')).toBeTruthy();
  });

  it('shows a clear no-results state after a successful empty search', async () => {
    jest.mocked(globalSearchService.search).mockResolvedValueOnce({
      tasks: [],
      projects: [],
      people: [],
    });
    await renderWithProviders(<GlobalSearchScreen />);
    await fireEvent.changeText(
      screen.getByLabelText('Search tasks, projects, and people'),
      'nothing matches',
    );

    expect(await screen.findByText('No matching results in this workspace.')).toBeTruthy();
  });

  it('surfaces search rate limits and retries without inventing results', async () => {
    jest
      .mocked(globalSearchService.search)
      .mockRejectedValueOnce(new ApiError('Rate limited', 429))
      .mockResolvedValueOnce({ tasks: [], projects: [], people: [] });
    await renderWithProviders(<GlobalSearchScreen />);
    await fireEvent.changeText(
      screen.getByLabelText('Search tasks, projects, and people'),
      'rate limited query',
    );

    expect(
      await screen.findByText('Too many searches. Wait a moment, then try again.'),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Retry search' }));
    expect(
      await screen.findByText('No matching results in this workspace.', {}, { timeout: 3000 }),
    ).toBeTruthy();
    expect(globalSearchService.search).toHaveBeenCalledTimes(2);
  });

  it('cancels outdated searches and never renders previous-workspace results', async () => {
    let resolveAlpha:
      | ((value: {
          tasks: { id: string; title: string; subtitle: string }[];
          projects: { id: string; title: string; subtitle: string }[];
          people: { id: string; title: string; subtitle: string }[];
        }) => void)
      | undefined;
    jest.mocked(globalSearchService.search).mockImplementation((_, workspaceId) => {
      if (workspaceId === 'workspace-1') {
        return new Promise((resolve) => {
          resolveAlpha = resolve;
        });
      }
      return Promise.resolve({
        tasks: [{ id: 'beta-task', title: 'Beta-only task', subtitle: 'pending' }],
        projects: [],
        people: [],
      });
    });

    const view = await renderWithProviders(<GlobalSearchScreen />);
    await fireEvent.changeText(
      screen.getByLabelText('Search tasks, projects, and people'),
      'workspace task',
    );
    await waitFor(() => expect(globalSearchService.search).toHaveBeenCalledTimes(1));
    const oldSignal = jest.mocked(globalSearchService.search).mock.calls[0]?.[2];

    jest.mocked(useAuth).mockReturnValue(authState(beta));
    view.rerender(<GlobalSearchScreen />);

    expect(await screen.findByText('Beta-only task', {}, { timeout: 3000 })).toBeTruthy();
    expect(oldSignal?.aborted).toBe(true);
    resolveAlpha?.({
      tasks: [{ id: 'alpha-task', title: 'Alpha-only task', subtitle: 'pending' }],
      projects: [],
      people: [],
    });
    expect(screen.queryByText('Alpha-only task')).toBeNull();
  });

  it('shows effective workspace membership in More and confirms sign-out', async () => {
    const logout = jest.fn(async () => undefined);
    jest.mocked(useAuth).mockReturnValue(authState(alpha, logout));
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await renderWithProviders(<MoreScreen />);

    expect(screen.getByText('Ada Lovelace')).toBeTruthy();
    expect(screen.getByText('ada@example.test')).toBeTruthy();
    expect(screen.getByText('Member')).toBeTruthy();
    expect(screen.queryByText('Executive')).toBeNull();
    expect(screen.getAllByText('Alpha Workspace').length).toBeGreaterThan(0);

    await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
    expect(logout).not.toHaveBeenCalled();
    const confirmation = alertSpy.mock.calls[0]?.[2]?.find((button) => button.text === 'Sign out');
    await act(async () => {
      confirmation?.onPress?.();
    });
    expect(logout).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/sign-in'));
  });

  it('keeps workspace switching available from More', async () => {
    jest
      .mocked(useAuth)
      .mockReturnValue(Object.assign(authState(), { clearWorkspaceError: jest.fn() }) as never);
    await renderWithProviders(<MoreScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Switch workspace' }));
    expect(screen.getByTestId('quick-workspace-switcher')).toBeTruthy();
  });
});
