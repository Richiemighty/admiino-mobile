# P17.2 role permissions and workspace security

Scope: mobile permission handling and source-backed access-control testing.
Baseline: `08f70faa733cec43af314a7c3d92edbd6aa40dc0`

The mobile client treats backend authorization as authoritative. UI visibility is tested as a usability boundary, while service/API tests verify that 401, 403, 404 and 423 responses are not converted into access.

Evidence:

- [Role and permission matrix](./role-permission-matrix.md)
- [Route and deep-link matrix](./route-access-matrix.md)
- [Task/project/team/file permissions](./task-project-permissions.md)
- [Reviewer B-10 findings](./reviewer-b10.md)
- [Test results](./test-results.md)
- [Blockers and external evidence](./blockers.md)

The phase added reusable role/access fixtures and a permission-matrix regression suite. No backend, production permission, database or account changes were made.
