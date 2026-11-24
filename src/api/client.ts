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
  redirect?: RequestRedirect;
}

export interface ApiBinaryResponse {
  bytes: Uint8Array;
  contentType: string | null;
  contentDisposition: string | null;
}

function isFormData(value: unknown): value is FormData {
  return typeof FormData !== 'undefined' && value instanceof FormData;
}

export class ApiClient {
  constructor(
    private readonly baseUrl: string | null,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    return this.execute(path, options, async (response) => {
      const text = await response.text();
      let payload: unknown = null;
      if (text) {
        try {
          payload = JSON.parse(text);
        } catch {
          throw new ApiError('The backend returned an invalid response.', response.status);
        }
      }

      if (payload === null)
        throw new ApiError('The backend returned an invalid response.', response.status);
      return payload as T;
    });
  }

  async requestBinary(
    path: string,
    options: Omit<ApiRequestOptions, 'body'>,
    maxBytes: number,
  ): Promise<ApiBinaryResponse> {
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
      throw new ApiError('The file download limit is invalid.', 400);
    }

    return this.execute(path, options, async (response) => {
      const contentLength = Number(response.headers.get('content-length'));
      if (Number.isFinite(contentLength) && contentLength > maxBytes) {
        throw new ApiError('This file exceeds the download size limit.', 413);
      }

      let bytes: Uint8Array;
      const reader = response.body?.getReader();
      if (reader) {
        const chunks: Uint8Array[] = [];
        let totalBytes = 0;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            totalBytes += value.byteLength;
            if (totalBytes > maxBytes) {
              await reader.cancel();
              throw new ApiError('This file exceeds the download size limit.', 413);
            }
            chunks.push(value);
          }
        } finally {
          reader.releaseLock();
        }
        bytes = new Uint8Array(totalBytes);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.byteLength;
        }
      } else {
        bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.byteLength > maxBytes) {
          throw new ApiError('This file exceeds the download size limit.', 413);
        }
      }

      return {
        bytes,
        contentType: response.headers.get('content-type'),
        contentDisposition: response.headers.get('content-disposition'),
      };
    });
  }

  private async execute<T>(
    path: string,
    options: ApiRequestOptions,
    parseResponse: (response: Response) => Promise<T>,
  ): Promise<T> {
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
    const formData = isFormData(options.body);
    const requestBody: BodyInit | undefined =
      options.body === undefined
        ? undefined
        : isFormData(options.body)
          ? options.body
          : JSON.stringify(options.body);
    for (const headerName of Object.keys(headers)) {
      if (formData && headerName.toLowerCase() === 'content-type') delete headers[headerName];
    }
    if (options.body !== undefined && !formData) headers['Content-Type'] = 'application/json';
    if (options.token) headers.Authorization = `Bearer ${options.token}`;
    if (options.workspaceId) headers['x-company-id'] = options.workspaceId;

    try {
      let response: Response;
      try {
        response = await this.fetchImpl(`${this.baseUrl}${normalizedPath}`, {
          method: options.method ?? 'GET',
          headers,
          body: requestBody,
          signal: timeoutSignal,
          redirect: options.redirect,
        });
      } catch (error) {
        if (controller.signal.aborted && !options.signal?.aborted) throw new ApiTimeoutError();
        if (error instanceof DOMException && error.name === 'AbortError')
          throw new ApiTimeoutError();
        throw new ApiNetworkError();
      }

      if (!response.ok) {
        const text = await response.text();
        let payload: unknown = null;
        if (text) {
          try {
            payload = JSON.parse(text);
          } catch {
            payload = null;
          }
        }
        const errorPayload =
          payload && typeof payload === 'object' ? (payload as ApiErrorPayload) : undefined;
        throw new ApiError(
          errorPayload?.message || `Request failed with status ${response.status}.`,
          response.status,
          errorPayload,
        );
      }

      return await parseResponse(response);
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
