import { describe, expect, it } from '@jest/globals';

import { ApiClient, ApiNetworkError } from '../../api';
import { SessionService } from '../../auth/session';
import type { SecureSessionStorage } from '../../auth/sessionStorage';
import { TaskService } from './service';

const workspaceId = 'workspace-1';
const taskId = 'task-1';

const task = {
  id: taskId,
  companyId: workspaceId,
  title: 'Review launch plan',
  description: 'Check the final milestones.',
  status: 'pending',
  priority: 'high',
  deadline: '2026-12-01T00:00:00.000Z',
  projectId: null,
  teamId: null,
};

const access = { canView: true, canEdit: true, readOnly: false };

const storage: SecureSessionStorage = {
  getAccessToken: async () => 'secure-access-token',
  setAccessToken: async () => undefined,
  clearAccessToken: async () => undefined,
  getActiveWorkspaceId: async () => null,
  setActiveWorkspaceId: async () => undefined,
  clearActiveWorkspaceId: async () => undefined,
  clearSession: async () => undefined,
};

function serviceFor(
  respond: (url: URL, init: RequestInit) => unknown,
  requests: { url: URL; init: RequestInit }[] = [],
): TaskService {
  const fetchImpl: typeof fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    requests.push({ url, init });
    return new Response(JSON.stringify(respond(url, init)), { status: 200 });
  };
  return new TaskService(
    new ApiClient('https://api.admiino.com/api/v1', fetchImpl),
    new SessionService(storage),
  );
}

