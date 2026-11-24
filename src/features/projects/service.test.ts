import { describe, expect, it } from '@jest/globals';

import { ApiClient, ApiError } from '../../api';
import { SessionService } from '../../auth/session';
import type { SecureSessionStorage } from '../../auth/sessionStorage';
import { ProjectService } from './service';

const workspaceId = 'workspace-1';
const projectId = 'project-1';

const project = {
  id: projectId,
  companyId: workspaceId,
  name: 'Launch',
  description: 'Release planning',
  status: 'active',
  visibility: 'workspace',
  teamId: 'team-1',
  team: { id: 'team-1', name: 'Operations', leadMemberId: null },
  startDate: '2026-06-01T00:00:00.000Z',
  endDate: null,
  dueDate: '2026-07-01T00:00:00.000Z',
  logoUrl: 'https://images.admiino.test/project-launch.png',
  color: '#6724DB',
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

function serviceFor(
  respond: (url: URL, init: RequestInit) => unknown,
  requests: { url: URL; init: RequestInit }[] = [],
): ProjectService {
  const fetchImpl: typeof fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    requests.push({ url, init });
    return new Response(JSON.stringify(respond(url, init)), { status: 200 });
  };
  return new ProjectService(
    new ApiClient('https://api.admiino.com/api/v1', fetchImpl),
    new SessionService(storage),
  );
}

