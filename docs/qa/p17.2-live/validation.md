# Validation

## Mobile commands

| Command                                                        | Result                                                                                              |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `npm run validate:environment`                                 | PASS; reports production host `api.admiino.com`; no live writes made                                |
| `npm run test:environment`                                     | PASS; 17/17                                                                                         |
| `npm run typecheck`                                            | PASS                                                                                                |
| `npm run lint`                                                 | PASS; 0 errors, 3 pre-existing warnings                                                             |
| `npm run format:check`                                         | PASS                                                                                                |
| `npm test -- --runInBand --watchman=false --testTimeout=20000` | FAIL; 47 suites/256 tests passed, 1 suite/1 test failed (`home/screens.test.tsx`, expected `Today`) |

The Jest failure is outside the P17.2 permission scope and was not changed. The run also emitted existing React test-environment `act()` warnings.

## Backend-local commands

- `node test/phase5a.test.js`: **PASS**, 13/13.
- `node test/task.test.js`: **PARTIAL**; 55 controller/route checks passed, 2 task visibility checks failed because local Postgres at `127.0.0.1:55434` was unavailable.
- `node test/websocketTaskAuthorization.test.js`: **PARTIAL**; 3/5 passed, 2 setup cases blocked by backend TLS environment validation (`DATABASE_TLS_DISABLE` is not permitted for the configured non-loopback database).
- `node test/taskProgressConsolidation.test.js`: **BLOCKED** by the same backend TLS environment validation.
- `node test/taskNotificationLifecycle.test.js`: **BLOCKED** by the same backend TLS environment validation.

## Not run

Expo dependency compatibility, Expo Doctor and iOS/Android exports were not run in this continuation because the available Node runtime was 20.20.1 at command time, while the requested Expo checks require Node 22.23.3. No simulator, emulator or EAS build was launched.

## Live/device

No staging API requests, state changes, physical-device checks, simulator checks or production writes were performed.
