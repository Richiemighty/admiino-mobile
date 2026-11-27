# Admiino Mobile

Expo, React Native, TypeScript, and Expo Router starter for iOS and Android.

## Run locally

```bash
npm install
npm start
```

Use the Expo CLI to open the app on a connected device, simulator, or emulator. The current entry route is `app/index.tsx`; shared code belongs in `src/`.

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npm run test:environment
npx expo-doctor
```

## Code quality and tests

TypeScript strict mode and unused-symbol checks are enabled. ESLint uses the Expo flat configuration, reports unused imports/variables as errors, and sorts imports. Prettier uses single quotes, semicolons, trailing commas, and a 100-character print width; approved product documents are intentionally excluded from automatic formatting.

Use `npm test` for Jest/React Native Testing Library component tests, `npm run test:environment` for the P03 environment validator suite, and `npm run format:check` before opening a PR. Tests mock navigation, native boundaries, secure storage, and networking; they must not contact a backend. Use `src/test/fixtures/network.ts` to return synthetic JSON responses through the reset `global.fetch` mock. Future auth, permission, workspace, task, and notification fixtures must follow approved response contracts and use synthetic IDs/data.

## Environment setup

Copy `.env.example` to `.env.local` for local development. The starter screen runs in development without making backend requests; the API origin is used only when application code explicitly makes a request.

```bash
npm run validate:environment
npm run test:environment
```

Normal local development and the Android development build use the production API at `https://api.admiino.com`. EAS profiles are in `eas.json`; the development profile is a development client/APK build type with production runtime configuration. Automated backend tests must use their explicitly supplied staging target, never the mobile runtime configuration.

## Development builds

Expo Go is a shared native container with a fixed set of native modules. The installed Expo Development Client is built for this app and can include its configured native modules; both use Metro for JavaScript development and refresh.

The Android package is `com.admiino.mobile`. The iOS bundle identifier remains pending owner approval. Configure only the iOS identifier when approved:

- **iOS simulator:** `npx expo run:ios --simulator "iPhone 16"` (requires Xcode and the approved identifier).
- **Android emulator/device:** start an Android emulator or connect an authorized device, then run `npx expo run:android` (uses `com.admiino.mobile`).
- **EAS Android development build:** after Admiino token authentication and Android signing are available, run `npx eas-cli build --profile development --platform android`.

The current `development` EAS profile enables the development client, internal distribution and production API runtime. The `production` profile remains a store-distribution configuration and is not automatically submitted.

The starter screen and automated suites use mocks where applicable. Production API connectivity is configured for normal mobile startup; iOS bundle identity remains pending approval.

## Approved project documents

Place the approved project rules at the repository root as `AGENTS.md`.

- UX Blueprint: `docs/product/` (Markdown or Word format).
- Development Playbook: `docs/planning/` (Word format).

Do not replace an approved document when adding or updating files.

## Branching policy

All approved Admiino Mobile work goes directly to `main`. Do not create or use staging or feature branches for this repository.
