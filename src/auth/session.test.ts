import { describe, expect, it, jest } from '@jest/globals';

import { ApiClient } from '../api/client';
import { isJwtExpired, SessionService } from './session';
import type { SecureSessionStorage } from './sessionStorage';

const createStorage = (): SecureSessionStorage => {
  const getAccessToken = jest.fn<() => Promise<string | null>>().mockResolvedValue(null);
  const setAccessToken = jest
    .fn<(token: string) => Promise<void>>()
    .mockImplementation(async () => undefined);
  const clearAccessToken = jest.fn<() => Promise<void>>().mockImplementation(async () => undefined);
  const getActiveWorkspaceId = jest.fn<() => Promise<string | null>>().mockResolvedValue(null);
  const setActiveWorkspaceId = jest
    .fn<(workspaceId: string) => Promise<void>>()
    .mockImplementation(async () => undefined);
  const clearActiveWorkspaceId = jest
    .fn<() => Promise<void>>()
    .mockImplementation(async () => undefined);
  const clearSession = jest.fn<() => Promise<void>>().mockImplementation(async () => undefined);

  return {
    getAccessToken,
    setAccessToken,
    clearAccessToken,
    getActiveWorkspaceId,
    setActiveWorkspaceId,
    clearActiveWorkspaceId,
    clearSession,
  };
};

describe('P07 session foundation', () => {
  it('detects expired JWT payloads', () => {
    const payload = btoa(JSON.stringify({ exp: 100 }));
    expect(isJwtExpired(`header.${payload}.signature`, 101000)).toBe(true);
  });
  it('stores a login access token and first workspace securely', async () => {
    const storage = createStorage();
    const client = new ApiClient(
      'https://example.com/api/v1',
      jest.fn(
        async () =>
          new Response(
            JSON.stringify({
              status: 'success',
              message: 'Welcome',
              token: 'access-token',
              data: {
                user: { id: 'u1', email: 'user@example.com' },
                workspaces: [
                  {
                    companyId: 'w1',
                    role: 'owner',
                    status: 'active',
                    isVerified: true,
                    company: { id: 'w1', name: 'Admiino', companyCode: 'ADM' },
                  },
                ],
              },
            }),
            { status: 200 },
          ),
      ) as unknown as typeof fetch,
    );
    const service = new SessionService(storage, client);
    await expect(
      service.prepareLogin({ email: ' user@example.com ', password: 'preview' }),
    ).resolves.toMatchObject({
      token: 'access-token',
    });
    expect(storage.setAccessToken).toHaveBeenCalledWith('access-token');
    expect(storage.setActiveWorkspaceId).toHaveBeenCalledWith('w1');
  });

  it('clears an expired or invalid session without starting a refresh loop', async () => {
    const storage = createStorage();
    jest.mocked(storage.getAccessToken).mockResolvedValue('expired-token');
    const client = new ApiClient(
      'https://example.com/api/v1',
      jest.fn(
        async () =>
          new Response(JSON.stringify({ status: 'error', message: 'Invalid token.' }), {
            status: 401,
          }),
      ) as unknown as typeof fetch,
    );
    await expect(new SessionService(storage, client).restoreSession()).resolves.toBeNull();
    expect(storage.clearSession).toHaveBeenCalled();
  });

  it('preserves a session for 403 and 423 restore responses', async () => {
    for (const status of [403, 423]) {
      const storage = createStorage();
      jest
        .mocked(storage.getAccessToken)
        .mockResolvedValue(`header.${btoa(JSON.stringify({ exp: 4100000000 }))}.signature`);
      const client = new ApiClient(
        'https://example.com/api/v1',
        jest.fn(
          async () =>
            new Response(JSON.stringify({ status: 'error', message: 'Denied' }), { status }),
        ) as unknown as typeof fetch,
      );
      await expect(new SessionService(storage, client).restoreSession()).resolves.not.toBeNull();
      expect(storage.clearSession).not.toHaveBeenCalled();
    }
  });

  it('removes tokens on logout', async () => {
    const storage = createStorage();
    await new SessionService(storage).logout();
    expect(storage.clearSession).toHaveBeenCalled();
  });
});
