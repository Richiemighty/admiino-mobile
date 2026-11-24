import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { cleanup, fireEvent, waitFor } from '@testing-library/react-native';

import type { EffectiveWorkspacePermissions } from '../../api/types';
import { useAuth } from '../../auth/AuthProvider';
import { renderWithProviders } from '../../test/render';
import { ProjectFormScreen } from './ProjectFormScreen';
import type { ProjectRecord } from './service';
import { projectService } from './service';

const mockUseAuth = jest.mocked(useAuth);
const mockCreateProject = jest.mocked(projectService.createProject);
const mockUpdateProject = jest.mocked(projectService.updateProject);
const mockGetCapabilities = jest.mocked(projectService.getGovernanceCapabilities);
const mockGetProject = jest.mocked(projectService.getProject);
const mockGetProjectMembers = jest.mocked(projectService.getProjectMembers);
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
    permissions: authPermissions({ create_projects: true }),
    status: 'authenticated',
    workspacePermissionStatus: 'ready',
    logout: async () => undefined,
    refreshUser: async () => ({ id: 'user-1', email: 'user@example.test' }),
    applyUserProfileUpdate: () => undefined,
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
    usePreventRemove: () => jest.fn(),
  };
});

jest.mock('@expo/ui/community/datetime-picker', () => ({
  DateTimePicker: () => null,
}));

jest.mock('../../components/ui/BottomSheet', () => ({
  BottomSheet: () => null,
}));

jest.mock('../../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('./service', () => ({
  PROJECT_STATUSES: ['planning', 'active', 'on_hold', 'completed', 'cancelled', 'archived'],
  projectService: {
    getGovernanceCapabilities: jest.fn(),
    getProject: jest.fn(),
    getProjectMembers: jest.fn(),
    listTeams: jest.fn(),
    createProject: jest.fn(),
    updateProject: jest.fn(),
  },
}));

describe('Project form screen', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthenticated();
    mockGetCapabilities.mockResolvedValue({ projectCreationRestricted: false });
    mockGetProject.mockResolvedValue(project);
    mockGetProjectMembers.mockResolvedValue([]);
    mockCreateProject.mockResolvedValue({ ...project, id: 'new-project' });
    mockUpdateProject.mockResolvedValue(project);
  });

  it('creates a project and opens the confirmed project record', async () => {
    const screen = await renderWithProviders(<ProjectFormScreen mode="create" />);
    fireEvent.changeText(screen.getByLabelText('Project name'), 'New project');
    fireEvent.press(await screen.findByLabelText('Create project'));

    await waitFor(() =>
      expect(mockCreateProject).toHaveBeenCalledWith(
        workspaceId,
        expect.objectContaining({ name: 'New project' }),
      ),
    );
    expect(mockRouter.replace).toHaveBeenCalledWith('/projects/new-project');
  });

  it('prefills and saves verified project fields in edit mode', async () => {
    const screen = await renderWithProviders(
      <ProjectFormScreen mode="edit" projectId={project.id} />,
    );
    const nameInput = await screen.findByLabelText('Project name');
    expect(nameInput.props.value).toBe(project.name);
    fireEvent.changeText(nameInput, 'Updated project');
    await waitFor(() =>
      expect(screen.getByLabelText('Project name').props.value).toBe('Updated project'),
    );
    fireEvent.press(screen.getByLabelText('Save project changes'));

    await waitFor(() =>
      expect(mockUpdateProject).toHaveBeenCalledWith(
        project.id,
        workspaceId,
        expect.objectContaining({ name: 'Updated project', status: project.status }),
      ),
    );
  });
});
