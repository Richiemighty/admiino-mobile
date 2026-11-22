export const APP_ENVIRONMENTS = ['development', 'staging', 'production'] as const;

export type AppEnvironmentName = (typeof APP_ENVIRONMENTS)[number];

export interface EnvironmentInput {
  appEnv?: string;
  apiBaseUrl?: string;
}

export interface EnvironmentValidationOptions {
  backendConnectivityRequired?: boolean;
  approvedApiHosts?: Partial<Record<AppEnvironmentName, readonly string[]>>;
}

export interface ValidatedEnvironment {
  appEnv: AppEnvironmentName;
  apiBaseUrl: string | null;
  websocketUrl: string | null;
}

export type AppEnvironmentOptions = EnvironmentValidationOptions;

export class EnvironmentConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvironmentConfigError';
  }
}

export const PROTECTED_PRODUCTION_API_HOSTS = [
  'admiino-backend.onrender.com',
  'api.admiino.com',
] as const;

const APPROVED_API_HOSTS: Record<AppEnvironmentName, readonly string[]> = {
  development: [],
  staging: [],
  production: [],
};

function isAppEnvironment(value: string): value is AppEnvironmentName {
  return APP_ENVIRONMENTS.includes(value as AppEnvironmentName);
}

function normalizedHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/\.$/, '');
}

function normalizedHost(url: URL): string {
  return url.host.toLowerCase().replace(/\.$/, '');
}

function isLoopbackHost(hostname: string): boolean {
  const host = normalizedHostname(hostname);
  return host === 'localhost' || host === '[::1]' || /^127(?:\.\d{1,3}){3}$/.test(host);
}

function isProtectedProductionHost(hostname: string): boolean {
  const host = normalizedHostname(hostname);
  return (
    PROTECTED_PRODUCTION_API_HOSTS.some(
      (candidate) => host === candidate || host.endsWith(`.${candidate}`),
    ) || /(^|[.-])(prod|production)([.-]|$)/.test(host)
  );
}

function parseApiUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new EnvironmentConfigError('EXPO_PUBLIC_API_BASE_URL must be an absolute URL.');
    }
    throw error;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new EnvironmentConfigError('EXPO_PUBLIC_API_BASE_URL must use HTTP or HTTPS.');
  }
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new EnvironmentConfigError(
      'EXPO_PUBLIC_API_BASE_URL must be an origin only, without credentials, path, query, or fragment.',
    );
  }

  return url;
}

function isApprovedHost(url: URL, hosts: readonly string[]): boolean {
  const host = normalizedHost(url);
  return hosts.some((approvedHost) => host === approvedHost.toLowerCase().replace(/\.$/, ''));
}

export function deriveWebSocketUrl(apiBaseUrl: string): string {
  const apiUrl = parseApiUrl(apiBaseUrl);
  const protocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${apiUrl.host}`;
}

export function validateWebSocketUrl(
  apiBaseUrl: string,
  websocketUrl: string,
  appEnv: AppEnvironmentName,
): string {
  const apiUrl = parseApiUrl(apiBaseUrl);
  let socketUrl: URL;
  try {
    socketUrl = new URL(websocketUrl);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new EnvironmentConfigError('The derived WebSocket URL is invalid.');
    }
    throw error;
  }

  const expectedProtocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  if (
    socketUrl.protocol !== expectedProtocol ||
    normalizedHost(socketUrl) !== normalizedHost(apiUrl) ||
    socketUrl.username ||
    socketUrl.password ||
    socketUrl.pathname !== '/' ||
    socketUrl.search ||
    socketUrl.hash
  ) {
    throw new EnvironmentConfigError(
      'The WebSocket URL must use the same host and transport security as the API environment.',
    );
  }
  if (appEnv !== 'development' && socketUrl.protocol !== 'wss:') {
    throw new EnvironmentConfigError('Staging and production WebSockets must use WSS.');
  }
  if (appEnv !== 'production' && isProtectedProductionHost(socketUrl.hostname)) {
    throw new EnvironmentConfigError(
      `The WebSocket URL cannot target a protected production host in ${appEnv}.`,
    );
  }

  return `${socketUrl.protocol}//${socketUrl.host}`;
}

export function validateEnvironment(
  input: EnvironmentInput,
  options: EnvironmentValidationOptions = {},
): ValidatedEnvironment {
  const appEnvValue = input.appEnv?.trim();
  if (!appEnvValue || !isAppEnvironment(appEnvValue)) {
    throw new EnvironmentConfigError(
      `EXPO_PUBLIC_APP_ENV must be one of: ${APP_ENVIRONMENTS.join(', ')}.`,
    );
  }
  const appEnv = appEnvValue;
  const apiBaseUrlValue = input.apiBaseUrl?.trim();
  const required = options.backendConnectivityRequired ?? appEnv !== 'development';

  if (!apiBaseUrlValue) {
    if (required) {
      throw new EnvironmentConfigError(
        'EXPO_PUBLIC_API_BASE_URL is required when backend connectivity is enabled.',
      );
    }
    return { appEnv, apiBaseUrl: null, websocketUrl: null };
  }

  const apiUrl = parseApiUrl(apiBaseUrlValue);
  if (appEnv !== 'production' && isProtectedProductionHost(apiUrl.hostname)) {
    throw new EnvironmentConfigError(
      `EXPO_PUBLIC_API_BASE_URL cannot target a protected production host in ${appEnv}.`,
    );
  }

  if (appEnv === 'development') {
    if (apiUrl.protocol === 'http:' && !isLoopbackHost(apiUrl.hostname)) {
      throw new EnvironmentConfigError(
        'Development HTTP URLs are limited to localhost and loopback addresses.',
      );
    }
    if (
      !isLoopbackHost(apiUrl.hostname) &&
      !isApprovedHost(apiUrl, options.approvedApiHosts?.development ?? APPROVED_API_HOSTS.development)
    ) {
      throw new EnvironmentConfigError(
        'The development API host is not allowlisted; use a local endpoint or an approved development host.',
      );
    }
  } else {
    if (apiUrl.protocol !== 'https:') {
      throw new EnvironmentConfigError(`${appEnv} API URLs must use HTTPS.`);
    }
    if (
      !isApprovedHost(apiUrl, options.approvedApiHosts?.[appEnv] ?? APPROVED_API_HOSTS[appEnv])
    ) {
      throw new EnvironmentConfigError(
        `The ${appEnv} API host is not allowlisted; host verification and approval are required.`,
      );
    }
  }

  const apiBaseUrl = apiUrl.origin;
  const websocketUrl = validateWebSocketUrl(
    apiBaseUrl,
    deriveWebSocketUrl(apiBaseUrl),
    appEnv,
  );

  return { appEnv, apiBaseUrl, websocketUrl };
}

function backendConnectivityRequired(value: string | undefined): boolean {
  if (!value || value === 'false') return false;
  if (value === 'true') return true;
  throw new EnvironmentConfigError('EXPO_PUBLIC_API_REQUIRED must be either true or false.');
}

export function getAppEnvironment(
  options: AppEnvironmentOptions = {},
): ValidatedEnvironment {
  return validateEnvironment(
    {
      appEnv: process.env.EXPO_PUBLIC_APP_ENV,
      apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
    },
    {
      ...options,
      backendConnectivityRequired:
        options.backendConnectivityRequired ??
        backendConnectivityRequired(process.env.EXPO_PUBLIC_API_REQUIRED),
    },
  );
}
