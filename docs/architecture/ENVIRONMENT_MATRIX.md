# Environment Configuration Matrix

This matrix defines the app-side environment names and the backend hosts observed in the backend source. It does not certify DNS, service availability, production cutover, or API contracts. No backend requests were made while preparing this matrix.

`EXPO_PUBLIC_*` values are public build-time values. They must never contain tokens, passwords, signing material, or other secrets. The app derives its WebSocket origin from the validated API origin; no separate WebSocket variable is accepted.

## Development

- **Purpose:** Local development, Expo Go, simulators, and development builds.
- **Environment name:** `production` for normal local mobile development and the development-client build.
- **API base URL:** `https://api.admiino.com`.
- **WebSocket URL:** Derived from the validated API origin (`http` → `ws`, `https` → `wss`). No origin means no WebSocket configuration.
- **App display name:** `Admiino Mobile (Development)` (proposed environment label).
- **App slug:** `admiino-mobile` (shared across profiles).
- **App scheme:** `admiinomobile-dev` (proposed; owner approval pending).
- **iOS bundle identifier:** `PENDING VERIFICATION`.
- **Android package identifier:** `com.admiino.mobile`.
- **EAS build profile:** `development`.
- **EAS variable environment:** `production`.
- **Permitted data classification:** Production data under the approved production access controls.
- **Configuration owner:** Mobile maintainer for app configuration; backend owner for any remote development host.
- **Verification status:** Local URL policy and no-backend setup mode are covered by tests. Backend default port is source-confirmed; no service was started or contacted.

## Agent-only staging tests

- **Purpose:** Backend integration tests only; no mobile build profile.
- **API base URL:** `https://admiino-backend-staging.onrender.com`, selected only through an explicit `STAGE_API` test-tool variable.
- **Database:** Existing backend `STAGINGDB_URL`; never copied into this repository, Expo, EAS or mobile JavaScript.
- **Permitted data classification:** Synthetic staging data only.
- **Verification status:** Test tooling must independently reject production origins and confirm database isolation before any write or migration.

## Production

- **Purpose:** Eventual public iOS and Android releases after explicit release approval.
- **Environment name:** `production`.
- **API base URL:** `https://api.admiino.com` is the verified canonical production API origin. `https://admiino-backend.onrender.com` is retired and rejected by the mobile validator.
- **WebSocket URL:** Derived from an explicitly approved production API origin (`wss` required).
- **App display name:** `Admiino Mobile`.
- **App slug:** `admiino-mobile` (shared across profiles).
- **App scheme:** `admiinomobile` (existing scaffold value; final approval pending).
- **iOS bundle identifier:** `PENDING VERIFICATION`.
- **Android package identifier:** `com.admiino.mobile`.
- **EAS build profile:** `production`.
- **EAS variable environment:** `production`.
- **Permitted data classification:** Approved production data only, under production access and privacy controls.
- **Configuration owner:** Backend owner for the live production origin; product/app owner for identifiers; EAS account owner for production variables and release authorization.
- **Verification status:** The production health endpoint has been checked read-only, and the project owner confirmed successful real sign-in through Expo Go. P10 automated tests use mocks and do not send authentication or state-changing requests to production.

## Enforcement and setup

- `EXPO_PUBLIC_APP_ENV` is required and must be `development`, `staging`, or `production`. `NODE_ENV` is not used to select the app environment.
- `EXPO_PUBLIC_API_BASE_URL` is an origin only: no path, query, fragment, username, or password. Staging/production require HTTPS and a host allowlist entry. Development HTTP is restricted to loopback.
- Production accepts only `api.admiino.com`; unit-test fixtures use reserved `.test` domains. The normal mobile runtime does not silently fall back to staging.
- `EXPO_PUBLIC_API_REQUIRED=true` makes a development configuration fail when no API URL is set. Staging and production always require a URL.
- Create `.env.local` from `.env.example` for normal production-backed mobile development. Keep `STAGE_API` outside the mobile runtime configuration and use it only in backend test tooling.
- The `eas.json` profiles bind the development client and production release to EAS `production`, with explicit `https://api.admiino.com` public variables. Only non-secret values are checked into that file.
- An EAS account owner must link/configure the EAS project and set the approved public API origins and app identifiers in the corresponding EAS environments. No account login, remote project configuration, cloud build, or submission is performed by this task.

Backend source reference: [`publicUrls.js`](../../../admiino-backend/src/config/publicUrls.js). Expo references: [Environment variables](https://docs.expo.dev/guides/environment-variables/), [EAS environment variables](https://docs.expo.dev/eas/environment-variables/), [EAS build configuration](https://docs.expo.dev/build/eas-json/), and [Expo SDK 58 app config](https://docs.expo.dev/versions/v58.0.0/config/app/).
