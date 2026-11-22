import { jest } from '@jest/globals';

export interface MockJsonResponse<T> {
  ok: boolean;
  status: number;
  json: () => Promise<T>;
  text: () => Promise<string>;
}

export function createJsonResponse<T>(body: T, status = 200): MockJsonResponse<T> {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

export function mockFetchJson<T>(body: T, status = 200): MockJsonResponse<T> {
  const response = createJsonResponse(body, status);
  const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
  fetchMock.mockResolvedValue(response as Response);
  return response;
}
