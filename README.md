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
npx expo-doctor
```

## Environment setup

Copy `.env.example` to `.env.local` for local development. The starter screen runs in development without making backend requests; the API origin is used only when application code explicitly makes a request.

```bash
npm run validate:environment
npm run test:environment
```

Staging and production hosts are allowlisted only after verification. EAS profiles are in `eas.json`; an account owner must configure the remote EAS project and environment variables before any EAS build. No cloud builds are started by this setup.

## Development builds

Expo Go is a shared native container with a fixed set of native modules. The installed Expo Development Client is built for this app and can include its configured native modules; both use Metro for JavaScript development and refresh.

Native builds are blocked until the app owner approves the iOS bundle identifier and Android package identifier. Once approved, configure the corresponding `EXPO_IOS_BUNDLE_IDENTIFIER` or `EXPO_ANDROID_PACKAGE_IDENTIFIER` locally or in the EAS environment:

- **iOS simulator:** `npx expo run:ios --simulator "iPhone 16"` (requires Xcode and the approved identifier).
- **Android emulator/device:** start an Android emulator or connect an authorized device, then run `npx expo run:android` (requires Android tooling and the approved identifier).
- **EAS Android development build:** after an account owner links/configures the EAS project and environment, run `npx eas-cli build --profile development --platform android`. EAS builds may consume paid resources; this setup did not run one.

The current `development` EAS profile enables the development client and internal distribution. The `preview` and `production` profiles are configuration only; neither has been built or submitted.

The starter screen only verifies that the application boots. There is no backend connection, authentication, or final app identifier configured. iOS bundle and Android package identifiers remain pending decisions.

## Approved project documents

Place the approved project rules at the repository root as `AGENTS.md`.

- UX Blueprint: `docs/product/` (Markdown or Word format).
- Development Playbook: `docs/planning/` (Word format).

Do not replace an approved document when adding or updating files.

## Branching proposal

- `main`: approved releases.
- `staging`: development integration.
- `feature/*`: individual development phases.

Branches and remote changes are managed only with explicit approval.
