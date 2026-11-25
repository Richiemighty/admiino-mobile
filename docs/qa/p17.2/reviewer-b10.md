# B-10 reviewer and approval enforcement

## Source finding

Backend task status enforcement is present in `src/controllers/taskController.js` and the associated task access/team helpers. For team tasks, the backend checks team lead, creator, manager-plus and explicit assignment, then prevents an assigned team member from completing or reopening a task that requires review. The workspace approvals service separately restricts join/member-verification decisions to owner/admin and permission requests to the verified manager/owner/admin path.

The mobile `TaskDetailsScreen` does not treat the current user's generic role as sufficient. It uses the task response access object, team-lead lookup and server-confirmed mutation response. `ApprovalsScreen` derives categories from effective permissions/role and preserves the member-verification rejection warning.

| Case                                                                   | Evidence                                           | Status                         |
| ---------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------ |
| Permitted reviewer can perform the transition                          | Backend source and mobile status tests             | PASS (source/mock)             |
| Assigned team member cannot complete/reopen without reviewer authority | Backend controller branch and mobile display tests | PASS (source/mock)             |
| Creator/team lead reviewer behavior                                    | Backend controller/helper source                   | PASS (source); staging NOT RUN |
| Permission override respected                                          | Effective-permission helper and mobile fixtures    | PASS (source/tests)            |
| Already-reviewed/completed transition rejected when invalid            | Backend transition validation                      | PASS (source); live NOT RUN    |
| Direct API call cannot bypass reviewer checks                          | Backend controller is the enforcement point        | PASS (source); no live replay  |

The release evidence remains incomplete without approved staging role accounts and direct API contract tests. No mobile change grants reviewer authority.
