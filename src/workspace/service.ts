import { apiClient } from '../api';
import type { ApiClient } from '../api/client';
import type {
  CreateWorkspaceResponse,
  EffectiveWorkspacePermissionsResponse,
  WorkspaceCodeResolutionResponse,
  WorkspaceJoinRequestsResponse,
} from '../api/types';

export class WorkspaceService {
  constructor(private readonly client: ApiClient = apiClient) {}

  getEffectivePermissions(token: string, workspaceId: string) {
    return this.client.get<EffectiveWorkspacePermissionsResponse>(
      '/access-requests/me/effective-permissions',
      { token, workspaceId },
    );
  }

  resolveCompanyCode(token: string, companyCode: string) {
    return this.client.post<WorkspaceCodeResolutionResponse>(
      '/companies/join/resolve',
      { companyCode },
      { token },
    );
  }

  requestToJoin(token: string, companyCode: string) {
    return this.client.post<{
      status: 'success';
      message: string;
      data: { request: { id: string; status: string }; workspace: { name: string } };
    }>('/companies/join/requests', { companyCode }, { token });
  }

  getMyJoinRequests(token: string) {
    return this.client.get<WorkspaceJoinRequestsResponse>('/companies/join/requests/mine', {
      token,
    });
  }

  createWorkspace(token: string, name: string) {
    return this.client.post<CreateWorkspaceResponse>('/companies', { name }, { token });
  }
}

export const workspaceService = new WorkspaceService();
