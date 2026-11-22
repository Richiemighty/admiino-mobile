import {
  EnvironmentConfigError,
  getAppEnvironment,
} from '../src/config/env.ts';

try {
  const environment = getAppEnvironment({
    backendConnectivityRequired: process.argv.includes('--require-api'),
  });

  console.log(`Environment valid: ${environment.appEnv}`);
  console.log(
    environment.apiBaseUrl
      ? 'API origin: configured and validated'
      : 'API origin: not configured; backend connectivity is disabled',
  );
  console.log(
    environment.websocketUrl
      ? 'WebSocket origin: derived from the validated API origin'
      : 'WebSocket origin: not configured',
  );
} catch (error) {
  if (!(error instanceof EnvironmentConfigError)) throw error;
  console.error(`Environment validation failed: ${error.message}`);
  process.exitCode = 1;
}
