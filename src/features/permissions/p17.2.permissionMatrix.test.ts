import { describe, expect, it } from '@jest/globals';

import { taskAccess, workspacePermissions } from '../../test/permissionFixtures';
import { canCreateProjects, canCreateProjectTasks, canEditProject } from '../projects/permissions';
import { getTaskSwipeActions } from '../tasks/taskSwipe';
import { getAuthenticatedRouteRedirect } from '../workspace/AuthenticatedRoute';

describe('P17.2 source-backed mobile permission matrix', () => {
  it('keeps role identity separate from effective permission flags', () => {
    expect(workspacePermissions('manager', { create_tasks: true }).permissions.create_tasks).toBe(
      true,
    );
    expect(workspacePermissions('manager', { create_tasks: false }).permissions.create_tasks).toBe(
      false,
    );
    expect(workspacePermissions('member').permissions.create_tasks).toBeUndefined();
    expect(workspacePermissions('guest').permissions.create_tasks).toBeUndefined();
  });

  it('does not expose task swipe actions from a role assumption', () => {
    expect(getTaskSwipeActions(taskAccess({ canView: true, canEdit: false }))).toEqual(['watch']);
    expect(
      getTaskSwipeActions(taskAccess({ canView: true, canEdit: true, readOnly: false })),
    ).toEqual(['status', 'edit', 'watch']);
    expect(getTaskSwipeActions(taskAccess({ canView: false, canEdit: false }))).toEqual([]);
  });

  it('requires the distinct effective project permissions', () => {
    expect(
      canCreateProjects(workspacePermissions('member', { create_projects: true }), {
        projectCreationRestricted: false,
      }),
    ).toBe(true);
    expect(
      canCreateProjects(workspacePermissions('member', { create_projects: true }), {
        projectCreationRestricted: true,
      }),
    ).toBe(false);
    expect(canCreateProjectTasks(workspacePermissions('member', { create_tasks: true }))).toBe(
      false,
    );
    expect(
      canCreateProjectTasks(workspacePermissions('member', { create_project_tasks: true })),
    ).toBe(true);
  });

  it('does not treat removed project membership as project administration', () => {
    expect(
      canEditProject(workspacePermissions('member'), [
        { id: 'user-1', role: 'admin', status: 'removed' },
      ]),
    ).toBe(false);
    expect(
      canEditProject(workspacePermissions('member'), [
        { id: 'user-1', role: 'admin', status: 'active' },
      ]),
    ).toBe(true);
  });

  it('protects direct routes while permission state is loading or denied', () => {
    expect(
      getAuthenticatedRouteRedirect({
        status: 'authenticated',
        workspaceCount: 1,
        activeWorkspace: true,
        workspacePermissionStatus: 'loading',
        redirectToHome: false,
      }),
    ).toBe('/workspace-select');
    expect(
      getAuthenticatedRouteRedirect({
        status: 'authenticated',
        workspaceCount: 1,
        activeWorkspace: true,
        workspacePermissionStatus: 'error',
        redirectToHome: false,
      }),
    ).toBe('/workspace-access');
    expect(
      getAuthenticatedRouteRedirect({
        status: 'authenticated',
        workspaceCount: 1,
        activeWorkspace: true,
        workspacePermissionStatus: 'suspended',
        redirectToHome: false,
      }),
    ).toBe('/workspace-suspended');
  });
});
