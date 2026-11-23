import { getAppEnvironment } from '../config/env';

export function getApiBaseUrl(): string | null {
  const environment = getAppEnvironment();
  if (!environment.apiBaseUrl) return null;
  return `${environment.apiBaseUrl}/api/v1`;
}

export function getHealthUrl(): string | null {
  const environment = getAppEnvironment();
  return environment.apiBaseUrl ? `${environment.apiBaseUrl}/health` : null;
}
