# Task, project, team and file permission evidence

## Tasks

The backend list endpoint scopes ordinary members to tasks they created, own as an assignee, or have through `TaskAssignee`; `view_all_tasks` expands visibility but does not grant edit rights. Task detail access separately returns `canView`, `canEdit` and `readOnly`. Mobile swipe actions derive only from that access object:

- `status` requires `canEdit`.
- `edit` requires `canEdit` and `readOnly === false`.
- `watch` requires `canView`.
- zero access yields no action rail.

The mobile parser rejects malformed access and cross-workspace task records. Task mutations send the verified workspace and task identifiers and preserve server 403 responses.

## Status/review workflow

Backend `updateTask` enforces team-task rules independently of the mobile controls. Assigned team members may submit work for review, while completion/reopen and review transitions require the backend-authorized reviewer path. Mobile mirrors the verified team-lead/creator display rules but does not make the client the authority.

## Projects

`projectAccessService` allows workspace-visible projects, active project members, or users with effective `view_all_projects`. Project creation requires effective `create_projects` plus unrestricted governance. Adding project tasks uses the distinct `create_project_tasks` permission. Active project-member admin status is required for member-level project editing; removed membership is not accepted.

## Teams and files

Team screens are read-only where the mobile contract supports only listing. Task/project files use authenticated downloads; the client does not trust private provider URLs or expose tokens. Project file access remains workspace/project-authorized and is not inferred from general workspace membership.

## Status

PASS means source-backed mobile tests and parser/permission tests. Live staging role permutations, direct API replay and physical-device deep-link checks remain NOT RUN or BLOCKED as described in [blockers](./blockers.md).
