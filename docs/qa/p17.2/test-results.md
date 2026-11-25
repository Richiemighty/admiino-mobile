# P17.2 test results

Added:

- `src/test/permissionFixtures.ts` — reusable role/effective-permission/task-access fixtures for owner, admin, manager, member, guest and external-viewer cases.
- `src/features/permissions/p17.2.permissionMatrix.test.ts` — effective permission, task swipe action, project governance, removed membership and protected-route regression tests.

Existing suites reused as evidence include `AuthenticatedRoute`, `AuthProvider`, task service/cache/swipe/screens, project permissions/screens, Inbox/Approvals, workspace screens, file contracts and server-cache isolation tests.

Final validation results:

| Check                                                          | Result                                      |
| -------------------------------------------------------------- | ------------------------------------------- |
| `npm run typecheck`                                            | PASS                                        |
| `npm run lint`                                                 | PASS with 3 pre-existing warnings; 0 errors |
| `npm run format:check`                                         | PASS                                        |
| `npm run validate:environment`                                 | PASS                                        |
| `npm run test:environment`                                     | PASS; 17/17                                 |
| `npm test -- --runInBand --watchman=false --testTimeout=20000` | PASS; 48 suites, 257 tests                  |
| `npx expo install --check` under Node 22.23.3                  | PASS; dependencies up to date               |
| `npx expo-doctor` under Node 22.23.3                           | PASS; 20/20 checks                          |
| `npx expo export --platform ios` under Node 22.23.3            | PASS                                        |
| `npx expo export --platform android` under Node 22.23.3        | PASS                                        |

Tests use deterministic fixtures and do not write production data. The three lint warnings are the existing generated-router and Calendar hook warnings; no new lint warnings were introduced.
