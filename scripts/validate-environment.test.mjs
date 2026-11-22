import assert from 'node:assert/strict';
import test from 'node:test';

import { validateEnvironment, validateWebSocketUrl } from '../src/config/env.ts';

test('accepts a local development API origin', () => {
  assert.deepEqual(
    validateEnvironment({
      appEnv: 'development',
      apiBaseUrl: 'http://localhost:5000',
    }),
    {
      appEnv: 'development',
      apiBaseUrl: 'http://localhost:5000',
      websocketUrl: 'ws://localhost:5000',
    },
  );
});

test('allows the setup screen to run in explicit development mode without a backend', () => {
  assert.deepEqual(validateEnvironment({ appEnv: 'development' }), {
    appEnv: 'development',
    apiBaseUrl: null,
    websocketUrl: null,
  });
});

test('accepts a staging fixture only when its host is explicitly allowlisted', () => {
  assert.equal(
    validateEnvironment(
      { appEnv: 'staging', apiBaseUrl: 'https://staging-api.example.test' },
      { approvedApiHosts: { staging: ['staging-api.example.test'] } },
    ).websocketUrl,
    'wss://staging-api.example.test',
  );
});

test('accepts a production fixture only when its host is explicitly approved', () => {
  assert.equal(
    validateEnvironment(
      { appEnv: 'production', apiBaseUrl: 'https://api.production.example.test' },
      { approvedApiHosts: { production: ['api.production.example.test'] } },
    ).apiBaseUrl,
    'https://api.production.example.test',
  );
});

test('rejects a missing API URL when connectivity is required', () => {
  assert.throws(
    () => validateEnvironment({ appEnv: 'development' }, { backendConnectivityRequired: true }),
    /EXPO_PUBLIC_API_BASE_URL is required/,
  );
});

test('rejects a malformed API URL', () => {
  assert.throws(
    () => validateEnvironment({ appEnv: 'development', apiBaseUrl: 'not-a-url' }),
    /must be an absolute URL/,
  );
});

test('rejects development targeting a protected production candidate', () => {
  assert.throws(
    () =>
      validateEnvironment({
        appEnv: 'development',
        apiBaseUrl: 'https://api.admiino.com',
      }),
    /protected production host/,
  );
});

test('rejects staging targeting a protected production candidate', () => {
  assert.throws(
    () =>
      validateEnvironment(
        { appEnv: 'staging', apiBaseUrl: 'https://api.admiino.com' },
        { approvedApiHosts: { staging: ['api.admiino.com'] } },
      ),
    /protected production host/,
  );
});

test('rejects suspected production hostnames outside production', () => {
  assert.throws(
    () =>
      validateEnvironment(
        {
          appEnv: 'staging',
          apiBaseUrl: 'https://api.production.example.test',
        },
        { approvedApiHosts: { staging: ['api.production.example.test'] } },
      ),
    /protected production host/,
  );
});

test('keeps the source-identified staging candidate blocked until approved', () => {
  assert.throws(
    () =>
      validateEnvironment({
        appEnv: 'staging',
        apiBaseUrl: 'https://admiino-backend-staging.onrender.com',
      }),
    /host is not allowlisted/,
  );
});

test('keeps the production candidate blocked until cutover is verified', () => {
  assert.throws(
    () =>
      validateEnvironment({
        appEnv: 'production',
        apiBaseUrl: 'https://api.admiino.com',
      }),
    /host is not allowlisted/,
  );
});

test('rejects insecure staging API URLs', () => {
  assert.throws(
    () =>
      validateEnvironment(
        { appEnv: 'staging', apiBaseUrl: 'http://staging-api.example.test' },
        { approvedApiHosts: { staging: ['staging-api.example.test'] } },
      ),
    /staging API URLs must use HTTPS/,
  );
});

test('rejects an invalid environment name', () => {
  assert.throws(
    () => validateEnvironment({ appEnv: 'test', apiBaseUrl: 'http://localhost:5000' }),
    /EXPO_PUBLIC_APP_ENV must be one of/,
  );
});

test('rejects a WebSocket URL for a different, production environment', () => {
  assert.throws(
    () =>
      validateWebSocketUrl('https://staging-api.example.test', 'wss://api.admiino.com', 'staging'),
    /same host and transport security/,
  );
});
