import { describe, expect, it } from '@jest/globals';

import type { EffectiveWorkspacePermissions } from '../../api/types';
import {
  canCreateProjects,
  canCreateProjectTasks,
  canEditProject,
  isMyProject,
} from './permissions';
import type { ProjectRecord } from './service';

function permissions(
  role: string,
  userId = 'user-1',
  values: Record<string, boolean> = {},
): EffectiveWorkspacePermissions {
  return {
    companyId: 'workspace-1',
    userId,
    role,
    rolePermissions: values,
    individualOverrides: {},
    permissions: values,
  };
}

const project: ProjectRecord = {
  id: 'project-1',
  companyId: 'workspace-1',
  name: 'Launch',
  status: 'active',
  visibility: 'private',
  createdBy: 'creator-1',
  members: [
    {
      id: 'user-1',
      ProjectMember: { role: 'admin', status: 'active' },
    },
  ],
};

describe('P13 project access rules', () => {
  it('requires both effective create permission and unrestricted governance', () => {
    expect(
      canCreateProjects(permissions('member', 'user-1', { create_projects: true }), {
        projectCreationRestricted: false,
      }),
    ).toBe(true);
    expect(
      canCreateProjects(permissions('member', 'user-1', { create_projects: true }), {
        projectCreationRestricted: true,
      }),
    ).toBe(false);
    expect(
      canCreateProjects(permissions('member', 'user-1', { create_projects: false }), {
        projectCreationRestricted: false,
      }),
    ).toBe(false);
  });

  it('requires the distinct effective permission for project task creation', () => {
    expect(
      canCreateProjectTasks(permissions('member', 'user-1', { create_project_tasks: true })),
    ).toBe(true);
    expect(canCreateProjectTasks(permissions('member', 'user-1', { create_tasks: true }))).toBe(
      false,
    );
  });

  it('uses the verified project update rule and active project membership', () => {
    expect(canEditProject(permissions('manager'), [])).toBe(true);
    expect(
      canEditProject(permissions('member'), [{ id: 'user-1', role: 'admin', status: 'active' }]),
    ).toBe(true);
    expect(
      canEditProject(permissions('member'), [{ id: 'user-1', role: 'admin', status: 'removed' }]),
    ).toBe(false);
  });

  it('identifies personal projects from creator, lead, or active project membership', () => {
    expect(isMyProject(project, 'user-1')).toBe(true);
    expect(isMyProject({ ...project, members: [] }, 'creator-1')).toBe(true);
    expect(isMyProject({ ...project, members: [] }, 'someone-else')).toBe(false);
  });
});
