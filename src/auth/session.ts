import { apiClient, ApiError } from '../api';
import type { ApiClient } from '../api/client';
import type { LoginRequest, LoginResponse, MeResponse, WorkspacesResponse } from '../api/types';
import { type SecureSessionStorage, secureSessionStorage } from './sessionStorage';

export class SessionService {
  private restorePromise: Promise<string | null> | null = null;

  constructor(
    private readonly storage: SecureSessionStorage = secureSessionStorage,
    private readonly client: ApiClient = apiClient,
  ) {}

  async restoreSession(): Promise<string | null> {
    if (this.restorePromise) return this.restorePromise;
    this.restorePromise = this.validateStoredSession();
    try {
      return await this.restorePromise;
    } finally {
      this.restorePromise = null;
    }
  }

  private async validateStoredSession(): Promise<string | null> {
    const token = await this.storage.getAccessToken();
    if (!token) return null;

    try {
      await this.client.get<MeResponse>('/auth/me', { token });
      return token;
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        await this.storage.clearSession();
        return null;
      }
      throw error;
    }
  }

  async prepareLogin(request: LoginRequest): Promise<LoginResponse> {
    const response = await this.client.post<LoginResponse>('/auth/login', {
      ...request,
      email: request.email.trim(),
    });
    await this.storage.setAccessToken(response.token);
    const firstWorkspace = response.data.workspaces?.[0];
    if (firstWorkspace) await this.storage.setActiveWorkspaceId(firstWorkspace.companyId);
    return response;
  }

  async logout(): Promise<void> {
    await this.storage.clearSession();
  }

  async getMe(token?: string) {
    const accessToken = token ?? (await this.storage.getAccessToken());
    if (!accessToken) throw new ApiError('No active session.', 401);
    return this.client.get<MeResponse>('/auth/me', { token: accessToken });
  }

  async getWorkspaces(token?: string) {
    const accessToken = token ?? (await this.storage.getAccessToken());
    if (!accessToken) throw new ApiError('No active session.', 401);
    const workspaceId = await this.storage.getActiveWorkspaceId();
    return this.client.get<WorkspacesResponse>('/auth/workspaces', {
      token: accessToken,
      workspaceId,
    });
  }
}

export const sessionService = new SessionService();
