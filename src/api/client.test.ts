import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { ApiClient } from './client';
import { ApiError, ApiNetworkError, ApiTimeoutError } from './errors';

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

  it('sends multipart bodies without overriding the generated content type', async () => {
    const body = new FormData();
    body.append('content', 'A comment');
    const fetchImpl = jest.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      expect(init?.body).toBe(body);
      expect(new Headers(init?.headers).has('content-type')).toBe(false);
      expect(new Headers(init?.headers).get('x-company-id')).toBe('workspace-1');
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }) as unknown as typeof fetch;

    await expect(
      new ApiClient('https://example.com/api/v1', fetchImpl).post('/comments', body, {
        token: 'test-token',
        workspaceId: 'workspace-1',
        headers: { 'Content-Type': 'application/json' },
      }),
    ).resolves.toEqual({ success: true });
  });

  it('downloads authenticated binary data and enforces the declared and actual size', async () => {
    const fetchImpl = jest.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get('Authorization')).toBe('Bearer test-token');
      expect(headers.get('x-company-id')).toBe('workspace-1');
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="report.pdf"',
        },
      });
    }) as unknown as typeof fetch;
    const client = new ApiClient('https://example.com/api/v1', fetchImpl);

    await expect(
      client.requestBinary(
        '/tasks/task-1/attachments/file-1/download',
        {
          token: 'test-token',
          workspaceId: 'workspace-1',
        },
        3,
      ),
    ).resolves.toMatchObject({
      bytes: new Uint8Array([1, 2, 3]),
      contentType: 'application/pdf',
    });

    const oversized = jest.fn(
      async () =>
        new Response(new Uint8Array([1, 2, 3, 4]), {
          status: 200,
          headers: { 'Content-Length': '4' },
        }),
    ) as unknown as typeof fetch;
    await expect(
      new ApiClient('https://example.com/api/v1', oversized).requestBinary('/file', {}, 3),
    ).rejects.toMatchObject({ status: 413 });

    const streamedOversized = jest.fn(
      async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array([1, 2, 3, 4]));
              controller.close();
            },
          }),
        ),
    ) as unknown as typeof fetch;
    await expect(
      new ApiClient('https://example.com/api/v1', streamedOversized).requestBinary('/file', {}, 3),
    ).rejects.toMatchObject({ status: 413 });
  });

  it('preserves authenticated backend errors for binary requests', async () => {
    const fetchImpl = jest.fn(
      async () =>
        new Response(JSON.stringify({ status: 'error', message: 'Access denied.' }), {
          status: 403,
        }),
    ) as unknown as typeof fetch;

    await expect(
      new ApiClient('https://example.com/api/v1', fetchImpl).requestBinary('/file', {}, 10),
    ).rejects.toBeInstanceOf(ApiError);
  });
});