describe('P12 task API contracts', () => {
  it('uses server-side My Tasks relation, filters, pagination, and workspace headers', async () => {
    const requests: { url: URL; init: RequestInit }[] = [];
    const service = serviceFor(
      () => ({
        status: 'success',
        total: 26,
        data: { tasks: [task] },
      }),
      requests,
    );

    await expect(
      service.listTasks(
        workspaceId,
        {
          relation: 'assigned',
          page: 2,
          query: '  launch  ',
          status: 'pending',
          priority: 'high',
        },
      ),
    ).resolves.toMatchObject({ page: 2, total: 26, tasks: [{ id: taskId }] });

    expect(requests[0]?.url.pathname).toBe('/api/v1/tasks');
    expect(requests[0]?.url.searchParams.get('scope')).toBe('assigned_workspace');
    expect(requests[0]?.url.searchParams.get('relation')).toBe('assigned');
    expect(requests[0]?.url.searchParams.get('q')).toBe('launch');
    expect(requests[0]?.url.searchParams.get('status')).toBe('pending');
    expect(requests[0]?.url.searchParams.get('priority')).toBe('high');
    expect(requests[0]?.url.searchParams.get('limit')).toBe('20');
    expect(requests[0]?.url.searchParams.get('page')).toBe('2');
    expect(new Headers(requests[0]?.init.headers).get('x-company-id')).toBe(workspaceId);
    expect(new Headers(requests[0]?.init.headers).get('Authorization')).toBe(
      'Bearer secure-access-token',
    );
  });

  it('uses the created relation and refuses All Tasks without effective permission', async () => {
    const requests: { url: URL; init: RequestInit }[] = [];
    const service = serviceFor(
      () => ({ status: 'success', total: 0, data: { tasks: [] } }),
      requests,
    );

    await service.listTasks(workspaceId, { relation: 'created', page: 1 });
    await expect(
      service.listTasks(workspaceId, { relation: 'all', page: 1 }),
    ).rejects.toMatchObject({ status: 403 });
    await service.listTasks(workspaceId, {
      relation: 'all',
      page: 1,
      canViewAllTasks: true,
    });

    expect(requests).toHaveLength(2);
    expect(requests[0]?.url.searchParams.get('relation')).toBe('created');
    expect(requests[1]?.url.searchParams.get('scope')).toBe('workspace');
  });

  it('validates task detail access and rejects a task from another workspace', async () => {
    const service = serviceFor((url) =>
      url.pathname.endsWith(`/tasks/${taskId}`)
        ? { status: 'success', data: { task, access } }
        : { status: 'success', total: 0, data: { tasks: [] } },
    );

    await expect(service.getTask(taskId, workspaceId)).resolves.toEqual({ task, access });

    const otherWorkspaceTask = { ...task, companyId: 'workspace-2' };
    const crossWorkspaceService = serviceFor(() => ({
      status: 'success',
      data: { task: otherWorkspaceTask, access },
    }));
    await expect(crossWorkspaceService.getTask(taskId, workspaceId)).rejects.toMatchObject({
      status: 404,
      payload: { code: 'TASK_NOT_IN_ACTIVE_WORKSPACE' },
    });

    const deniedService = serviceFor(() => ({
      status: 'success',
      data: { task, access: { ...access, canView: false } },
    }));
    await expect(deniedService.getTask(taskId, workspaceId)).rejects.toMatchObject({
      status: 403,
    });
  });

  it('creates regular and project-context tasks through their verified endpoints', async () => {
    const requests: { url: URL; init: RequestInit }[] = [];
    const service = serviceFor(
      (url) =>
        url.pathname.endsWith('/projects/project-1/tasks')
          ? { status: 'success', data: { ...task, projectId: 'project-1' } }
          : { status: 'success', data: { task } },
      requests,
    );

    await service.createTask(workspaceId, {
      title: ' New task ',
      description: ' Notes ',
      priority: 'medium',
      assigneeIds: ['user-1', 'user-2', 'user-1'],
    });
    await service.createTask(
      workspaceId,
      { title: 'Project task', priority: 'low', projectId: 'project-1' },
      true,
    );

    expect(requests.map(({ url }) => `${url.pathname} ${url.search}`.trim())).toEqual([
      '/api/v1/tasks',
      '/api/v1/projects/project-1/tasks',
    ]);
    expect(JSON.parse(String(requests[0]?.init.body))).toMatchObject({
      title: 'New task',
      description: 'Notes',
      assigneeId: 'user-1',
      assigneeIds: ['user-1', 'user-2'],
    });
    expect(new Headers(requests[1]?.init.headers).get('x-company-id')).toBe(workspaceId);
  });

  it('requires task-level edit access and leaves status changes to server confirmation', async () => {
    const requests: { url: URL; init: RequestInit }[] = [];
    const service = serviceFor(
      () => ({ status: 'success', data: { task: { ...task, status: 'in_progress' } } }),
      requests,
    );

    await expect(
      service.updateTask(taskId, workspaceId, { status: 'in_progress' }, {
        canView: true,
        canEdit: false,
        readOnly: true,
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(requests).toHaveLength(0);

    await expect(
      service.updateTask(taskId, workspaceId, { status: 'in_progress' }, access),
    ).resolves.toMatchObject({ status: 'in_progress' });
    expect(requests[0]?.url.pathname).toBe(`/api/v1/tasks/${taskId}`);
    expect(requests[0]?.init.method).toBe('PATCH');
    expect(JSON.parse(String(requests[0]?.init.body))).toEqual({ status: 'in_progress' });
  });

  it('reports server-filtered field edits instead of treating stripped fields as success', async () => {
    const service = serviceFor(() => ({
      status: 'success',
      data: { task: { ...task, title: 'Original title' } },
    }));
    await expect(
      service.updateTask(taskId, workspaceId, { title: 'Updated title' }, access),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('loads only active workspace members and validates project and team ownership', async () => {
    const service = serviceFor((url) => {
      if (url.pathname.endsWith('/team/members')) {
        return {
          status: 'success',
          data: {
            members: [
              {
                userId: 'active-user',
                companyId: workspaceId,
                status: 'active',
                user: { firstName: 'Ada', lastName: 'Lovelace', isActive: true },
              },
              {
                userId: 'removed-user',
                companyId: workspaceId,
                status: 'removed',
                user: { firstName: 'Removed', lastName: 'Member', isActive: true },
              },
            ],
          },
        };
      }
      if (url.pathname.endsWith('/projects')) {
        return {
          status: 'success',
          data: { projects: [{ id: 'project-1', companyId: workspaceId, name: 'Launch' }] },
        };
      }
      return {
        status: 'success',
        data: {
          teams: [
            {
              id: 'team-1',
              companyId: workspaceId,
              name: 'Operations',
              leadMember: { userId: 'lead-user' },
              memberLinks: [{ companyMember: { userId: 'active-user' } }],
            },
          ],
        },
      };
    });

    await expect(service.getMembers(workspaceId)).resolves.toEqual([
      { userId: 'active-user', firstName: 'Ada', lastName: 'Lovelace' },
    ]);
    await expect(service.getProjects(workspaceId)).resolves.toEqual([
      { id: 'project-1', name: 'Launch' },
    ]);
    await expect(service.getTeams(workspaceId)).resolves.toEqual([
      { id: 'team-1', name: 'Operations', memberIds: ['lead-user', 'active-user'] },
    ]);
  });

  it('surfaces network failures instead of returning empty task data', async () => {
    const client = new ApiClient(
      'https://api.admiino.com/api/v1',
      async () => {
        throw new Error('offline');
      },
    );
    const service = new TaskService(client, new SessionService(storage));

    await expect(service.listTasks(workspaceId, { relation: 'assigned', page: 1 })).rejects.toBeInstanceOf(
      ApiNetworkError,
    );
  });
});
