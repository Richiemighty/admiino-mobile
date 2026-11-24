import { describe, expect, it } from '@jest/globals';

import { ApiClient } from '../../api';
import { SessionService } from '../../auth/session';
import type { SecureSessionStorage } from '../../auth/sessionStorage';
import { WorkspaceApprovalsService } from './approvalsService';

const workspaceId = 'workspace-1';

const joinRequest = {
  id: 'join-1',
  companyId: workspaceId,
  status: 'pending',
  createdAt: '2026-03-16T12:00:00.000Z',
  message: 'Please add me',
  requester: {
    id: 'user-2',
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.test',
    emailVerified: true,
    isActive: true,
  },
  workspace: { id: workspaceId, name: 'Admiino' },
  decidedAt: null,
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
): WorkspaceApprovalsService {
  const fetchImpl: typeof fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    requests.push({ url, init });
    return new Response(JSON.stringify(respond(url, init)), { status: 200 });
  };
  return new WorkspaceApprovalsService(
    new ApiClient('https://api.admiino.com/api/v1', fetchImpl),
    new SessionService(storage),
  );
}

describe('P14 workspace approval API contracts', () => {
  it('accepts valid empty join, verification, and permission queues', async () => {
    const service = serviceFor((url) => {
      if (url.pathname.endsWith('/join/requests')) {
        return {
          status: 'success',
          data: {
            requests: [],
            pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
          },
        };
      }
      if (url.pathname.endsWith('/pending-verifications')) {
        return { status: 'success', data: { pendingMembers: [] } };
      }
      return { status: 'success', data: { requests: [] } };
    });

    await expect(service.listJoinRequests(workspaceId)).resolves.toMatchObject({
      requests: [],
      total: 0,
    });
    await expect(service.listPendingVerifications(workspaceId)).resolves.toEqual([]);
    await expect(service.listAccessRequests(workspaceId)).resolves.toEqual([]);
  });

  it('accepts nullable requester names and email fields', async () => {
    const service = serviceFor(() => ({
      status: 'success',
      data: {
        requests: [
          {
            ...joinRequest,
            requester: {
              id: null,
              firstName: null,
              lastName: null,
              email: null,
            },
          },
        ],
        pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      },
    }));

    await expect(service.listJoinRequests(workspaceId)).resolves.toMatchObject({
      requests: [
        {
          requester: {
            id: '',
            firstName: null,
            lastName: null,
            email: null,
          },
        },
      ],
    });
  });
  it('loads pending join requests with verified pagination and workspace context', async () => {
    const requests: { url: URL; init: RequestInit }[] = [];
    const service = serviceFor(
      () => ({
        status: 'success',
        data: {
          requests: [joinRequest],
          pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
        },
      }),
      requests,
    );

    await expect(service.listJoinRequests(workspaceId)).resolves.toMatchObject({
      requests: [{ id: 'join-1', requester: { emailVerified: true } }],
      total: 1,
      totalPages: 1,
    });
    expect(requests[0]?.url.pathname).toBe('/api/v1/companies/join/requests');
    expect(requests[0]?.url.searchParams.get('status')).toBe('pending');
    expect(requests[0]?.url.searchParams.get('pageSize')).toBe('20');
    expect(new Headers(requests[0]?.init.headers).get('x-company-id')).toBe(workspaceId);
  });

  it('rejects cross-workspace join requests before exposing them', async () => {
    const service = serviceFor(() => ({
      status: 'success',
      data: {
        requests: [{ ...joinRequest, companyId: 'workspace-2' }],
        pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      },
    }));
    await expect(service.listJoinRequests(workspaceId)).rejects.toMatchObject({ status: 502 });
  });

  it('uses the verified approve and decline actions for join decisions', async () => {
    const requests: { url: URL; init: RequestInit }[] = [];
    const service = serviceFor(
      () => ({ status: 'success', data: { request: joinRequest } }),
      requests,
    );
    await service.decideJoinRequest(workspaceId, 'join-1', 'decline');
    expect(requests[0]?.url.pathname).toBe('/api/v1/companies/join/requests/join-1');
    expect(requests[0]?.init.method).toBe('PATCH');
    expect(JSON.parse(String(requests[0]?.init.body))).toEqual({ action: 'decline' });
    expect(new Headers(requests[0]?.init.headers).get('x-company-id')).toBe(workspaceId);
  });

  it('loads only current-workspace pending verifications and confirms the supported decision methods', async () => {
    const requests: { url: URL; init: RequestInit }[] = [];
    const service = serviceFor(
      (url) =>
        url.pathname.endsWith('/pending-verifications')
          ? {
              status: 'success',
              data: {
                pendingMembers: [
                  {
                    id: 'membership-1',
                    companyId: workspaceId,
                    userId: 'user-2',
                    status: 'invited',
                    isVerified: false,
                    createdAt: '2026-03-16T12:00:00.000Z',
                    user: {
                      id: 'user-2',
                      firstName: 'Ada',
                      lastName: 'Lovelace',
                      email: 'ada@example.test',
                    },
                  },
                  {
                    id: 'membership-2',
                    companyId: workspaceId,
                    userId: 'user-3',
                    status: 'removed',
                    isVerified: false,
                    createdAt: '2026-03-16T12:00:00.000Z',
                    user: { id: 'user-3', email: 'removed@example.test' },
                  },
                ],
              },
            }
          : { status: 'success', message: 'Verified.' },
      requests,
    );
    await expect(service.listPendingVerifications(workspaceId)).resolves.toHaveLength(1);
    await service.decideMemberVerification(workspaceId, 'user-2', 'approve');
    await service.decideMemberVerification(workspaceId, 'user-2', 'reject');
    expect(requests.map(({ url, init }) => `${init.method ?? 'GET'} ${url.pathname}`)).toEqual([
      'GET /api/v1/team/pending-verifications',
      'PATCH /api/v1/team/verify/user-2',
      'DELETE /api/v1/team/reject/user-2',
    ]);
  });

  it('uses the backend permission-request decision payload without local grants', async () => {
    const requests: { url: URL; init: RequestInit }[] = [];
    const service = serviceFor(
      (url) =>
        url.pathname.endsWith('/access-1')
          ? { status: 'success', data: { request: { id: 'access-1' } } }
          : {
              status: 'success',
              data: {
                requests: [
                  {
                    id: 'access-1',
                    companyId: workspaceId,
                    requesterUserId: 'user-2',
                    permissionKey: 'view_all_tasks',
                    reason: 'Need workspace visibility',
                    status: 'pending',
                    createdAt: '2026-03-16T12:00:00.000Z',
                    requester: {
                      id: 'user-2',
                      firstName: 'Ada',
                      lastName: 'Lovelace',
                      email: 'ada@example.test',
                    },
                  },
                ],
              },
            },
      requests,
    );

    await expect(service.listAccessRequests(workspaceId)).resolves.toMatchObject([
      { id: 'access-1', permissionKey: 'view_all_tasks' },
    ]);
    await service.decideAccessRequest(workspaceId, 'access-1', 'deny');
    expect(requests[0]?.url.pathname).toBe('/api/v1/access-requests');
    expect(requests[0]?.url.searchParams.get('limit')).toBe('200');
    expect(requests[1]?.url.pathname).toBe('/api/v1/access-requests/access-1');
    expect(requests[1]?.init.method).toBe('PATCH');
    expect(JSON.parse(String(requests[1]?.init.body))).toEqual({ action: 'deny' });
  });

  it('surfaces a conflicting permission decision instead of treating it as success', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ message: 'Already processed' }), { status: 409 });
    const service = new WorkspaceApprovalsService(
      new ApiClient('https://api.admiino.com/api/v1', fetchImpl),
      new SessionService(storage),
    );

    await expect(
      service.decideAccessRequest(workspaceId, 'access-1', 'approve'),
    ).rejects.toMatchObject({
      status: 409,
    });
  });
});
