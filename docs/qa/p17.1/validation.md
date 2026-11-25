# Validation and outstanding checks

## Commands

Results from this P17.1 change set:

| Check                                                          | Result                                                                      |
| -------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `npm run typecheck`                                            | PASS                                                                        |
| `npm run lint`                                                 | PASS with 3 pre-existing warnings; 0 errors                                 |
| `npm run format:check`                                         | PASS                                                                        |
| `npm run validate:environment`                                 | PASS; production API configuration validated without making requests        |
| `npm run test:environment`                                     | PASS; 17/17                                                                 |
| `npm test -- --runInBand --watchman=false --testTimeout=20000` | PASS; 47 suites, 252 tests                                                  |
| `npx expo install --check` under Node 22.23.3                  | PASS; dependencies up to date                                               |
| `npx expo-doctor` under Node 22.23.3                           | NOT COMPLETED; produced no output and was stopped after bounded observation |
| `npx expo export --platform ios` under Node 22.23.3            | PASS; exported to `/tmp/admiino-p17-ios-export`                             |
| `npx expo export --platform android` under Node 22.23.3        | PASS; exported to `/tmp/admiino-p17-android-export`                         |

The shell's default Node 20.20.1 cannot parse the TypeScript Expo config for Expo CLI commands. Node 22.23.3 is installed and was used for all Expo checks and exports. The three lint warnings are the existing generated-router and Calendar hook warnings; the P17.1 suite adds no lint warnings.

Expected commands:

```bash
npm run typecheck
npm run lint
npm run format:check
npm run validate:environment
npm run test:environment
npm test -- --runInBand --watchman=false --testTimeout=20000
npx expo install --check
npx expo-doctor
```

Noninteractive iOS and Android exports are permitted. They are build checks only and do not establish native gesture quality, push delivery, deep-link association or production API behavior.

## Not run in P17.1

- Production or unapproved staging state-changing smoke tests.
- Push delivery and device registration.
- Universal/App Link association on a physical device.
- Physical iPhone/Android acceptance.
- Account deletion or ownership transfer.
- Google OAuth mobile flow.
- Simulator, emulator, `simctl`, graphical automation, EAS, Xcode or CocoaPods.

## Device/staging checklist for the product owner

- Sign in, restore session, switch workspace and sign out.
- Create/update a task and confirm status, assignee and cache consistency.
- Open Inbox from Home and return from task/project/file targets.
- Swipe task rows repeatedly while scrolling; verify actions on a real native runtime.
- Open task/project image attachments and move next/previous.
- Test notification deep links and wrong-workspace denial with approved staging data.
- Verify invite, email verification, reset-password and organisation activation links.
- Verify native push permission, delivery and unread behavior once B-02 exists.
- Confirm deletion policy and reauthentication once B-08 exists.
