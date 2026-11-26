# Workspace security results

| Case                                               | Evidence                                                                                        | Status                                     |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Workspace switch clears/reloads permission context | AuthProvider tests clear prior permissions and load the selected workspace                      | PASS (mocked automated)                    |
| 401/403/404/423 handling                           | Protected-route, task, workspace and cache tests preserve safe error boundaries                 | PASS (mocked automated/source)             |
| Removal from workspace/team                        | Backend source requires active membership; live revocation was not performed                    | PASS (source); NOT RUN (live)              |
| Revoking view-all/private-project access           | Effective permission/resource access logic is covered; no live mutation or stale-session replay | PASS (source/mobile tests); BLOCKED (live) |
| Cached screen/direct link after revocation         | Workspace-scoped cache and route guards are covered; device/deep-link replay not run            | PASS (automated); NOT RUN (device/live)    |
| Cross-workspace isolation                          | Mobile parser/cache tests reject mismatched workspace data; backend source scopes access        | PASS (source/mobile tests); NOT RUN (live) |

No restricted data was accessed during this verification.
