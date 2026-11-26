# Reviewer B-10 results

Backend source review found the `updateTask` Team-task guard in `src/controllers/taskController.js`: assignment is checked, assigned members may submit `in_review`, and direct completion/reopen by an assigned non-reviewer is rejected. Team Lead, creator and manager-plus paths are derived from the current backend branch; they were not assumed from the mobile role label.

| Scenario                                                | Expected from current backend                      | Actual evidence                                           | Status                              |
| ------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------- | ----------------------------------- |
| Assigned team member submits work                       | Allow `in_review` when task access permits         | Controller/source and backend contract coverage           | PASS (source/local)                 |
| Ordinary assigned member completes review-required work | Reject                                             | Controller guard; local task-status checks                | PASS (source/local)                 |
| Authorised reviewer completes submitted work            | Allow when current backend authority permits       | Source/contract path only                                 | NOT RUN (live)                      |
| Unauthorised member completes                           | Reject, no mutation                                | Source path and local contract checks                     | PASS (source/local); NOT RUN (live) |
| Authorised reviewer reopens                             | Allow when supported                               | Source/contract path only                                 | NOT RUN (live)                      |
| Unauthorised reopen                                     | Reject                                             | Source path                                               | PASS (source); NOT RUN (live)       |
| Creator reviewer action                                 | Follow actual authority branch                     | Source inspected; no live actor                           | NOT RUN (live)                      |
| Team Lead action                                        | Follow `isTeamLead` branch                         | Source inspected; no live actor                           | NOT RUN (live)                      |
| Manager/Admin/Owner action                              | Follow current controller rules, not assumed power | Source inspected; no live actor                           | NOT RUN (live)                      |
| Restricted permission transition                        | Reject                                             | Effective-permission and read-only guards covered locally | PASS (source/local); NOT RUN (live) |
| Invalid/repeated transition                             | Reject/no-op per current domain rules              | Contract/source checks                                    | PASS (source/local); NOT RUN (live) |
| Direct API bypass                                       | Backend must enforce independently of mobile UI    | Controller is enforcement point; no HTTP replay           | PASS (source); BLOCKED (live proof) |

B-10 is not resolved for release evidence. Live reviewer verification remains **BLOCKED**.
