# Environment Configuration Matrix

This matrix defines the app-side environment names and the backend hosts observed in the backend source. It does not certify DNS, service availability, production cutover, or API contracts. No backend requests were made while preparing this matrix.

`EXPO_PUBLIC_*` values are public build-time values. They must never contain tokens, passwords, signing material, or other secrets. The app derives its WebSocket origin from the validated API origin; no separate WebSocket variable is accepted.

## Development

- **Purpose:** Local development, Expo Go, simulators, and development builds.
- **Environment name:** `development`.
- **API base URL:** Optional for the setup screen. When enabled, local development uses an explicit origin such as `http://localhost:5000`, matching the backend's local default in `admiino-backend/src/config/publicUrls.js`. Remote development hosts require a separate allowlist approval.
- **WebSocket URL:** Derived from the validated API origin (`http` → `ws`, `https` → `wss`). No origin means no WebSocket configuration.
- **App display name:** `Admiino Mobile (Development)` (proposed environment label).
- **App slug:** `admiino-mobile` (shared across profiles).
- **App scheme:** `admiinomobile-dev` (proposed; owner approval pending).
- **iOS bundle identifier:** `PENDING VERIFICATION`.
- **Android package identifier:** `PENDING VERIFICATION`.
- **EAS build profile:** `development`.
- **EAS variable environment:** `development`.
- **Permitted data classification:** Synthetic data or explicitly authorized local/development data; never production data.
- **Configuration owner:** Mobile maintainer for app configuration; backend owner for any remote development host.
- **Verification status:** Local URL policy and no-backend setup mode are covered by tests. Backend default port is source-confirmed; no service was started or contacted.

## Staging / Preview

- **Purpose:** Integration, acceptance, and pre-release testing.
- **Environment name:** `staging` in the app; EAS calls its corresponding variable environment `preview`.
- **API base URL:** Backend source declares `https://admiino-backend-staging.onrender.com` in `src/config/publicUrls.js`. It is a source-identified candidate, not runtime-verified here. The app allowlist is intentionally empty until the backend owner confirms the service and authorizes it.
- **WebSocket URL:** Derived from the verified staging API origin (`wss` required).
- **App display name:** `Admiino Mobile (Staging)` (proposed environment label).
- **App slug:** `admiino-mobile` (shared across profiles).
- **App scheme:** `admiinomobile-staging` (proposed; owner approval pending).
- **iOS bundle identifier:** `PENDING VERIFICATION`.
- **Android package identifier:** `PENDING VERIFICATION`.
- **EAS build profile:** `preview`.
- **EAS variable environment:** `preview` (not an EAS environment named `staging`).
- **Permitted data classification:** Synthetic or explicitly authorized staging test data only.
- **Configuration owner:** Backend owner to verify the staging service and test-data policy; mobile/EAS owner for app identity and EAS variables.
- **Verification status:** Host is present in backend source, but service reachability and data authorization were not verified. Preview builds remain blocked until host approval and identifiers are supplied.

## Production

- **Purpose:** Eventual public iOS and Android releases after explicit release approval.
- **Environment name:** `production`.
- **API base URL:** `https://api.admiino.com` is the verified canonical production API origin. `https://admiino-backend.onrender.com` is retired and rejected by the mobile validator.
- **WebSocket URL:** Derived from an explicitly approved production API origin (`wss` required).
- **App display name:** `Admiino Mobile`.
- **App slug:** `admiino-mobile` (shared across profiles).
- **App scheme:** `admiinomobile` (existing scaffold value; final approval pending).
- **iOS bundle identifier:** `PENDING VERIFICATION`.
- **Android package identifier:** `PENDING VERIFICATION`.
- **EAS build profile:** `production`.
- **EAS variable environment:** `production`.
- **Permitted data classification:** Approved production data only, under production access and privacy controls.
- **Configuration owner:** Backend owner for the live production origin; product/app owner for identifiers; EAS account owner for production variables and release authorization.
- **Verification status:** The production health endpoint has been checked read-only, and the project owner confirmed successful real sign-in through Expo Go. P10 automated tests use mocks and do not send authentication or state-changing requests to production.

## Enforcement and setup

- `EXPO_PUBLIC_APP_ENV` is required and must be `development`, `staging`, or `production`. `NODE_ENV` is not used to select the app environment.
- `EXPO_PUBLIC_API_BASE_URL` is an origin only: no path, query, fragment, username, or password. Staging/production require HTTPS and a host allowlist entry. Development HTTP is restricted to loopback.
- Known production candidates and hostnames with `prod`/`production` labels are rejected in development and staging. No environment silently falls back to production.
- Staging has no approved API host. Production accepts only `api.admiino.com`; unit-test fixtures use reserved `.test` domains.
- `EXPO_PUBLIC_API_REQUIRED=true` makes a development configuration fail when no API URL is set. Staging and production always require a URL.
- Create `.env.local` from `.env.example` for local development. Do not create `.env.staging`; Expo SDK 58 does not load custom `.env` mode names. EAS environment variables are used for remote preview/production builds.
- The `eas.json` profiles bind `development` → EAS `development`, `preview` → EAS `preview` (app environment `staging`), and `production` → EAS `production`. Only non-secret environment labels are checked into that file.
- An EAS account owner must link/configure the EAS project and set the approved public API origins and app identifiers in the corresponding EAS environments. No account login, remote project configuration, cloud build, or submission is performed by this task.

Backend source reference: [`publicUrls.js`](../../../admiino-backend/src/config/publicUrls.js). Expo references: [Environment variables](https://docs.expo.dev/guides/environment-variables/), [EAS environment variables](https://docs.expo.dev/eas/environment-variables/), [EAS build configuration](https://docs.expo.dev/build/eas-json/), and [Expo SDK 58 app config](https://docs.expo.dev/versions/v58.0.0/config/app/).
