import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { cleanup, fireEvent, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { EffectiveWorkspacePermissions } from '../../api/types';
import { useAuth } from '../../auth/AuthProvider';
import { renderWithProviders } from '../../test/render';
import { ProjectListScreen } from './ProjectListScreen';
import type { ProjectRecord } from './service';
import { projectService } from './service';

const mockUseAuth = jest.mocked(useAuth);
const mockListProjects = jest.mocked(projectService.listProjects);
const mockGetCapabilities = jest.mocked(projectService.getGovernanceCapabilities);
const workspaceId = 'workspace-1';
const project: ProjectRecord = {
  id: 'project-1',
  companyId: workspaceId,
  name: 'Launch project',
  description: 'Release planning',
  status: 'active',
  visibility: 'workspace',
  teamId: null,
  logoUrl: 'https://images.admiino.test/project-launch.png',
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
    permissions: authPermissions({ view_all_projects: true, create_projects: true }),
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
  };
});

jest.mock('../../components/ui/BottomSheet', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const { View } = jest.requireActual('react-native') as typeof import('react-native');
  return {
    BottomSheet: ({
      visible,
      children,
      footer,
    }: {
      visible: boolean;
      children: ReactNode;
      footer?: ReactNode;
    }) => (visible ? React.createElement(View, null, children, footer) : null),
  };
});

jest.mock('../../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('./service', () => ({
  PROJECT_STATUSES: ['planning', 'active', 'on_hold', 'completed', 'cancelled', 'archived'],
  projectService: {
    listProjects: jest.fn(),
    getGovernanceCapabilities: jest.fn(),
  },
}));

describe('Project list screen', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthenticated();
    mockListProjects.mockResolvedValue([
      project,
      { ...project, id: 'project-2', name: 'Completed project', status: 'completed' },
    ]);
    mockGetCapabilities.mockResolvedValue({ projectCreationRestricted: false });
  });

  it('filters by supported status and gates creation on workspace governance', async () => {
    const screen = await renderWithProviders(<ProjectListScreen />);
    expect(await screen.findByLabelText('Create project')).toBeTruthy();
    expect(await screen.findByLabelText('Launch project logo')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Filter projects, Active'));
    fireEvent.press(await screen.findByLabelText('Filter status: Completed'));
    fireEvent.press(await screen.findByLabelText('Close project filters'));

    expect(await screen.findByLabelText('Filter projects, Completed')).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByLabelText('Open project Completed project')).toBeTruthy(),
    );
    expect(screen.queryByLabelText('Open project Launch project')).toBeNull();
    screen.unmount();

    mockGetCapabilities.mockResolvedValueOnce({ projectCreationRestricted: true });
    const restrictedScreen = await renderWithProviders(<ProjectListScreen />);
    await waitFor(() => expect(mockGetCapabilities).toHaveBeenCalledTimes(2));
    expect(restrictedScreen.queryByLabelText('Create project')).toBeNull();
  });
});
