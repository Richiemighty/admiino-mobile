import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { cleanup, fireEvent } from '@testing-library/react-native';

import { ApiError } from '../../api';
import type { EffectiveWorkspacePermissions } from '../../api/types';
import { useAuth } from '../../auth/AuthProvider';
import { renderWithProviders } from '../../test/render';
import { ProjectDetailsScreen } from './ProjectDetailsScreen';
import type { ProjectRecord, ProjectTask } from './service';
import { projectService } from './service';

const mockUseAuth = jest.mocked(useAuth);
const mockRouter = (
  jest.requireMock('expo-router') as {
    router: {
      push: jest.Mock;
      replace: jest.Mock;
      back: jest.Mock;
      canGoBack: jest.Mock;
    };
  }
).router;
const mockGetProject = jest.mocked(projectService.getProject);
const mockListProjectTasks = jest.mocked(projectService.listProjectTasks);
const mockGetProjectMembers = jest.mocked(projectService.getProjectMembers);

const workspaceId = 'workspace-1';
const project: ProjectRecord = {
  id: 'project-1',
  companyId: workspaceId,
  name: 'Launch project',
  description: 'Release planning',
  status: 'active',
  visibility: 'workspace',
  teamId: null,
};
const task: ProjectTask = {
  id: 'task-1',
  companyId: workspaceId,
  projectId: project.id,
  title: 'Prepare launch',
  status: 'in_progress',
  priority: 'high',
  deadline: '2026-07-14T00:00:00.000Z',
};

function authPermissions(values: Record<string, boolean> = {}): EffectiveWorkspacePermissions {
  return {
    companyId: workspaceId,
    userId: 'user-1',
    role: 'owner',
    rolePermissions: values,
    individualOverrides: {},
    permissions: values,
  };
}

function setAuthenticated() {
  const activeWorkspace = {
    companyId: workspaceId,
    role: 'owner',
    status: 'active',
    isVerified: true,
    company: { id: workspaceId, name: 'Admiino', companyCode: 'ADM' },
  };
  mockUseAuth.mockReturnValue({
    activeWorkspace,
    workspaces: [activeWorkspace],
    selectedWorkspaceId: workspaceId,
    permissions: authPermissions({
      create_project_tasks: true,
      assign_workspace_members: true,
    }),
    status: 'authenticated',
    workspacePermissionStatus: 'ready',
    logout: async () => undefined,
    restore: async () => undefined,
    login: async () => undefined,
    selectWorkspace: async () => true,
    refreshWorkspaces: async () => true,
    clearError: () => undefined,
    clearWorkspaceError: () => undefined,
    workspaceError: null,
    error: null,
    user: { id: 'user-1', firstName: 'Ada', email: 'ada@example.test' },
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

jest.mock('./service', () => ({
  PROJECT_STATUSES: ['planning', 'active', 'on_hold', 'completed', 'cancelled', 'archived'],
  projectService: {
    getProject: jest.fn(),
    listProjectTasks: jest.fn(),
    getProjectMembers: jest.fn(),
    getProjectFiles: jest.fn(),
  },
}));

describe('Project details screen', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthenticated();
    mockGetProject.mockResolvedValue(project);
    mockListProjectTasks.mockResolvedValue([task]);
    mockGetProjectMembers.mockResolvedValue([]);
  });

  it('opens a project task in the existing task details route with project return context', async () => {
    const screen = await renderWithProviders(
      <ProjectDetailsScreen initialSection="tasks" projectId={project.id} />,
    );
    fireEvent.press(await screen.findByLabelText('Open task Prepare launch'));

    expect(mockRouter.push).toHaveBeenCalledWith(
      `/tasks/task-1?projectId=${project.id}&fromProject=1`,
    );
  });

  it('preselects the project and permitted team when adding a project task', async () => {
    mockGetProject.mockResolvedValue({ ...project, teamId: 'team-1' });
    const screen = await renderWithProviders(
      <ProjectDetailsScreen initialSection="tasks" projectId={project.id} />,
    );
    fireEvent.press(await screen.findByLabelText('Add task to project'));

    expect(mockRouter.push).toHaveBeenCalledWith(
      `/task-create?projectId=${project.id}&teamId=team-1&returnToProject=1`,
    );
  });

  it('does not expose project details when the backend denies access', async () => {
    mockGetProject.mockRejectedValueOnce(new ApiError('Forbidden', 403));
    const screen = await renderWithProviders(<ProjectDetailsScreen projectId={project.id} />);

    expect(await screen.findByText('You do not have access to this project.')).toBeTruthy();
    expect(screen.queryByText(project.name)).toBeNull();
    expect(mockListProjectTasks).not.toHaveBeenCalled();
  });
});
