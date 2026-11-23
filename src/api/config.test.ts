import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { ApiClient } from './client';
import { getApiBaseUrl, getHealthUrl } from './config';

const originalEnvironment = {
  appEnv: process.env.EXPO_PUBLIC_APP_ENV,
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
  apiRequired: process.env.EXPO_PUBLIC_API_REQUIRED,
};

afterEach(() => {
  jest.restoreAllMocks();
  for (const [key, value] of Object.entries({
    EXPO_PUBLIC_APP_ENV: originalEnvironment.appEnv,
    EXPO_PUBLIC_API_BASE_URL: originalEnvironment.apiBaseUrl,
    EXPO_PUBLIC_API_REQUIRED: originalEnvironment.apiRequired,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('production API configuration', () => {
  it('uses the verified API origin, health route, and /api/v1 login prefix', async () => {
    process.env.EXPO_PUBLIC_APP_ENV = 'production';
    process.env.EXPO_PUBLIC_API_BASE_URL = 'https://api.admiino.com';
    process.env.EXPO_PUBLIC_API_REQUIRED = 'true';
    const fetchMock = jest.fn(
      async (_input: string | URL | Request) =>
        new Response(JSON.stringify({ status: 'success' }), { status: 200 }),
    );

    expect(getApiBaseUrl()).toBe('https://api.admiino.com/api/v1');
    expect(getHealthUrl()).toBe('https://api.admiino.com/health');
    await new ApiClient(getApiBaseUrl(), fetchMock as unknown as typeof fetch).post('/auth/login', {
      email: 'user@example.com',
      password: 'test-password',
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.admiino.com/api/v1/auth/login');
  });
});
