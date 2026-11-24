import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Alert } from 'react-native';

import { ApiError, ApiNetworkError } from '../../api';
import { useAuth } from '../../auth/AuthProvider';
import { renderWithProviders } from '../../test/render';
import { TaskDetailsScreen } from './TaskDetailsScreen';
import { TaskFormScreen } from './TaskFormScreen';
import { TasksScreen } from './TasksScreen';
import { taskService } from './service';

jest.mock('../../auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('./service', () => ({
  ...jest.requireActual<typeof import('./service')>('./service'),
  taskService: {
    listTasks: jest.fn(),
    getTask: jest.fn(),
    getDependencies: jest.fn(),
    getTeamLead: jest.fn(),
    createTask: jest.fn(),
    updateTask: jest.fn(),
    getMembers: jest.fn(),
    getProjects: jest.fn(),
    getTeams: jest.fn(),
  },
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

const task = {
  id: 'task-1',
  companyId: 'workspace-1',
  title: 'Review launch plan',
  description: 'Check the final milestones.',
  status: 'pending' as const,
  priority: 'high' as const,
  deadline: '2026-12-01T00:00:00.000Z',
  projectId: 'project-1',
  teamId: null,
  project: { id: 'project-1', companyId: 'workspace-1', name: 'Launch project' },
  team: null,
  creator: { id: 'creator-1', firstName: 'Ada', lastName: 'Lovelace' },
  assignee: { id: 'user-1', firstName: 'Sam', lastName: 'Member' },
  assignees: [{ id: 'user-1', firstName: 'Sam', lastName: 'Member' }],
  subtasks: [{ id: 'subtask-1', title: 'Confirm dates', status: 'in_progress' }],
  attachments: [{ id: 'attachment-1', fileName: 'plan.pdf', fileType: 'application/pdf' }],
  activities: [
    {
      id: 'activity-1',
      actionType: 'status_changed',
      createdAt: '2026-11-20T12:00:00.000Z',
      actor: { id: 'creator-1', firstName: 'Ada', lastName: 'Lovelace' },
    },
  ],
};

const editableAccess = { canView: true, canEdit: true, readOnly: false };
const readOnlyAccess = { canView: true, canEdit: false, readOnly: true };
const emptyDependencies = {
  dependsOn: [],
  blocking: [],
  isBlocked: false,
  unresolvedDependencyCount: 0,
  dependsOnCount: 0,
  blockingCount: 0,
  hasCancelledDependency: false,
};

const authState = (
  activeWorkspace = alpha,
  options: { role?: string; permissions?: Record<string, boolean>; userId?: string } = {},
  logout = jest.fn(async () => undefined),
) =>
  ({
    status: 'authenticated',
    user: {
      id: options.userId ?? 'user-1',
      firstName: 'Sam',
      lastName: 'Member',
      email: 'sam@example.test',
      role: 'executive',
    },
    workspaces: [alpha, beta],
    activeWorkspace,
    selectedWorkspaceId: activeWorkspace.companyId,
    permissions: {
      companyId: activeWorkspace.companyId,
      userId: options.userId ?? 'user-1',
      role: options.role ?? activeWorkspace.role,
      rolePermissions: {},
      individualOverrides: {},
      permissions: options.permissions ?? {},
    },
    workspacePermissionStatus: 'ready',
    logout,
  }) as never;

const page = (workspaceId: string, title: string, total = 1) => ({
  workspaceId,
  total,
  page: 1,
  tasks: [{ ...task, id: `${workspaceId}-${title}`, companyId: workspaceId, title }],
});

describe('P12 task lists, detail, and forms', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useAuth).mockReturnValue(authState());
    jest.mocked(router.push).mockClear();
    jest.mocked(router.replace).mockClear();
    jest.mocked(router.back).mockClear();
    jest.mocked(taskService.listTasks).mockResolvedValue(page('workspace-1', 'My task'));
    jest.mocked(taskService.getTask).mockResolvedValue({ task, access: editableAccess });
    jest.mocked(taskService.getDependencies).mockResolvedValue(emptyDependencies);
    jest.mocked(taskService.getTeamLead).mockResolvedValue(null);
    jest.mocked(taskService.createTask).mockResolvedValue({
      ...task,
      id: 'task-created',
      title: 'New task',
    });
    jest.mocked(taskService.updateTask).mockImplementation(async (_id, _workspace, input) => ({
      ...task,
      ...input,
    }));
    jest.mocked(taskService.getMembers).mockResolvedValue([
      { userId: 'user-1', firstName: 'Sam', lastName: 'Member' },
      { userId: 'user-2', firstName: 'Taylor', lastName: 'Teammate' },
    ]);
    jest.mocked(taskService.getProjects).mockResolvedValue([
      { id: 'project-1', name: 'Launch project' },
    ]);
    jest.mocked(taskService.getTeams).mockResolvedValue([
      { id: 'team-1', name: 'Operations', memberIds: ['user-1', 'user-2'] },
    ]);
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  it('loads My Tasks and Created by Me from their server relations', async () => {
    jest.mocked(taskService.listTasks).mockImplementation(async (workspaceId, filters) =>
      page(workspaceId, filters.relation === 'created' ? 'Created task' : 'Assigned task'),
    );
    await renderWithProviders(<TasksScreen />);

    expect(await screen.findByText('Assigned task')).toBeTruthy();
    expect(taskService.listTasks).toHaveBeenCalledWith(
      'workspace-1',
      expect.objectContaining({ relation: 'assigned', page: 1 }),
      expect.any(AbortSignal),
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Created by Me' }));
    expect(await screen.findByText('Created task')).toBeTruthy();
    expect(taskService.listTasks).toHaveBeenLastCalledWith(
      'workspace-1',
      expect.objectContaining({ relation: 'created', page: 1 }),
      expect.any(AbortSignal),
    );
  });

  it('shows All Tasks only with effective permission and requests workspace scope', async () => {
    const view = await renderWithProviders(<TasksScreen />);
    expect(await screen.findByText('My task')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'All Tasks' })).toBeNull();

    jest.mocked(taskService.listTasks).mockImplementation(async (workspaceId, filters) =>
    page(workspaceId, filters.relation === 'all' ? 'All task' : 'Assigned task'),
    );
    jest.mocked(useAuth).mockReturnValue(
      authState(alpha, { permissions: { view_all_tasks: true } }),
    );
    view.rerender(<TasksScreen />);
    expect(await screen.findByRole('button', { name: 'All Tasks' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'All Tasks' }));
    expect(await screen.findByText('All task')).toBeTruthy();
    expect(taskService.listTasks).toHaveBeenLastCalledWith(
        'workspace-1',
        expect.objectContaining({ relation: 'all', canViewAllTasks: true }),
        expect.any(AbortSignal),
    );
  });

  it('sends search and filters to the backend and loads the next page', async () => {
    jest.mocked(taskService.listTasks).mockResolvedValue(page('workspace-1', 'Filtered task', 21));
    await renderWithProviders(<TasksScreen />);
    expect(await screen.findByText('Filtered task')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Search tasks'), 'launch');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
    await waitFor(
      () =>
        expect(taskService.listTasks).toHaveBeenLastCalledWith(
          'workspace-1',
          expect.objectContaining({ query: 'launch', page: 1 }),
          expect.any(AbortSignal),
        ),
      { timeout: 3000 },
    );
    await fireEvent.press(screen.getByRole('button', { name: 'In Progress' }));
    await waitFor(() =>
      expect(taskService.listTasks).toHaveBeenLastCalledWith(
        'workspace-1',
        expect.objectContaining({ status: 'in_progress', page: 1 }),
        expect.any(AbortSignal),
      ),
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Load more tasks' }));
    await waitFor(() =>
      expect(taskService.listTasks).toHaveBeenLastCalledWith(
        'workspace-1',
        expect.objectContaining({ status: 'in_progress', page: 2 }),
        expect.any(AbortSignal),
      ),
    );
    expect(screen.getByText(/Due-date filtering is not available/)).toBeTruthy();
  });

  it('clears the previous workspace task list and aborts its request on switching', async () => {
    const signals: AbortSignal[] = [];
    jest.mocked(taskService.listTasks).mockImplementation((workspaceId, _filters, signal) => {
      if (signal) signals.push(signal);
      return Promise.resolve(page(workspaceId, `${workspaceId} private task`));
    });
    const view = await renderWithProviders(<TasksScreen />);
    expect(await screen.findByText('workspace-1 private task')).toBeTruthy();

    jest.mocked(useAuth).mockReturnValue(authState(beta));
    view.rerender(<TasksScreen />);
    expect(await screen.findByText('workspace-2 private task')).toBeTruthy();
    expect(screen.queryByText('workspace-1 private task')).toBeNull();
    expect(signals[0]?.aborted).toBe(true);
  });

  it('opens Home-selected tasks at their detail route', async () => {
    jest.mocked(taskService.getTask).mockResolvedValue({ task, access: editableAccess });
    await renderWithProviders(<TaskDetailsScreen taskId={task.id} />);
    expect(await screen.findByText(task.title)).toBeTruthy();
    expect(screen.getByText('Launch project')).toBeTruthy();
    expect(screen.queryByText('Operations')).toBeNull();
    expect(screen.getByText('Confirm dates')).toBeTruthy();
    expect(screen.getByText('plan.pdf')).toBeTruthy();
    expect(screen.getByText(/Status Changed/)).toBeTruthy();
  });

  it('allows an assigned member to update status through task access and waits for confirmation', async () => {
    const updatedTask = { ...task, status: 'in_progress' as const };
    jest.mocked(taskService.updateTask).mockResolvedValue(updatedTask);
    await renderWithProviders(<TaskDetailsScreen taskId={task.id} />);

    expect(await screen.findByText(task.title)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Set status to In Progress' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit task' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Set status to In Progress' }));

    expect(await screen.findByText('Status updated to In Progress.')).toBeTruthy();
    expect(taskService.updateTask).toHaveBeenCalledWith(
      task.id,
      'workspace-1',
      { status: 'in_progress' },
      editableAccess,
    );
  });

  it('hides status and edit actions when task access is read-only', async () => {
    jest.mocked(taskService.getTask).mockResolvedValueOnce({ task, access: readOnlyAccess });
    await renderWithProviders(<TaskDetailsScreen taskId={task.id} />);
    expect(await screen.findByText(task.title)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Set status to In Progress' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit task' })).toBeNull();
  });

  it('does not offer review completion while a task is in review', async () => {
    const reviewTask = { ...task, status: 'in_review' as const };
    jest.mocked(taskService.getTask).mockResolvedValueOnce({
      task: reviewTask,
      access: editableAccess,
    });
    await renderWithProviders(<TaskDetailsScreen taskId={task.id} />);
    expect(await screen.findByText(/awaiting review/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Set status to Completed' })).toBeNull();
  });

  it('keeps the previous status after a server-rejected transition', async () => {
    jest
      .mocked(taskService.updateTask)
      .mockRejectedValueOnce(new ApiError('Invalid transition', 400));
    await renderWithProviders(<TaskDetailsScreen taskId={task.id} />);
    expect(await screen.findByText(task.title)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Set status to In Progress' }));

    expect(await screen.findByText(/server rejected this status change/)).toBeTruthy();
    expect(screen.getByText('Pending')).toBeTruthy();
    expect(taskService.updateTask).toHaveBeenCalledTimes(1);
  });

  it('shows network failures instead of substituting an empty task list', async () => {
    jest.mocked(taskService.listTasks).mockRejectedValueOnce(new ApiNetworkError());
    await renderWithProviders(<TasksScreen />);
    expect(await screen.findByText(/offline/)).toBeTruthy();
    expect(screen.queryByText('No tasks found')).toBeNull();
  });

  it('creates a task with eligible assignees and project context, then opens the confirmed task', async () => {
    const permissions = {
      create_tasks: true,
      assign_workspace_members: true,
      view_workspace_members: true,
    };
    jest.mocked(useAuth).mockReturnValue(authState(alpha, { role: 'manager', permissions }));
    await renderWithProviders(<TaskFormScreen mode="create" />);

    await fireEvent.changeText(screen.getByLabelText('Task title'), 'Prepare rollout');
    await fireEvent.changeText(screen.getByLabelText('Deadline'), '2026-12-31');
    await fireEvent.press(screen.getByRole('button', { name: 'Set priority to urgent' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Project' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Select Launch project' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Team' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Select Operations' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Assignees' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Select Taylor Teammate' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Finish selecting assignees' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save task' }));

    await waitFor(() =>
      expect(taskService.createTask).toHaveBeenCalledWith(
        'workspace-1',
        expect.objectContaining({
          title: 'Prepare rollout',
          priority: 'urgent',
          projectId: 'project-1',
          teamId: 'team-1',
          assigneeIds: ['user-2'],
        }),
        false,
      ),
    );
    expect(router.replace).toHaveBeenCalledWith('/tasks/task-created');
  });

  it('rejects invalid input and does not submit a second request while saving', async () => {
    const permissions = { create_tasks: true };
    jest.mocked(useAuth).mockReturnValue(authState(alpha, { role: 'manager', permissions }));
    await renderWithProviders(<TaskFormScreen mode="create" />);
    await fireEvent.changeText(screen.getByLabelText('Task title'), 'New task');
    await fireEvent.changeText(screen.getByLabelText('Deadline'), '2026-02-31');
    await fireEvent.press(screen.getByRole('button', { name: 'Save task' }));
    expect(await screen.findByText(/valid date/)).toBeTruthy();
    expect(taskService.createTask).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('Deadline'), '');
    let resolveCreate: ((value: typeof task) => void) | undefined;
    jest.mocked(taskService.createTask).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Save task' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save task' }));
    expect(taskService.createTask).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveCreate?.({ ...task, id: 'task-created', title: 'New task' });
    });
  });

  it('prefills edit fields and saves through the authorised task update endpoint', async () => {
    jest.mocked(useAuth).mockReturnValue(authState(alpha, { role: 'manager' }));
    await renderWithProviders(<TaskFormScreen mode="edit" taskId={task.id} />);
    expect(await screen.findByDisplayValue(task.title)).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Task title'), 'Updated title');
    await fireEvent.press(screen.getByRole('button', { name: 'Save task changes' }));

    await waitFor(() =>
      expect(taskService.updateTask).toHaveBeenCalledWith(
        task.id,
        'workspace-1',
        expect.objectContaining({ title: 'Updated title', priority: 'high' }),
        editableAccess,
      ),
    );
    expect(router.replace).toHaveBeenCalledWith(`/tasks/${task.id}`);
  });

  it('blocks member field editing even when broad task access allows status changes', async () => {
    jest.mocked(useAuth).mockReturnValue(authState(alpha, { role: 'member' }));
    await renderWithProviders(<TaskFormScreen mode="edit" taskId={task.id} />);
    expect(await screen.findByText(/cannot be edited with your current task access/)).toBeTruthy();
    expect(taskService.updateTask).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Task title')).toBeNull();
  });

  it('confirms discarding dirty edit values', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    jest.mocked(useAuth).mockReturnValue(authState(alpha, { role: 'manager' }));
    await renderWithProviders(<TaskFormScreen mode="edit" taskId={task.id} />);
    expect(await screen.findByDisplayValue(task.title)).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Task title'), 'Unsaved title');
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));

    const discard = alertSpy.mock.calls.at(-1)?.[2]?.find((button) => button.text === 'Discard');
    await act(async () => {
      discard?.onPress?.();
    });
    expect(router.back).toHaveBeenCalledTimes(1);
  });
});
