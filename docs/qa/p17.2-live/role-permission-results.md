# Role-permission results

| Area/case                                        | Expected/observed evidence                                                                                                              | Status                                  |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Owner/admin/manager/member effective permissions | Mobile fixtures and permission matrix tests preserve server-supplied effective permissions; role names are not used as client authority | PASS (mocked automated/source)          |
| Guest/external viewer and inactive membership    | Resource access is required; removed/inactive membership is denied by the reviewed backend policy                                       | PASS (source/mobile tests)              |
| Explicit grant/restriction                       | Effective override shape and false restrictions are covered by existing permission tests                                                | PASS (mocked automated)                 |
| `create_tasks` vs `create_project_tasks`         | Mobile project/task permission helpers keep the capabilities distinct; backend remains authoritative                                    | PASS (source/mobile tests)              |
| Tasks/projects/teams/files/conversations         | Mobile controls and error handling are covered by existing suites; backend access is rechecked by resource services                     | PASS (source/mobile tests)              |
| Workspace approvals                              | Category visibility and rejection-warning behavior pass mobile tests; backend state-changing decisions were not executed live           | PASS (mocked automated); NOT RUN (live) |
| Actual role permutations and HTTP responses      | No approved accounts or staging records                                                                                                 | BLOCKED                                 |

The hidden-button behavior is not treated as security evidence. No live API authorization result is claimed.
