# Source-backed role and permission matrix

Sources inspected: backend `workspaceEffectivePermissions.js`, `workspaceRolePermissions.js`, `taskAccessService.js`, `projectAccessService.js`, task/project controllers and the mobile `AuthProvider`, task/project permission helpers.

| Identity/context        | Authoritative source                               | Verified behavior                                                                                                                             | Status                         |
| ----------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Owner                   | Active `CompanyMember.role = owner`                | Effective workspace permissions are all true; task/project governance still remains server-authoritative                                      | PASS (source/tests)            |
| Admin                   | Active membership + company role permission config | Defaults permit workspace operations, but company configuration/overrides are applied                                                         | PASS (source/tests)            |
| Manager                 | Active membership + effective permission config    | Defaults permit create tasks/projects/project tasks, upload, member view and assignment; view-all permissions are separate                    | PASS (source/tests)            |
| Member                  | Active membership + effective permission config    | Operations are disabled by default and require explicit effective permissions; task access may come from creator/assignee/team/view-all rules | PASS (source/tests)            |
| Guest                   | Active membership/resource access                  | Not an effective workspace-operation role; task/project access must come from the resource contract, not role assumptions                     | PASS (source)                  |
| External viewer         | Approved resource access                           | Read-only task access; no workspace operation assumptions                                                                                     | PASS (source)                  |
| Team lead               | Active team membership with `leadMemberId`         | Task detail access can be editable and backend status logic recognises team lead authority                                                    | PASS (source); staging NOT RUN |
| Explicit grant          | `WorkspaceUserPermission` override                 | Override replaces the role value for allowed permission keys                                                                                  | PASS (source/tests)            |
| Explicit restriction    | Revoked/false override                             | False effective value must remain false even when role default is true                                                                        | PASS (source/tests)            |
| Removed/inactive member | `CompanyMember.status != active`                   | Membership lookup fails; workspace/resource access must be denied                                                                             | PASS (source)                  |
| Suspended workspace     | Auth/workspace permission state and 423 handling   | Mobile redirects to `/workspace-suspended` and must not expose prior workspace content                                                        | PASS (mobile tests)            |

The mobile fixture intentionally does not encode a permanent role-to-permission policy. It tests the effective response shape and resource access object instead.
