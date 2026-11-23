import { describe, expect, it } from '@jest/globals';

import { ApiClient, ApiError } from '../../api';
import { SessionService } from '../../auth/session';
import type { SecureSessionStorage } from '../../auth/sessionStorage';
import { GlobalSearchService, HomeService } from './service';

const summary = {
  relation: 'assigned',
  totalTasks: 2,
  pendingTasks: 1,
  inProgressTasks: 1,
  inReviewTasks: 0,
  delayedTasks: 0,
  completedTasks: 0,
  cancelledTasks: 0,
  openTasks: 2,
  overdueTasks: 0,
  urgentTasks: 1,
  completionRate: 0,
};

const storage: SecureSessionStorage = {
  getAccessToken: async () => 'secure-access-token',
  setAccessToken: async () => undefined,
  clearAccessToken: async () => undefined,
  getActiveWorkspaceId: async () => null,
  setActiveWorkspaceId: async () => undefined,
  clearActiveWorkspaceId: async () => undefined,
  clearSession: async () => undefined,
};

function createClient(
  respond: (url: URL) => unknown,
  requests: { url: URL; headers: Headers }[] = [],
): ApiClient {
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    requests.push({ url, headers: new Headers(init?.headers) });
    return new Response(JSON.stringify(respond(url)), { status: 200 });
  };
  return new ApiClient('https://api.admiino.com/api/v1', fetchImpl);
}

describe('P11 home and search API contracts', () => {
  it('loads the assigned-only summary and task page with the active workspace header', async () => {
    const requests: { url: URL; headers: Headers }[] = [];
    const client = createClient(
      (url) =>
        url.pathname.endsWith('/tasks/my/summary')
          ? { status: 'success', data: { summary } }
          : {
              status: 'success',
              results: 1,
              total: 1,
              data: {
                tasks: [
                  {
                    id: 'task-1',
                    title: 'Review launch plan',
                    status: 'in_progress',
                    priority: 'high',
                    deadline: '2026-07-14',
                  },
                ],
              },
            },
      requests,
    );
    const service = new HomeService(client, new SessionService(storage));

    await expect(service.getDashboardData('workspace-1')).resolves.toMatchObject({
      workspaceId: 'workspace-1',
      summary: { relation: 'assigned', totalTasks: 2, overdueTasks: 0 },
      tasks: [{ id: 'task-1', title: 'Review launch plan' }],
    });

    expect(requests).toHaveLength(2);
    expect(requests.map(({ url }) => url.pathname)).toEqual([
      '/api/v1/tasks/my/summary',
      '/api/v1/tasks',
    ]);
    expect(requests[0]?.url.searchParams.get('relation')).toBe('assigned');
    expect(requests[1]?.url.searchParams.get('scope')).toBe('assigned_workspace');
    expect(requests[1]?.url.searchParams.get('relation')).toBe('assigned');
    expect(requests[1]?.url.searchParams.get('limit')).toBe('50');
    for (const request of requests) {
      expect(request.headers.get('Authorization')).toBe('Bearer secure-access-token');
      expect(request.headers.get('x-company-id')).toBe('workspace-1');
    }
  });

  it('rejects malformed personal summary data instead of showing invented metrics', async () => {
    const client = createClient((url) =>
      url.pathname.endsWith('/tasks/my/summary')
        ? { status: 'success', data: { summary: { relation: 'assigned', totalTasks: 'many' } } }
        : { status: 'success', results: 0, total: 0, data: { tasks: [] } },
    );
    const service = new HomeService(client, new SessionService(storage));

    await expect(service.getDashboardData('workspace-1')).rejects.toMatchObject({
      name: 'ApiError',
      status: 502,
    });
  });

  it('searches only with the active workspace and safely ignores unsupported result groups', async () => {
    const requests: { url: URL; headers: Headers }[] = [];
    const client = createClient(
      () => ({
        status: 'success',
        data: {
          groups: {
            tasks: [{ id: 'task-1', title: 'Quarterly plan', subtitle: 'in_progress' }],
            projects: [{ id: 'project-1', title: 'Quarterly work', subtitle: 'Project' }],
            people: [{ id: 'person-1', title: 'Ada Lovelace', subtitle: 'Workspace member' }],
            teams: [{ id: 'team-1', title: 'Team', subtitle: 'Team' }],
          },
        },
      }),
      requests,
    );
    const service = new GlobalSearchService(client, new SessionService(storage));

    await expect(service.search('  quarterly plan  ', 'workspace-2')).resolves.toEqual({
      tasks: [{ id: 'task-1', title: 'Quarterly plan', subtitle: 'in_progress' }],
      projects: [{ id: 'project-1', title: 'Quarterly work', subtitle: 'Project' }],
      people: [{ id: 'person-1', title: 'Ada Lovelace', subtitle: 'Workspace member' }],
    });

    expect(requests[0]?.url.pathname).toBe('/api/v1/global-search');
    expect(requests[0]?.url.searchParams.get('q')).toBe('quarterly plan');
    expect(requests[0]?.headers.get('x-company-id')).toBe('workspace-2');
    expect(requests[0]?.headers.get('Authorization')).toBe('Bearer secure-access-token');
  });

  it('does not send undersized global-search queries to the backend', async () => {
    let requestCount = 0;
    const client = createClient(() => {
      requestCount += 1;
      return { status: 'success', data: { groups: {} } };
    });
    const service = new GlobalSearchService(client, new SessionService(storage));

    await expect(service.search('a', 'workspace-1')).rejects.toBeInstanceOf(ApiError);
    expect(requestCount).toBe(0);
  });
});
