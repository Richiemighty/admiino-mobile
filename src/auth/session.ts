import { apiClient, ApiError } from '../api';
import type { ApiClient } from '../api/client';
import type { LoginRequest, LoginResponse, MeResponse, WorkspacesResponse } from '../api/types';
import { type SecureSessionStorage, secureSessionStorage } from './sessionStorage';

export function isJwtExpired(token: string, nowMs = Date.now()): boolean {
  try {
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return true;
    const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const decoded = globalThis.atob(`${base64}${padding}`);
    const payload = JSON.parse(decoded) as { exp?: unknown };
    if (typeof payload.exp !== 'number') return true;
    return payload.exp * 1000 <= nowMs;
  } catch {
    return true;
  }
}

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
    if (isJwtExpired(token)) {
      await this.storage.clearSession();
      return null;
    }

    try {
      await this.client.get<MeResponse>('/auth/me', { token });
      return token;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await this.storage.clearSession();
        return null;
      }
      if (error instanceof ApiError && (error.status === 403 || error.status === 423)) {
        return token;
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

  async getMe(token?: string, signal?: AbortSignal) {
    const accessToken = token ?? (await this.getAccessToken());
    if (!accessToken) throw new ApiError('No active session.', 401);
    return this.client.get<MeResponse>('/auth/me', { token: accessToken, signal });
  }

  async getWorkspaces(token?: string) {
    const accessToken = token ?? (await this.getAccessToken());
    if (!accessToken) throw new ApiError('No active session.', 401);
    return this.client.get<WorkspacesResponse>('/auth/workspaces', {
      token: accessToken,
    });
  }

  async getAccessToken() {
    const token = await this.storage.getAccessToken();
    if (!token) throw new ApiError('No active session.', 401);
    return token;
  }

  async getSelectedWorkspaceId() {
    return this.storage.getActiveWorkspaceId();
  }

  async setSelectedWorkspaceId(workspaceId: string) {
    await this.storage.setActiveWorkspaceId(workspaceId);
  }

  async clearSelectedWorkspaceId() {
    await this.storage.clearActiveWorkspaceId();
  }
}

export const sessionService = new SessionService();