describe('P13 project API contracts', () => {
  it('uses the active workspace and backend search parameter for project listings', async () => {
    const requests: { url: URL; init: RequestInit }[] = [];
    const service = serviceFor(
      () => ({ status: 'success', results: 1, data: { projects: [project] } }),
      requests,
    );

    await expect(service.listProjects(workspaceId, { search: '  launch  ' })).resolves.toEqual([
      project,
    ]);
    expect(requests[0]?.url.pathname).toBe('/api/v1/projects');
    expect(requests[0]?.url.searchParams.get('search')).toBe('launch');
    expect(new Headers(requests[0]?.init.headers).get('x-company-id')).toBe(workspaceId);
    expect(new Headers(requests[0]?.init.headers).get('Authorization')).toBe(
      'Bearer secure-access-token',
    );
  });

  it('rejects project list and detail records outside the active workspace', async () => {
    const service = serviceFor((url) =>
      url.pathname.endsWith(`/projects/${projectId}`)
        ? { status: 'success', data: { project: { ...project, companyId: 'workspace-2' } } }
        : {
            status: 'success',
            results: 1,
            data: { projects: [{ ...project, companyId: 'workspace-2' }] },
          },
    );

    await expect(service.listProjects(workspaceId)).rejects.toMatchObject({
      status: 404,
      payload: { code: 'PROJECT_NOT_IN_ACTIVE_WORKSPACE' },
    });
    await expect(service.getProject(projectId, workspaceId)).rejects.toMatchObject({
      status: 404,
      payload: { code: 'PROJECT_NOT_IN_ACTIVE_WORKSPACE' },
    });
  });

  it('rejects project task results without a matching project association', async () => {
    const service = serviceFor(() => ({
      status: 'success',
      data: [
        {
          id: 'task-1',
          companyId: workspaceId,
          projectId: null,
          title: 'Unlinked task',
          status: 'pending',
          priority: 'medium',
        },
      ],
    }));

    await expect(service.listProjectTasks(projectId, workspaceId)).rejects.toMatchObject({
      status: 502,
    });
  });

  it('loads project details, scoped tasks, members, and read-only file metadata', async () => {
    const service = serviceFor((url) => {
      if (url.pathname.endsWith(`/projects/${projectId}/tasks`)) {
        return {
          status: 'success',
          data: [
            {
              id: 'task-1',
              companyId: workspaceId,
              projectId,
              title: 'Review launch plan',
              status: 'in_progress',
              priority: 'high',
              deadline: '2026-06-20T00:00:00.000Z',
              assignee: { id: 'user-1', firstName: 'Ada', lastName: 'Lovelace' },
            },
          ],
        };
      }
      if (url.pathname.endsWith(`/projects/${projectId}/members`)) {
        return {
          status: 'success',
          data: {
            members: [
              {
                id: 'user-1',
                role: 'owner',
                status: 'active',
                firstName: 'Ada',
                lastName: 'Lovelace',
                email: 'ada@example.test',
              },
            ],
            invites: [],
          },
        };
      }
      if (url.pathname.endsWith(`/projects/${projectId}/files`)) {
        return {
          status: 'success',
          data: {
            rootFolder: { id: 'folder-root', name: 'Launch Files' },
            folder: { id: 'folder-root', name: 'Launch Files', parentId: null },
            breadcrumbs: [{ id: 'folder-root', name: 'Launch Files', parentId: null }],
            folders: [],
            files: [
              {
                id: 'file-1',
                fileName: 'brief.pdf',
                fileType: 'application/pdf',
                fileSize: 1024,
                fileUrl: 'must-not-be-used',
                publicId: 'must-not-be-used',
              },
            ],
          },
        };
      }
      return { status: 'success', data: { project } };
    });

    await expect(service.getProject(projectId, workspaceId)).resolves.toMatchObject({
      id: projectId,
      companyId: workspaceId,
    });
    await expect(service.listProjectTasks(projectId, workspaceId)).resolves.toMatchObject([
      { id: 'task-1', companyId: workspaceId, projectId, status: 'in_progress' },
    ]);
    await expect(service.getProjectMembers(projectId, workspaceId)).resolves.toMatchObject([
      { id: 'user-1', role: 'owner', status: 'active' },
    ]);
    await expect(service.getProjectFiles(projectId, workspaceId)).resolves.toMatchObject({
      files: [{ id: 'file-1', fileName: 'brief.pdf', fileType: 'application/pdf' }],
    });
  });

  it('creates and updates projects with verified fields and rejects invalid dates before requests', async () => {
    const requests: { url: URL; init: RequestInit }[] = [];
    const service = serviceFor((url, init) => {
      if (url.pathname === '/api/v1/projects' && init.method === 'POST') {
        return {
          status: 'success',
          data: {
            project: {
              ...project,
              name: 'New launch',
              description: null,
              startDate: '2026-06-01T00:00:00.000Z',
              dueDate: '2026-07-01T00:00:00.000Z',
            },
          },
        };
      }
      return {
        status: 'success',
        data: {
          project: {
            ...project,
            name: 'Updated launch',
            description: 'Updated description',
            status: 'completed',
            startDate: '2026-06-02T00:00:00.000Z',
            dueDate: '2026-07-02T00:00:00.000Z',
          },
        },
      };
    }, requests);

    await service.createProject(workspaceId, {
      name: ' New launch ',
      startDate: '2026-06-01',
      dueDate: '2026-07-01',
    });
    expect(JSON.parse(String(requests[0]?.init.body))).toEqual({
      name: 'New launch',
      startDate: '2026-06-01T00:00:00.000Z',
      dueDate: '2026-07-01T00:00:00.000Z',
    });
    expect(new Headers(requests[0]?.init.headers).get('x-company-id')).toBe(workspaceId);

    await service.updateProject(projectId, workspaceId, {
      name: 'Updated launch',
      description: 'Updated description',
      status: 'completed',
      startDate: '2026-06-02',
      dueDate: '2026-07-02',
      teamId: 'team-1',
    });
    expect(requests[1]?.url.pathname).toBe(`/api/v1/projects/${projectId}`);
    expect(requests[1]?.init.method).toBe('PATCH');
    expect(JSON.parse(String(requests[1]?.init.body))).toMatchObject({
      name: 'Updated launch',
      status: 'completed',
      startDate: '2026-06-02T00:00:00.000Z',
      dueDate: '2026-07-02T00:00:00.000Z',
      teamId: 'team-1',
    });

    await expect(
      service.createProject(workspaceId, {
        name: 'Invalid dates',
        startDate: '2026-07-02',
        dueDate: '2026-07-01',
      }),
    ).rejects.toBeInstanceOf(ApiError);
    await expect(
      service.createProject(workspaceId, { name: 'Invalid', dueDate: '2026-02-30' }),
    ).rejects.toMatchObject({ status: 400 });
    expect(requests).toHaveLength(2);
  });

  it('reads the project-creation governance capability', async () => {
    const requests: { url: URL; init: RequestInit }[] = [];
    const service = serviceFor(
      () => ({
        status: 'success',
        data: { projectCreationRestricted: true },
      }),
      requests,
    );

    await expect(service.getGovernanceCapabilities(workspaceId)).resolves.toEqual({
      projectCreationRestricted: true,
    });
    expect(requests[0]?.url.pathname).toBe('/api/v1/workspace/governance/capabilities');
    expect(new Headers(requests[0]?.init.headers).get('x-company-id')).toBe(workspaceId);
  });
});
