import { getApiBaseUrl } from './config';
import { ApiError, ApiNetworkError, ApiTimeoutError } from './errors';
import type { ApiErrorPayload } from './types';

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  token?: string | null;
  workspaceId?: string | null;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export class ApiClient {
  constructor(
    private readonly baseUrl: string | null,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    if (!this.baseUrl) {
      throw new ApiError('API connectivity is not configured for this environment.', 0);
    }

    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 15000);

    const timeoutSignal = options.signal
      ? AbortSignal.any([options.signal, controller.signal])
      : controller.signal;

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...options.headers,
    };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (options.token) headers.Authorization = `Bearer ${options.token}`;
    if (options.workspaceId) headers['x-company-id'] = options.workspaceId;

    try {
      let response: Response;
      try {
        response = await this.fetchImpl(`${this.baseUrl}${normalizedPath}`, {
          method: options.method ?? 'GET',
          headers,
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
          signal: timeoutSignal,
        });
      } catch (error) {
        if (controller.signal.aborted && !options.signal?.aborted) throw new ApiTimeoutError();
        if (error instanceof DOMException && error.name === 'AbortError')
          throw new ApiTimeoutError();
        throw new ApiNetworkError();
      }

      const text = await response.text();
      let payload: unknown = null;
      if (text) {
        try {
          payload = JSON.parse(text);
        } catch {
          throw new ApiError('The backend returned an invalid response.', response.status);
        }
      }

      if (!response.ok) {
        const errorPayload =
          payload && typeof payload === 'object' ? (payload as ApiErrorPayload) : undefined;
        throw new ApiError(
          errorPayload?.message || `Request failed with status ${response.status}.`,
          response.status,
          errorPayload,
        );
      }

      if (payload === null)
        throw new ApiError('The backend returned an invalid response.', response.status);
      return payload as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  get<T>(path: string, options: Omit<ApiRequestOptions, 'method' | 'body'> = {}) {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  post<T>(path: string, body: unknown, options: Omit<ApiRequestOptions, 'method' | 'body'> = {}) {
    return this.request<T>(path, { ...options, method: 'POST', body });
  }
}

export const apiClient = new ApiClient(getApiBaseUrl());
