# Blockers

| Blocker                                            | Responsible component                | Exact next action                                                                                                               | Status  |
| -------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ------- |
| No approved staging URL/accounts/synthetic records | Release/QA environment               | Provision non-production workspace and role accounts with safe reset/cleanup, then run the HTTP matrix and B-10 cases           | BLOCKED |
| B-10 live reviewer proof absent                    | QA/backend                           | Replay submit, complete, reopen, restricted and repeated transitions as each approved actor; capture status and persisted state | BLOCKED |
| `canCollaborate` omitted from task detail          | Backend task controller/API contract | Approve and implement response-field change plus backend/mobile regression tests; do not infer access client-side               | BLOCKED |
| Backend local DB/TLS setup                         | Backend development environment      | Provide loopback test Postgres or approved test configuration; rerun blocked local suites                                       | BLOCKED |
| One existing mobile Jest failure                   | Mobile/P11                           | Investigate date-sensitive Home fixture/assertion separately; rerun full suite                                                  | FAIL    |
| Expo checks under required Node 22                 | Mobile/release environment           | Re-run dependency check, Doctor and non-interactive exports under Node 22.23.3                                                  | NOT RUN |

P17.2 full acceptance is not met until the first two blockers are cleared. This verification did not begin P17.3.
