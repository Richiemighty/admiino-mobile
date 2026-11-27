# Expo, EAS and GitHub setup

## Project identity

| Setting           | Value                                  |
| ----------------- | -------------------------------------- |
| Expo owner        | `admiino-pte`                          |
| Expo project name | Admiino Mobile                         |
| Expo slug         | `admiino-mobile`                       |
| Expo Project ID   | `5010e767-3661-4976-8df9-56b94281ac4d` |
| GitHub repository | `Richiemighty/admiino-mobile`          |
| Git branch        | `main`                                 |
| Source directory  | Repository root                        |

`app.config.ts` is the source of truth for the owner and `extra.eas.projectId`. The app must resolve to the values above; a different project ID must be treated as a configuration error.

## Git policy

All new Admiino Mobile work goes directly to `main` and is pushed to `origin/main`. Do not create staging or feature branches, force-push, rewrite history, or change the remote.

## EAS profiles

- `development`: development client, internal Android APK, Expo `production` environment, and explicit production API variables.
- `production`: store distribution with Expo `production` environment and explicit production API variables. It is not automatically submitted.

There is no mobile preview/staging build profile. Staging is reserved for explicitly targeted automated backend tooling.

## GitHub workflow

`.eas/workflows/build-android-development.yml` defines a manual-only Android development build using the `development` profile. It intentionally has no GitHub push trigger yet because the first successful Admiino EAS build and signing prerequisite have not been verified.

After the first successful Admiino build and signing verification, the workflow may be changed to:

```yaml
on:
  push:
    branches:
      - main
```

Do not add production builds, EAS Update, store submission, pull-request triggers, or non-`main` branch triggers to this workflow.

## Secure authentication

The other Expo account already logged into the development machine must remain untouched. Do not run `expo login`, `expo logout`, `eas login`, or `eas logout`.

Use an Admiino-scoped token only through the process environment. Never print, commit, document, or place it in Expo public variables:

```bash
export EXPO_TOKEN='<supplied securely in your shell or secret manager>'
npx eas-cli whoami
npx eas-cli project:info
```

The commands must report the `admiino-pte` account and Project ID `5010e767-3661-4976-8df9-56b94281ac4d`. If `EXPO_TOKEN` is unavailable or reports another account/project, stop authenticated operations.

## First Android development build

After securely supplying the Admiino token and confirming project ownership:

```bash
EXPO_TOKEN="$EXPO_TOKEN" npx eas-cli build --platform android --profile development
```

This is the prerequisite for GitHub-triggered builds and may initialise Android signing credentials. Confirm the build succeeds in the Expo dashboard and that the Android credentials belong to this Admiino project. Do not use credentials from another application.

The resulting internal APK can be downloaded from the EAS build details page and installed on an approved Android test device. This repository does not claim a successful build until a build record exists.

Once the first build succeeds, validate the workflow and run it manually against the pushed `main` commit:

```bash
EXPO_TOKEN="$EXPO_TOKEN" npx eas-cli workflow:validate .eas/workflows/build-android-development.yml --non-interactive
EXPO_TOKEN="$EXPO_TOKEN" npx eas-cli workflow:run .eas/workflows/build-android-development.yml \
  --git-branch main \
  --git-commit-hash "$(git rev-parse main)"
```

Only after that succeeds should the `main` push trigger be enabled.

## iOS later

iOS signing is not configured or claimed here. It requires approved Apple Developer access, bundle identifier ownership, certificates/profiles and (for physical-device development builds) registered devices. Configure and verify iOS credentials separately before creating an iOS build.

## Environment and security requirements

- Development may run without backend connectivity, or use only a local/approved development host.
- Normal development and both EAS build profiles require the validated production API origin `https://api.admiino.com`.
- Automated backend tests must use `STAGE_API=https://admiino-backend-staging.onrender.com` supplied outside the mobile runtime configuration and must reject production origins before writes.
- `EXPO_PUBLIC_*` values are public build-time values only; do not put tokens, JWTs, OAuth secrets or signing material there.
- `.env.local`, credentials and signing files remain untracked.
- No staging database migration or write was performed. Backend test tooling must use the existing isolated `STAGINGDB_URL` only after independently confirming its target.

## Current verification state

- Project identity and the guaranteed Android package fallback are configured in `app.config.ts`.
- Development and production EAS profiles explicitly use the production API; the unused preview profile was removed.
- Manual Android development workflow is prepared.
- Expo account ownership, GitHub linkage, Android signing and successful cloud build are **not yet verified** because `EXPO_TOKEN` was not supplied.
- The terminal's existing Expo account was not logged out, changed, or used to initialise this project.
