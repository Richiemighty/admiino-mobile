import { describe, expect, it } from '@jest/globals';

import { ApiClient } from '../api/client';
import { WorkspaceService } from './service';

describe('P10 workspace API contracts', () => {
  it('sends effective-permissions requests to the versioned API with the selected workspace header', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init });
      return new Response(
        JSON.stringify({
          status: 'success',
          data: {
            companyId: 'workspace-2',
            userId: 'user-1',
            role: 'member',
            rolePermissions: { create_tasks: false },
            individualOverrides: {},
            permissions: { create_tasks: false },
          },
        }),
        { status: 200 },
      );
    };
    const service = new WorkspaceService(
      new ApiClient('https://api.admiino.com/api/v1', fetchImpl),
    );

    await service.getEffectivePermissions('access-token', 'workspace-2');

    expect(calls[0]?.url).toBe(
      'https://api.admiino.com/api/v1/access-requests/me/effective-permissions',
    );
    const headers = new Headers(calls[0]?.init?.headers);
    expect(headers.get('Authorization')).toBe('Bearer access-token');
    expect(headers.get('x-company-id')).toBe('workspace-2');
  });

  it('uses the verified create and join request paths and payloads', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init });
      return new Response(JSON.stringify({ status: 'success', data: {} }), { status: 200 });
    };
    const service = new WorkspaceService(
      new ApiClient('https://api.admiino.com/api/v1', fetchImpl),
    );

    await service.resolveCompanyCode('token', 'ACME-1234');
    await service.requestToJoin('token', 'ACME-1234');
    await service.getMyJoinRequests('token');
    await service.createWorkspace('token', 'Admiino Team');

    expect(calls.map(({ url }) => url)).toEqual([
      'https://api.admiino.com/api/v1/companies/join/resolve',
      'https://api.admiino.com/api/v1/companies/join/requests',
      'https://api.admiino.com/api/v1/companies/join/requests/mine',
      'https://api.admiino.com/api/v1/companies',
    ]);
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ companyCode: 'ACME-1234' });
    expect(JSON.parse(String(calls[1]?.init?.body))).toEqual({ companyCode: 'ACME-1234' });
    expect(JSON.parse(String(calls[3]?.init?.body))).toEqual({ name: 'Admiino Team' });
  });
});
