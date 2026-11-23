import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { ApiClient } from './client';
import { ApiNetworkError, ApiTimeoutError } from './errors';

describe('P07 API client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('makes successful requests and sends auth and workspace headers', async () => {
    const fetchImpl = jest.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({
        Authorization: 'Bearer test-token',
        'x-company-id': 'workspace-1',
      });
      return new Response(JSON.stringify({ status: 'success', data: { ok: true } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as unknown as typeof fetch;

    const client = new ApiClient('https://example.com/api/v1', fetchImpl);
    await expect(
      client.get('/health-check', { token: 'test-token', workspaceId: 'workspace-1' }),
    ).resolves.toEqual({ status: 'success', data: { ok: true } });
  });

  it('maps invalid JSON and backend errors to ApiError', async () => {
    const invalidJson = jest.fn(
      async () => new Response('not-json', { status: 200 }),
    ) as unknown as typeof fetch;
    await expect(
      new ApiClient('https://example.com/api/v1', invalidJson).get('/bad'),
    ).rejects.toMatchObject({
      name: 'ApiError',
      status: 200,
    });

    const backendError = jest.fn(
      async () =>
        new Response(JSON.stringify({ status: 'error', code: 'TEST', message: 'Denied' }), {
          status: 403,
        }),
    ) as unknown as typeof fetch;
    await expect(
      new ApiClient('https://example.com/api/v1', backendError).get('/forbidden'),
    ).rejects.toMatchObject({
      name: 'ApiError',
      status: 403,
      code: 'TEST',
    });
  });

  it('maps network failures and abort timeouts', async () => {
    const network = jest.fn(async () => {
      throw new TypeError('offline');
    }) as unknown as typeof fetch;
    await expect(
      new ApiClient('https://example.com/api/v1', network).get('/offline'),
    ).rejects.toBeInstanceOf(ApiNetworkError);

    const hanging = jest.fn(
      (_input: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
    ) as unknown as typeof fetch;
    await expect(
      new ApiClient('https://example.com/api/v1', hanging).get('/slow', { timeoutMs: 10 }),
    ).rejects.toBeInstanceOf(ApiTimeoutError);
  });
});
