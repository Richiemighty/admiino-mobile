import type { ApiErrorPayload } from './types';

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly payload?: ApiErrorPayload;

  constructor(message: string, status = 0, payload?: ApiErrorPayload) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = payload?.code;
    this.payload = payload;
  }
}

export class ApiTimeoutError extends ApiError {
  constructor() {
    super('The request timed out. Please try again.', 408);
    this.name = 'ApiTimeoutError';
  }
}

export class ApiNetworkError extends ApiError {
  constructor() {
    super('Unable to reach Admiino. Check your connection and try again.', 0);
    this.name = 'ApiNetworkError';
  }
}
